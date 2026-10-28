import { P0_UNITS } from "@/features/audio-library/p0-catalog";
import { variantHasRecording, type PlaybackRole } from "./roles";

/**
 * Câu bài tập ↔ bản ghi giáo viên (R10.3a). HÀM THUẦN, chỉ dùng ở máy chủ (kéo danh mục P0 từ kho tri thức): không đọc
 * CSDL/Storage. Cách đọc (`expectedLabel`) lấy từ chính khe âm thanh của câu (sinh từ kho tri thức) — không tự đặt cách
 * đọc mới; máy chủ so nó với cách đọc GV đã xác nhận.
 */

export type UnitBinding = {
  unitKind: "phoneme";
  /** Chữ ghi âm (NFC), ví dụ "ngh". */
  unitText: string;
  /** Âm dùng chung bản ghi khi GV chưa tách (y → i); null nếu không có. */
  fallbackUnitText: string | null;
  /** Cách đọc mà câu khai báo (kho tri thức) — phải trùng cách đọc GV đã xác nhận. */
  expectedLabel: string;
};

/** Âm dùng chung bản ghi của âm khác theo danh mục P0 (y → i) — null nếu âm có bản ghi riêng. */
export function sharedRecordingUnit(unitText: string): string | null {
  const text = unitText.normalize("NFC");
  return P0_UNITS.find((unit) => unit.alsoCovers.includes(text))?.text ?? null;
}

type ItemLike = {
  variant: string;
  content: unknown;
  answer: unknown;
  audio: { stimulus?: { spokenText: string }; model?: { spokenText: string } };
};

const PHONEME_UNIT = /^phoneme:([\p{L}]{1,6})$/u;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Âm của đáp án đúng trong câu nghe âm: đơn vị `phoneme:…` của phương án đúng. */
function answerPhoneme(item: ItemLike): string | null {
  if (!isRecord(item.content) || !isRecord(item.answer)) return null;
  const optionId = item.answer.optionId;
  const options = item.content.options;
  if (typeof optionId !== "string" || !Array.isArray(options)) return null;
  const option = options.find((entry): entry is Record<string, unknown> => isRecord(entry) && entry.id === optionId);
  const unit = option && typeof option.unit === "string" ? PHONEME_UNIT.exec(option.unit) : null;
  return unit?.[1] ? unit[1].normalize("NFC") : null;
}

/** Ràng buộc bản ghi giáo viên của một khe, hoặc null khi khe này không dùng bản ghi giáo viên. */
export function bindingFor(item: ItemLike, role: PlaybackRole): UnitBinding | null {
  // Khe giọng máy (câu lệnh) không có bản ghi giáo viên: thuộc thư viện TTS (server/tts-library/playback.ts).
  if (role === "instruction") return null;
  if (!variantHasRecording(item.variant, role)) return null;
  const expectedLabel = item.audio[role]?.spokenText.normalize("NFC").trim();
  const unitText = answerPhoneme(item);
  if (!expectedLabel || !unitText) return null;
  return { unitKind: "phoneme", unitText, fallbackUnitText: sharedRecordingUnit(unitText), expectedLabel };
}
