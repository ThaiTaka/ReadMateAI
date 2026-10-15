import type { ReviewStatus } from "../../knowledge/schema.ts";
import type { AudioRole } from "./primitives.ts";

/**
 * Hình và âm thanh dùng trong bài tập. Mỗi tệp phải có nguồn, giấy phép và trạng thái duyệt riêng
 * (CLAUDE.md §7.9; PRD F-ND-05). Tên tranh (`word`) là dữ liệu phía bộ máy — không bao giờ được đưa
 * vào phần `content` hiển thị cho học sinh, vì tên tranh thường chính là đáp án.
 */

export type PictureSource =
  | {
      kind: "icon_library";
      library: string;
      license: string;
      /** Ghi chú giấy phép (tác giả, điều kiện ghi công). */
      licenseNote: string;
    }
  | { kind: "teacher_upload" | "commissioned"; license: string; licenseNote: string };

export type PictureAsset = {
  id: string;
  iconKey: string;
  /** Tên tranh mong đợi (đáp án) — NFC, chữ thường. */
  word: string;
  /** Mục từ tương ứng trong kho tri thức (nếu có). */
  wordId: string | null;
  source: PictureSource;
  review: { status: ReviewStatus; note: string };
  /** Những cách gọi khác có thể khiến tranh mơ hồ — GV cần xem khi duyệt. */
  clarityNote: string;
  /** `demo_fixture`: chỉ dùng cho bản chơi thử; `library`: thư viện media thật (GĐ6). */
  scope: "demo_fixture" | "library";
};

export type AudioAsset = {
  id: string;
  role: AudioRole;
  spokenText: string;
  source: "teacher_recording" | "tts";
  review: { status: ReviewStatus };
};

export type MediaLibrary = {
  pictures: readonly PictureAsset[];
  audio: readonly AudioAsset[];
};

export const EMPTY_MEDIA: MediaLibrary = { pictures: [], audio: [] };

export function findPicture(media: MediaLibrary, id: string): PictureAsset | undefined {
  return media.pictures.find((picture) => picture.id === id);
}

export function findAudio(media: MediaLibrary, id: string): AudioAsset | undefined {
  return media.audio.find((asset) => asset.id === id);
}
