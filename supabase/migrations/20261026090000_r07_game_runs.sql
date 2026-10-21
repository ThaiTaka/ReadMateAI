-- =====================================================================================
-- R07.5a — Lượt chơi Mê cung kho báu: bảng game_runs + dữ liệu bản đồ phía CSDL + hàm gateway bắt đầu/tiếp tục/lưu vị trí.
-- GAME_DESIGN §4.7–4.8, REDESIGN_ARCHITECTURE §5.3. KHÔNG có game_encounters/câu hỏi/HP/rương (R08).
--
--   * RLS bật, chỉ policy SELECT (thiết bị: lượt của chính học sinh; GV: lớp mình). Ghi CHỈ qua gateway_* (service_role).
--   * Vị trí do CSDL kiểm theo bản đồ (private.game_levels, đồng bộ với content/games/treasure-maze — có test đối chiếu):
--     nguyên, trong bản đồ, không phải tường, và mỗi lần lưu là một CHUỖI bước kề nhau từ vị trí đã lưu (tối đa 64 bước).
--     Không có "dịch chuyển tức thời". Lưu vị trí không đổi điểm, không mở rương, không kích hoạt chạm trán.
--   * Optimistic concurrency: state_version. Phiên bản cũ/mới hơn → STATE_CONFLICT (không ghi đè). Gửi lại đúng yêu cầu đã
--     thành công (phiên bản cũ nhưng vị trí hiện tại đã bằng đích) → trả 'replayed', không ghi.
--   * Thứ tự khóa (khớp reset mùa R06 và ghi điểm R04): mùa (FOR SHARE) → dòng lượt chơi (FOR UPDATE).
--   * Ngưỡng vào chơi xét ĐIỂM HIỆN TẠI (balance) của mùa, không trừ điểm khi vào.
--   * CHƯA đủ nội dung (R08 chưa phân bổ 7 chạm trán/21 câu): tạo lượt mới trả INSUFFICIENT_CONTENT. Chỉ khi môi trường
--     kiểm thử LOCAL bật cờ riêng (private.test_environment.game_run_fixtures_allowed, mặc định TẮT, cần cả fixtures_allowed)
--     mới tạo lượt KHÔNG tính điểm (scored = false) để kiểm thử cơ chế lưu trạng thái. Không có đường nào tạo lượt scored.
-- =====================================================================================

-- -------------------------------------------------------------------------------------
-- Cờ kiểm thử riêng cho lượt chơi fixture (tắt mặc định; chỉ script local bật)
-- -------------------------------------------------------------------------------------

alter table private.test_environment add column game_run_fixtures_allowed boolean not null default false;

create or replace function private.game_run_fixtures_allowed()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select t.fixtures_allowed and t.game_run_fixtures_allowed
                   from private.test_environment t where t.singleton), false);
$$;

-- -------------------------------------------------------------------------------------
-- Bản đồ các màn (bản sao có kiểm của content/games/treasure-maze/levels/*.json)
-- -------------------------------------------------------------------------------------

create table private.game_levels (
  game_key text not null check (game_key = 'treasure_maze'),
  level_key text not null,
  level_version text not null,
  level_name text not null,
  rows text[] not null check (array_length(rows, 1) between 9 and 13),
  start_row int not null check (start_row >= 0),
  start_col int not null check (start_col >= 0),
  is_current boolean not null default true,
  primary key (game_key, level_key, level_version),
  check (substr(rows[start_row + 1], start_col + 1, 1) = 'S')
);
comment on table private.game_levels is
  'Bản đồ từng màn để CSDL kiểm vị trí (tường/biên). level_version = SHA-256 hex của các hàng nối bằng LF. Đổi bản đồ = thêm phiên bản mới (is_current) bằng migration; lượt đang dở vẫn dùng đúng phiên bản của nó.';
create unique index game_levels_one_current on private.game_levels (game_key, level_key) where is_current;
revoke all on private.game_levels from public, anon, authenticated;

create trigger game_levels_immutable before delete on private.game_levels
  for each row execute function private.block_change();

insert into private.game_levels (game_key, level_key, level_version, level_name, rows, start_row, start_col)
select 'treasure_maze', v.level_key, encode(sha256(convert_to(array_to_string(v.rows, chr(10)), 'UTF8')), 'hex'), v.level_name, v.rows, v.sr, v.sc
from (values
  ('treasure-maze-01', 'Khu vườn khởi đầu', array['#########', '#S......#', '#######.#', '#.....#.#', '#.###.#.#', '#.#.....#', '#.#######', '#T......#', '#########']::text[], 1, 1),
  ('treasure-maze-02', 'Rừng lối rẽ', array['###########', '#S..#T....#', '###.#####.#', '#...#...#.#', '#.###.#.#.#', '#.....#...#', '#####.#.#.#', '#.....#.#.#', '#.#.#.#.#.#', '#.#.......#', '###########']::text[], 1, 1),
  ('treasure-maze-03', 'Mê cung kho báu', array['#############', '#S......#...#', '#######.#.###', '#T..#...#...#', '#.#.#.#####.#', '#...#.......#', '#.#.#####.#.#', '#.#.#.....#.#', '###.#.#####.#', '#.....#.....#', '#.###.#####.#', '#...........#', '#############']::text[], 1, 1)
) as v(level_key, level_name, rows, sr, sc);

-- Ô tại (hàng, cột) của một màn; NULL nếu ngoài bản đồ hoặc không có màn.
create or replace function private.game_cell(p_game_key text, p_level_key text, p_level_version text, p_row int, p_col int)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
           when p_row between 0 and array_length(l.rows, 1) - 1 and p_col between 0 and length(l.rows[p_row + 1]) - 1
             then substr(l.rows[p_row + 1], p_col + 1, 1)
         end
  from private.game_levels l
  where l.game_key = p_game_key and l.level_key = p_level_key and l.level_version = p_level_version;
$$;

-- Một phần tử vị trí hợp lệ về HÌNH DẠNG: {row, col} là số nguyên không âm (không nhận chuỗi, số thực, khóa thiếu).
create or replace function private.game_position_shape_ok(p_position jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    jsonb_typeof(p_position) = 'object'
    and jsonb_typeof(p_position -> 'row') = 'number' and jsonb_typeof(p_position -> 'col') = 'number'
    and (p_position ->> 'row') ~ '^[0-9]{1,3}$' and (p_position ->> 'col') ~ '^[0-9]{1,3}$',
    false);
$$;

-- Đi theo chuỗi bước từ vị trí p_from: mỗi bước phải kề (1 ô, 4 hướng) và không phải tường/ngoài bản đồ.
create or replace function private.game_walk(p_game_key text, p_level_key text, p_level_version text, p_from jsonb, p_path jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_row int := (p_from ->> 'row')::int;
  v_col int := (p_from ->> 'col')::int;
  v_step jsonb;
  v_nr int;
  v_nc int;
begin
  for v_step in select e from jsonb_array_elements(p_path) e loop
    v_nr := (v_step ->> 'row')::int;
    v_nc := (v_step ->> 'col')::int;
    if abs(v_nr - v_row) + abs(v_nc - v_col) <> 1 then
      raise exception 'INVALID_POSITION' using errcode = '22023';
    end if;
    if coalesce(private.game_cell(p_game_key, p_level_key, p_level_version, v_nr, v_nc), '#') = '#' then
      raise exception 'INVALID_POSITION' using errcode = '22023';
    end if;
    v_row := v_nr;
    v_col := v_nc;
  end loop;
  return jsonb_build_object('row', v_row, 'col', v_col);
end;
$$;

-- -------------------------------------------------------------------------------------
-- game_runs
-- -------------------------------------------------------------------------------------

create table public.game_runs (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null,
  student_id uuid not null,
  season_id uuid not null,
  game_key text not null check (game_key in ('treasure_maze', 'wonder_forest', 'tone_island', 'rhyme_castle')),
  level_key text not null check (length(level_key) between 1 and 64),
  level_version text not null check (level_version ~ '^[0-9a-f]{64}$'),
  status text not null default 'in_progress'
    check (status in ('in_progress', 'completed', 'abandoned', 'void_season_reset')),
  scored boolean not null default false,
  position jsonb not null check (private.game_position_shape_ok(position)),
  state_version int not null default 1 check (state_version >= 1),
  encounter_count smallint not null default 7 check (encounter_count between 1 and 7),
  treasure_opened_at timestamptz null,
  started_at timestamptz not null default now(),
  last_active_at timestamptz not null default now(),
  completed_at timestamptz null,
  ended_at timestamptz null,
  foreign key (student_id, class_id) references public.students (id, class_id) on delete cascade,
  foreign key (season_id, class_id) references public.seasons (id, class_id) on delete cascade,
  foreign key (game_key, level_key, level_version) references private.game_levels (game_key, level_key, level_version),
  check ((status = 'in_progress') = (ended_at is null)),
  check ((status = 'completed') = (completed_at is not null)),
  check (treasure_opened_at is null or status = 'completed'),
  check (not (scored and status = 'abandoned')),
  check (game_key <> 'treasure_maze' or encounter_count = 7)
);
comment on table public.game_runs is
  'Một lượt chơi một màn. position = {row, col} lưu gần nhất; state_version tăng mỗi lần vị trí đổi. Chưa có chạm trán/câu hỏi (R08).';
create unique index game_runs_one_in_progress on public.game_runs (student_id, game_key, level_key) where status = 'in_progress';
create unique index game_runs_one_scored on public.game_runs (season_id, student_id, game_key, level_key) where scored;
create index game_runs_class_idx on public.game_runs (class_id);
create index game_runs_student_idx on public.game_runs (student_id);
create index game_runs_season_in_progress_idx on public.game_runs (season_id) where status = 'in_progress';

-- Vị trí luôn nằm trên ô đi được của đúng phiên bản màn (kể cả khi ghi bằng service_role trực tiếp).
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
       or new.level_version <> old.level_version or new.scored <> old.scored or new.started_at <> old.started_at
       or new.encounter_count <> old.encounter_count then
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
create trigger game_runs_guard before insert or update on public.game_runs
  for each row execute function private.guard_game_run();
create trigger game_runs_no_direct_delete before delete on public.game_runs
  for each row execute function private.block_direct_change();

alter table public.game_runs enable row level security;
create policy game_runs_staff_read on public.game_runs for select to authenticated
  using (class_id in (select private.my_class_ids()) or (select private.is_admin()));
create policy game_runs_device_read on public.game_runs for select to authenticated
  using (student_id in (select private.my_student_ids()));

revoke all on public.game_runs from public, anon, authenticated;
grant select on public.game_runs to authenticated;
grant all on public.game_runs to service_role;

-- -------------------------------------------------------------------------------------
-- DTO của một lượt chơi (không có student_id/class_id/season_id)
-- -------------------------------------------------------------------------------------

create or replace function private.game_run_dto(p_run public.game_runs)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_build_object(
    'id', p_run.id, 'game_key', p_run.game_key, 'level_key', p_run.level_key, 'level_version', p_run.level_version,
    'status', p_run.status, 'scored', p_run.scored, 'position', p_run.position,
    'state_version', p_run.state_version, 'encounter_count', p_run.encounter_count);
$$;

-- -------------------------------------------------------------------------------------
-- Bắt đầu / tiếp tục lượt chơi
-- -------------------------------------------------------------------------------------

create or replace function public.gateway_start_game_run(
  p_auth_user_id uuid,
  p_student_id uuid,
  p_game_key text,
  p_level_key text
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
  v_balance int;
  v_run public.game_runs;
begin
  if p_game_key is distinct from 'treasure_maze' or p_level_key is null then
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

  -- Ngưỡng theo ĐIỂM HIỆN TẠI của mùa (không dùng điểm tích lũy); chưa có dòng điểm = 0. Không trừ điểm khi vào.
  select (r.game_min_balance ->> p_game_key)::int into v_min from private.scoring_rules r where r.version = v_rules_version;
  select coalesce((select ss.balance from public.season_scores ss
                   where ss.season_id = v_season_id and ss.student_id = p_student_id), 0) into v_balance;
  if v_min is null or v_balance < v_min then
    raise exception 'INSUFFICIENT_POINTS' using errcode = '22023';
  end if;

  select * into v_run from public.game_runs g
  where g.student_id = p_student_id and g.season_id = v_season_id and g.game_key = p_game_key
    and g.level_key = p_level_key and g.status = 'in_progress';
  if v_run.id is not null then
    return jsonb_build_object('outcome', 'resumed', 'run', private.game_run_dto(v_run));
  end if;

  -- R08 chưa phân bổ 7 chạm trán + 21 câu → không có lượt tính điểm. Fixture LOCAL chỉ tạo lượt không tính điểm.
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
end;
$$;

-- -------------------------------------------------------------------------------------
-- Lưu vị trí: p_path = các bước TIẾP THEO sau vị trí đã lưu (mỗi bước kề bước trước, tối đa 64); rỗng = chỉ báo còn hoạt động.
-- -------------------------------------------------------------------------------------

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

  -- season_id không đổi sau khi tạo: đọc không khóa, rồi khóa mùa TRƯỚC dòng lượt chơi (cùng thứ tự với reset mùa).
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
    -- Gửi lại yêu cầu đã thành công (phản hồi bị mất): đích đã là vị trí hiện tại → ổn định, không ghi.
    if p_state_version < v_run.state_version and v_len > 0 and v_final = v_run.position then
      return jsonb_build_object('outcome', 'replayed', 'state_version', v_run.state_version, 'position', v_run.position);
    end if;
    raise exception 'STATE_CONFLICT' using errcode = '22023';
  end if;
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
-- Quyền hàm: hàm nội bộ không cấp cho client; gateway_* chỉ service_role
-- -------------------------------------------------------------------------------------

revoke all on function private.game_run_fixtures_allowed() from public, anon, authenticated;
revoke all on function private.game_cell(text, text, text, int, int) from public, anon, authenticated;
revoke all on function private.game_position_shape_ok(jsonb) from public, anon, authenticated;
revoke all on function private.game_walk(text, text, text, jsonb, jsonb) from public, anon, authenticated;
revoke all on function private.guard_game_run() from public, anon, authenticated;
revoke all on function private.game_run_dto(public.game_runs) from public, anon, authenticated;
grant execute on function private.game_run_fixtures_allowed(), private.game_cell(text, text, text, int, int),
  private.game_position_shape_ok(jsonb), private.game_walk(text, text, text, jsonb, jsonb),
  private.game_run_dto(public.game_runs) to service_role;

revoke all on function public.gateway_start_game_run(uuid, uuid, text, text) from public, anon, authenticated;
revoke all on function public.gateway_save_game_position(uuid, uuid, uuid, jsonb, int) from public, anon, authenticated;
grant execute on function public.gateway_start_game_run(uuid, uuid, text, text) to service_role;
grant execute on function public.gateway_save_game_position(uuid, uuid, uuid, jsonb, int) to service_role;
