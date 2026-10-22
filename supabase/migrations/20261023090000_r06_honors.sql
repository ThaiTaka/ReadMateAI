-- =====================================================================================
-- R06.1 — Vinh danh TOP 3 (backend): ảnh chụp bất biến, quyền, riêng tư.
-- (LEADERBOARD_SPEC §8, REDESIGN_ARCHITECTURE §7.4). Không giao diện, không reset mùa (R06.2/R06.3).
--
-- Mô hình:
--   honor_snapshots         — đầu ảnh chụp: lớp, mùa, người tạo, thời điểm. BẤT BIẾN.
--   honor_snapshot_entries  — các hàng được vinh danh (hạng 1–3, điểm > 0): hạng, tên hiển thị đã duyệt lúc chụp,
--                             avatar, điểm lúc chụp. BẤT BIẾN. Giữ student_id NỘI BỘ để lọc theo quyền hiện tại khi đọc.
--
-- Quyền riêng tư: bảng entries KHÔNG cấp SELECT cho authenticated (RLS bật, policy từ chối) — giáo viên chỉ đọc qua
-- teacher_get_honor_snapshot, hàm này LỌC lại mỗi lần đọc theo trạng thái hiện tại (đồng ý, tên hiển thị đã duyệt,
-- học sinh còn hoạt động) và không bao giờ trả student_id/class_id. Rút đồng ý sau khi chụp ⇒ lần đọc sau không còn
-- hàng đó; bản gốc vẫn nguyên trong CSDL (bất biến), xóa hồ sơ học sinh xóa hàng theo dây chuyền (quyền xóa dữ liệu).
--
-- Xếp hạng: rank() = 1 + số người điểm cao hơn — đúng định nghĩa của Ranking Engine R05 (ranking.ts: 1,2,2,4);
-- tính ở CSDL để GV không thể gửi hạng/điểm tự bịa qua RPC. Kiểm thử tích hợp đối chiếu với rankScores().
-- Không sửa migration cũ. Mọi hàm security definer, search_path rỗng, quyền thực thi tường minh.
-- =====================================================================================

create table public.honor_snapshots (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes (id) on delete cascade,
  season_id uuid not null,
  season_no smallint not null check (season_no >= 1),
  -- UUID giáo viên tạo (như audit_logs.actor_id: không khóa ngoại để không chặn việc xóa tài khoản).
  created_by uuid not null,
  created_at timestamptz not null default now(),
  foreign key (season_id, class_id) references public.seasons (id, class_id) on delete cascade
);
comment on table public.honor_snapshots is
  'Ảnh chụp vinh danh TOP 3 — bất biến. Điểm số/mùa không bị thay đổi khi chụp.';
create index honor_snapshots_class_idx on public.honor_snapshots (class_id, created_at desc);
create index honor_snapshots_season_idx on public.honor_snapshots (season_id, class_id);

create table public.honor_snapshot_entries (
  snapshot_id uuid not null references public.honor_snapshots (id) on delete cascade,
  student_id uuid not null,
  class_id uuid not null,
  rank smallint not null check (rank between 1 and 3),
  position smallint not null check (position >= 1),
  alias text not null check (char_length(alias) between 1 and 20),
  avatar_key text not null check (avatar_key ~ '^[a-z][a-z0-9-]{0,39}$'),
  points int not null check (points > 0),
  primary key (snapshot_id, student_id),
  foreign key (student_id, class_id) references public.students (id, class_id) on delete cascade
);
comment on table public.honor_snapshot_entries is
  'Hàng vinh danh: rank 1–3, điểm > 0. Chỉ đọc qua teacher_get_honor_snapshot (lọc theo quyền hiện tại).';
create index honor_snapshot_entries_student_idx on public.honor_snapshot_entries (student_id, class_id);
create index honor_snapshot_entries_class_idx on public.honor_snapshot_entries (class_id);

create trigger honor_snapshots_immutable before update or delete on public.honor_snapshots
  for each row execute function private.block_direct_change();
create trigger honor_snapshot_entries_immutable before update or delete on public.honor_snapshot_entries
  for each row execute function private.block_direct_change();

alter table public.honor_snapshots enable row level security;
alter table public.honor_snapshot_entries enable row level security;

create policy honor_snapshots_staff_read on public.honor_snapshots for select to authenticated
  using (class_id in (select private.my_class_ids()) or (select private.is_admin()));
-- Từ chối tường minh: người dùng không đọc thẳng bảng hàng (thiếu cả GRANT); đọc qua hàm đã lọc.
create policy honor_snapshot_entries_no_direct_read on public.honor_snapshot_entries for select to authenticated
  using (false);

-- -------------------------------------------------------------------------------------
-- Quyền: chủ nhiệm (owner) hoặc co_teacher có can_honor.
-- -------------------------------------------------------------------------------------
create or replace function private.require_honor_staff(p_class_id uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_staff();
begin
  if not exists (
    select 1 from public.class_staff cs
    where cs.class_id = p_class_id and cs.staff_id = v_uid and cs.removed_at is null
      and (cs.role = 'owner' or cs.can_honor)
  ) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  return v_uid;
end;
$$;

-- Hàng còn được phép hiển thị theo trạng thái HIỆN TẠI: học sinh còn hoạt động, tên hiển thị hiện tại vẫn là tên đã
-- duyệt lúc chụp, và còn cả hai đồng ý. Thiếu một điều kiện ⇒ ẩn (không báo lý do, không đếm số bị ẩn).
create or replace function private.honor_entry_visible(p_student_id uuid, p_alias text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.students st
    where st.id = p_student_id
      and st.status = 'active'
      and st.leaderboard_alias is not distinct from p_alias
      and st.leaderboard_alias_approved_at is not null
      and private.consent_active(st.id, 'learning_data')
      and private.consent_active(st.id, 'leaderboard_display')
  );
$$;

-- -------------------------------------------------------------------------------------
-- Giáo viên chủ nhiệm: bật/tắt vinh danh cho lớp. Bật chỉ được khi cờ hệ thống honors_feature_approved bật
-- (trigger guard_class → HONORS_NOT_APPROVED). Tắt luôn được.
-- -------------------------------------------------------------------------------------
create or replace function public.teacher_set_honors_enabled(p_class_id uuid, p_enabled boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_class public.classes;
begin
  perform private.require_class_staff(p_class_id, true);
  if p_enabled is null then
    raise exception 'INVALID_INPUT' using errcode = '22023';
  end if;
  select * into v_class from public.classes c where c.id = p_class_id for update;
  if v_class.status <> 'active' then
    raise exception 'CLASS_ARCHIVED' using errcode = '22023';
  end if;
  update public.classes set honors_enabled = p_enabled where id = p_class_id;
  perform private.write_audit('honors.configure', 'class', p_class_id, p_class_id,
    jsonb_build_object('enabled', p_enabled));
end;
$$;

-- -------------------------------------------------------------------------------------
-- Tạo ảnh chụp: một giao dịch. Không đổi điểm, không đổi mùa. Không tạo ảnh chụp rỗng.
-- -------------------------------------------------------------------------------------
create or replace function public.teacher_create_honor_snapshot(p_class_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_honor_staff(p_class_id);
  v_class public.classes;
  v_season public.seasons;
  v_id uuid;
  v_count int;
begin
  -- Khóa dòng lớp: tuần tự hóa với đổi cấu hình/lưu trữ lớp.
  select * into v_class from public.classes c where c.id = p_class_id for update;
  if v_class.status <> 'active' then
    raise exception 'CLASS_ARCHIVED' using errcode = '22023';
  end if;
  if not v_class.honors_enabled or not private.feature_enabled('honors_feature_approved') then
    raise exception 'HONORS_DISABLED' using errcode = '22023';
  end if;
  select * into v_season from public.seasons s where s.class_id = p_class_id and s.status = 'active';
  if v_season.id is null then
    raise exception 'SEASON_CLOSED' using errcode = '22023';
  end if;

  insert into public.honor_snapshots (class_id, season_id, season_no, created_by)
  values (p_class_id, v_season.id, v_season.seq_no, v_uid)
  returning id into v_id;

  -- Một câu lệnh đọc nhất quán: học sinh đủ điều kiện hiển thị (cùng bộ lọc với bảng xếp hạng), rank() kiểu thi đấu,
  -- chỉ hạng ≤ 3 và điểm > 0. Thứ tự đọc trong cùng bậc: đạt điểm sớm hơn → tên → mã (ổn định).
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
    -- Hủy cả giao dịch (kể cả đầu ảnh chụp vừa chèn): không có ảnh chụp rỗng.
    raise exception 'NO_HONOREES' using errcode = '22023';
  end if;

  perform private.write_audit('honors.snapshot_create', 'honor_snapshot', v_id, p_class_id,
    jsonb_build_object('season_id', v_season.id, 'entries', v_count));
  return v_id;
end;
$$;

-- -------------------------------------------------------------------------------------
-- Đọc: dữ liệu lấy từ ảnh chụp đã lưu (không tính lại hạng/điểm), lọc theo quyền hiện tại, không có mã định danh.
-- -------------------------------------------------------------------------------------
create or replace function public.teacher_get_honor_snapshot(p_snapshot_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_snap public.honor_snapshots;
  v_class public.classes;
  v_rows jsonb;
begin
  select * into v_snap from public.honor_snapshots h where h.id = p_snapshot_id;
  if v_snap.id is null then
    perform private.require_staff();
    raise exception 'NOT_FOUND' using errcode = '22023';
  end if;
  perform private.require_class_staff(v_snap.class_id);
  if not private.feature_enabled('honors_feature_approved') then
    raise exception 'HONORS_DISABLED' using errcode = '22023';
  end if;
  select * into v_class from public.classes c where c.id = v_snap.class_id;
  select coalesce(jsonb_agg(jsonb_build_object(
           'rank', e.rank,
           'alias', e.alias,
           'avatar_key', e.avatar_key,
           'points', e.points) order by e.rank, e.position), '[]'::jsonb)
    into v_rows
  from public.honor_snapshot_entries e
  where e.snapshot_id = v_snap.id and private.honor_entry_visible(e.student_id, e.alias);
  return jsonb_build_object(
    'id', v_snap.id,
    'season_no', v_snap.season_no,
    'class_name', v_class.name,
    'created_at', v_snap.created_at,
    'entries', v_rows);
end;
$$;

create or replace function public.teacher_list_honor_snapshots(p_class_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_class_staff(p_class_id);
  if not private.feature_enabled('honors_feature_approved') then
    raise exception 'HONORS_DISABLED' using errcode = '22023';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', h.id, 'season_no', h.season_no, 'created_at', h.created_at)
                     order by h.created_at desc)
    from public.honor_snapshots h where h.class_id = p_class_id
  ), '[]'::jsonb);
end;
$$;

-- =====================================================================================
-- Quyền
-- =====================================================================================

revoke all on public.honor_snapshots, public.honor_snapshot_entries from public, anon, authenticated;
grant select on public.honor_snapshots to authenticated;
grant all on public.honor_snapshots, public.honor_snapshot_entries to service_role;

revoke all on function
  public.teacher_set_honors_enabled(uuid, boolean),
  public.teacher_create_honor_snapshot(uuid),
  public.teacher_get_honor_snapshot(uuid),
  public.teacher_list_honor_snapshots(uuid)
from public, anon, authenticated;
grant execute on function
  public.teacher_set_honors_enabled(uuid, boolean),
  public.teacher_create_honor_snapshot(uuid),
  public.teacher_get_honor_snapshot(uuid),
  public.teacher_list_honor_snapshots(uuid)
to authenticated, service_role;

revoke all on function private.require_honor_staff(uuid), private.honor_entry_visible(uuid, text)
from public, anon, authenticated;
grant execute on function private.require_honor_staff(uuid), private.honor_entry_visible(uuid, text) to service_role;
