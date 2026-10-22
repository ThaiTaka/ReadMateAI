-- =====================================================================================
-- R08.1 — Nền tảng dữ liệu 7 chạm trán × 3 câu của Mê cung kho báu. CHỈ schema + ràng buộc (R08.2 mới phân bổ thật).
-- GAME_DESIGN §4.3–4.7, REDESIGN_ARCHITECTURE §5.3.
--
--   * private.game_level_triggers: 7 điểm kích hoạt của từng phiên bản màn (đồng bộ từ content/games/treasure-maze, có test
--     đối chiếu). Chỉ ghi thêm; phiên bản màn cũ giữ nguyên. Tọa độ do CSDL biết, KHÔNG nhận từ trình duyệt.
--   * public.game_encounters: RLS chỉ SELECT; học sinh chỉ thấy dòng đã kích hoạt/kết thúc của chính mình (dòng pending ẩn
--     để không lộ điểm kích hoạt/quái vật). Ghi chỉ qua hàm gateway (R08.2/R08.3), bảo vệ bằng trigger cả với service_role.
--   * Không thể có chạm trán thứ tám: check 1..7 + unique (run_id, encounter_no) + trigger đếm theo encounter_count.
--   * question_instances: thêm ngữ cảnh 'game_encounter' (run_id, game_encounter_id), vị trí 1..3, không lặp nội dung trong lượt.
--   * Lưu vị trí: lượt đã có chạm trán không được đi xuyên/rời điểm kích hoạt chưa xử lý (kích hoạt thật: R08.3).
-- Thứ tự khóa (khớp R06/R07): lớp → mùa → lượt chơi → chạm trán → câu.
-- =====================================================================================

-- -------------------------------------------------------------------------------------
-- Điểm kích hoạt của từng phiên bản màn
-- -------------------------------------------------------------------------------------

create table private.game_level_triggers (
  game_key text not null,
  level_key text not null,
  level_version text not null,
  trigger_key text not null check (trigger_key ~ '^[a-z0-9][a-z0-9-]{1,31}$'),
  row_no int not null check (row_no >= 0),
  col_no int not null check (col_no >= 0),
  primary key (game_key, level_key, level_version, trigger_key),
  unique (game_key, level_key, level_version, row_no, col_no),
  foreign key (game_key, level_key, level_version) references private.game_levels (game_key, level_key, level_version)
);
comment on table private.game_level_triggers is
  'Điểm kích hoạt chạm trán (đúng 7 mỗi phiên bản màn Mê cung). Phiên bản màn mới = thêm dòng mới bằng migration, không sửa dòng cũ.';
revoke all on private.game_level_triggers from public, anon, authenticated;
grant select on private.game_level_triggers to service_role;

-- Điểm kích hoạt phải nằm trên ô đường đi ('.') của đúng phiên bản màn (không phải tường, xuất phát hay rương).
create or replace function private.guard_game_level_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if private.game_cell(new.game_key, new.level_key, new.level_version, new.row_no, new.col_no) is distinct from '.' then
    raise exception 'TRIGGER_NOT_ON_PATH' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger game_level_triggers_guard before insert on private.game_level_triggers
  for each row execute function private.guard_game_level_trigger();
create trigger game_level_triggers_immutable before update or delete on private.game_level_triggers
  for each row execute function private.block_change();

insert into private.game_level_triggers (game_key, level_key, level_version, trigger_key, row_no, col_no)
select 'treasure_maze', v.level_key, l.level_version, v.trigger_key, v.r, v.c
from (values
  ('treasure-maze-01', 'tm01-t1', 1, 4),
  ('treasure-maze-01', 'tm01-t2', 2, 7),
  ('treasure-maze-01', 'tm01-t3', 5, 6),
  ('treasure-maze-01', 'tm01-t4', 3, 5),
  ('treasure-maze-01', 'tm01-t5', 3, 2),
  ('treasure-maze-01', 'tm01-t6', 6, 1),
  ('treasure-maze-01', 'tm01-t7', 7, 5),
  ('treasure-maze-02', 'tm02-t1', 3, 3),
  ('treasure-maze-02', 'tm02-t2', 5, 4),
  ('treasure-maze-02', 'tm02-t3', 7, 4),
  ('treasure-maze-02', 'tm02-t4', 9, 4),
  ('treasure-maze-02', 'tm02-t5', 6, 7),
  ('treasure-maze-02', 'tm02-t6', 9, 9),
  ('treasure-maze-02', 'tm02-t7', 1, 9),
  ('treasure-maze-03', 'tm03-t1', 1, 7),
  ('treasure-maze-03', 'tm03-t2', 5, 9),
  ('treasure-maze-03', 'tm03-t3', 7, 11),
  ('treasure-maze-03', 'tm03-t4', 1, 9),
  ('treasure-maze-03', 'tm03-t5', 9, 3),
  ('treasure-maze-03', 'tm03-t6', 9, 1),
  ('treasure-maze-03', 'tm03-t7', 3, 3)
) as v(level_key, trigger_key, r, c)
join private.game_levels l on l.game_key = 'treasure_maze' and l.level_key = v.level_key and l.is_current;

do $$
begin
  if exists (
    select 1 from private.game_levels l
    where l.game_key = 'treasure_maze'
      and (select count(*) from private.game_level_triggers t
           where t.game_key = l.game_key and t.level_key = l.level_key and t.level_version = l.level_version) <> 7
  ) then
    raise exception 'Mỗi màn Mê cung phải có đúng 7 điểm kích hoạt';
  end if;
end;
$$;

-- -------------------------------------------------------------------------------------
-- game_encounters
-- -------------------------------------------------------------------------------------

-- Khóa phụ để chạm trán/câu bám CHÍNH XÁC học sinh, lớp, mùa của lượt chơi (khóa ngoại tổng hợp).
alter table public.game_runs add constraint game_runs_identity_key unique (id, student_id, class_id, season_id);

create table public.game_encounters (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null,
  student_id uuid not null,
  class_id uuid not null,
  season_id uuid not null,
  encounter_no smallint not null check (encounter_no between 1 and 7),
  trigger_key text not null check (trigger_key ~ '^[a-z0-9][a-z0-9-]{1,31}$'),
  monster_key text not null check (monster_key ~ '^[a-z0-9][a-z0-9_-]{1,47}$'),
  hp_remaining smallint not null default 3 check (hp_remaining between 0 and 3),
  status text not null default 'pending' check (status in ('pending', 'active', 'defeated', 'undefeated', 'void')),
  return_position jsonb null check (return_position is null or private.game_position_shape_ok(return_position)),
  activated_at timestamptz null,
  resolved_at timestamptz null,
  foreign key (run_id, student_id, class_id, season_id)
    references public.game_runs (id, student_id, class_id, season_id) on delete cascade,
  unique (run_id, encounter_no),
  unique (run_id, trigger_key),
  unique (run_id, monster_key),
  unique (id, run_id, student_id, class_id, season_id),
  check (status <> 'pending' or (hp_remaining = 3 and activated_at is null and resolved_at is null and return_position is null)),
  check (status <> 'active' or (activated_at is not null and resolved_at is null and return_position is not null)),
  check (status not in ('defeated', 'undefeated') or (activated_at is not null and resolved_at is not null and return_position is not null)),
  check (status <> 'defeated' or hp_remaining = 0),
  check (status <> 'undefeated' or hp_remaining > 0),
  check (status <> 'void' or resolved_at is not null),
  check (activated_at is null or return_position is not null)
);
comment on table public.game_encounters is
  'Cuộc chạm trán (phân bổ sẵn khi tạo lượt, R08.2). Tối đa 7 mỗi lượt; kết thúc (defeated/undefeated/void) là cuối cùng, không mở lại.';
create index game_encounters_student_idx on public.game_encounters (student_id);
create index game_encounters_class_idx on public.game_encounters (class_id);
create index game_encounters_season_open_idx on public.game_encounters (season_id) where status in ('pending', 'active');
-- Mỗi lượt chỉ có một chạm trán đang diễn ra.
create unique index game_encounters_one_active on public.game_encounters (run_id) where status = 'active';

create or replace function private.guard_game_encounter()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_run public.game_runs;
  v_run_status text;
  v_existing int;
begin
  if tg_op = 'INSERT' then
    -- Khóa dòng lượt chơi (reset mùa cập nhật dòng này trước khi đóng chạm trán → không để lại dòng pending trên lượt void).
    select * into v_run from public.game_runs g where g.id = new.run_id for share;
    if v_run.id is null or v_run.student_id <> new.student_id or v_run.class_id <> new.class_id
       or v_run.season_id <> new.season_id then
      raise exception 'ENCOUNTER_RUN_MISMATCH' using errcode = '23514';
    end if;
    if v_run.game_key <> 'treasure_maze' or v_run.status <> 'in_progress' then
      raise exception 'RUN_NOT_ACTIVE' using errcode = '23514';
    end if;
    if new.status <> 'pending' then
      raise exception 'INVALID_INITIAL_STATE' using errcode = '23514';
    end if;
    select count(*) into v_existing from public.game_encounters e where e.run_id = new.run_id;
    if v_existing >= v_run.encounter_count or new.encounter_no > v_run.encounter_count then
      raise exception 'ENCOUNTER_LIMIT' using errcode = '23514';
    end if;
    if not exists (
      select 1 from private.game_level_triggers t
      where t.game_key = v_run.game_key and t.level_key = v_run.level_key and t.level_version = v_run.level_version
        and t.trigger_key = new.trigger_key
    ) then
      raise exception 'UNKNOWN_TRIGGER' using errcode = '23514';
    end if;
    return new;
  end if;

  -- UPDATE
  if new.id <> old.id or new.run_id <> old.run_id or new.student_id <> old.student_id or new.class_id <> old.class_id
     or new.season_id <> old.season_id or new.encounter_no <> old.encounter_no or new.trigger_key <> old.trigger_key
     or new.monster_key <> old.monster_key then
    raise exception 'ENCOUNTER_IMMUTABLE' using errcode = '23514';
  end if;
  if old.status in ('defeated', 'undefeated', 'void') then
    raise exception 'ENCOUNTER_FINISHED' using errcode = '23514';
  end if;
  if new.status <> old.status
     and not ((old.status = 'pending' and new.status in ('active', 'void'))
              or (old.status = 'active' and new.status in ('defeated', 'undefeated', 'void'))) then
    raise exception 'INVALID_ENCOUNTER_TRANSITION' using errcode = '23514';
  end if;
  -- Điểm kích hoạt/vị trí quay lại/thời điểm kích hoạt chỉ được đặt MỘT lần, đúng lúc pending → active.
  if not (old.status = 'pending' and new.status = 'active')
     and (new.return_position is distinct from old.return_position or new.activated_at is distinct from old.activated_at) then
    raise exception 'ENCOUNTER_IMMUTABLE' using errcode = '23514';
  end if;
  -- HP chỉ giảm từng bước một và chỉ khi đang diễn ra.
  if new.hp_remaining <> old.hp_remaining and not (old.status = 'active' and new.hp_remaining = old.hp_remaining - 1) then
    raise exception 'INVALID_HP' using errcode = '23514';
  end if;
  -- Chỉ đóng bằng 'void' (reset mùa) khi lượt không còn hoạt động; mọi thay đổi khác cần lượt đang chơi.
  if new.status <> 'void' then
    select g.status into v_run_status from public.game_runs g where g.id = new.run_id for share;
    if v_run_status is distinct from 'in_progress' then
      raise exception 'RUN_NOT_ACTIVE' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;
create trigger game_encounters_guard before insert or update on public.game_encounters
  for each row execute function private.guard_game_encounter();
create trigger game_encounters_no_direct_delete before delete on public.game_encounters
  for each row execute function private.block_direct_change();

alter table public.game_encounters enable row level security;
create policy game_encounters_staff_read on public.game_encounters for select to authenticated
  using (class_id in (select private.my_class_ids()) or (select private.is_admin()));
-- Học sinh (thiết bị) chỉ thấy chạm trán của chính mình đã kích hoạt/kết thúc; dòng pending ẩn (không lộ điểm kích hoạt/quái vật).
create policy game_encounters_device_read on public.game_encounters for select to authenticated
  using (student_id in (select private.my_student_ids()) and status <> 'pending');

revoke all on public.game_encounters from public, anon, authenticated;
grant select on public.game_encounters to authenticated;
grant all on public.game_encounters to service_role;

-- -------------------------------------------------------------------------------------
-- question_instances: ngữ cảnh game_encounter (R04 luyện tập giữ nguyên)
-- -------------------------------------------------------------------------------------

alter table public.question_instances drop constraint question_instances_context_kind_check;
alter table public.question_instances add constraint question_instances_context_kind_check
  check (context_kind in ('practice_session', 'game_encounter'));
alter table public.question_instances add column run_id uuid null;
alter table public.question_instances add column game_encounter_id uuid null;
alter table public.question_instances add constraint question_instances_game_encounter_fk
  foreign key (game_encounter_id, run_id, student_id, class_id, season_id)
  references public.game_encounters (id, run_id, student_id, class_id, season_id) on delete cascade;
alter table public.question_instances add constraint question_instances_context_shape check (
  (context_kind = 'practice_session' and practice_session_id is not null and run_id is null and game_encounter_id is null)
  or (context_kind = 'game_encounter' and practice_session_id is null and run_id is not null
      and game_encounter_id is not null and position between 1 and 3)
);
-- Đúng 3 câu riêng biệt mỗi chạm trán; cùng lượt không lặp nội dung (theo vân tay) hay câu gốc.
create unique index question_instances_encounter_position on public.question_instances (game_encounter_id, position)
  where game_encounter_id is not null;
create unique index question_instances_run_item on public.question_instances (run_id, exercise_item_id)
  where run_id is not null;
create unique index question_instances_run_content on public.question_instances (run_id, content_fingerprint)
  where run_id is not null;
create index question_instances_run_idx on public.question_instances (run_id) where run_id is not null;

create or replace function private.guard_question_instance()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item public.exercise_items;
  v_status text;
  v_origin text;
  v_enc_status text;
  v_run_status text;
begin
  if tg_op = 'INSERT' then
    select i.* into v_item from public.exercise_items i where i.id = new.exercise_item_id;
    select v.status, e.origin into v_status, v_origin
    from public.exercise_versions v join public.exercises e on e.id = v.exercise_id
    where v.id = v_item.exercise_version_id;
    if v_item.exercise_version_id is distinct from new.exercise_version_id or v_status is distinct from 'approved' then
      raise exception 'CONTENT_NOT_APPROVED' using errcode = '23514';
    end if;
    if v_origin = 'test_fixture' and not private.test_fixtures_allowed() then
      raise exception 'TEST_FIXTURES_NOT_ALLOWED' using errcode = '23514';
    end if;
    if new.content_fingerprint <> v_item.content_fingerprint
       or new.view <> jsonb_build_object('type', v_item.type_code, 'variant', v_item.variant, 'content', v_item.content) then
      raise exception 'VIEW_MISMATCH' using errcode = '23514';
    end if;
    if new.attempts_used <> 0 or new.status <> 'open' or new.rewarded then
      raise exception 'INVALID_INITIAL_STATE' using errcode = '23514';
    end if;
    if new.context_kind = 'game_encounter' then
      -- Câu game chỉ gắn vào chạm trán chưa kết thúc của lượt còn hoạt động (cùng học sinh/lớp/mùa đã được khóa ngoại kiểm).
      select e.status, g.status into v_enc_status, v_run_status
      from public.game_encounters e join public.game_runs g on g.id = e.run_id
      where e.id = new.game_encounter_id;
      if v_enc_status is null or v_enc_status not in ('pending', 'active') or v_run_status <> 'in_progress' then
        raise exception 'ENCOUNTER_NOT_OPEN' using errcode = '23514';
      end if;
    end if;
    return new;
  end if;
  if new.student_id <> old.student_id or new.class_id <> old.class_id or new.season_id <> old.season_id
     or new.context_kind <> old.context_kind or new.practice_session_id is distinct from old.practice_session_id
     or new.run_id is distinct from old.run_id or new.game_encounter_id is distinct from old.game_encounter_id
     or new.position <> old.position or new.exercise_item_id <> old.exercise_item_id
     or new.exercise_version_id <> old.exercise_version_id or new.content_fingerprint <> old.content_fingerprint
     or new.view <> old.view or new.support_level <> old.support_level or new.max_attempts <> old.max_attempts
     or new.scorable <> old.scorable or new.not_scorable_reason is distinct from old.not_scorable_reason
     or new.opened_at <> old.opened_at then
    raise exception 'QUESTION_IMMUTABLE' using errcode = '23514';
  end if;
  if new.attempts_used not in (old.attempts_used, old.attempts_used + 1) then
    raise exception 'INVALID_ATTEMPT_COUNT' using errcode = '23514';
  end if;
  if new.status <> old.status and not (old.status = 'open' and new.status in ('correct', 'exhausted', 'void')) then
    raise exception 'INVALID_QUESTION_TRANSITION' using errcode = '23514';
  end if;
  if old.rewarded and not new.rewarded then
    raise exception 'QUESTION_IMMUTABLE' using errcode = '23514';
  end if;
  return new;
end;
$$;

-- -------------------------------------------------------------------------------------
-- Lưu vị trí: không đi xuyên/rời điểm kích hoạt chưa xử lý (R08.3 sẽ kích hoạt; ở đây chỉ chặn bỏ qua)
-- -------------------------------------------------------------------------------------

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
  -- Lượt fixture không tính điểm chưa phân bổ chạm trán (R07): giữ nguyên hành vi cũ.
  if v_total = 0 and not p_run.scored then
    return;
  end if;
  -- Lượt tính điểm thật PHẢI có đủ chạm trán; thiếu → không cho hoạt động.
  if p_run.scored and v_total <> p_run.encounter_count then
    raise exception 'ENCOUNTERS_INCOMPLETE' using errcode = '22023';
  end if;
  if v_len = 0 then
    return;
  end if;
  if exists (select 1 from public.game_encounters e where e.run_id = p_run.id and e.status = 'active') then
    raise exception 'ENCOUNTER_ACTIVE' using errcode = '22023';
  end if;
  -- Ô kích hoạt "chưa xử lý" = chưa có dòng chạm trán, hoặc đang pending. Rời ô đó hoặc đi xuyên qua nó đều bị chặn;
  -- chỉ được DỪNG tại ô đó (bước cuối của đường đi) để R08.3 kích hoạt.
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

create or replace function public.gateway_save_game_position(
  p_auth_user_id uuid,
  p_student_id uuid,
  p_run_id uuid,
  p_path jsonb,
  p_state_version int
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_class_id uuid;
  v_season_id uuid;
  v_status text;
  v_run public.game_runs;
  v_len int;
  v_elem jsonb;
  v_final jsonb;
begin
  if p_run_id is null or p_state_version is null or p_state_version < 1
     or p_path is null or jsonb_typeof(p_path) <> 'array' then
    raise exception 'INVALID_INPUT' using errcode = '22023';
  end if;
  v_len := jsonb_array_length(p_path);
  if v_len > 64 then
    raise exception 'INVALID_INPUT' using errcode = '22023';
  end if;
  for v_elem in select e from jsonb_array_elements(p_path) e loop
    if not private.game_position_shape_ok(v_elem) then
      raise exception 'INVALID_POSITION' using errcode = '22023';
    end if;
  end loop;

  v_class_id := private.require_linked_device(p_auth_user_id, p_student_id);
  if not private.consent_active(p_student_id, 'learning_data') then
    raise exception 'CONSENT_REQUIRED' using errcode = '42501';
  end if;

  select g.season_id into v_season_id from public.game_runs g
  where g.id = p_run_id and g.student_id = p_student_id and g.class_id = v_class_id;
  if v_season_id is null then
    raise exception 'NOT_FOUND' using errcode = '22023';
  end if;
  select s.status into v_status from public.seasons s where s.id = v_season_id for share;
  if v_status is distinct from 'active' then
    raise exception 'SEASON_CLOSED' using errcode = '22023';
  end if;
  select * into v_run from public.game_runs g where g.id = p_run_id for update;
  if v_run.status <> 'in_progress' then
    raise exception 'RUN_NOT_ACTIVE' using errcode = '22023';
  end if;

  v_final := case when v_len = 0 then v_run.position else p_path -> (v_len - 1) end;
  if p_state_version <> v_run.state_version then
    if p_state_version < v_run.state_version and v_len > 0 and v_final = v_run.position then
      return jsonb_build_object('outcome', 'replayed', 'state_version', v_run.state_version, 'position', v_run.position);
    end if;
    raise exception 'STATE_CONFLICT' using errcode = '22023';
  end if;
  -- R08.1: chạm trán chưa xử lý chặn đường đi; lượt tính điểm thiếu chạm trán không hoạt động (kể cả khi chỉ báo còn hoạt động).
  perform private.game_check_encounter_path(v_run, p_path);
  if v_len = 0 then
    update public.game_runs set last_active_at = now() where id = v_run.id;
    return jsonb_build_object('outcome', 'unchanged', 'state_version', v_run.state_version, 'position', v_run.position);
  end if;

  v_final := private.game_walk(v_run.game_key, v_run.level_key, v_run.level_version, v_run.position, p_path);
  if v_final = v_run.position then
    update public.game_runs set last_active_at = now() where id = v_run.id;
    return jsonb_build_object('outcome', 'unchanged', 'state_version', v_run.state_version, 'position', v_run.position);
  end if;
  update public.game_runs set position = v_final, state_version = state_version + 1, last_active_at = now()
  where id = v_run.id
  returning * into v_run;
  return jsonb_build_object('outcome', 'saved', 'state_version', v_run.state_version, 'position', v_run.position);
end;
$$;

-- -------------------------------------------------------------------------------------
-- Quyền hàm
-- -------------------------------------------------------------------------------------

revoke all on function private.guard_game_level_trigger() from public, anon, authenticated;
revoke all on function private.guard_game_encounter() from public, anon, authenticated;
revoke all on function private.game_check_encounter_path(public.game_runs, jsonb) from public, anon, authenticated;
grant execute on function private.game_check_encounter_path(public.game_runs, jsonb) to service_role;
revoke all on function public.gateway_save_game_position(uuid, uuid, uuid, jsonb, int) from public, anon, authenticated;
grant execute on function public.gateway_save_game_position(uuid, uuid, uuid, jsonb, int) to service_role;
