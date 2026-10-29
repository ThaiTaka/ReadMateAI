-- =====================================================================================
-- R08.6 — Chơi lại Mê cung kho báu KHÔNG tính điểm. GAME_DESIGN §4.8, GAMIFICATION_SPEC §1/§6.
--
--   * Ba loại lượt, phân biệt bằng cột RIÊNG (không suy từ scored = false):
--       tính điểm : scored = true,  is_replay = false  — 7 chạm trán, 21 câu scorable
--       chơi lại  : scored = false, is_replay = true   — 7 chạm trán, 21 câu KHÔNG tính điểm (GAME_REPLAY)
--       fixture   : scored = false, is_replay = false  — lượt LOCAL của R07, không chạm trán
--     is_replay bất biến và không đi cùng scored (check).
--   * Điều kiện chơi lại (CSDL quyết): lượt TÍNH ĐIỂM của chính học sinh, chính màn, chính MÙA ĐANG DIỄN RA đã completed.
--     Mùa mới = chưa có lượt completed trong mùa → vào lại theo đường tính điểm (cần ngưỡng điểm). Chơi lại không có ngưỡng
--     điểm và không mở khóa gì; không có đường nào biến chơi lại thành lượt tính điểm.
--   * Lượt đang dở (bất kỳ loại) luôn được trả lại trước mọi xét điều kiện. Một lượt đang hoạt động mỗi học sinh/màn
--     (game_runs_one_in_progress); hai tab cùng bấm "Chơi lại" chỉ tạo một lượt (khóa dòng điểm mùa tuần tự hóa).
--   * Câu của lượt chơi lại: scorable = false, not_scorable_reason = 'GAME_REPLAY'. record_graded_attempt (R08.3) đã bỏ
--     sổ cái/điểm mùa/mở khóa cho câu không tính điểm nhưng vẫn kiểm thứ tự, trạng thái chạm trán và giảm HP — giữ nguyên.
--     Câu từng tính điểm được dùng lại ở chế độ này (chỉ chế độ này); không trùng mã câu/vân tay TRONG lượt.
--   * Không có kế hoạch (p_plan null) → INSUFFICIENT_CONTENT; không có đường fixture cho chơi lại.
-- =====================================================================================

alter table public.game_runs add column is_replay boolean not null default false;
alter table public.game_runs add constraint game_runs_replay_not_scored check (not (scored and is_replay));
comment on column public.game_runs.is_replay is
  'true = lượt chơi lại không tính điểm (đủ 7 chạm trán + 21 câu GAME_REPLAY). Khác lượt fixture LOCAL (scored = false, is_replay = false, không chạm trán).';

alter table public.question_instances drop constraint question_instances_not_scorable_reason_check;
alter table public.question_instances add constraint question_instances_not_scorable_reason_check
  check (not_scorable_reason in ('ALREADY_SCORED_IN_SEASON', 'PRACTICE_ONLY', 'GAME_REPLAY'));
-- Câu chơi lại chỉ tồn tại trong ngữ cảnh chạm trán.
alter table public.question_instances add constraint question_instances_game_replay_reason
  check (not_scorable_reason is distinct from 'GAME_REPLAY' or context_kind = 'game_encounter');

create or replace function private.guard_game_run()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cell text;
begin
  if tg_op = 'UPDATE' then
    if new.id <> old.id or new.class_id <> old.class_id or new.student_id <> old.student_id
       or new.season_id <> old.season_id or new.game_key <> old.game_key or new.level_key <> old.level_key
       or new.level_version <> old.level_version or new.scored <> old.scored or new.is_replay <> old.is_replay
       or new.started_at <> old.started_at or new.encounter_count <> old.encounter_count then
      raise exception 'IMMUTABLE_GAME_RUN' using errcode = '23514';
    end if;
    if old.status <> 'in_progress' then
      raise exception 'RUN_NOT_ACTIVE' using errcode = '23514';
    end if;
    if new.position is distinct from old.position then
      if new.state_version <> old.state_version + 1 then
        raise exception 'STATE_VERSION' using errcode = '23514';
      end if;
    elsif new.state_version <> old.state_version then
      raise exception 'STATE_VERSION' using errcode = '23514';
    end if;
  end if;
  if not private.game_position_shape_ok(new.position) then
    raise exception 'INVALID_POSITION' using errcode = '23514';
  end if;
  v_cell := private.game_cell(new.game_key, new.level_key, new.level_version,
    (new.position ->> 'row')::int, (new.position ->> 'col')::int);
  if v_cell is null or v_cell = '#' then
    raise exception 'INVALID_POSITION' using errcode = '23514';
  end if;
  return new;
end;
$$;

create or replace function private.game_run_dto(p_run public.game_runs)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_build_object(
    'id', p_run.id, 'game_key', p_run.game_key, 'level_key', p_run.level_key, 'level_version', p_run.level_version,
    'status', p_run.status, 'scored', p_run.scored, 'replay', p_run.is_replay, 'position', p_run.position,
    'state_version', p_run.state_version, 'encounter_count', p_run.encounter_count);
$$;

-- Lượt chơi lại cũng có đủ chạm trán: kiểm đường đi như lượt tính điểm; chỉ lượt fixture R07 được miễn.
create or replace function private.game_check_encounter_path(p_run public.game_runs, p_path jsonb)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_total int;
  v_step record;
  v_len int := jsonb_array_length(p_path);
begin
  select count(*) into v_total from public.game_encounters e where e.run_id = p_run.id;
  if v_total = 0 and not p_run.scored and not p_run.is_replay then
    return;
  end if;
  if (p_run.scored or p_run.is_replay) and v_total <> p_run.encounter_count then
    raise exception 'ENCOUNTERS_INCOMPLETE' using errcode = '22023';
  end if;
  if v_len = 0 then
    return;
  end if;
  if exists (select 1 from public.game_encounters e where e.run_id = p_run.id and e.status = 'active') then
    raise exception 'ENCOUNTER_ACTIVE' using errcode = '22023';
  end if;
  if exists (
    select 1 from private.game_level_triggers t
    left join public.game_encounters e on e.run_id = p_run.id and e.trigger_key = t.trigger_key
    where t.game_key = p_run.game_key and t.level_key = p_run.level_key and t.level_version = p_run.level_version
      and t.row_no = (p_run.position ->> 'row')::int and t.col_no = (p_run.position ->> 'col')::int
      and coalesce(e.status, 'pending') = 'pending'
  ) then
    raise exception 'ENCOUNTER_PENDING' using errcode = '22023';
  end if;
  for v_step in
    select (s.e ->> 'row')::int as r, (s.e ->> 'col')::int as c
    from jsonb_array_elements(p_path) with ordinality as s(e, n)
    where s.n < v_len
  loop
    if exists (
      select 1 from private.game_level_triggers t
      left join public.game_encounters e on e.run_id = p_run.id and e.trigger_key = t.trigger_key
      where t.game_key = p_run.game_key and t.level_key = p_run.level_key and t.level_version = p_run.level_version
        and t.row_no = v_step.r and t.col_no = v_step.c and coalesce(e.status, 'pending') = 'pending'
    ) then
      raise exception 'ENCOUNTER_PENDING' using errcode = '22023';
    end if;
  end loop;
end;
$$;

-- -------------------------------------------------------------------------------------
-- Bắt đầu lượt: thêm p_replay (ý định của học sinh; CSDL quyết định có cho phép hay không)
-- -------------------------------------------------------------------------------------

drop function public.gateway_start_game_run(uuid, uuid, text, text, jsonb);

create or replace function public.gateway_start_game_run(
  p_auth_user_id uuid,
  p_student_id uuid,
  p_game_key text,
  p_level_key text,
  p_plan jsonb default null,
  p_replay boolean default false
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
  v_level private.game_levels;
  v_min int;
  v_score public.season_scores;
  v_run public.game_runs;
  v_curriculum text;
  v_band text;
  v_triggers text[];
  v_enc jsonb;
  v_enc_no int;
  v_enc_id uuid;
  v_q jsonb;
  v_pos int;
  v_item record;
  v_item_ids uuid[] := array[]::uuid[];
  v_fingerprints text[] := array[]::text[];
  v_replay boolean := coalesce(p_replay, false);
begin
  if p_game_key is distinct from 'treasure_maze' or p_level_key is null then
    raise exception 'INVALID_INPUT' using errcode = '22023';
  end if;
  if p_plan is not null and not private.game_plan_shape_ok(p_plan) then
    raise exception 'INVALID_INPUT' using errcode = '22023';
  end if;
  select l.* into v_level from private.game_levels l
  where l.game_key = p_game_key and l.level_key = p_level_key and l.is_current;
  if v_level.level_key is null then
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
  v_score := private.lock_season_score(v_season_id, p_student_id, v_class_id);

  -- Lượt đang dở của đúng màn (bất kỳ loại) → trả lại nguyên vẹn, kể cả khi người dùng bấm "Chơi lại".
  select * into v_run from public.game_runs g
  where g.student_id = p_student_id and g.season_id = v_season_id and g.game_key = p_game_key
    and g.level_key = p_level_key and g.status = 'in_progress';
  if v_run.id is not null then
    return jsonb_build_object('outcome', 'resumed', 'run', private.game_run_dto(v_run));
  end if;

  if v_replay then
    -- Chơi lại: chỉ khi lượt TÍNH ĐIỂM của màn này trong MÙA NÀY đã hoàn thành. Không xét ngưỡng điểm (không đổi điểm).
    if not exists (
      select 1 from public.game_runs g
      where g.season_id = v_season_id and g.student_id = p_student_id and g.game_key = p_game_key
        and g.level_key = p_level_key and g.scored and g.status = 'completed'
    ) then
      raise exception 'REPLAY_NOT_AVAILABLE' using errcode = '22023';
    end if;
  else
    -- Một lượt TÍNH ĐIỂM mỗi màn mỗi mùa; lượt đã kết thúc không mở lại thành lượt tính điểm. Xét TRƯỚC ngưỡng điểm để học
    -- sinh đã hoàn thành màn (điểm có thể đã xuống dưới ngưỡng) nhận RUN_NOT_ACTIVE → giao diện mời "Chơi lại cho vui".
    if exists (
      select 1 from public.game_runs g
      where g.season_id = v_season_id and g.student_id = p_student_id and g.game_key = p_game_key
        and g.level_key = p_level_key and g.scored
    ) then
      raise exception 'RUN_NOT_ACTIVE' using errcode = '22023';
    end if;
    select (r.game_min_balance ->> p_game_key)::int into v_min from private.scoring_rules r where r.version = v_rules_version;
    if v_min is null or v_score.balance < v_min then
      raise exception 'INSUFFICIENT_POINTS' using errcode = '22023';
    end if;
  end if;

  if p_plan is null then
    -- Chơi lại không có đường fixture; lượt fixture không tính điểm chỉ cho môi trường kiểm thử LOCAL có cờ riêng.
    if v_replay or not private.game_run_fixtures_allowed() then
      raise exception 'INSUFFICIENT_CONTENT' using errcode = '22023';
    end if;
    begin
      insert into public.game_runs (class_id, student_id, season_id, game_key, level_key, level_version, scored, position)
      values (v_class_id, p_student_id, v_season_id, p_game_key, p_level_key, v_level.level_version, false,
              jsonb_build_object('row', v_level.start_row, 'col', v_level.start_col))
      returning * into v_run;
    exception when unique_violation then
      select * into v_run from public.game_runs g
      where g.student_id = p_student_id and g.game_key = p_game_key and g.level_key = p_level_key and g.status = 'in_progress';
      if v_run.id is null then
        raise;
      end if;
      return jsonb_build_object('outcome', 'resumed', 'run', private.game_run_dto(v_run));
    end;
    return jsonb_build_object('outcome', 'created', 'run', private.game_run_dto(v_run));
  end if;

  select c.curriculum_status into v_curriculum from public.classes c where c.id = v_class_id;
  if v_curriculum is distinct from 'confirmed' then
    raise exception 'CURRICULUM_UNCONFIRMED' using errcode = '22023';
  end if;
  select b.band into v_band from public.student_band_assignments b
  where b.student_id = p_student_id and b.valid_to is null;
  if v_band is null then
    raise exception 'NO_BAND' using errcode = '22023';
  end if;

  select array_agg(t.trigger_key order by t.trigger_key) into v_triggers
  from private.game_level_triggers t
  where t.game_key = v_level.game_key and t.level_key = v_level.level_key and t.level_version = v_level.level_version;
  if coalesce(cardinality(v_triggers), 0) <> 7 then
    raise exception 'LEVEL_TRIGGERS_INCOMPLETE' using errcode = 'XX000';
  end if;

  -- Kiểm lại TỪNG câu của kế hoạch: đủ điều kiện (đã duyệt, đã học, hợp nhóm), 21 câu đôi một khác nhau cả mã lẫn vân tay.
  -- Lượt tính điểm: chưa tính điểm trong mùa. Lượt chơi lại: được dùng lại câu từng tính điểm (không tính điểm nữa).
  for v_enc in select e from jsonb_array_elements(p_plan -> 'encounters') e loop
    for v_q in select q from jsonb_array_elements(v_enc -> 'questions') q loop
      select i.id, i.content_fingerprint into v_item
      from public.exercise_items i
      where i.id = (v_q ->> 'exerciseItemId')::uuid
        and i.id in (select x.exercise_item_id from private.eligible_items(v_class_id, v_band) x);
      if v_item.id is null then
        raise exception 'CONTENT_NOT_ELIGIBLE' using errcode = '22023';
      end if;
      if v_item.id = any (v_item_ids) or v_item.content_fingerprint = any (v_fingerprints) then
        raise exception 'INSUFFICIENT_CONTENT' using errcode = '22023';
      end if;
      if not v_replay and exists (
        select 1 from public.question_instances qi
        where qi.season_id = v_season_id and qi.student_id = p_student_id
          and qi.content_fingerprint = v_item.content_fingerprint and qi.scorable
      ) then
        raise exception 'INSUFFICIENT_CONTENT' using errcode = '22023';
      end if;
      v_item_ids := v_item_ids || v_item.id;
      v_fingerprints := v_fingerprints || v_item.content_fingerprint;
    end loop;
  end loop;

  begin
    insert into public.game_runs (class_id, student_id, season_id, game_key, level_key, level_version, scored, is_replay, position)
    values (v_class_id, p_student_id, v_season_id, p_game_key, p_level_key, v_level.level_version, not v_replay, v_replay,
            jsonb_build_object('row', v_level.start_row, 'col', v_level.start_col))
    returning * into v_run;
  exception when unique_violation then
    select * into v_run from public.game_runs g
    where g.student_id = p_student_id and g.game_key = p_game_key and g.level_key = p_level_key and g.status = 'in_progress';
    if v_run.id is null then
      raise;
    end if;
    return jsonb_build_object('outcome', 'resumed', 'run', private.game_run_dto(v_run));
  end;

  for v_enc, v_enc_no in
    select e, n::int from jsonb_array_elements(p_plan -> 'encounters') with ordinality as t(e, n)
  loop
    insert into public.game_encounters (run_id, student_id, class_id, season_id, encounter_no, trigger_key, monster_key)
    values (v_run.id, p_student_id, v_class_id, v_season_id, v_enc_no, v_triggers[v_enc_no], v_enc ->> 'monsterKey')
    returning id into v_enc_id;
    for v_q, v_pos in
      select q, n::int from jsonb_array_elements(v_enc -> 'questions') with ordinality as t(q, n)
    loop
      insert into public.question_instances (
        student_id, class_id, season_id, context_kind, run_id, game_encounter_id, position, exercise_item_id,
        exercise_version_id, content_fingerprint, view, support_level, max_attempts, scorable, not_scorable_reason
      )
      select p_student_id, v_class_id, v_season_id, 'game_encounter', v_run.id, v_enc_id, v_pos, i.id,
             i.exercise_version_id, i.content_fingerprint,
             jsonb_build_object('type', i.type_code, 'variant', i.variant, 'content', i.content),
             (v_q ->> 'supportLevel')::int, (v_q ->> 'maxAttempts')::int, not v_replay,
             case when v_replay then 'GAME_REPLAY' end
      from public.exercise_items i
      where i.id = (v_q ->> 'exerciseItemId')::uuid;
    end loop;
  end loop;

  perform private.write_audit(case when v_replay then 'game.replay_start' else 'game.start' end, 'game_run', v_run.id,
    v_class_id, jsonb_build_object('student_id', p_student_id, 'level_key', p_level_key, 'encounters', 7, 'questions', 21),
    p_auth_user_id);
  return jsonb_build_object('outcome', 'created', 'run', private.game_run_dto(v_run));
end;
$$;

-- -------------------------------------------------------------------------------------
-- Kích hoạt chạm trán / mở kho báu: chấp nhận lượt chơi lại (đủ chạm trán + 21 câu)
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
  -- Chỉ lượt (tính điểm hoặc chơi lại) đã phân bổ ĐỦ 7 chạm trán × 21 câu mới có chạm trán thật.
  if not (v_run.scored or v_run.is_replay)
     or (select count(*) from public.game_encounters e where e.run_id = v_run.id) <> v_run.encounter_count
     or (select count(*) from public.question_instances q where q.run_id = v_run.id) <> v_run.encounter_count * 3 then
    raise exception 'ENCOUNTERS_INCOMPLETE' using errcode = '22023';
  end if;

  select * into v_enc from public.game_encounters e where e.run_id = v_run.id and e.status = 'active';
  if v_enc.id is not null then
    v_outcome := 'resumed';
  else
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
  if not (v_run.scored or v_run.is_replay) or v_total <> v_run.encounter_count or v_remaining > 0
     or v_defeated + v_undefeated <> v_run.encounter_count then
    raise exception 'ENCOUNTERS_INCOMPLETE' using errcode = '22023';
  end if;

  update public.game_runs
    set status = 'completed', treasure_opened_at = now(), completed_at = now(), ended_at = now(), last_active_at = now()
    where id = v_run.id
    returning * into v_run;
  perform private.write_audit(case when v_run.is_replay then 'treasure.open_replay' else 'treasure.open' end,
    'game_run', v_run.id, v_class_id,
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

revoke all on function public.gateway_start_game_run(uuid, uuid, text, text, jsonb, boolean) from public, anon, authenticated;
grant execute on function public.gateway_start_game_run(uuid, uuid, text, text, jsonb, boolean) to service_role;
