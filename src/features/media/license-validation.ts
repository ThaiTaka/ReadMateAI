import { z } from "zod";

/**
 * Kiểm tra danh mục giấy phép asset `content/media/licenses.json` (R02; CLAUDE.md §7.9, §9.4.7).
 * Chạy trong `npm run content:check` trực tiếp bằng Node 24 → chỉ import tương đối có đuôi `.ts`, không alias.
 *
 * Quy tắc:
 * - Mỗi asset có id, tên, đường dẫn (tệp tồn tại trong repo), tác giả, nguồn, giấy phép, phạm vi sử dụng.
 * - Asset là học liệu/nhân vật (`character`, `avatar`, `scene`, `icon`) phải có trạng thái duyệt `pending_review`
 *   hoặc `approved`; chỉ được `approved` khi có `reviewedBy` + `reviewedAt` (do GV duyệt — không bao giờ tự đặt).
 * - `teacherReviewed: true` chỉ đi cùng `approved`.
 */

export const MEDIA_LICENSES_FILE = "media/licenses.json";

const ReviewSchema = z.object({
  status: z.enum(["pending_review", "approved", "not_required"]),
  teacherReviewed: z.boolean(),
  reviewedBy: z.string().min(1).nullable(),
  reviewedAt: z.string().min(1).nullable(),
  notes: z.string().min(1),
});

const AssetSchema = z.object({
  id: z.string().regex(/^[a-z0-9]+(?:[.-][a-z0-9]+)*$/u),
  name: z.string().min(1),
  kind: z.enum(["character", "avatar", "scene", "icon", "font", "icon-set"]),
  /** Đường dẫn tương đối gốc repo, có thể kèm "#Tên" để chỉ một thành phần trong tệp. */
  paths: z.array(z.string().min(1)).min(1),
  author: z.string().min(1),
  source: z.string().min(1),
  license: z.string().min(1),
  usage: z.string().min(1),
  createdAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u),
  review: ReviewSchema,
});

export const MediaLicensesSchema = z.object({
  version: z.literal(1),
  updatedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u),
  note: z.string().min(1),
  assets: z.array(AssetSchema).min(1),
});

export type MediaAsset = z.infer<typeof AssetSchema>;

export type MediaIssue = { severity: "error" | "warning"; code: string; itemId?: string; message: string };

const ARTWORK_KINDS = new Set<MediaAsset["kind"]>(["character", "avatar", "scene", "icon"]);

/**
 * @param raw nội dung tệp JSON
 * @param fileExists hàm kiểm tra tệp tồn tại (đường dẫn tương đối gốc repo, đã bỏ phần "#…")
 */
export function validateMediaLicenses(
  raw: string,
  fileExists: (path: string) => boolean,
): { issues: MediaIssue[]; assets: MediaAsset[] } {
  const issues: MediaIssue[] = [];
  if (raw.normalize("NFC") !== raw) {
    issues.push({ severity: "error", code: "NOT_NFC", message: "Tệp giấy phép phải ở dạng Unicode NFC." });
  }
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch (error) {
    issues.push({ severity: "error", code: "INVALID_JSON", message: `JSON không hợp lệ: ${String(error)}` });
    return { issues, assets: [] };
  }
  const parsed = MediaLicensesSchema.safeParse(json);
  if (!parsed.success) {
    for (const problem of parsed.error.issues) {
      issues.push({
        severity: "error",
        code: "SCHEMA",
        message: `${problem.path.join(".") || "(gốc)"}: ${problem.message}`,
      });
    }
    return { issues, assets: [] };
  }
  const seen = new Set<string>();
  for (const asset of parsed.data.assets) {
    const add = (severity: MediaIssue["severity"], code: string, message: string) =>
      issues.push({ severity, code, itemId: asset.id, message });
    if (seen.has(asset.id)) add("error", "DUPLICATE_ID", "Trùng id asset.");
    seen.add(asset.id);
    for (const path of asset.paths) {
      const file = path.split("#")[0] ?? "";
      if (!fileExists(file)) add("error", "MISSING_PATH", `Không tìm thấy tệp ${file}.`);
    }
    const { review } = asset;
    if (ARTWORK_KINDS.has(asset.kind) && review.status === "not_required") {
      add("error", "REVIEW_REQUIRED", "Nhân vật, avatar, cảnh và biểu tượng học liệu phải được GV duyệt.");
    }
    if (review.status === "approved" && (!review.reviewedBy || !review.reviewedAt || !review.teacherReviewed)) {
      add("error", "APPROVAL_WITHOUT_REVIEWER", "Chỉ được 'approved' khi có giáo viên duyệt (reviewedBy, reviewedAt).");
    }
    if (review.status !== "approved" && review.teacherReviewed) {
      add("error", "INCONSISTENT_REVIEW", "teacherReviewed = true nhưng trạng thái chưa phải 'approved'.");
    }
    if (review.status === "pending_review") {
      add("warning", "PENDING_TEACHER_REVIEW", `${asset.name}: chờ giáo viên duyệt.`);
    }
  }
  return { issues, assets: parsed.data.assets };
}
