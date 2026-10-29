/*
 * Kiểm tra tập tệp màn của Mê cung kho báu (R07.3): hàm thuần trên bản đồ đường dẫn → nội dung,
 * chạy được bằng Node 24 (import tương đối có đuôi .ts). Lỗi luôn có tệp, mã và tọa độ nếu có.
 */
import { validateLevel } from "../core/level-validate.ts";
import type { Position } from "../core/types.ts";
import { levelFileSchema, toLevel, type LevelFile } from "./schema.ts";

export const LEVELS_DIR = "games/treasure-maze/levels/";

/** Ba màn bắt buộc, theo thứ tự chơi. Tệp thiếu hoặc mã màn sai đều là lỗi. */
export const REQUIRED_LEVELS: readonly { readonly file: string; readonly id: string; readonly size: number }[] = [
  { file: `${LEVELS_DIR}level-01.json`, id: "treasure-maze-01", size: 9 },
  { file: `${LEVELS_DIR}level-02.json`, id: "treasure-maze-02", size: 11 },
  { file: `${LEVELS_DIR}level-03.json`, id: "treasure-maze-03", size: 13 },
];

export type LevelFileIssue = {
  readonly file: string;
  readonly code: string;
  readonly message: string;
  readonly position?: Position;
};

export function isLevelPath(path: string): boolean {
  return path.startsWith(LEVELS_DIR);
}

export type ParsedLevelFile = { ok: true; level: LevelFile } | { ok: false; issues: LevelFileIssue[] };

/** JSON → LevelFile (cú pháp, NFC, zod). Không kiểm luật bản đồ. */
export function parseLevelFile(file: string, raw: string): ParsedLevelFile {
  const issue = (code: string, message: string): ParsedLevelFile => ({ ok: false, issues: [{ file, code, message }] });
  if (raw.charCodeAt(0) === 0xfeff) return issue("BOM", "Tệp có BOM ở đầu — lưu lại dạng UTF-8 không BOM.");
  if (raw !== raw.normalize("NFC")) return issue("NOT_NFC", "Nội dung tệp chưa ở dạng Unicode NFC.");
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch (error) {
    return issue("JSON_SYNTAX", `JSON không hợp lệ: ${(error as Error).message}`);
  }
  const result = levelFileSchema.safeParse(json);
  if (!result.success) {
    return {
      ok: false,
      issues: result.error.issues.map((zodIssue) => ({
        file,
        code: "SCHEMA_INVALID",
        message: `${zodIssue.path.join(".") || "(gốc)"}: ${zodIssue.message}`,
      })),
    };
  }
  return { ok: true, level: result.data };
}

/** `files` khóa theo đường dẫn tương đối với `content/` (dùng dấu `/`). Trả [] khi mọi màn hợp lệ. */
export function validateLevelFiles(files: ReadonlyMap<string, string>): LevelFileIssue[] {
  const issues: LevelFileIssue[] = [];
  const required = new Map(REQUIRED_LEVELS.map((entry) => [entry.file, entry]));

  for (const entry of REQUIRED_LEVELS) {
    if (!files.has(entry.file)) {
      issues.push({ file: entry.file, code: "MISSING_LEVEL_FILE", message: `Thiếu tệp màn bắt buộc (${entry.id}).` });
    }
  }

  const idOwners = new Map<string, string>();
  for (const [file, raw] of [...files].sort(([a], [b]) => a.localeCompare(b))) {
    if (!isLevelPath(file)) continue;
    const expected = required.get(file);
    if (!expected) {
      issues.push({
        file,
        code: "UNEXPECTED_LEVEL_FILE",
        message: "Tệp màn không nằm trong danh sách ba màn bắt buộc.",
      });
    }
    const parsed = parseLevelFile(file, raw);
    if (!parsed.ok) {
      issues.push(...parsed.issues);
      continue;
    }
    const { level } = parsed;

    const owner = idOwners.get(level.id);
    if (owner !== undefined) {
      issues.push({ file, code: "LEVEL_ID_DUPLICATE", message: `Mã màn "${level.id}" trùng với ${owner}.` });
    } else {
      idOwners.set(level.id, file);
    }
    if (expected && level.id !== expected.id) {
      issues.push({ file, code: "LEVEL_ID_MISMATCH", message: `Mã màn "${level.id}", cần "${expected.id}".` });
    }
    if (expected && (level.rows.length !== expected.size || level.rows.some((row) => row.length !== expected.size))) {
      issues.push({
        file,
        code: "LEVEL_SIZE_MISMATCH",
        message: `Màn ${expected.id} phải là ${expected.size}×${expected.size}.`,
      });
    }

    for (const error of validateLevel(toLevel(level))) {
      issues.push({
        file,
        code: error.code,
        message: error.triggerId ? `${error.message} [${error.triggerId}]` : error.message,
        ...(error.position ? { position: error.position } : {}),
      });
    }
  }
  return issues;
}
