import { AUDIO_MAX_BYTES } from "@/features/audio-library/limits";
import { buildUploadDeps } from "@/server/audio-library/deps";
import { jsonResult, teacherOrFail } from "@/server/audio-library/http";
import { processAudioUpload } from "@/server/audio-library/upload";
import { consumeRateLimit, RATE_LIMITS } from "@/server/rate-limit";
import { fail } from "@/server/result";
import { isSameOrigin } from "@/server/same-origin";

/** Phần dư cho các trường form và ranh giới multipart ngoài tệp. */
const FORM_OVERHEAD_BYTES = 16 * 1024;

/**
 * POST /api/teacher/audio/versions — GV tải một bản ghi (ghi trực tiếp hoặc tệp chọn sẵn) thành BẢN NHÁP.
 * multipart/form-data: `unitKind`, `unitText`, `file`. Xác thực GV (thiết bị học sinh bị từ chối) → cùng nguồn →
 * giới hạn tần suất → kiểm tra tệp theo nội dung → Storage riêng tư → hàm CSDL (kiểm lại quyền, cờ, đồng ý, bất biến).
 * Dùng Route Handler (không phải Server Action) vì Server Action giới hạn thân ~1 MB mặc định.
 */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return jsonResult(fail("FORBIDDEN"));
  const auth = await teacherOrFail();
  if (!auth.ok) return jsonResult(auth);

  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > AUDIO_MAX_BYTES + FORM_OVERHEAD_BYTES) {
    return jsonResult(fail("AUDIO_TOO_LARGE"));
  }
  if (!(request.headers.get("content-type") ?? "").toLowerCase().startsWith("multipart/form-data")) {
    return jsonResult(fail("INVALID_INPUT"));
  }

  const limited = await consumeRateLimit(RATE_LIMITS.audioUpload, auth.data.userId);
  if (limited === "limited") return jsonResult(fail("RATE_LIMITED"));

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return jsonResult(fail("INVALID_INPUT"));
  }
  const result = await processAudioUpload(buildUploadDeps(auth.data), {
    unitKind: form.get("unitKind"),
    unitText: form.get("unitText"),
    file: form.get("file"),
  });
  return jsonResult(result);
}
