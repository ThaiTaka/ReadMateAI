-- =====================================================================================
-- R06.3 — Reset điểm = bắt đầu mùa mới (backend). GAMIFICATION_SPEC §8.2, LEADERBOARD_SPEC §9, REDESIGN_ARCHITECTURE §7.3.
-- Không giao diện (R06.4). Không bảng game (R07–R09). Không sửa migration cũ.
--
-- Hợp đồng: teacher_reset_season(class, request_id, expected_season_id, confirmation) → { new_season_id, seq_no, replayed }.
--   * Chỉ chủ nhiệm (class_staff.role = 'owner') — kiểm tra bằng auth.uid() TRONG CSDL (co_teacher, học sinh, khách,
--     giáo viên lớp khác → FORBIDDEN). Hàm nội bộ không cấp cho client.
--   * confirmation phải khớp tên lớp thật (NFC, bỏ khoảng trắng hai đầu) — CSDL kiểm tra lại, không chỉ Server Action.
--   * expected_season_id = mùa GV đã thấy khi xác nhận. Khác mùa đang diễn ra → SEASON_MISMATCH: một xác nhận cũ
--     (hoặc hai request khác request_id cùng xác nhận một mùa) không bao giờ tạo hai mùa mới liên tiếp.
--   * request_id: gửi lại đúng bộ tham số → trả kết quả cũ (replayed = true), không reset lần hai; cùng request_id mà
--     khác lớp/mùa/GV → IDEMPOTENCY_CONFLICT.
--
-- Tuần tự hóa (thứ tự khóa cố định, tránh deadlock): lớp (FOR UPDATE) → mùa active (FOR UPDATE) → các dòng con.
-- Hàm ghi điểm R04 khóa mùa FOR SHARE trước mọi dòng con nên: ghi điểm đã vào trước thì reset đợi và thấy điểm đó
-- (đi vào hạng cuối); ghi điểm đến sau thì thấy mùa đã đóng → SEASON_CLOSED. Không mất điểm, không ghi nhầm mùa.
--
-- Một giao dịch: mọi lỗi giữa chừng hoàn tác toàn bộ. Không đụng item_attempts, point_events, mastery, honor snapshot,
-- lớp khác. Điểm mùa mới bắt đầu từ 0 vì season_scores gắn season_id (dòng được tạo khi học sinh ghi điểm lần đầu);
-- thẻ bản đồ (map_tile_reveals) và mở khóa game (game_unlocks) cũng gắn season_id nên tự "khóa lại".
-- QUY TẮC CHO R07–R09: mọi bảng trạng thái game PHẢI có season_id (khóa ngoại tới seasons) và hàm reset này phải đóng
-- (void) các lượt chơi/chạm trán còn dở của mùa cũ; trạng thái game của mùa cũ không bao giờ được dùng lại cho mùa mới.
-- =====================================================================================

alter table public.season_scores add column final_rank int null check (final_rank >= 1);
comment on column public.season_scores.final_rank is
  'Hạng cuối mùa theo điểm hiện tại, đồng hạng kiểu thi đấu 1-2-2-4 (như ranking.ts). Chỉ đặt khi đóng mùa; NULL khi mùa còn diễn ra.';

create table public.season_resets (
  request_id uuid primary key,
  class_id uuid not null references public.classes (id) on delete cascade,
  old_season_id uuid not null,
  new_season_id uuid not null,
  -- UUID giáo viên (như audit_logs.actor_id: không khóa ngoại để không chặn việc xóa tài khoản).
  performed_by uuid not null,
  performed_at timestamptz not null default now(),
  scored_students int not null check (scored_students >= 0),
  voided_questions int not null check (voided_questions >= 0),
  voided_sessions int not null check (voided_sessions >= 0),
  foreign key (old_season_id, class_id) references public.seasons (id, class_id) on delete cascade,
  foreign key (new_season_id, class_id) references public.seasons (id, class_id) on delete cascade,
  unique (old_season_id),
  unique (new_season_id)
);
comment on table public.season_resets is
  'Nhật ký reset mùa — bất biến. request_id là khóa ý định (gửi lại không reset hai lần); unique(old_season_id) bảo đảm một mùa chỉ được đóng bằng reset một lần.';
create index season_resets_class_idx on public.season_resets (class_id, performed_at desc);

create trigger season_resets_immutable before update or delete on public.season_resets
  for each row execute function private.block_direct_change();

alter table public.season_resets enable row level security;
create policy season_resets_staff_read on public.season_resets for select to authenticated
  using (class_id in (select private.my_class_ids()) or (select private.is_admin()));

revoke all on public.season_resets from public, anon, authenticated;
grant select on public.season_resets to authenticated;
grant all on public.season_resets to service_role;

-- -------------------------------------------------------------------------------------
-- Hàm thực hiện (nội bộ). Tự kiểm tra quyền bằng auth.uid() — không tin lớp gọi nó.
-- -------------------------------------------------------------------------------------
create or replace function private.reset_class_season(
  p_class_id uuid,
  p_request_id uuid,
  p_expected_season_id uuid,
  p_confirmation text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid;
  v_class public.classes;
  v_old public.seasons;
  v_new_id uuid;
  v_new_no int;
  v_prior public.season_resets;
  v_questions int;
  v_sessions int;
  v_scored int;
begin
  if p_class_id is null or p_request_id is null or p_expected_season_id is null or p_confirmation is null then
    raise exception 'INVALID_INPUT' using errcode = '22023';
  end if;
  -- (1) Quyền: CHỈ chủ nhiệm của lớp này (require_class_staff(…, true) kiểm tra staff đang hoạt động + owner).
  v_uid := private.require_class_staff(p_class_id, true);

  -- (2) Khóa lớp: mọi yêu cầu reset của lớp xếp hàng tại đây.
  select * into v_class from public.classes c where c.id = p_class_id for update;
  if v_class.id is null then
    raise exception 'NOT_FOUND' using errcode = '22023';
  end if;

  -- (3) Khóa ý định (sau khi đã giữ khóa lớp ⇒ hai request cùng request_id không chạy song song).
  select * into v_prior from public.season_resets r where r.request_id = p_request_id;
  if v_prior.request_id is not null then
    if v_prior.class_id <> p_class_id or v_prior.old_season_id <> p_expected_season_id or v_prior.performed_by <> v_uid then
      raise exception 'IDEMPOTENCY_CONFLICT' using errcode = '22023';
    end if;
    return jsonb_build_object(
      'new_season_id', v_prior.new_season_id,
      'seq_no', (select s.seq_no from public.seasons s where s.id = v_prior.new_season_id),
      'replayed', true
    );
  end if;

  if v_class.status <> 'active' then
    raise exception 'CLASS_ARCHIVED' using errcode = '22023';
  end if;

  -- (4) Xác nhận bằng tên lớp (kiểm tra lại ở CSDL).
  if normalize(btrim(p_confirmation), nfc) is distinct from normalize(btrim(v_class.name), nfc) then
    raise exception 'CONFIRMATION_MISMATCH' using errcode = '22023';
  end if;

  -- (5) Khóa mùa active (chặn ghi điểm song song — ghi điểm khóa FOR SHARE) và đối chiếu mùa đã xác nhận.
  select * into v_old from public.seasons s where s.class_id = p_class_id and s.status = 'active' for update;
  if v_old.id is null then
    raise exception 'SEASON_CLOSED' using errcode = '22023';
  end if;
  if v_old.id <> p_expected_season_id then
    raise exception 'SEASON_MISMATCH' using errcode = '22023';
  end if;

  -- (6) Hạng cuối: rank() = 1 + số người điểm cao hơn (1-2-2-4). Ghi cho mọi dòng điểm của mùa.
  update public.season_scores s set final_rank = r.rk
  from (
    select ss.student_id, rank() over (order by ss.balance desc) as rk
    from public.season_scores ss where ss.season_id = v_old.id
  ) r
  where s.season_id = v_old.id and s.student_id = r.student_id;
  get diagnostics v_scored = row_count;

  -- (7) Đóng câu phát hành còn mở và buổi luyện đang dở của mùa cũ — không trừ điểm, không ghi điểm.
  update public.question_instances q set status = 'void', closed_at = now()
  where q.season_id = v_old.id and q.status = 'open';
  get diagnostics v_questions = row_count;
  update public.practice_sessions p set status = 'void', ended_at = now()
  where p.season_id = v_old.id and p.status = 'in_progress';
  get diagnostics v_sessions = row_count;

  -- (8) Đóng mùa cũ, mở mùa mới (partial unique index đảm bảo đúng một mùa active mỗi lớp).
  update public.seasons set status = 'closed', ended_at = now(), closed_by = v_uid where id = v_old.id;
  v_new_no := v_old.seq_no + 1;
  insert into public.seasons (class_id, seq_no, status, rules_version, config, started_at, started_by)
  values (p_class_id, v_new_no, 'active', v_old.rules_version, v_old.config, now(), v_uid)
  returning id into v_new_id;

  -- (9) Nhật ký reset + audit (chỉ UUID/số liệu, không tên học sinh).
  insert into public.season_resets
    (request_id, class_id, old_season_id, new_season_id, performed_by, scored_students, voided_questions, voided_sessions)
  values (p_request_id, p_class_id, v_old.id, v_new_id, v_uid, v_scored, v_questions, v_sessions);
  perform private.write_audit('season.reset', 'season', v_new_id, p_class_id,
    jsonb_build_object('old_season_id', v_old.id, 'new_season_id', v_new_id, 'seq_no', v_new_no));

  return jsonb_build_object('new_season_id', v_new_id, 'seq_no', v_new_no, 'replayed', false);
end;
$$;

-- RPC cho giáo viên (JWT authenticated). Chỉ là vỏ: toàn bộ kiểm tra nằm trong hàm nội bộ.
create or replace function public.teacher_reset_season(
  p_class_id uuid,
  p_request_id uuid,
  p_expected_season_id uuid,
  p_confirmation text
)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select private.reset_class_season(p_class_id, p_request_id, p_expected_season_id, p_confirmation);
$$;

revoke all on function private.reset_class_season(uuid, uuid, uuid, text) from public, anon, authenticated;
grant execute on function private.reset_class_season(uuid, uuid, uuid, text) to service_role;
revoke all on function public.teacher_reset_season(uuid, uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.teacher_reset_season(uuid, uuid, uuid, text) to authenticated, service_role;
