-- =====================================================================================
-- R03 — Chặn tự đăng ký tài khoản (Auth Hook "before_user_created").
--
-- Vì sao không tắt signup trong cấu hình Auth (đã kiểm chứng trên Supabase local, CLI 2.121):
--   * tắt signup toàn cục (GOTRUE_DISABLE_SIGNUP) chặn luôn người dùng ẩn danh = thiết bị học sinh;
--   * tắt "email signup" (GOTRUE_EXTERNAL_EMAIL_ENABLED) tắt cả ĐĂNG NHẬP bằng email của giáo viên.
-- Giải pháp: giữ signup bật; hook từ chối MỌI tài khoản không ẩn danh tạo qua đăng ký công khai. Tài khoản GV
-- chỉ được tạo bằng Admin API (khóa secret, script quản trị) — Admin API không đi qua hook (đã kiểm chứng).
-- Tài khoản email không có staff_profiles vẫn không vào được khu vực GV (lớp kiểm tra thứ hai).
-- =====================================================================================

create or replace function private.hook_before_user_created(event jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if coalesce((event -> 'user' ->> 'is_anonymous')::boolean, false) then
    return '{}'::jsonb;
  end if;
  return jsonb_build_object('error', jsonb_build_object(
    'http_code', 403,
    'message', 'Không thể tự đăng ký. Tài khoản giáo viên do quản trị viên của trường cấp.'));
end;
$$;

revoke all on function private.hook_before_user_created(jsonb) from public, anon, authenticated;
grant usage on schema private to supabase_auth_admin;
grant execute on function private.hook_before_user_created(jsonb) to supabase_auth_admin, service_role;
