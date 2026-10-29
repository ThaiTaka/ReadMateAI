/**
 * Môi trường nào được phép chạy chế độ trình diễn âm thanh. HÀM THUẦN (nhận biến môi trường làm đầu vào để kiểm thử).
 *
 * Lớp bảo vệ ở MÃ ỨNG DỤNG (lớp thứ hai ngoài cổng CSDL `private.test_environment.contest_audio_allowed`): chỉ khi Supabase là máy này
 * (127.0.0.1/localhost), không chạy trên Vercel, và người dùng chưa đặt `CONTEST_AUDIO_PREVIEW=off`. Cổng CSDL vẫn là lớp quyết định —
 * ở đây chỉ để mã ứng dụng KHÔNG hỏi CSDL, không đọc Storage và không hiện nhãn trình diễn khi không phải máy local.
 */

export type ContestEnvironment = Readonly<Record<string, string | undefined>>;

const LOCAL_URL = /^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])(:\d+)?(\/|$)/u;

export function isLocalSupabaseUrl(url: string | undefined): boolean {
  return typeof url === "string" && LOCAL_URL.test(url.trim());
}

export function isContestPreviewEnvironment(env: ContestEnvironment): boolean {
  if (!isLocalSupabaseUrl(env.NEXT_PUBLIC_SUPABASE_URL)) return false;
  if (env.VERCEL || env.VERCEL_ENV || env.VERCEL_URL) return false;
  if ((env.CONTEST_AUDIO_PREVIEW ?? "").trim().toLowerCase() === "off") return false;
  return true;
}
