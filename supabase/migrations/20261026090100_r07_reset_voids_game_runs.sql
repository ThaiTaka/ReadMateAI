-- =====================================================================================
-- R07.5a — Reset mùa (R06.3) đóng cả lượt chơi game còn dở. Thay private.reset_class_season bằng migration MỚI (không sửa migration cũ).
-- Chỉ thêm bước (7b): game_runs in_progress của mùa cũ → void_season_reset (cùng giao dịch, cùng thứ tự khóa:
-- lớp → mùa → dòng con). Hợp đồng trả về, idempotency (request_id) và mọi kiểm tra quyền giữ nguyên.
-- QUY TẮC R08: game_encounters/question_instances của lượt bị void cũng phải được đóng trong hàm này.
-- =====================================================================================

alter table public.season_resets add column voided_game_runs int not null default 0 check (voided_game_runs >= 0);

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
  v_runs int;
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
  -- (7b) R07.5a: lượt chơi game còn dở của mùa cũ → void_season_reset (giữ lịch sử, chỉ lớp này, cùng giao dịch).
  -- Lưu vị trí khóa mùa FOR SHARE trước dòng lượt chơi nên chờ reset rồi nhận SEASON_CLOSED.
  update public.game_runs g set status = 'void_season_reset', ended_at = now()
  where g.season_id = v_old.id and g.status = 'in_progress';
  get diagnostics v_runs = row_count;

  -- (8) Đóng mùa cũ, mở mùa mới (partial unique index đảm bảo đúng một mùa active mỗi lớp).
  update public.seasons set status = 'closed', ended_at = now(), closed_by = v_uid where id = v_old.id;
  v_new_no := v_old.seq_no + 1;
  insert into public.seasons (class_id, seq_no, status, rules_version, config, started_at, started_by)
  values (p_class_id, v_new_no, 'active', v_old.rules_version, v_old.config, now(), v_uid)
  returning id into v_new_id;

  -- (9) Nhật ký reset + audit (chỉ UUID/số liệu, không tên học sinh).
  insert into public.season_resets
    (request_id, class_id, old_season_id, new_season_id, performed_by, scored_students, voided_questions, voided_sessions, voided_game_runs)
  values (p_request_id, p_class_id, v_old.id, v_new_id, v_uid, v_scored, v_questions, v_sessions, v_runs);
  perform private.write_audit('season.reset', 'season', v_new_id, p_class_id,
    jsonb_build_object('old_season_id', v_old.id, 'new_season_id', v_new_id, 'seq_no', v_new_no));

  return jsonb_build_object('new_season_id', v_new_id, 'seq_no', v_new_no, 'replayed', false);
end;
$$;
