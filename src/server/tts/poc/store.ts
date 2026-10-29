import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { emptyManifest, pocManifestSchema, withSample, type PocManifest, type PocSample } from "./manifest.ts";
import type { PocStore } from "./run.ts";

/**
 * Nơi lưu cục bộ của tệp nghe thử: `<thư mục dự án>/.tts-poc/` (được .gitignore, không bao giờ vào Git/Storage/Vercel).
 * Chỉ máy của người vận hành; trên môi trường không có thư mục này, trang so sánh hiện trạng thái rỗng.
 */

export const POC_DIR_NAME = ".tts-poc";
export const POC_MANIFEST_FILE = "manifest.json";

export const defaultPocDir = (): string => join(process.cwd(), POC_DIR_NAME);

export type ManifestRead = { manifest: PocManifest; problem: "NONE" | "MISSING" | "INVALID" };

export async function readPocManifest(dir: string): Promise<ManifestRead> {
  let raw: string;
  try {
    raw = await readFile(join(dir, POC_MANIFEST_FILE), "utf8");
  } catch {
    return { manifest: emptyManifest(), problem: "MISSING" };
  }
  try {
    const parsed = pocManifestSchema.safeParse(JSON.parse(raw));
    return parsed.success
      ? { manifest: parsed.data, problem: "NONE" }
      : { manifest: emptyManifest(), problem: "INVALID" };
  } catch {
    return { manifest: emptyManifest(), problem: "INVALID" };
  }
}

/** Ghi tuần tự (script không chạy song song). Tệp trùng nội dung (cùng sha256) chỉ ghi một lần. */
export function createFsPocStore(dir: string): PocStore {
  return {
    async write(sample: PocSample, bytes: Uint8Array): Promise<void> {
      await mkdir(dir, { recursive: true });
      try {
        await writeFile(join(dir, sample.file), bytes, { flag: "wx" });
      } catch (error) {
        if (!(error instanceof Error) || (error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      }
      const current = await readPocManifest(dir);
      // Sổ hỏng thì dừng thay vì ghi đè âm thầm dữ liệu người vận hành đã có.
      if (current.problem === "INVALID") throw new Error("manifest.json không hợp lệ; không ghi đè");
      const next = withSample(current.manifest, sample);
      const temp = join(dir, `${POC_MANIFEST_FILE}.tmp`);
      await writeFile(temp, `${JSON.stringify(next, null, 2)}\n`, "utf8");
      await rename(temp, join(dir, POC_MANIFEST_FILE));
    },
  };
}
