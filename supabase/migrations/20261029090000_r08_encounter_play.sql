-- =====================================================================================
-- R08.3 — Chơi chạm trán ở máy chủ: kích hoạt, chấm điểm + HP quái vật, kết thúc chạm trán, mở kho báu.
-- GAME_DESIGN §4.3–4.8, GAMIFICATION_SPEC §4–5. KHÔNG có giao diện quái vật (R08.4).
--
--   * gateway_activate_encounter: nhân vật phải ĐANG ĐỨNG (vị trí lưu ở CSDL, không tin trình duyệt) trên điểm kích hoạt của một
--     chạm trán pending. pending → active, lưu return_position + activated_at, HP giữ 3. Gọi lại khi đang active → 'resumed'
--     (không kích hoạt hai lần, không đặt lại HP). Khóa dòng lượt chơi tuần tự hóa hai tab.
--   * private.record_graded_attempt: thêm nhánh context_kind = 'game_encounter'. Điều kiện nằm ở CSDL (không chỉ ở API):
--     lượt đang chơi, chạm trán ĐANG DIỄN RA, đúng thứ tự câu (câu trước phải đã đóng). Đúng → +10 và HP −1 (một lần, cùng giao
--     dịch với việc đóng câu); sai → −5, HP giữ nguyên; đóng cả 3 câu → defeated (HP 0) hoặc undefeated (HP > 0).
--     Điểm/idempotency/mở khóa game giữ nguyên R04 (luyện tập không đổi).
--   * gateway_open_treasure: chỉ khi đứng đúng ô kho báu, đủ 7 chạm trán đã kết thúc → lượt completed. Không cộng điểm; gửi lại
--     → 'replayed'.
-- Thứ tự khóa (khớp R04–R08.2, reset mùa R06): mùa (FOR SHARE) → lượt chơi → chạm trán → câu → điểm mùa của học sinh. Bắt đầu lượt
-- (R08.2) giữ điểm mùa trước nhưng chỉ chèn dòng mới, không chờ khóa lượt/chạm trán/câu nào của giao dịch khác.
-- =====================================================================================

-- Kết quả có kiểu của một lượt: thêm trạng thái chạm trán (null với câu luyện tập).
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
    'encounter', (
      select jsonb_build_object('id', e.id, 'encounterNo', e.encounter_no, 'status', e.status, 'hpRemaining', e.hp_remaining)
      from public.game_encounters e where e.id = q.game_encounter_id),
    'newlyUnlockedGames', to_jsonb(coalesce(p_unlocked, '{}'::text[]))
  )
  from public.item_attempts a
  join public.question_instances q on q.id = a.question_instance_id
  where a.id = p_attempt_id;
$$;

-- -------------------------------------------------------------------------------------
-- Ghi một lượt đã chấm (R04) + nhánh chạm trán
-- -------------------------------------------------------------------------------------

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
  v_run_status text;
  v_enc public.game_encounters;
  v_hp smallint;
  v_all_closed boolean;
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

  -- (4b) R08.3: câu của chạm trán → khóa lượt chơi rồi chạm trán TRƯỚC khi khóa câu; chạm trán phải đang diễn ra.
  if v_qi.context_kind = 'game_encounter' then
    select g.status into v_run_status from public.game_runs g where g.id = v_qi.run_id for update;
    if v_run_status is distinct from 'in_progress' then
      raise exception 'RUN_NOT_ACTIVE' using errcode = '22023';
    end if;
    select e.* into v_enc from public.game_encounters e where e.id = v_qi.game_encounter_id for update;
    if v_enc.status = 'pending' then
      raise exception 'ENCOUNTER_PENDING' using errcode = '22023';
    elsif v_enc.status <> 'active' then
      raise exception 'QUESTION_CLOSED' using errcode = '22023';
    end if;
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
  -- (6b) R08.3: đúng thứ tự — câu trước trong cùng chạm trán phải đã đóng (chạm trán đã bị khóa nên không có đua nhau).
  if v_qi.context_kind = 'game_encounter' and exists (
    select 1 from public.question_instances q
    where q.game_encounter_id = v_qi.game_encounter_id and q.position < v_qi.position and q.status = 'open'
  ) then
    raise exception 'QUESTION_NOT_CURRENT' using errcode = '22023';
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

  -- (11) R08.3: HP quái vật giảm đúng một lần khi câu ĐÚNG đóng (câu chỉ đóng một lần, đã khóa); đóng cả 3 câu → kết thúc
  -- chạm trán. Sai/hết lượt không đổi HP. Không bao giờ sinh câu thứ tư.
  if v_qi.context_kind = 'game_encounter' then
    v_hp := v_enc.hp_remaining - case when v_status = 'correct' then 1 else 0 end;
    v_all_closed := not exists (
      select 1 from public.question_instances q where q.game_encounter_id = v_enc.id and q.status = 'open'
    );
    update public.game_encounters e
      set hp_remaining = v_hp,
          status = case when not v_all_closed then 'active' when v_hp = 0 then 'defeated' else 'undefeated' end,
          resolved_at = case when v_all_closed then now() else null end
      where e.id = v_enc.id;
  end if;

  return private.attempt_result(v_attempt.id, 'recorded', v_unlocked);
end;
$$;

-- -------------------------------------------------------------------------------------
-- Kích hoạt chạm trán
-- -------------------------------------------------------------------------------------

create or replace function public.gateway_activate_encounter(
  p_auth_user_id uuid,
  p_student_id uuid,
  p_run_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_class_id uuid;
  v_season_id uuid;
  v_season_status text;
  v_run public.game_runs;
  v_enc public.game_encounters;
  v_outcome text;
begin
  if p_run_id is null then
    raise exception 'INVALID_INPUT' using errcode = '22023';
  end if;
  v_class_id := private.require_linked_device(p_auth_user_id, p_student_id);
  if not private.consent_active(p_student_id, 'learning_data') then
    raise exception 'CONSENT_REQUIRED' using errcode = '42501';
  end if;
  select g.season_id into v_season_id from public.game_runs g
  where g.id = p_run_id and g.student_id = p_student_id and g.class_id = v_class_id;
  if v_season_id is null then
    raise exception 'NOT_FOUND' using errcode = '22023';
  end if;
  select s.status into v_season_status from public.seasons s where s.id = v_season_id for share;
  if v_season_status is distinct from 'active' then
    raise exception 'SEASON_CLOSED' using errcode = '22023';
  end if;
  select * into v_run from public.game_runs g where g.id = p_run_id for update;
  if v_run.status <> 'in_progress' then
    raise exception 'RUN_NOT_ACTIVE' using errcode = '22023';
  end if;
  -- Chỉ lượt tính điểm đã phân bổ ĐỦ 7 chạm trán × 21 câu mới có chạm trán thật.
  if not v_run.scored
     or (select count(*) from public.game_encounters e where e.run_id = v_run.id) <> v_run.encounter_count
     or (select count(*) from public.question_instances q where q.run_id = v_run.id) <> v_run.encounter_count * 3 then
    raise exception 'ENCOUNTERS_INCOMPLETE' using errcode = '22023';
  end if;

  -- Đang có chạm trán diễn ra (tải lại, hai tab) → trả lại đúng chạm trán đó; không kích hoạt lần hai, không đặt lại HP.
  select * into v_enc from public.game_encounters e where e.run_id = v_run.id and e.status = 'active';
  if v_enc.id is not null then
    v_outcome := 'resumed';
  else
    -- Chạm trán gắn với điểm kích hoạt mà nhân vật đang đứng (vị trí lưu ở CSDL).
    select e.* into v_enc
    from public.game_encounters e
    join private.game_level_triggers t
      on t.game_key = v_run.game_key and t.level_key = v_run.level_key and t.level_version = v_run.level_version
     and t.trigger_key = e.trigger_key
    where e.run_id = v_run.id
      and t.row_no = (v_run.position ->> 'row')::int and t.col_no = (v_run.position ->> 'col')::int;
    if v_enc.id is null then
      raise exception 'NOT_AT_TRIGGER' using errcode = '22023';
    end if;
    if v_enc.status <> 'pending' then
      raise exception 'ENCOUNTER_FINISHED' using errcode = '22023';
    end if;
    update public.game_encounters e
      set status = 'active', activated_at = now(), return_position = v_run.position
      where e.id = v_enc.id
      returning * into v_enc;
    update public.game_runs set last_active_at = now() where id = v_run.id;
    perform private.write_audit('encounter.activate', 'game_encounter', v_enc.id, v_class_id,
      jsonb_build_object('student_id', p_student_id, 'run_id', v_run.id, 'encounter_no', v_enc.encounter_no),
      p_auth_user_id);
    v_outcome := 'activated';
  end if;

  return jsonb_build_object('outcome', v_outcome, 'encounter', jsonb_build_object(
    'id', v_enc.id, 'encounterNo', v_enc.encounter_no, 'monsterKey', v_enc.monster_key,
    'status', v_enc.status, 'hpRemaining', v_enc.hp_remaining));
end;
$$;

-- -------------------------------------------------------------------------------------
-- Mở kho báu
-- -------------------------------------------------------------------------------------

create or replace function public.gateway_open_treasure(
  p_auth_user_id uuid,
  p_student_id uuid,
  p_run_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_class_id uuid;
  v_season_id uuid;
  v_season_status text;
  v_run public.game_runs;
  v_total int;
  v_remaining int;
  v_defeated int;
  v_undefeated int;
begin
  if p_run_id is null then
    raise exception 'INVALID_INPUT' using errcode = '22023';
  end if;
  v_class_id := private.require_linked_device(p_auth_user_id, p_student_id);
  if not private.consent_active(p_student_id, 'learning_data') then
    raise exception 'CONSENT_REQUIRED' using errcode = '42501';
  end if;
  select g.season_id into v_season_id from public.game_runs g
  where g.id = p_run_id and g.student_id = p_student_id and g.class_id = v_class_id;
  if v_season_id is null then
    raise exception 'NOT_FOUND' using errcode = '22023';
  end if;
  select s.status into v_season_status from public.seasons s where s.id = v_season_id for share;
  select * into v_run from public.game_runs g where g.id = p_run_id for update;

  -- Gửi lại sau khi đã mở: trả lại kết quả cũ (kể cả khi mùa vừa đổi), không ghi gì thêm.
  if v_run.status = 'completed' and v_run.treasure_opened_at is not null then
    return jsonb_build_object('outcome', 'replayed', 'treasure', jsonb_build_object(
      'runId', v_run.id, 'status', v_run.status, 'completedAt', v_run.completed_at,
      'defeated', (select count(*) from public.game_encounters e where e.run_id = v_run.id and e.status = 'defeated'),
      'undefeated', (select count(*) from public.game_encounters e where e.run_id = v_run.id and e.status = 'undefeated')));
  end if;
  if v_season_status is distinct from 'active' then
    raise exception 'SEASON_CLOSED' using errcode = '22023';
  end if;
  if v_run.status <> 'in_progress' then
    raise exception 'RUN_NOT_ACTIVE' using errcode = '22023';
  end if;
  if private.game_cell(v_run.game_key, v_run.level_key, v_run.level_version,
       (v_run.position ->> 'row')::int, (v_run.position ->> 'col')::int) is distinct from 'T' then
    raise exception 'NOT_AT_TREASURE' using errcode = '22023';
  end if;

  select count(*),
         count(*) filter (where e.status in ('pending', 'active')),
         count(*) filter (where e.status = 'defeated'),
         count(*) filter (where e.status = 'undefeated')
  into v_total, v_remaining, v_defeated, v_undefeated
  from public.game_encounters e where e.run_id = v_run.id;
  if not v_run.scored or v_total <> v_run.encounter_count or v_remaining > 0
     or v_defeated + v_undefeated <> v_run.encounter_count then
    raise exception 'ENCOUNTERS_INCOMPLETE' using errcode = '22023';
  end if;

  update public.game_runs
    set status = 'completed', treasure_opened_at = now(), completed_at = now(), ended_at = now(), last_active_at = now()
    where id = v_run.id
    returning * into v_run;
  perform private.write_audit('treasure.open', 'game_run', v_run.id, v_class_id,
    jsonb_build_object('student_id', p_student_id, 'defeated', v_defeated, 'undefeated', v_undefeated),
    p_auth_user_id);
  return jsonb_build_object('outcome', 'opened', 'treasure', jsonb_build_object(
    'runId', v_run.id, 'status', v_run.status, 'completedAt', v_run.completed_at,
    'defeated', v_defeated, 'undefeated', v_undefeated));
end;
$$;

-- -------------------------------------------------------------------------------------
-- Quyền hàm
-- -------------------------------------------------------------------------------------

revoke all on function public.gateway_activate_encounter(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.gateway_activate_encounter(uuid, uuid, uuid) to service_role;
revoke all on function public.gateway_open_treasure(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.gateway_open_treasure(uuid, uuid, uuid) to service_role;
