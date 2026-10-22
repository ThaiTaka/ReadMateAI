-- =====================================================================================
-- R04 — Hàm ghi điểm, phát câu, mở thẻ bản đồ. Đường GHI DUY NHẤT vào các bảng của migration 090000.
--
--   * gateway_* : CHỈ service_role (student gateway của Next.js) gọi, SAU KHI máy chủ đã xác minh phiên thiết bị
--                 bằng getClaims(). Hàm vẫn tự kiểm tra lại liên kết thiết bị ↔ học sinh, đồng ý learning_data,
--                 mùa đang diễn ra (phòng thủ nhiều lớp). student_id KHÔNG BAO GIỜ lấy từ trình duyệt: với lượt trả
--                 lời, học sinh suy ra từ câu phát hành; với buổi luyện/thẻ bản đồ, máy chủ đã đối chiếu danh sách
--                 học sinh mà RLS trả cho JWT của thiết bị.
--   * Kết quả đúng/sai do MÁY CHỦ chấm (runtime.ts GĐ4) rồi truyền vào; trình duyệt không gửi điểm hay is_correct.
--   * Thứ tự khóa cố định (chống deadlock, tương thích reset mùa R06): mùa (FOR SHARE) → câu phát hành (FOR UPDATE)
--     → điểm mùa của học sinh (FOR UPDATE). Reset mùa (R06) khóa mùa FOR UPDATE → nộp bài song song chờ rồi nhận
--     SEASON_CLOSED.
-- Mã lỗi: message là mã máy đọc; máy chủ ánh xạ sang câu chữ tiếng Việt (src/server/result.ts).
-- =====================================================================================

-- Thiết bị (người dùng ẩn danh) đang liên kết với học sinh, học sinh và lớp đang hoạt động → class_id.
create or replace function private.require_linked_device(p_auth_user_id uuid, p_student_id uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_class_id uuid;
begin
  select st.class_id into v_class_id
  from public.student_devices d
  join public.students st on st.id = d.student_id
  join public.classes c on c.id = st.class_id
  where d.auth_user_id = p_auth_user_id and d.student_id = p_student_id and d.revoked_at is null
    and st.status = 'active' and c.status = 'active'
  limit 1;
  if v_class_id is null then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  return v_class_id;
end;
$$;

-- Dòng điểm mùa (tạo lần đầu có sự kiện — học sinh vào giữa mùa bắt đầu từ 0) rồi khóa nó.
create or replace function private.lock_season_score(p_season_id uuid, p_student_id uuid, p_class_id uuid)
returns public.season_scores
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_score public.season_scores;
begin
  insert into public.season_scores (season_id, student_id, class_id)
  values (p_season_id, p_student_id, p_class_id)
  on conflict (season_id, student_id) do nothing;
  select s.* into v_score from public.season_scores s
  where s.season_id = p_season_id and s.student_id = p_student_id
  for update;
  return v_score;
end;
$$;

-- Kết quả có kiểu của một lượt (dùng cho cả lần ghi đầu và lần gửi lại cùng clientAttemptId).
create or replace function private.attempt_result(p_attempt_id uuid, p_outcome text, p_unlocked text[])
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'outcome', p_outcome,
    'attemptId', a.id,
    'attemptNo', a.attempt_no,
    'isCorrect', a.is_correct,
    'errorTags', to_jsonb(a.error_tags),
    'marks', a.marks,
    'response', a.response,
    'question', jsonb_build_object(
      'id', q.id, 'status', q.status, 'attemptsUsed', q.attempts_used, 'maxAttempts', q.max_attempts,
      'scorable', q.scorable, 'rewarded', q.rewarded, 'supportLevel', q.support_level,
      'practiceSessionId', q.practice_session_id, 'position', q.position),
    'points', (
      select jsonb_build_object('nominalDelta', e.nominal_delta, 'appliedDelta', e.applied_delta,
                                'balanceBefore', e.balance_before, 'balanceAfter', e.balance_after)
      from public.point_events e where e.item_attempt_id = a.id),
    'score', coalesce((
      select jsonb_build_object('balance', s.balance, 'earnedTotal', s.earned_total, 'deductedTotal', s.deducted_total)
      from public.season_scores s where s.season_id = q.season_id and s.student_id = q.student_id),
      jsonb_build_object('balance', 0, 'earnedTotal', 0, 'deductedTotal', 0)),
    'sessionStatus', (select p.status from public.practice_sessions p where p.id = q.practice_session_id),
    'newlyUnlockedGames', to_jsonb(coalesce(p_unlocked, '{}'::text[]))
  )
  from public.item_attempts a
  join public.question_instances q on q.id = a.question_instance_id
  where a.id = p_attempt_id;
$$;

-- =====================================================================================
-- Ghi một lượt đã chấm (GAMIFICATION_SPEC §4.1, §5, §9) — MỘT giao dịch
-- =====================================================================================

create or replace function private.record_graded_attempt(
  p_auth_user_id uuid,
  p_question_instance_id uuid,
  p_client_attempt_id uuid,
  p_response jsonb,
  p_response_key text,
  p_request_hash text,
  p_is_correct boolean,
  p_error_tags text[],
  p_marks jsonb,
  p_grader_version text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_qi public.question_instances;
  v_attempt public.item_attempts;
  v_season_status text;
  v_rules_version text;
  v_rules private.scoring_rules;
  v_score public.season_scores;
  v_attempt_no smallint;
  v_status text;
  v_nominal int;
  v_after int;
  v_applied int;
  v_unlocked text[] := '{}'::text[];
begin
  if p_client_attempt_id is null or p_response is null or p_response_key is null or p_request_hash is null
     or p_is_correct is null then
    raise exception 'INVALID_INPUT' using errcode = '22023';
  end if;

  -- (1) Câu + thiết bị: học sinh suy ra từ câu phát hành; thiết bị phải đang liên kết với đúng học sinh đó.
  select q.* into v_qi from public.question_instances q where q.id = p_question_instance_id;
  if v_qi.id is null then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  perform private.require_linked_device(p_auth_user_id, v_qi.student_id);

  -- (2) Khóa ý định: lượt đã ghi → trả kết quả cũ (không lượt mới, không điểm mới); nội dung khác → xung đột.
  select a.* into v_attempt from public.item_attempts a where a.client_attempt_id = p_client_attempt_id;
  if v_attempt.id is not null then
    if v_attempt.question_instance_id <> p_question_instance_id or v_attempt.request_hash <> p_request_hash then
      raise exception 'IDEMPOTENCY_CONFLICT' using errcode = '22023';
    end if;
    return private.attempt_result(v_attempt.id, 'replayed', '{}');
  end if;

  -- (3) Đồng ý thu dữ liệu học tập còn hiệu lực.
  if not private.consent_active(v_qi.student_id, 'learning_data') then
    raise exception 'CONSENT_REQUIRED' using errcode = '42501';
  end if;

  -- (4) Mùa đang diễn ra — khóa CHIA SẺ (reset mùa R06 khóa độc quyền).
  select s.status, s.rules_version into v_season_status, v_rules_version
  from public.seasons s where s.id = v_qi.season_id for share;
  if v_season_status is distinct from 'active' then
    raise exception 'SEASON_CLOSED' using errcode = '22023';
  end if;

  -- (5) Khóa câu; kiểm tra lại khóa ý định (hai request cùng clientAttemptId chạy song song).
  select q.* into v_qi from public.question_instances q where q.id = p_question_instance_id for update;
  select a.* into v_attempt from public.item_attempts a where a.client_attempt_id = p_client_attempt_id;
  if v_attempt.id is not null then
    if v_attempt.question_instance_id <> p_question_instance_id or v_attempt.request_hash <> p_request_hash then
      raise exception 'IDEMPOTENCY_CONFLICT' using errcode = '22023';
    end if;
    return private.attempt_result(v_attempt.id, 'replayed', '{}');
  end if;

  -- (6) Câu còn mở, còn lượt, câu trả lời khác các lần trước.
  if v_qi.status <> 'open' then
    raise exception 'QUESTION_CLOSED' using errcode = '22023';
  end if;
  if v_qi.attempts_used >= v_qi.max_attempts then
    raise exception 'NO_ATTEMPTS_LEFT' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.item_attempts a
    where a.question_instance_id = v_qi.id and a.response_key = p_response_key
  ) then
    raise exception 'DUPLICATE_RESPONSE' using errcode = '22023';
  end if;

  -- (7) Ghi lượt trả lời.
  v_attempt_no := v_qi.attempts_used + 1;
  insert into public.item_attempts (
    question_instance_id, student_id, class_id, season_id, exercise_item_id, attempt_no, client_attempt_id,
    request_hash, response, response_key, is_correct, error_tags, marks, support_level, scorable, grader_version
  ) values (
    v_qi.id, v_qi.student_id, v_qi.class_id, v_qi.season_id, v_qi.exercise_item_id, v_attempt_no,
    p_client_attempt_id, p_request_hash, p_response, p_response_key, p_is_correct,
    coalesce(p_error_tags, '{}'), coalesce(p_marks, '{}'), v_qi.support_level, v_qi.scorable, p_grader_version
  ) returning * into v_attempt;

  v_status := case
    when p_is_correct then 'correct'
    when v_attempt_no >= v_qi.max_attempts then 'exhausted'
    else 'open'
  end;

  -- (8) Câu tính điểm: sổ cái + điểm mùa (sàn 0 tại từng sự kiện) + dấu mở khóa game lần đầu đạt ngưỡng.
  if v_qi.scorable then
    select r.* into v_rules from private.scoring_rules r where r.version = v_rules_version;
    if v_rules.version is null then
      raise exception 'RULES_NOT_FOUND' using errcode = '22023';
    end if;
    v_score := private.lock_season_score(v_qi.season_id, v_qi.student_id, v_qi.class_id);
    v_nominal := case when p_is_correct then v_rules.points_correct else v_rules.points_incorrect end;
    v_after := greatest(v_rules.balance_floor, v_score.balance + v_nominal);
    v_applied := v_after - v_score.balance;

    update public.season_scores s
      set balance = v_after,
          earned_total = s.earned_total + greatest(v_nominal, 0),
          deducted_total = s.deducted_total + greatest(-v_applied, 0),
          balance_updated_at = now(),
          updated_at = now()
      where s.season_id = v_qi.season_id and s.student_id = v_qi.student_id
      returning * into v_score;

    insert into public.point_events (
      season_id, student_id, class_id, question_instance_id, item_attempt_id, attempt_no, outcome,
      nominal_delta, applied_delta, balance_before, balance_after, earned_total_after, rules_version, idempotency_key
    ) values (
      v_qi.season_id, v_qi.student_id, v_qi.class_id, v_qi.id, v_attempt.id, v_attempt_no,
      case when p_is_correct then 'correct' else 'incorrect' end,
      v_nominal, v_applied, v_after - v_applied, v_after, v_score.earned_total, v_rules.version,
      v_qi.id::text || ':' || v_attempt_no::text
    );

    with inserted as (
      insert into public.game_unlocks (season_id, student_id, game_key, class_id, balance_at_unlock)
      select v_qi.season_id, v_qi.student_id, g.key, v_qi.class_id, v_after
      from jsonb_each_text(v_rules.game_min_balance) g
      where g.value::int <= v_after
      on conflict (season_id, student_id, game_key) do nothing
      returning game_key
    )
    select coalesce(array_agg(game_key order by game_key), '{}') into v_unlocked from inserted;
  end if;

  -- (9) Cập nhật câu: đóng khi đúng hoặc hết lượt.
  update public.question_instances q
    set attempts_used = v_attempt_no,
        status = v_status,
        closed_at = case when v_status <> 'open' then now() else null end,
        rewarded = (v_qi.scorable and p_is_correct)
    where q.id = v_qi.id;

  -- (10) Buổi luyện xong khi mọi câu đã đóng.
  if v_status <> 'open' and v_qi.practice_session_id is not null and not exists (
    select 1 from public.question_instances q
    where q.practice_session_id = v_qi.practice_session_id and q.status = 'open'
  ) then
    update public.practice_sessions p set status = 'completed', ended_at = now()
      where p.id = v_qi.practice_session_id and p.status = 'in_progress';
  end if;

  return private.attempt_result(v_attempt.id, 'recorded', v_unlocked);
end;
$$;

create or replace function public.gateway_record_attempt(
  p_auth_user_id uuid,
  p_question_instance_id uuid,
  p_client_attempt_id uuid,
  p_response jsonb,
  p_response_key text,
  p_request_hash text,
  p_is_correct boolean,
  p_error_tags text[],
  p_marks jsonb,
  p_grader_version text
)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select private.record_graded_attempt(p_auth_user_id, p_question_instance_id, p_client_attempt_id, p_response,
    p_response_key, p_request_hash, p_is_correct, p_error_tags, p_marks, p_grader_version);
$$;

-- =====================================================================================
-- Câu đủ điều kiện phát cho học sinh (MỘT nơi định nghĩa): phiên bản approved, bài tập chưa lưu trữ, đúng chuỗi bài
-- đã xác nhận của lớp, đã học (Nhóm 3: tới bài trước), hợp nhóm, fixture chỉ trong môi trường kiểm thử.
-- =====================================================================================

create or replace function private.eligible_items(p_class_id uuid, p_band text)
returns table (
  exercise_item_id uuid, content_fingerprint text, type_code text, variant text, lesson_ordinal int
)
language sql
stable
security definer
set search_path = ''
as $$
  select i.id, i.content_fingerprint, i.type_code, i.variant, v.lesson_ordinal
  from public.classes c
  join public.curriculum_lessons l on l.id = c.current_lesson_id
  join public.exercise_versions v on v.series_id = c.curriculum_series_id and v.status = 'approved'
  join public.exercises e on e.id = v.exercise_id
  join public.exercise_items i on i.exercise_version_id = v.id
  where c.id = p_class_id
    and c.curriculum_status = 'confirmed'
    and e.archived_at is null
    and (e.origin <> 'test_fixture' or private.test_fixtures_allowed())
    and v.lesson_ordinal <= case when p_band = 'foundation' then l.ordinal - 1 else l.ordinal end
    and (cardinality(e.target_bands) = 0 or p_band = any (e.target_bands));
$$;

-- Danh sách ứng viên cho bộ lập buổi luyện của máy chủ (không chứa nội dung/đáp án — chỉ mã + vân tay).
create or replace function public.gateway_practice_candidates(p_auth_user_id uuid, p_student_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_class_id uuid;
  v_season_id uuid;
  v_curriculum text;
  v_band text;
begin
  v_class_id := private.require_linked_device(p_auth_user_id, p_student_id);
  if not private.consent_active(p_student_id, 'learning_data') then
    raise exception 'CONSENT_REQUIRED' using errcode = '42501';
  end if;
  select s.id into v_season_id from public.seasons s where s.class_id = v_class_id and s.status = 'active';
  if v_season_id is null then
    raise exception 'SEASON_CLOSED' using errcode = '22023';
  end if;
  select c.curriculum_status into v_curriculum from public.classes c where c.id = v_class_id;
  if v_curriculum <> 'confirmed' then
    raise exception 'CURRICULUM_UNCONFIRMED' using errcode = '22023';
  end if;
  select b.band into v_band from public.student_band_assignments b
  where b.student_id = p_student_id and b.valid_to is null;
  if v_band is null then
    raise exception 'NO_BAND' using errcode = '22023';
  end if;
  return jsonb_build_object(
    'band', v_band,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'exerciseItemId', x.exercise_item_id,
        'fingerprint', x.content_fingerprint,
        'typeCode', x.type_code,
        'variant', x.variant,
        'lessonOrdinal', x.lesson_ordinal,
        'scoredInSeason', exists (
          select 1 from public.question_instances q
          where q.season_id = v_season_id and q.student_id = p_student_id
            and q.content_fingerprint = x.content_fingerprint and q.scorable)
      ) order by x.exercise_item_id)
      from (select * from private.eligible_items(v_class_id, v_band) limit 500) x
    ), '[]'::jsonb)
  );
end;
$$;

-- =====================================================================================
-- Lập hoặc mở lại buổi luyện (REDESIGN_ARCHITECTURE §7.1)
-- p_items: [{exerciseItemId, supportLevel, maxAttempts, scorable}] do máy chủ chọn từ nội dung đã duyệt.
-- Hàm KIỂM TRA LẠI từng câu: phiên bản approved, đúng chuỗi bài của lớp, đã học (Nhóm 3: tới bài trước), hợp nhóm,
-- fixture chỉ trong môi trường kiểm thử. Tính điểm hay không do CSDL quyết định cuối cùng theo vân tay trong mùa.
-- =====================================================================================

create or replace function public.gateway_start_practice_session(
  p_auth_user_id uuid,
  p_student_id uuid,
  p_items jsonb,
  p_planner_version text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_class_id uuid;
  v_season_id uuid;
  v_session_id uuid;
  v_device_id uuid;
  v_curriculum text;
  v_series_id uuid;
  v_lesson int;
  v_band text;
  v_entry jsonb;
  v_item record;
  v_position int := 0;
  v_support int;
  v_max_attempts int;
  v_scorable boolean;
  v_reason text;
begin
  v_class_id := private.require_linked_device(p_auth_user_id, p_student_id);
  if not private.consent_active(p_student_id, 'learning_data') then
    raise exception 'CONSENT_REQUIRED' using errcode = '42501';
  end if;

  select s.id into v_season_id from public.seasons s
  where s.class_id = v_class_id and s.status = 'active'
  for share;
  if v_season_id is null then
    raise exception 'SEASON_CLOSED' using errcode = '22023';
  end if;
  -- Tuần tự hóa thao tác của cùng học sinh (hai tab bấm "Luyện" cùng lúc → một buổi).
  perform private.lock_season_score(v_season_id, p_student_id, v_class_id);

  -- Buổi đang làm của mùa trước (nếu có) không còn hiệu lực.
  update public.question_instances q set status = 'void', closed_at = now()
    where q.student_id = p_student_id and q.status = 'open' and q.season_id <> v_season_id;
  update public.practice_sessions p set status = 'void', ended_at = now()
    where p.student_id = p_student_id and p.status = 'in_progress' and p.season_id <> v_season_id;

  select p.id into v_session_id from public.practice_sessions p
  where p.student_id = p_student_id and p.status = 'in_progress';
  if v_session_id is not null then
    return jsonb_build_object('sessionId', v_session_id, 'resumed', true);
  end if;

  select c.curriculum_status, c.curriculum_series_id, l.ordinal into v_curriculum, v_series_id, v_lesson
  from public.classes c left join public.curriculum_lessons l on l.id = c.current_lesson_id
  where c.id = v_class_id;
  if v_curriculum <> 'confirmed' or v_series_id is null or v_lesson is null then
    raise exception 'CURRICULUM_UNCONFIRMED' using errcode = '22023';
  end if;
  select b.band into v_band from public.student_band_assignments b
  where b.student_id = p_student_id and b.valid_to is null;
  if v_band is null then
    raise exception 'NO_BAND' using errcode = '22023';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'INSUFFICIENT_CONTENT' using errcode = '22023';
  end if;
  if jsonb_array_length(p_items) > 50 then
    raise exception 'INVALID_INPUT' using errcode = '22023';
  end if;

  select d.id into v_device_id from public.student_devices d
  where d.auth_user_id = p_auth_user_id and d.student_id = p_student_id and d.revoked_at is null
  limit 1;

  insert into public.practice_sessions (student_id, class_id, season_id, device_id, question_count, planner_version)
  values (p_student_id, v_class_id, v_season_id, v_device_id, jsonb_array_length(p_items), p_planner_version)
  returning id into v_session_id;

  for v_entry in select value from jsonb_array_elements(p_items) loop
    v_position := v_position + 1;
    select i.id, i.exercise_version_id, i.content_fingerprint, i.type_code, i.variant, i.content
      into v_item
    from public.exercise_items i
    where i.id = (v_entry ->> 'exerciseItemId')::uuid
      and i.id in (select x.exercise_item_id from private.eligible_items(v_class_id, v_band) x);
    if v_item.id is null then
      raise exception 'CONTENT_NOT_ELIGIBLE' using errcode = '22023';
    end if;

    v_support := (v_entry ->> 'supportLevel')::int;
    v_max_attempts := (v_entry ->> 'maxAttempts')::int;
    if v_support is null or v_support not between 0 and 3 or v_max_attempts is null or v_max_attempts not between 1 and 3 then
      raise exception 'INVALID_INPUT' using errcode = '22023';
    end if;

    v_reason := null;
    if coalesce((v_entry ->> 'scorable')::boolean, true) is false then
      v_reason := 'PRACTICE_ONLY';
    elsif exists (
      select 1 from public.question_instances q
      where q.season_id = v_season_id and q.student_id = p_student_id
        and q.content_fingerprint = v_item.content_fingerprint and q.scorable
    ) then
      v_reason := 'ALREADY_SCORED_IN_SEASON';
    end if;
    v_scorable := v_reason is null;

    insert into public.question_instances (
      student_id, class_id, season_id, context_kind, practice_session_id, position, exercise_item_id,
      exercise_version_id, content_fingerprint, view, support_level, max_attempts, scorable, not_scorable_reason
    ) values (
      p_student_id, v_class_id, v_season_id, 'practice_session', v_session_id, v_position, v_item.id,
      v_item.exercise_version_id, v_item.content_fingerprint,
      jsonb_build_object('type', v_item.type_code, 'variant', v_item.variant, 'content', v_item.content),
      v_support, v_max_attempts, v_scorable, v_reason
    );
  end loop;

  update public.practice_sessions p
    set plan = (
      select jsonb_agg(jsonb_build_object('position', q.position, 'questionInstanceId', q.id, 'scorable', q.scorable)
                       order by q.position)
      from public.question_instances q where q.practice_session_id = v_session_id)
    where p.id = v_session_id;

  perform private.write_audit('practice.start', 'practice_session', v_session_id, v_class_id,
    jsonb_build_object('student_id', p_student_id, 'questions', v_position), p_auth_user_id);
  return jsonb_build_object('sessionId', v_session_id, 'resumed', false);
end;
$$;

-- =====================================================================================
-- Khám phá thẻ bản đồ (GAMIFICATION_SPEC §6) — không tiêu điểm; số thẻ = min(tổng thẻ, floor(tích lũy / bước)).
-- Bố cục bản đồ (thẻ kề) do máy chủ cung cấp từ src/features/game-world/map.ts; CSDL kiểm tra số lượt + tính kề
-- trong giao dịch. Gửi lại cùng thẻ → "already_revealed" (không tốn lượt).
-- =====================================================================================

create or replace function public.gateway_reveal_map_tile(
  p_auth_user_id uuid,
  p_student_id uuid,
  p_map_key text,
  p_tile_key text,
  p_tile_count int,
  p_neighbors text[],
  p_adjacent_to_start boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_class_id uuid;
  v_season_id uuid;
  v_rules_version text;
  v_step int;
  v_score public.season_scores;
  v_count int;
  v_allowed int;
begin
  if p_tile_count is null or p_tile_count not between 1 and 64 or p_tile_key is null or p_map_key is null then
    raise exception 'INVALID_INPUT' using errcode = '22023';
  end if;
  v_class_id := private.require_linked_device(p_auth_user_id, p_student_id);
  if not private.consent_active(p_student_id, 'learning_data') then
    raise exception 'CONSENT_REQUIRED' using errcode = '42501';
  end if;
  select s.id, s.rules_version into v_season_id, v_rules_version from public.seasons s
  where s.class_id = v_class_id and s.status = 'active'
  for share;
  if v_season_id is null then
    raise exception 'SEASON_CLOSED' using errcode = '22023';
  end if;
  select r.map_tile_step into v_step from private.scoring_rules r where r.version = v_rules_version;
  v_score := private.lock_season_score(v_season_id, p_student_id, v_class_id);

  select count(*)::int into v_count from public.map_tile_reveals m
  where m.season_id = v_season_id and m.student_id = p_student_id;
  v_allowed := least(p_tile_count, floor(v_score.earned_total / v_step)::int);

  if exists (
    select 1 from public.map_tile_reveals m
    where m.season_id = v_season_id and m.student_id = p_student_id and m.tile_key = p_tile_key
  ) then
    return jsonb_build_object('outcome', 'already_revealed', 'revealed', v_count, 'allowed', v_allowed);
  end if;
  if v_count >= v_allowed then
    raise exception 'NO_TILE_AVAILABLE' using errcode = '22023';
  end if;
  if not coalesce(p_adjacent_to_start, false) and not exists (
    select 1 from public.map_tile_reveals m
    where m.season_id = v_season_id and m.student_id = p_student_id and m.tile_key = any (coalesce(p_neighbors, '{}'))
  ) then
    raise exception 'NOT_ADJACENT' using errcode = '22023';
  end if;

  insert into public.map_tile_reveals (season_id, student_id, tile_key, class_id, map_key, ordinal, earned_total_at_reveal)
  values (v_season_id, p_student_id, p_tile_key, v_class_id, p_map_key, v_count + 1, v_score.earned_total);
  return jsonb_build_object('outcome', 'revealed', 'revealed', v_count + 1, 'allowed', v_allowed);
end;
$$;

-- Hằng số điểm của một phiên bản quy tắc (để kiểm thử đối chiếu với rules.ts) — chỉ service_role.
create or replace function public.gateway_scoring_rules(p_version text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select to_jsonb(r) - 'created_at' from private.scoring_rules r where r.version = p_version;
$$;

-- =====================================================================================
-- Rút đồng ý learning_data: như R03 (thu hồi thiết bị + thẻ) + đóng buổi luyện/câu đang mở (không trừ điểm).
-- Dữ liệu đã lưu KHÔNG bị lộ (thiết bị mất quyền ngay); quy trình xóa theo yêu cầu chờ xác nhận pháp lý (RD-21).
-- =====================================================================================

create or replace function public.teacher_withdraw_consent(p_student_id uuid, p_scope text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_class_id uuid := private.require_student_staff(p_student_id);
  v_consent_id uuid;
begin
  update public.guardian_consents
    set status = 'withdrawn', withdrawn_at = now(), withdrawn_by = (select auth.uid())
    where student_id = p_student_id and scope = p_scope and status = 'granted'
    returning id into v_consent_id;
  if v_consent_id is null then
    raise exception 'CONSENT_NOT_ACTIVE' using errcode = '22023';
  end if;
  if p_scope = 'learning_data' then
    perform private.revoke_student_access(p_student_id, 'consent_withdrawn');
    update public.question_instances set status = 'void', closed_at = now()
      where student_id = p_student_id and status = 'open';
    update public.practice_sessions set status = 'void', ended_at = now()
      where student_id = p_student_id and status = 'in_progress';
  end if;
  perform private.write_audit('consent.withdraw', 'consent', v_consent_id, v_class_id,
    jsonb_build_object('student_id', p_student_id, 'scope', p_scope));
end;
$$;

-- =====================================================================================
-- Quyền thực thi
-- =====================================================================================

revoke all on function
  public.gateway_record_attempt(uuid, uuid, uuid, jsonb, text, text, boolean, text[], jsonb, text),
  public.gateway_start_practice_session(uuid, uuid, jsonb, text),
  public.gateway_reveal_map_tile(uuid, uuid, text, text, int, text[], boolean),
  public.gateway_scoring_rules(text),
  public.gateway_practice_candidates(uuid, uuid)
from public, anon, authenticated;
grant execute on function
  public.gateway_record_attempt(uuid, uuid, uuid, jsonb, text, text, boolean, text[], jsonb, text),
  public.gateway_start_practice_session(uuid, uuid, jsonb, text),
  public.gateway_reveal_map_tile(uuid, uuid, text, text, int, text[], boolean),
  public.gateway_scoring_rules(text),
  public.gateway_practice_candidates(uuid, uuid)
to service_role;

-- teacher_withdraw_consent được tạo lại: giữ nguyên quyền của R03.
revoke all on function public.teacher_withdraw_consent(uuid, text) from public, anon;
grant execute on function public.teacher_withdraw_consent(uuid, text) to authenticated, service_role;

revoke all on all functions in schema private from public, anon, authenticated;
grant execute on function
  private.is_active_staff(), private.is_admin(), private.my_school_id(), private.my_class_ids(),
  private.my_owned_class_ids(), private.my_student_ids(), private.my_student_class_ids(),
  private.is_clean_text(text, int, int)
to authenticated;
grant execute on all functions in schema private to service_role;
