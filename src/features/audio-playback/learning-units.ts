import phonemes from "../../../content/kb/phonemes.json";
import { AUDIO_UNIT_BY_KEY, P0_UNIT_BY_KEY, P0_UNITS } from "@/features/audio-library/p0-catalog";

/**
 * Chữ/âm có thể nghe khi HỌC (R10.4) — phía học sinh. Chỉ máy chủ và kiểm thử dùng (kéo kho tri thức); trình duyệt chỉ nhận
 * kiểu `LearningUnitKind` qua `import type`. Nằm ở `features/audio-playback` (cầu nối duy nhất tới thư viện bản ghi giáo viên).
 */

/** Hai loại bản ghi giáo viên khi học; tiếng/từ hoàn chỉnh thuộc thư viện giọng máy, không nằm ở đây. */
export type LearningUnitKind = "letter" | "phoneme";

type RawPhoneme = { text: string; teachingLabel: { proposed: string } };

const PHONEME_LABELS: ReadonlyMap<string, string> = new Map(
  (phonemes as { items: RawPhoneme[] }).items.map((item) => [
    item.text.normalize("NFC"),
    item.teachingLabel.proposed.normalize("NFC"),
  ]),
);

export type LearningUnitInfo = {
  kind: LearningUnitKind;
  /** Chữ (NFC) — khóa tra cứu bản ghi. */
  text: string;
  /** Cách đọc mà kho tri thức khai báo; phải trùng cách đọc giáo viên đã xác nhận mới được phát. */
  label: string;
  /** Chữ dùng chung bản ghi khi giáo viên chưa tách (y dùng bản ghi của i); null nếu không có. */
  fallback: string | null;
};

/**
 * Tra một chữ/âm: trả undefined với loại/chữ lạ — trình duyệt không bao giờ chọn được một tài nguyên ngoài danh mục này.
 * Gồm cả những âm không có hàng riêng trong danh sách ghi âm (y chung bản ghi của i).
 */
export function learningUnitInfo(kind: string, text: string): LearningUnitInfo | undefined {
  const unit = text.normalize("NFC");
  if (kind === "letter") {
    const found = AUDIO_UNIT_BY_KEY.get(`letter:${unit}`);
    return found ? { kind: "letter", text: unit, label: found.proposedLabel, fallback: null } : undefined;
  }
  if (kind === "phoneme") {
    const label = PHONEME_LABELS.get(unit);
    if (!label) return undefined;
    const fallback = P0_UNIT_BY_KEY.has(`phoneme:${unit}`)
      ? null
      : (P0_UNITS.find((entry) => entry.alsoCovers.includes(unit))?.text ?? null);
    return { kind: "phoneme", text: unit, label, fallback };
  }
  return undefined;
}
