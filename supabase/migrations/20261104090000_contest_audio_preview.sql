-- CHẾ ĐỘ TRÌNH DIỄN CUỘC THI — âm thanh giọng máy tạo tự động, MIỀN DỮ LIỆU RIÊNG (docs/CONTEST_AUDIO.md).
--
-- Mục đích: dự án đang được chuẩn bị TRÌNH DIỄN trên máy local với học sinh hư cấu, chưa triển khai cho lớp học thật. Chủ dự án không
-- muốn duyệt từng tệp thủ công để nghe thử, nhưng KHÔNG được giả danh giáo viên để tạo phê duyệt chuyên môn. Vì vậy:
--
--   * Bảng RIÊNG `contest_audio_assets` + bucket RIÊNG `contest-audio` (cấu hình ở supabase/config.toml) + hàm phát RIÊNG. Không đụng
--     `audio_assets`/`audio_asset_versions` (bản ghi giáo viên) và `tts_audio_versions`/`tts_script_reviews` (giọng máy đã duyệt).
--   * Bảng KHÔNG có cột "đã duyệt/người duyệt/đã nghe": về cấu trúc, một dòng ở đây không thể trở thành "giáo viên đã duyệt". Nguồn gốc
--     cố định bằng ràng buộc: origin='ai_generated', purpose='contest_preview', technical_check='technical_check_passed'.
--   * Chỉ chạy khi CẢ HAI điều kiện đúng: cờ hệ thống `contest_audio_preview_enabled` BẬT và `private.test_environment.contest_audio_allowed`
--     BẬT. Migration này không bật cái nào; chỉ công cụ `npm run audio:contest` (chỉ Supabase LOCAL) và kiểm thử đổi được. Production không
--     có đường bật bằng mã ứng dụng.
--   * Mục có rủi ro cách đọc (`risk_class = needs_verification`) mặc định KHÔNG phát; cần thêm cờ `contest_audio_play_unverified`.
--   * Thu hồi toàn bộ luôn dùng được (kể cả khi chế độ đã tắt): `gateway_revoke_contest_audio`.
--   * Học sinh không có quyền đọc bảng hay Storage; chỉ máy chủ (service_role) gọi hàm kiểm tra lại mọi điều kiện ở MỖI lần phát.

insert into private.feature_flags (key, enabled, note) values
  ('contest_audio_preview_enabled', false,
   'Chế độ trình diễn cuộc thi: phát âm thanh giọng máy tạo tự động (chưa giáo viên nghe/duyệt). Chỉ bật trên Supabase LOCAL với học sinh hư cấu; production luôn TẮT.'),
  ('contest_audio_play_unverified', false,
   'Cho phép phát cả những mục trình diễn có rủi ro cách đọc (needs_verification). Mặc định TẮT; chỉ chủ dự án bật trên máy local khi trình diễn.');

alter table private.test_environment add column contest_audio_allowed boolean not null default false;
comment on column private.test_environment.contest_audio_allowed is
  'Cổng LOCAL của chế độ trình diễn âm thanh: mặc định TẮT, chỉ `npm run audio:contest` và kiểm thử trên Supabase local mới đổi. Production không bao giờ bật.';

-- Chế độ trình diễn đang hoạt động: cờ hệ thống BẬT và cổng local BẬT.
create or replace function private.contest_audio_active()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.feature_enabled('contest_audio_preview_enabled')
     and coalesce((select t.contest_audio_allowed from private.test_environment t where t.singleton), false);
$$;
revoke all on function private.contest_audio_active() from public, anon, authenticated;
grant execute on function private.contest_audio_active() to service_role;

-- -------------------------------------------------------------------------------------
-- Bảng
-- -------------------------------------------------------------------------------------

create table public.contest_audio_assets (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id),
  -- `letter:b` · `phoneme:gh` · `instruction:listen_letter` · `feedback:retry.tone` (danh mục src/features/contest-audio).
  entry_id text not null check (entry_id ~ '^(letter|phoneme|instruction|feedback):[^[:space:]]{1,60}$'),
  entry_kind text not null check (entry_kind in ('letter', 'phoneme', 'instruction', 'feedback')),
  spoken_text text not null check (spoken_text is nfc normalized and char_length(spoken_text) between 1 and 300),
  content_hash text not null check (content_hash ~ '^[0-9a-f]{64}$'),
  -- Khóa dùng lại tệp: nhà cung cấp + giọng + tốc độ + phiên bản cấu hình + chữ. Hai mục cùng chữ có thể trùng khóa (dùng chung một lần gọi).
  asset_key text not null check (asset_key ~ '^[0-9a-f]{64}$'),
  provider text not null check (provider = 'viettel'),
  voice_key text not null check (voice_key ~ '^[a-z0-9-]{1,40}$'),
  speed text not null check (speed in ('slow', 'normal')),
  config_version text not null check (config_version ~ '^contest-[a-z0-9._-]{1,40}$'),
  -- NGUỒN GỐC cố định: không đổi được thành "bản ghi giáo viên" hay "đã duyệt" vì không có chỗ nào để ghi như vậy.
  origin text not null default 'ai_generated' check (origin = 'ai_generated'),
  purpose text not null default 'contest_preview' check (purpose = 'contest_preview'),
  technical_check text not null default 'technical_check_passed' check (technical_check = 'technical_check_passed'),
  risk_class text not null check (risk_class in ('standard', 'needs_verification')),
  risk_reasons text not null default '' check (risk_reasons ~ '^[a-z_,]{0,120}$'),
  storage_bucket text not null default 'contest-audio' check (storage_bucket = 'contest-audio'),
  storage_key text not null check (
    storage_key ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(mp3|wav|ogg)$'
  ),
  mime_type text not null check (mime_type in ('audio/mpeg', 'audio/wav', 'audio/ogg')),
  size_bytes int not null check (size_bytes between 1 and 2097152),
  duration_ms int not null check (duration_ms between 300 and 10000),
  content_sha256 text not null check (content_sha256 ~ '^[0-9a-f]{64}$'),
  -- Số đo sau khi giải mã (phần nghìn của biên độ 0…1) — chỉ là kiểm tra kỹ thuật.
  peak_milli int not null check (peak_milli between 0 and 1000),
  rms_milli int not null check (rms_milli between 0 and 1000),
  created_at timestamptz not null default now(),
  revoked_at timestamptz null,
  revoke_reason text null check (revoke_reason is null or char_length(revoke_reason) between 3 and 200),
  check (entry_id like entry_kind || ':%'),
  check ((revoked_at is null) = (revoke_reason is null))
);
comment on table public.contest_audio_assets is
  'Âm thanh giọng máy TRÌNH DIỄN (tạo tự động, chỉ qua kiểm tra kỹ thuật, chưa ai nghe/duyệt). Miền riêng, tách khỏi bản ghi giáo viên và thư viện giọng máy đã duyệt; không có cột duyệt.';

create index contest_audio_assets_school_entry_idx on public.contest_audio_assets (school_id, entry_id, created_at desc);
-- Mỗi (trường, mục) có tối đa MỘT tệp đang dùng.
create unique index contest_audio_assets_one_live on public.contest_audio_assets (school_id, entry_id) where revoked_at is null;

-- Bất biến: không xóa; mọi cột không đổi sau khi tạo, trừ việc thu hồi một lần (revoked_at + revoke_reason).
create or replace function private.guard_contest_audio()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'CONTEST_AUDIO_NO_DELETE' using errcode = '23514';
  end if;
  if tg_op = 'UPDATE' then
    if old.revoked_at is not null then
      raise exception 'CONTEST_AUDIO_IMMUTABLE' using errcode = '23514';
    end if;
    if (to_jsonb(new) - 'revoked_at' - 'revoke_reason') is distinct from (to_jsonb(old) - 'revoked_at' - 'revoke_reason') then
      raise exception 'CONTEST_AUDIO_IMMUTABLE' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function private.guard_contest_audio() from public, anon, authenticated;
grant execute on function private.guard_contest_audio() to service_role;

create trigger contest_audio_assets_guard
  before update or delete on public.contest_audio_assets
  for each row execute function private.guard_contest_audio();

-- -------------------------------------------------------------------------------------
-- Hàm của công cụ trình diễn (chỉ service_role)
-- -------------------------------------------------------------------------------------

-- Đăng ký một tệp đã qua kiểm tra kỹ thuật. Chỉ khi chế độ đang hoạt động. Idempotent: cùng khóa tệp + cùng nội dung → trả lại bản đang dùng.
create or replace function public.gateway_register_contest_audio(
  p_school_id uuid,
  p_version_id uuid,
  p_entry_id text,
  p_spoken_text text,
  p_content_hash text,
  p_asset_key text,
  p_config_version text,
  p_risk_class text,
  p_risk_reasons text,
  p_storage_key text,
  p_mime_type text,
  p_size_bytes int,
  p_duration_ms int,
  p_content_sha256 text,
  p_peak_milli int,
  p_rms_milli int
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_live public.contest_audio_assets;
  v_kind text;
begin
  if not private.contest_audio_active() then
    raise exception 'CONTEST_AUDIO_DISABLED' using errcode = '22023';
  end if;
  if p_school_id is null or p_version_id is null or p_entry_id is null
     or not exists (select 1 from public.schools s where s.id = p_school_id) then
    raise exception 'INVALID_INPUT' using errcode = '22023';
  end if;
  v_kind := split_part(p_entry_id, ':', 1);

  select a.* into v_live from public.contest_audio_assets a
   where a.school_id = p_school_id and a.entry_id = p_entry_id and a.revoked_at is null;
  if v_live.id is not null then
    if v_live.asset_key = p_asset_key and v_live.content_hash = p_content_hash then
      return jsonb_build_object('versionId', v_live.id, 'reused', true);
    end if;
    -- Chữ hoặc cấu hình giọng đã đổi: tệp cũ ngừng phát, tệp mới thay thế.
    update public.contest_audio_assets set revoked_at = now(), revoke_reason = 'superseded_by_new_version' where id = v_live.id;
  end if;

  insert into public.contest_audio_assets (
    id, school_id, entry_id, entry_kind, spoken_text, content_hash, asset_key, provider, voice_key, speed, config_version,
    risk_class, risk_reasons, storage_key, mime_type, size_bytes, duration_ms, content_sha256, peak_milli, rms_milli)
  values (
    p_version_id, p_school_id, p_entry_id, v_kind, p_spoken_text, p_content_hash, p_asset_key, 'viettel', 'vi-male-1', 'slow',
    p_config_version, p_risk_class, coalesce(p_risk_reasons, ''), p_storage_key, p_mime_type, p_size_bytes, p_duration_ms,
    p_content_sha256, p_peak_milli, p_rms_milli);
  return jsonb_build_object('versionId', p_version_id, 'reused', false);
end;
$$;

-- Thu hồi TOÀN BỘ tệp trình diễn đang dùng (của một trường, hoặc mọi trường nếu p_school_id null). Luôn dùng được, kể cả khi chế độ đã tắt.
create or replace function public.gateway_revoke_contest_audio(p_school_id uuid, p_reason text)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count int;
begin
  if p_reason is null or char_length(p_reason) not between 3 and 200 then
    raise exception 'INVALID_INPUT' using errcode = '22023';
  end if;
  update public.contest_audio_assets
     set revoked_at = now(), revoke_reason = p_reason
   where revoked_at is null and (p_school_id is null or school_id = p_school_id);
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- -------------------------------------------------------------------------------------
-- Hàm của student gateway (chỉ service_role, chỉ ĐỌC)
-- -------------------------------------------------------------------------------------

-- Bộ kiểm tra dùng chung: trả metadata tệp đang dùng khớp băm nội dung + khóa tệp hiện hành, hoặc ném mã lỗi máy đọc.
create or replace function private.resolve_contest_audio(
  p_school_id uuid,
  p_entry_id text,
  p_content_hash text,
  p_asset_key text,
  p_require_playable boolean
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_row public.contest_audio_assets;
  v_playable boolean;
begin
  select a.* into v_row from public.contest_audio_assets a
   where a.school_id = p_school_id and a.entry_id = p_entry_id and a.revoked_at is null;
  if v_row.id is null or v_row.content_hash <> p_content_hash or v_row.asset_key <> p_asset_key then
    raise exception 'AUDIO_NOT_AVAILABLE' using errcode = '22023';
  end if;
  v_playable := v_row.risk_class = 'standard' or private.feature_enabled('contest_audio_play_unverified');
  if p_require_playable and not v_playable then
    raise exception 'AUDIO_NOT_AVAILABLE' using errcode = '22023';
  end if;
  return jsonb_build_object(
    'versionId', v_row.id,
    'storageKey', v_row.storage_key,
    'mimeType', v_row.mime_type,
    'sizeBytes', v_row.size_bytes,
    'durationMs', v_row.duration_ms,
    'contentHash', v_row.content_sha256,
    'riskClass', v_row.risk_class,
    'playable', v_playable);
end;
$$;
revoke all on function private.resolve_contest_audio(uuid, text, text, text, boolean) from public, anon, authenticated;
grant execute on function private.resolve_contest_audio(uuid, text, text, text, boolean) to service_role;

-- Phát MỘT mục cho học sinh. Mã lỗi: CONTEST_AUDIO_DISABLED · INVALID_INPUT · FORBIDDEN · CONSENT_REQUIRED · AUDIO_NOT_AVAILABLE.
-- `p_content_hash` và `p_asset_key` do MÁY CHỦ tính từ danh mục hiện hành: chữ/giọng đã đổi thì tệp cũ không còn khớp.
create or replace function public.gateway_resolve_contest_audio(
  p_auth_user_id uuid,
  p_student_id uuid,
  p_entry_id text,
  p_content_hash text,
  p_asset_key text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_class_id uuid;
  v_school_id uuid;
begin
  if not private.contest_audio_active() then
    raise exception 'CONTEST_AUDIO_DISABLED' using errcode = '22023';
  end if;
  if p_auth_user_id is null or p_student_id is null
     or p_entry_id is null or p_entry_id !~ '^(letter|phoneme|instruction|feedback):[^[:space:]]{1,60}$'
     or p_content_hash is null or p_content_hash !~ '^[0-9a-f]{64}$'
     or p_asset_key is null or p_asset_key !~ '^[0-9a-f]{64}$' then
    raise exception 'INVALID_INPUT' using errcode = '22023';
  end if;
  v_class_id := private.require_linked_device(p_auth_user_id, p_student_id);
  if not private.consent_active(p_student_id, 'learning_data') then
    raise exception 'CONSENT_REQUIRED' using errcode = '42501';
  end if;
  select c.school_id into v_school_id from public.classes c where c.id = v_class_id;
  return private.resolve_contest_audio(v_school_id, p_entry_id, p_content_hash, p_asset_key, true);
end;
$$;

-- Danh sách mục đang có tệp (cho trang Học tập đánh dấu nút nào dùng được). `p_units`: [{entryId, contentHash, assetKey}] (tối đa 200).
-- Trả [{entryId, state: 'playable'|'held', mimeType, riskClass}]; mục không có tệp vắng mặt. Chế độ tắt → [] (không lỗi).
create or replace function public.gateway_list_contest_audio(
  p_auth_user_id uuid,
  p_student_id uuid,
  p_units jsonb
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_class_id uuid;
  v_school_id uuid;
  v_item jsonb;
  v_found jsonb;
  v_result jsonb := '[]'::jsonb;
begin
  if p_auth_user_id is null or p_student_id is null or p_units is null or jsonb_typeof(p_units) <> 'array'
     or jsonb_array_length(p_units) > 200 then
    raise exception 'INVALID_INPUT' using errcode = '22023';
  end if;
  v_class_id := private.require_linked_device(p_auth_user_id, p_student_id);
  if not private.contest_audio_active() then
    return v_result;
  end if;
  if not private.consent_active(p_student_id, 'learning_data') then
    raise exception 'CONSENT_REQUIRED' using errcode = '42501';
  end if;
  select c.school_id into v_school_id from public.classes c where c.id = v_class_id;

  for v_item in select value from jsonb_array_elements(p_units) loop
    begin
      if (v_item ->> 'entryId') !~ '^(letter|phoneme|instruction|feedback):[^[:space:]]{1,60}$'
         or (v_item ->> 'contentHash') !~ '^[0-9a-f]{64}$' or (v_item ->> 'assetKey') !~ '^[0-9a-f]{64}$' then
        continue;
      end if;
      v_found := private.resolve_contest_audio(
        v_school_id, v_item ->> 'entryId', v_item ->> 'contentHash', v_item ->> 'assetKey', false);
      v_result := v_result || jsonb_build_array(jsonb_build_object(
        'entryId', v_item ->> 'entryId',
        'state', case when (v_found ->> 'playable')::boolean then 'playable' else 'held' end,
        'mimeType', v_found ->> 'mimeType',
        'riskClass', v_found ->> 'riskClass'));
    exception when sqlstate '22023' then
      null; -- không có tệp / chữ đã đổi: vắng mặt trong danh sách
    end;
  end loop;
  return v_result;
end;
$$;

-- -------------------------------------------------------------------------------------
-- RLS — chỉ policy SELECT cho giáo viên cùng trường (để trang giáo viên hiện báo cáo); ghi chỉ qua hàm gateway_*
-- -------------------------------------------------------------------------------------

alter table public.contest_audio_assets enable row level security;
create policy contest_audio_assets_school_read on public.contest_audio_assets for select to authenticated
  using (school_id = (select private.my_school_id()));

revoke all on public.contest_audio_assets from public, anon, authenticated;
grant select on public.contest_audio_assets to authenticated;
grant all on public.contest_audio_assets to service_role;

revoke all on function
  public.gateway_register_contest_audio(uuid, uuid, text, text, text, text, text, text, text, text, text, int, int, text, int, int),
  public.gateway_revoke_contest_audio(uuid, text),
  public.gateway_resolve_contest_audio(uuid, uuid, text, text, text),
  public.gateway_list_contest_audio(uuid, uuid, jsonb)
from public, anon, authenticated;
grant execute on function
  public.gateway_register_contest_audio(uuid, uuid, text, text, text, text, text, text, text, text, text, int, int, text, int, int),
  public.gateway_revoke_contest_audio(uuid, text),
  public.gateway_resolve_contest_audio(uuid, uuid, text, text, text),
  public.gateway_list_contest_audio(uuid, uuid, jsonb)
to service_role;
