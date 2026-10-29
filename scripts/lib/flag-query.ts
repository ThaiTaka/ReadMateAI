/**
 * Đọc kết quả `supabase db query --local --agent no --output-format json` cho công cụ cờ âm thanh (hàm thuần, có unit test).
 *
 * Định dạng thực tế (Supabase CLI 2.121, đã chạy thật): stdout chỉ có JSON; thông báo CLI ("Connecting…", "A new version…") nằm ở stderr.
 *   --agent no  → mảng trần `[{ "key": …, "enabled": … }, …]`
 *   --agent yes → phong bì `{ "boundary": …, "rows": [...], "warning": … }`
 * Mã cũ cắt chuỗi tại dấu `{` đầu tiên nên hỏng với mảng trần (dấu `{` của hàng đầu tiên). Ở đây phân tích TOÀN BỘ stdout, rồi kiểm schema;
 * kết quả sai hình dạng là lỗi, không bao giờ suy ra "TẮT".
 */
import { z } from "zod";

export type FlagQueryErrorCode =
  | "CLI_FAILED"
  | "INVALID_JSON"
  | "UNEXPECTED_SHAPE"
  | "UNEXPECTED_KEYS"
  | "DUPLICATE_KEYS"
  | "MISSING_FLAGS"
  | "VERIFY_MISMATCH";

export class FlagQueryError extends Error {
  readonly code: FlagQueryErrorCode;
  constructor(code: FlagQueryErrorCode, message: string) {
    super(message);
    this.name = "FlagQueryError";
    this.code = code;
  }
}

const rowSchema = z.object({ key: z.string(), enabled: z.boolean() });
const rowsSchema = z.array(rowSchema);
// `looseObject` cho phong bì: các trường `boundary`/`warning` do CLI thêm, không dùng tới.
const envelopeSchema = z.looseObject({ rows: rowsSchema });

export function parseFlagRows(stdout: string, expectedKeys: readonly string[]): Map<string, boolean> {
  let json: unknown;
  try {
    json = JSON.parse(stdout);
  } catch {
    throw new FlagQueryError("INVALID_JSON", "đầu ra của Supabase CLI không phải JSON hợp lệ");
  }

  const parsed = Array.isArray(json) ? rowsSchema.safeParse(json) : envelopeSchema.safeParse(json);
  if (!parsed.success) {
    throw new FlagQueryError(
      "UNEXPECTED_SHAPE",
      "JSON không đúng hình dạng mong đợi (cần mảng hoặc phong bì có rows gồm key/enabled)",
    );
  }
  const rows = Array.isArray(parsed.data) ? parsed.data : parsed.data.rows;

  const flags = new Map<string, boolean>();
  for (const row of rows) {
    if (!expectedKeys.includes(row.key)) {
      throw new FlagQueryError("UNEXPECTED_KEYS", `kết quả có cờ không nằm trong danh sách cố định: ${row.key}`);
    }
    if (flags.has(row.key)) throw new FlagQueryError("DUPLICATE_KEYS", `cờ xuất hiện hai lần: ${row.key}`);
    flags.set(row.key, row.enabled);
  }
  const missing = expectedKeys.filter((key) => !flags.has(key));
  if (missing.length > 0) {
    throw new FlagQueryError("MISSING_FLAGS", `thiếu cờ trong CSDL: ${missing.join(", ")}`);
  }
  return flags;
}

export type CliResult = {
  status: number | null;
  stdout: string;
  stderr: string;
  error?: Error | undefined;
};

/** stderr của CLI lẫn thông báo cập nhật phiên bản — bỏ những dòng đó để thông báo lỗi nêu đúng nguyên nhân. */
function errorDetail(stderr: string): string {
  const lines = stderr
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line && !/^(Connecting to|A new version of Supabase CLI|We recommend updating)/u.test(line));
  return lines.slice(0, 3).join(" | ");
}

/** Trả về stdout khi CLI thoát mã 0; ngược lại ném `CLI_FAILED` kèm nguyên nhân. */
export function stdoutOrThrow(result: CliResult): string {
  if (result.error) throw new FlagQueryError("CLI_FAILED", `không chạy được Supabase CLI: ${result.error.message}`);
  if (result.status !== 0) {
    const detail = errorDetail(result.stderr);
    throw new FlagQueryError(
      "CLI_FAILED",
      `Supabase CLI thoát với mã ${result.status ?? "không rõ"}${detail ? ` — ${detail}` : ""}`,
    );
  }
  return result.stdout;
}

/** Sau khi cập nhật: mọi cờ phải đúng giá trị mong muốn, đọc lại từ CSDL. */
export function assertAllFlags(flags: ReadonlyMap<string, boolean>, enabled: boolean): void {
  const wrong = [...flags].filter(([, value]) => value !== enabled).map(([key]) => key);
  if (wrong.length > 0) {
    throw new FlagQueryError(
      "VERIFY_MISMATCH",
      `sau khi cập nhật, cờ chưa đúng ${enabled ? "BẬT" : "TẮT"}: ${wrong.join(", ")}`,
    );
  }
}
