import "server-only";
import letters from "../../../content/kb/letters.json";
import phonemes from "../../../content/kb/phonemes.json";
import {
  buildContestCatalog,
  type ContestEntry,
  type RawLetter,
  type RawPhoneme,
} from "@/features/contest-audio/catalog";
import { LIBRARY_ENTRIES } from "@/server/tts-library/entries";

/**
 * Danh mục lời đọc của chế độ trình diễn, dựng một lần từ kho tri thức + danh mục câu lệnh/phản hồi (docs/CONTEST_AUDIO.md).
 * Trình duyệt không bao giờ gửi mã mục: máy chủ tra theo (loại, chữ) hoặc theo câu.
 */

const CATALOG = buildContestCatalog({
  letters: (letters as { items: RawLetter[] }).items,
  phonemes: (phonemes as { items: RawPhoneme[] }).items,
  library: LIBRARY_ENTRIES.map((entry) => ({ id: entry.id, text: entry.text, attention: entry.attention })),
});

export const CONTEST_ENTRIES: readonly ContestEntry[] = CATALOG.entries;

export function contestEntry(id: string): ContestEntry | undefined {
  return CATALOG.byId.get(id);
}

/** Tên chữ cái (`letter`) hoặc âm của chữ (`phoneme`) của Học tập. */
export function contestUnitEntry(kind: "letter" | "phoneme", text: string): ContestEntry | undefined {
  return CATALOG.byId.get(`${kind}:${text.normalize("NFC")}`);
}
