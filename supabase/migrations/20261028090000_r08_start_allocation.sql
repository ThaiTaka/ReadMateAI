-- =====================================================================================
-- R08.2 — Bắt đầu lượt Mê cung kho báu: phân bổ 7 chạm trán + 21 câu trong MỘT giao dịch.
-- GAME_DESIGN §4.7, REDESIGN_ARCHITECTURE §5.3. Thay gateway_start_game_run (R07.5a) bằng bản có tham số kế hoạch.
--
--   * Máy chủ (student gateway) lập kế hoạch từ nội dung ĐÃ DUYỆT (src/features/game-runs/planner.ts, hàm thuần) và
--     truyền p_plan = {encounters:[{monsterKey, questions:[{exerciseItemId, supportLevel, maxAttempts} × 3]} × 7]}.
--     Trình duyệt KHÔNG gửi gì ngoài mã màn; CSDL KIỂM TRA LẠI toàn bộ kế hoạch (không tin máy chủ lập kế hoạch):
--     câu phải đủ điều kiện (private.eligible_items), khác nhau theo exercise_item_id VÀ content_fingerprint, và chưa
--     từng tính điểm trong mùa của học sinh. Mọi câu của lượt tính điểm đều scorable = true.
--   * 7 điểm kích hoạt đọc từ private.game_level_triggers của đúng level_version (chạm trán n ↔ điểm kích hoạt thứ n theo
--     khóa); tọa độ/quái vật/câu không bao giờ do trình duyệt chọn. Chạm trán khởi tạo pending, 3 HP, chưa kích hoạt.
--   * Lỗi ở bất kỳ bước nào → rollback toàn bộ (một lệnh gọi hàm = một giao dịch): không lượt, không chạm trán, không câu.
--   * Có lượt in_progress → trả lại ĐÚNG lượt đó (resumed), không phân bổ lại, không đổi vị trí/state_version/HP/điểm.
--     Kiểm tra này đứng TRƯỚC ngưỡng điểm: sai một câu (−5) giữa chừng không khóa học sinh khỏi lượt đang dở.
--   * Thiếu nội dung → INSUFFICIENT_CONTENT. Không có kế hoạch (p_plan null): chỉ khi cờ fixture LOCAL bật mới tạo lượt
--     KHÔNG tính điểm, không chạm trán (hành vi R07.5a để kiểm thử lưu vị trí); còn lại INSUFFICIENT_CONTENT.
--   * Mỗi màn một lượt TÍNH ĐIỂM mỗi mùa (unique game_runs_one_scored). Chơi lại không tính điểm là R08.6 — ở đây
--     lượt tính điểm đã kết thúc của mùa → RUN_NOT_ACTIVE.
-- Thứ tự khóa (khớp R04–R08.1): lớp → mùa (FOR SHARE) → điểm mùa của học sinh (FOR UPDATE) → lượt → chạm trán → câu.
-- =====================================================================================

-- Hình dạng kế hoạch (không đọc CSDL): đúng 7 chạm trán × 3 câu, mã quái vật khác nhau, tham số trong khoảng cho phép.
create or replace function private.game_plan_shape_ok(p_plan jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_e jsonb;
  v_q jsonb;
  v_monsters text[] := array[]::text[];
begin
  if jsonb_typeof(p_plan) is distinct from 'object' or jsonb_typeof(p_plan -> 'encounters') is distinct from 'array' then
    return false;
  end if;
  if jsonb_array_length(p_plan -> 'encounters') <> 7 then
    return false;
  end if;
  for v_e in select e from jsonb_array_elements(p_plan -> 'encounters') e loop
    if jsonb_typeof(v_e) is distinct from 'object'
       or jsonb_typeof(v_e -> 'monsterKey') is distinct from 'string'
       or jsonb_typeof(v_e -> 'questions') is distinct from 'array' then
      return false;
    end if;
    if (v_e ->> 'monsterKey') !~ '^[a-z0-9][a-z0-9_-]{1,47}$' or (v_e ->> 'monsterKey') = any (v_monsters)
       or jsonb_array_length(v_e -> 'questions') <> 3 then
      return false;
    end if;
    v_monsters := v_monsters || (v_e ->> 'monsterKey');
    for v_q in select q from jsonb_array_elements(v_e -> 'questions') q loop
      if jsonb_typeof(v_q) is distinct from 'object'
         or jsonb_typeof(v_q -> 'exerciseItemId') is distinct from 'string'
         or jsonb_typeof(v_q -> 'supportLevel') is distinct from 'number'
         or jsonb_typeof(v_q -> 'maxAttempts') is distinct from 'number' then
        return false;
      end if;
      if (v_q ->> 'exerciseItemId') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
         or (v_q ->> 'supportLevel') !~ '^[0-3]$' or (v_q ->> 'maxAttempts') !~ '^[1-3]$' then
        return false;
      end if;
    end loop;
  end loop;
  return true;
end;
$$;

drop function public.gateway_start_game_run(uuid, uuid, text, text);

create or replace function public.gateway_start_game_run(
  p_auth_user_id uuid,
  p_student_id uuid,
  p_game_key text,
  p_level_key text,
  p_plan jsonb default null
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
  -- Tuần tự hóa mọi thao tác của cùng học sinh (hai tab bấm "Vào chơi" cùng lúc, luyện tập song song): giữ khóa dòng điểm
  -- mùa. Đọc điểm SAU khi giữ khóa để ngưỡng xét đúng giá trị hiện tại.
  v_score := private.lock_season_score(v_season_id, p_student_id, v_class_id);

  -- Lượt đang dở của đúng màn → trả lại nguyên vẹn (không phân bổ lại, không đổi trạng thái).
  select * into v_run from public.game_runs g
  where g.student_id = p_student_id and g.season_id = v_season_id and g.game_key = p_game_key
    and g.level_key = p_level_key and g.status = 'in_progress';
  if v_run.id is not null then
    return jsonb_build_object('outcome', 'resumed', 'run', private.game_run_dto(v_run));
  end if;

  -- Ngưỡng theo ĐIỂM HIỆN TẠI của mùa (không dùng điểm tích lũy). Không trừ điểm khi vào.
  select (r.game_min_balance ->> p_game_key)::int into v_min from private.scoring_rules r where r.version = v_rules_version;
  if v_min is null or v_score.balance < v_min then
    raise exception 'INSUFFICIENT_POINTS' using errcode = '22023';
  end if;

  -- Một lượt TÍNH ĐIỂM mỗi màn mỗi mùa; lượt đã kết thúc không mở lại (chơi lại không tính điểm: R08.6).
  if exists (
    select 1 from public.game_runs g
    where g.season_id = v_season_id and g.student_id = p_student_id and g.game_key = p_game_key
      and g.level_key = p_level_key and g.scored
  ) then
    raise exception 'RUN_NOT_ACTIVE' using errcode = '22023';
  end if;

  if p_plan is null then
    -- Không có kế hoạch = không đủ nội dung. Chỉ môi trường kiểm thử LOCAL có cờ riêng mới tạo lượt KHÔNG tính điểm.
    if not private.game_run_fixtures_allowed() then
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

  -- Kiểm tra lại TỪNG câu của kế hoạch trước khi tạo gì (kể cả khi máy chủ lập kế hoạch sai): đủ điều kiện, chưa tính điểm
  -- trong mùa, 21 câu đôi một khác nhau cả mã câu lẫn vân tay nội dung.
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
      if exists (
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
    insert into public.game_runs (class_id, student_id, season_id, game_key, level_key, level_version, scored, position)
    values (v_class_id, p_student_id, v_season_id, p_game_key, p_level_key, v_level.level_version, true,
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
             (v_q ->> 'supportLevel')::int, (v_q ->> 'maxAttempts')::int, true, null
      from public.exercise_items i
      where i.id = (v_q ->> 'exerciseItemId')::uuid;
    end loop;
  end loop;

  perform private.write_audit('game.start', 'game_run', v_run.id, v_class_id,
    jsonb_build_object('student_id', p_student_id, 'level_key', p_level_key, 'encounters', 7, 'questions', 21),
    p_auth_user_id);
  return jsonb_build_object('outcome', 'created', 'run', private.game_run_dto(v_run));
end;
$$;

-- -------------------------------------------------------------------------------------
-- Quyền hàm
-- -------------------------------------------------------------------------------------

revoke all on function private.game_plan_shape_ok(jsonb) from public, anon, authenticated;
grant execute on function private.game_plan_shape_ok(jsonb) to service_role;
revoke all on function public.gateway_start_game_run(uuid, uuid, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.gateway_start_game_run(uuid, uuid, text, text, jsonb) to service_role;
