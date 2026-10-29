-- R10.4 — Âm thanh KHI HỌC (chạm vào chữ để nghe): tên chữ cái + âm của chữ, từ bản ghi giáo viên ĐÃ DUYỆT.
--
-- Khác R10.3a (âm của MỘT CÂU hỏi): đây là hoạt động học không có câu hỏi và không chấm điểm, nên không có `question_instance`.
-- Học sinh được chủ động nghe chữ mà hoạt động đang dạy; phần chống lộ đáp án (AD-35) vẫn do chính sách của từng dạng bài
-- ở buổi luyện/trò chơi lo — đường này KHÔNG dùng trong buổi luyện/chạm trán.
--
--   * Ba loại âm thanh KHÁC NHAU, không gộp: tên chữ cái (`letter`, ví dụ "bê"), âm của chữ (`phoneme`, ví dụ "bờ") và
--     tiếng/từ hoàn chỉnh (thuộc thư viện giọng máy, migration riêng). Bản ghi của loại này không bao giờ thay cho loại kia:
--     tài nguyên khóa theo (trường, loại, chữ).
--   * Mọi điều kiện của R10.3a được kiểm lại ở MỖI lần: cờ phát, thiết bị liên kết đúng học sinh, đồng ý learning_data,
--     cùng trường, bản đang dùng + approved + đã nghe, cách đọc đã xác nhận và khớp, người ghi còn đồng ý.
--   * Cờ `student_teacher_audio_playback_approved` (R10.3a) vẫn TẮT mặc định — không thêm cờ mới, không bật ở đâu cả.
--   * Chỉ ĐỌC: không tự tạo, tự duyệt hay đổi đồng ý của bất kỳ bản ghi nào.

-- 1. Thư viện bản ghi nhận thêm loại `letter` (tên chữ cái). Ràng buộc trước đó chỉ cho 'phoneme' và 'rime'.
alter table public.audio_assets drop constraint audio_assets_unit_kind_check;
alter table public.audio_assets
  add constraint audio_assets_unit_kind_check check (unit_kind in ('letter', 'phoneme', 'rime'));

-- 2. Bộ kiểm tra dùng chung cho một (trường, loại, chữ): trả metadata để máy chủ đọc tệp, hoặc ném mã lỗi máy đọc.
--    Nằm ở schema private: không ai gọi trực tiếp, chỉ hai hàm gateway bên dưới.
create or replace function private.resolve_teacher_audio_unit(
  p_school_id uuid,
  p_unit_kind text,
  p_unit_text text,
  p_fallback_unit_text text,
  p_expected_label text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_asset public.audio_assets;
  v_ver public.audio_asset_versions;
begin
  select a.* into v_asset from public.audio_assets a
   where a.school_id = p_school_id and a.unit_kind = p_unit_kind and a.unit_text = p_unit_text;
  -- Âm dùng chung bản ghi của âm khác (y → i) chỉ khi KHÔNG có tài nguyên riêng.
  if v_asset.id is null and p_fallback_unit_text is not null and p_fallback_unit_text ~ '^[[:alpha:]]{1,6}$' then
    select a.* into v_asset from public.audio_assets a
     where a.school_id = p_school_id and a.unit_kind = p_unit_kind and a.unit_text = p_fallback_unit_text;
  end if;
  if v_asset.id is null or v_asset.active_version_id is null then
    raise exception 'AUDIO_NOT_AVAILABLE' using errcode = '22023';
  end if;

  select v.* into v_ver from public.audio_asset_versions v
   where v.id = v_asset.active_version_id and v.asset_id = v_asset.id and v.school_id = p_school_id;
  if v_ver.id is null or v_ver.status <> 'approved' or v_ver.reviewed_by is null or v_ver.review_listened is not true then
    raise exception 'AUDIO_NOT_AVAILABLE' using errcode = '22023';
  end if;

  if v_asset.confirmed_label is null then
    raise exception 'PRONUNCIATION_UNCONFIRMED' using errcode = '22023';
  end if;
  if v_asset.confirmed_label <> v_ver.spoken_label or v_asset.confirmed_label <> p_expected_label then
    raise exception 'LABEL_MISMATCH' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.audio_voice_consents c
     where c.id = v_ver.consent_id and c.staff_id = v_ver.created_by and c.status = 'granted'
  ) then
    raise exception 'VOICE_CONSENT_REQUIRED' using errcode = '22023';
  end if;

  return jsonb_build_object(
    'versionId', v_ver.id,
    'storageKey', v_ver.storage_key,
    'mimeType', v_ver.mime_type,
    'sizeBytes', v_ver.size_bytes,
    'durationMs', v_ver.duration_ms,
    'contentHash', v_ver.content_hash);
end;
$$;
revoke all on function private.resolve_teacher_audio_unit(uuid, text, text, text, text) from public, anon, authenticated;

-- 3. Phát MỘT chữ/âm cho học sinh (không cần câu hỏi). Mã lỗi giống gateway_resolve_teacher_audio:
--    AUDIO_PLAYBACK_DISABLED · FORBIDDEN · CONSENT_REQUIRED · AUDIO_NOT_AVAILABLE · PRONUNCIATION_UNCONFIRMED ·
--    LABEL_MISMATCH · VOICE_CONSENT_REQUIRED · INVALID_INPUT.
-- `p_expected_label` do MÁY CHỦ lấy từ kho tri thức (không từ trình duyệt) và phải trùng cách đọc GV đã xác nhận.
create or replace function public.gateway_resolve_learning_audio(
  p_auth_user_id uuid,
  p_student_id uuid,
  p_unit_kind text,
  p_unit_text text,
  p_fallback_unit_text text,
  p_expected_label text
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
  if not private.feature_enabled('student_teacher_audio_playback_approved') then
    raise exception 'AUDIO_PLAYBACK_DISABLED' using errcode = '22023';
  end if;
  if p_auth_user_id is null or p_student_id is null or p_expected_label is null
     or p_unit_kind is null or p_unit_kind not in ('letter', 'phoneme')
     or p_unit_text is null or p_unit_text !~ '^[[:alpha:]]{1,6}$' then
    raise exception 'INVALID_INPUT' using errcode = '22023';
  end if;

  -- Thiết bị phải đang liên kết đúng học sinh này; lớp và học sinh còn hoạt động.
  v_class_id := private.require_linked_device(p_auth_user_id, p_student_id);
  if not private.consent_active(p_student_id, 'learning_data') then
    raise exception 'CONSENT_REQUIRED' using errcode = '42501';
  end if;
  select c.school_id into v_school_id from public.classes c where c.id = v_class_id;

  return private.resolve_teacher_audio_unit(v_school_id, p_unit_kind, p_unit_text, p_fallback_unit_text, p_expected_label);
end;
$$;
revoke all on function public.gateway_resolve_learning_audio(uuid, uuid, text, text, text, text) from public, anon, authenticated;
grant execute on function public.gateway_resolve_learning_audio(uuid, uuid, text, text, text, text) to service_role;

-- 4. Danh sách chữ/âm đang PHÁT ĐƯỢC ngay bây giờ (cho trang học đánh dấu nút nào dùng được). Cờ tắt → danh sách rỗng, không lỗi.
--    `p_units`: mảng [{kind, text, fallback, label}] do máy chủ dựng từ kho tri thức (tối đa 200). Đơn vị không đủ điều kiện
--    chỉ đơn giản vắng mặt trong kết quả — không lộ lý do.
create or replace function public.gateway_list_learning_audio(
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
  if not private.feature_enabled('student_teacher_audio_playback_approved') then
    return v_result;
  end if;
  if not private.consent_active(p_student_id, 'learning_data') then
    raise exception 'CONSENT_REQUIRED' using errcode = '42501';
  end if;
  select c.school_id into v_school_id from public.classes c where c.id = v_class_id;

  for v_item in select value from jsonb_array_elements(p_units) loop
    begin
      if v_item ->> 'kind' not in ('letter', 'phoneme') or (v_item ->> 'text') !~ '^[[:alpha:]]{1,6}$' then
        continue;
      end if;
      v_found := private.resolve_teacher_audio_unit(
        v_school_id, v_item ->> 'kind', v_item ->> 'text', v_item ->> 'fallback', v_item ->> 'label');
      v_result := v_result || jsonb_build_array(jsonb_build_object(
        'kind', v_item ->> 'kind', 'text', v_item ->> 'text', 'mimeType', v_found ->> 'mimeType'));
    exception when sqlstate '22023' then
      null; -- chưa duyệt / cách đọc chưa khớp / người ghi rút đồng ý: không có trong danh sách
    end;
  end loop;
  return v_result;
end;
$$;
revoke all on function public.gateway_list_learning_audio(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.gateway_list_learning_audio(uuid, uuid, jsonb) to service_role;
