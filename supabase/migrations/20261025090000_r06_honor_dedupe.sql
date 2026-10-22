-- =====================================================================================
-- R06.5 — Chống tạo ảnh chụp vinh danh trùng + API vinh danh cho học sinh.
--
-- Chống trùng (tại CSDL, không chỉ khóa nút ở giao diện):
--   * honor_snapshot_requests: khóa ý định request_id → snapshot. Cùng request_id gửi lại ⇒ trả cùng snapshot, không tạo
--     thêm; cùng request_id nhưng khác lớp/người tạo ⇒ IDEMPOTENCY_CONFLICT. Request_id gắn với CẢ yêu cầu được tạo mới
--     lẫn yêu cầu bị gộp (để thử lại sau khoảng chống lặp vẫn trả đúng snapshot cũ, không tạo thêm).
--   * Khóa dòng lớp (FOR UPDATE) tuần tự hóa mọi yêu cầu của cùng lớp ⇒ hai yêu cầu đồng thời không chạy song song.
--   * Khoảng chống lặp (mặc định 15 giây, private.honor_settings): yêu cầu KHÁC request_id mà lớp vừa có ảnh chụp trong
--     khoảng đó (hai tab/thiết bị bấm gần như cùng lúc) ⇒ trả ảnh chụp vừa tạo, không tạo ảnh thứ hai. Sau khoảng
--     này, giáo viên vẫn chủ động vinh danh lần mới được.
--   * Không sửa ảnh chụp cũ, điểm, mùa, lịch sử. Đường gọi cũ teacher_create_honor_snapshot(uuid) bị gỡ (không có khóa ý định).
--
-- Học sinh xem lần vinh danh gần nhất: gateway_latest_honors (chỉ service_role). Lớp suy ra từ thiết bị đã liên kết.
-- =====================================================================================

create table private.honor_settings (
  singleton boolean primary key default true check (singleton),
  dedupe_seconds int not null default 15 check (dedupe_seconds between 0 and 600)
);
insert into private.honor_settings default values;
revoke all on private.honor_settings from public, anon, authenticated;
grant all on private.honor_settings to service_role;
comment on table private.honor_settings is
  'Khoảng chống lặp tạo ảnh chụp vinh danh (giây). Chỉ đổi ở môi trường kiểm thử local.';

create table public.honor_snapshot_requests (
  request_id uuid primary key,
  class_id uuid not null references public.classes (id) on delete cascade,
  snapshot_id uuid not null references public.honor_snapshots (id) on delete cascade,
  requested_by uuid not null,
  deduplicated boolean not null,
  created_at timestamptz not null default now()
);
comment on table public.honor_snapshot_requests is
  'Khóa ý định tạo ảnh chụp vinh danh — bất biến. deduplicated = yêu cầu bị gộp vào ảnh chụp vừa có trong khoảng chống lặp.';
create index honor_snapshot_requests_snapshot_idx on public.honor_snapshot_requests (snapshot_id);
create index honor_snapshot_requests_class_idx on public.honor_snapshot_requests (class_id);

create trigger honor_snapshot_requests_immutable before update or delete on public.honor_snapshot_requests
  for each row execute function private.block_direct_change();

alter table public.honor_snapshot_requests enable row level security;
create policy honor_snapshot_requests_no_direct_read on public.honor_snapshot_requests for select to authenticated
  using (false);
revoke all on public.honor_snapshot_requests from public, anon, authenticated;
grant all on public.honor_snapshot_requests to service_role;

-- Gỡ đường gọi cũ (không có khóa ý định ⇒ có thể bỏ qua cơ chế chống trùng).
drop function public.teacher_create_honor_snapshot(uuid);

create or replace function public.teacher_create_honor_snapshot(p_class_id uuid, p_request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid;
  v_class public.classes;
  v_season public.seasons;
  v_prior public.honor_snapshot_requests;
  v_recent uuid;
  v_id uuid;
  v_count int;
begin
  if p_class_id is null or p_request_id is null then
    raise exception 'INVALID_INPUT' using errcode = '22023';
  end if;
  v_uid := private.require_honor_staff(p_class_id);

  -- Khóa dòng lớp: mọi yêu cầu vinh danh của lớp xếp hàng tại đây (và tuần tự hóa với đổi cấu hình/lưu trữ lớp).
  select * into v_class from public.classes c where c.id = p_class_id for update;

  -- Khóa ý định (sau khi giữ khóa lớp ⇒ hai yêu cầu cùng request_id không chạy song song).
  select * into v_prior from public.honor_snapshot_requests r where r.request_id = p_request_id;
  if v_prior.request_id is not null then
    if v_prior.class_id <> p_class_id or v_prior.requested_by <> v_uid then
      raise exception 'IDEMPOTENCY_CONFLICT' using errcode = '22023';
    end if;
    return jsonb_build_object('snapshot_id', v_prior.snapshot_id, 'replayed', true,
                              'deduplicated', v_prior.deduplicated);
  end if;

  if v_class.status <> 'active' then
    raise exception 'CLASS_ARCHIVED' using errcode = '22023';
  end if;
  if not v_class.honors_enabled or not private.feature_enabled('honors_feature_approved') then
    raise exception 'HONORS_DISABLED' using errcode = '22023';
  end if;

  -- Khoảng chống lặp: lớp vừa có ảnh chụp ⇒ gộp, ghi nhớ request_id này trỏ về ảnh chụp đó.
  select h.id into v_recent
  from public.honor_snapshots h
  where h.class_id = p_class_id
    and h.created_at > clock_timestamp() - make_interval(secs => (select s.dedupe_seconds from private.honor_settings s))
  order by h.created_at desc
  limit 1;
  if v_recent is not null then
    insert into public.honor_snapshot_requests (request_id, class_id, snapshot_id, requested_by, deduplicated)
    values (p_request_id, p_class_id, v_recent, v_uid, true);
    return jsonb_build_object('snapshot_id', v_recent, 'replayed', false, 'deduplicated', true);
  end if;

  select * into v_season from public.seasons s where s.class_id = p_class_id and s.status = 'active';
  if v_season.id is null then
    raise exception 'SEASON_CLOSED' using errcode = '22023';
  end if;

  insert into public.honor_snapshots (class_id, season_id, season_no, created_by)
  values (p_class_id, v_season.id, v_season.seq_no, v_uid)
  returning id into v_id;

  -- Nội dung ảnh chụp: như R06.1 (cùng bộ lọc với bảng xếp hạng, rank() kiểu thi đấu, hạng ≤ 3 và điểm > 0).
  with ranked as (
    select r.student_id, r.alias, r.avatar_key, r.points, r.reached_at,
           rank() over (order by r.points desc) as rk
    from private.leaderboard_rows(p_class_id) r
  )
  insert into public.honor_snapshot_entries (snapshot_id, student_id, class_id, rank, position, alias, avatar_key, points)
  select v_id, x.student_id, p_class_id, x.rk, row_number() over (order by x.rk, x.reached_at nulls last, x.alias, x.student_id),
         x.alias, x.avatar_key, x.points
  from ranked x
  where x.rk <= 3 and x.points > 0;
  get diagnostics v_count = row_count;

  if v_count = 0 then
    -- Hủy cả giao dịch: không có ảnh chụp rỗng, không ghi nhớ request_id.
    raise exception 'NO_HONOREES' using errcode = '22023';
  end if;

  insert into public.honor_snapshot_requests (request_id, class_id, snapshot_id, requested_by, deduplicated)
  values (p_request_id, p_class_id, v_id, v_uid, false);

  perform private.write_audit('honors.snapshot_create', 'honor_snapshot', v_id, p_class_id,
    jsonb_build_object('season_id', v_season.id, 'entries', v_count));
  return jsonb_build_object('snapshot_id', v_id, 'replayed', false, 'deduplicated', false);
end;
$$;

-- -------------------------------------------------------------------------------------
-- Học sinh: lần vinh danh gần nhất của lớp CỦA MÌNH. Lớp suy ra từ thiết bị đã liên kết (không nhận class/season).
-- Mọi trường hợp không được xem (cờ hệ thống/cờ lớp tắt, thiếu đồng ý học tập của chính học sinh) ⇒ 'disabled' không kèm
-- dữ liệu. Hàng hiển thị lọc lại ở MỖI lần đọc (đồng ý, tên hiển thị đã duyệt, học sinh hoạt động). Không trả mã định
-- danh, nhóm năng lực, số hàng bị ẩn hay lý do.
-- -------------------------------------------------------------------------------------
create or replace function public.gateway_latest_honors(p_auth_user_id uuid, p_student_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_class_id uuid := private.require_linked_device(p_auth_user_id, p_student_id);
  v_class public.classes;
  v_snap public.honor_snapshots;
  v_rows jsonb;
begin
  select * into v_class from public.classes c where c.id = v_class_id;
  if not v_class.honors_enabled
     or not private.feature_enabled('honors_feature_approved')
     or not private.consent_active(p_student_id, 'learning_data') then
    return jsonb_build_object('status', 'disabled');
  end if;
  select * into v_snap from public.honor_snapshots h
  where h.class_id = v_class_id order by h.created_at desc, h.id limit 1;
  if v_snap.id is null then
    return jsonb_build_object('status', 'none');
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
           'rank', e.rank,
           'alias', e.alias,
           'avatar_key', e.avatar_key,
           'points', e.points) order by e.rank, e.position), '[]'::jsonb)
    into v_rows
  from public.honor_snapshot_entries e
  where e.snapshot_id = v_snap.id and private.honor_entry_visible(e.student_id, e.alias);
  return jsonb_build_object(
    'status', 'ok',
    'season_no', v_snap.season_no,
    'created_at', v_snap.created_at,
    'entries', v_rows);
end;
$$;

revoke all on function public.teacher_create_honor_snapshot(uuid, uuid) from public, anon, authenticated;
grant execute on function public.teacher_create_honor_snapshot(uuid, uuid) to authenticated, service_role;
revoke all on function public.gateway_latest_honors(uuid, uuid) from public, anon, authenticated;
grant execute on function public.gateway_latest_honors(uuid, uuid) to service_role;
