-- R10.3a — Phát bản ghi giáo viên ĐÃ DUYỆT cho học sinh: cờ hệ thống + hàm gateway kiểm tra đủ điều kiện.
--
-- Nguyên tắc (docs/AUDIO_ENGINE.md §13):
--   * KHÔNG mở quyền SELECT bảng audio_* hay quyền đọc Storage cho thiết bị học sinh. Máy chủ (service_role) gọi MỘT hàm
--     duy nhất; hàm tự kiểm tra lại mọi điều kiện ở MỖI lần phát (không tin kết quả của lần trước) rồi trả đúng những
--     trường máy chủ cần để đọc tệp. Khóa đối tượng (`storageKey`) chỉ đi tới mã máy chủ, không bao giờ tới trình duyệt.
--   * Cờ `student_teacher_audio_playback_approved` mặc định TẮT; chỉ bật sau khi GV đồng ý bằng văn bản, có bản ghi
--     thật được duyệt và chủ dự án cho phép. Khi tắt, mọi lần phát bị từ chối AUDIO_PLAYBACK_DISABLED.
--   * Không tự tạo, tự duyệt hay đổi đồng ý của bất kỳ bản ghi nào; chỉ ĐỌC.

insert into private.feature_flags (key, enabled, note) values
  ('student_teacher_audio_playback_approved', false,
   'Phát bản ghi giọng giáo viên đã duyệt cho học sinh: chỉ bật khi có bản ghi thật được duyệt, GV đồng ý và đã thử trên iPhone/Android (R10.3).');

-- Trả về bản ghi ĐANG DÙNG của một âm cho một câu của học sinh, hoặc ném mã lỗi máy đọc:
--   AUDIO_PLAYBACK_DISABLED  cờ tắt
--   FORBIDDEN                thiết bị không liên kết với học sinh sở hữu câu / học sinh, lớp không hoạt động
--   CONSENT_REQUIRED         học sinh chưa có đồng ý learning_data còn hiệu lực
--   AUDIO_NOT_AVAILABLE      chưa có tài nguyên / bản đang dùng / bản chưa ở trạng thái approved
--   PRONUNCIATION_UNCONFIRMED, LABEL_MISMATCH   cách đọc chưa xác nhận / không khớp bản ghi / không khớp câu
--   VOICE_CONSENT_REQUIRED   người ghi đã rút đồng ý dùng giọng
-- Phạm vi = TRƯỜNG của lớp học sinh: bản ghi của trường khác không bao giờ khớp.
-- p_fallback_unit_text (rỗng/null = không có) chỉ dùng khi KHÔNG có tài nguyên riêng cho p_unit_text (ví dụ y dùng chung bản ghi của i); nếu GV
-- đã tạo tài nguyên riêng cho âm đó (chọn tách quy ước) thì chỉ tài nguyên riêng được xét — không lấy nhầm âm khác.
create or replace function public.gateway_resolve_teacher_audio(
  p_auth_user_id uuid,
  p_question_instance_id uuid,
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
  v_qi public.question_instances;
  v_class_id uuid;
  v_school_id uuid;
  v_asset public.audio_assets;
  v_ver public.audio_asset_versions;
begin
  if not private.feature_enabled('student_teacher_audio_playback_approved') then
    raise exception 'AUDIO_PLAYBACK_DISABLED' using errcode = '22023';
  end if;
  if p_auth_user_id is null or p_question_instance_id is null or p_expected_label is null
     or p_unit_text is null or p_unit_text !~ '^[[:alpha:]]{1,6}$' then
    raise exception 'INVALID_INPUT' using errcode = '22023';
  end if;

  -- Học sinh suy ra từ câu phát hành (không nhận từ trình duyệt); thiết bị phải đang liên kết với đúng học sinh đó.
  select q.* into v_qi from public.question_instances q where q.id = p_question_instance_id;
  if v_qi.id is null then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  v_class_id := private.require_linked_device(p_auth_user_id, v_qi.student_id);
  if not private.consent_active(v_qi.student_id, 'learning_data') then
    raise exception 'CONSENT_REQUIRED' using errcode = '42501';
  end if;
  select c.school_id into v_school_id from public.classes c where c.id = v_class_id;

  select a.* into v_asset from public.audio_assets a
   where a.school_id = v_school_id and a.unit_kind = 'phoneme' and a.unit_text = p_unit_text;
  if v_asset.id is null and p_fallback_unit_text is not null and p_fallback_unit_text ~ '^[[:alpha:]]{1,6}$' then
    select a.* into v_asset from public.audio_assets a
     where a.school_id = v_school_id and a.unit_kind = 'phoneme' and a.unit_text = p_fallback_unit_text;
  end if;
  if v_asset.id is null or v_asset.active_version_id is null then
    raise exception 'AUDIO_NOT_AVAILABLE' using errcode = '22023';
  end if;

  select v.* into v_ver from public.audio_asset_versions v
   where v.id = v_asset.active_version_id and v.asset_id = v_asset.id and v.school_id = v_school_id;
  if v_ver.id is null or v_ver.status <> 'approved' or v_ver.reviewed_by is null or v_ver.review_listened is not true then
    raise exception 'AUDIO_NOT_AVAILABLE' using errcode = '22023';
  end if;

  if v_asset.confirmed_label is null then
    raise exception 'PRONUNCIATION_UNCONFIRMED' using errcode = '22023';
  end if;
  if v_asset.confirmed_label <> v_ver.spoken_label or v_asset.confirmed_label <> p_expected_label then
    raise exception 'LABEL_MISMATCH' using errcode = '22023';
  end if;

  -- Người ghi vẫn còn đồng ý (đúng chứng từ đã gắn vào phiên bản).
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

revoke all on function public.gateway_resolve_teacher_audio(uuid, uuid, text, text, text)
  from public, anon, authenticated;
grant execute on function public.gateway_resolve_teacher_audio(uuid, uuid, text, text, text) to service_role;
