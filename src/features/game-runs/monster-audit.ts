import { containsForm, syllableSequence } from "../exercises/core/leaks.ts";
import { isNFC, normalizeWhitespace } from "../../lib/vietnamese/normalize.ts";

/**
 * Bộ soát chữ của quái vật (R08.5). Tên, nhãn trình đọc màn hình và lời thoại quái vật hiện ra TRƯỚC khi câu đóng, nên
 * không được chứa đáp án của câu đang hỏi. Hàm thuần: nhận chữ + dạng bị cấm của các câu, trả cảnh báo kèm vị trí.
 *
 * Phân hai mức (không kết luận "an toàn tuyệt đối" khi không thấy lỗi — chỉ là chưa phát hiện được bằng so khớp):
 *  - `error`   — chữ quái vật chứa đúng một dạng đáp án bị cấm của một câu cụ thể (lộ trực tiếp, chặn).
 *  - `warning` — tên trùng hoặc gần giống một tiếng/từ của kho học liệu: chưa lộ câu nào hôm nay nhưng có thể lộ khi kho lớn
 *                lên → GV xem. Chỉ xét TÊN (lời thoại chung có "con", "bạn" … ở mọi nơi nên so với kho sẽ vô nghĩa).
 */

export type MonsterTextKind = "name" | "label" | "line";
export type MonsterTextEntry = {
  /** Vị trí để người phát triển tìm nguồn, ví dụ "src/strings/vi.ts#monsters.mon-01". */
  where: string;
  kind: MonsterTextKind;
  text: string;
};

export type AuditedItem = {
  id: string;
  /** Dạng đáp án bị cấm lộ của câu (lấy từ `textExposure(item).forbidden`, chỉ cần `form`). */
  forbiddenForms: readonly string[];
};

export type MonsterAuditCode =
  | "MONSTER_TEXT_LEAKS_ANSWER"
  | "MONSTER_NAME_IS_LEARNING_UNIT"
  | "MONSTER_NAME_SIMILAR_TO_LEARNING_UNIT"
  | "MONSTER_NAME_MISSING"
  | "MONSTER_NAME_DUPLICATE"
  | "MONSTER_TEXT_NOT_NORMALIZED";

export type MonsterAuditFinding = {
  severity: "error" | "warning";
  code: MonsterAuditCode;
  where: string;
  message: string;
};

/** Bỏ dấu thanh, giữ nguyên dấu mũ/móc/ă/đ (so khớp "gần giống" theo thanh). */
function foldTone(syllable: string): string {
  return syllable
    .normalize("NFD")
    .replace(/[\u0300\u0301\u0303\u0309\u0323]/g, "")
    .normalize("NFC");
}

export function auditMonsterTexts(input: {
  entries: readonly MonsterTextEntry[];
  items: readonly AuditedItem[];
  /** Tiếng (chữ thường, NFC) có trong kho học liệu: từ, tiếng, câu, vần, âm. */
  lexicon: ReadonlySet<string>;
}): MonsterAuditFinding[] {
  const findings: MonsterAuditFinding[] = [];
  const names = new Map<string, string>();
  const toneFolded = new Map<string, string>();
  for (const unit of input.lexicon) toneFolded.set(foldTone(unit), unit);

  for (const entry of input.entries) {
    if (entry.kind === "name" && normalizeWhitespace(entry.text).length === 0) {
      findings.push({
        severity: "error",
        code: "MONSTER_NAME_MISSING",
        where: entry.where,
        message: "Quái vật không có tên hiển thị.",
      });
      continue;
    }
    if (!isNFC(entry.text) || normalizeWhitespace(entry.text) !== entry.text.trim()) {
      findings.push({
        severity: "error",
        code: "MONSTER_TEXT_NOT_NORMALIZED",
        where: entry.where,
        message: `Chữ "${entry.text}" chưa chuẩn hóa NFC hoặc có khoảng trắng thừa.`,
      });
    }

    for (const item of input.items) {
      for (const form of item.forbiddenForms) {
        if (!containsForm(entry.text, form)) continue;
        findings.push({
          severity: "error",
          code: "MONSTER_TEXT_LEAKS_ANSWER",
          where: entry.where,
          message: `"${entry.text}" chứa "${form}" — dạng đáp án bị cấm của câu ${item.id}.`,
        });
      }
    }

    if (entry.kind !== "name") continue;
    const key = syllableSequence(entry.text).join(" ");
    const previous = names.get(key);
    if (previous) {
      findings.push({
        severity: "error",
        code: "MONSTER_NAME_DUPLICATE",
        where: entry.where,
        message: `Tên "${entry.text}" trùng với tên ở ${previous}.`,
      });
    } else {
      names.set(key, entry.where);
    }
    for (const syllable of syllableSequence(entry.text)) {
      if (input.lexicon.has(syllable)) {
        findings.push({
          severity: "warning",
          code: "MONSTER_NAME_IS_LEARNING_UNIT",
          where: entry.where,
          message: `Tiếng "${syllable}" trong tên "${entry.text}" là tiếng của kho học liệu — GV xem có thể thành đáp án.`,
        });
      } else {
        const near = toneFolded.get(foldTone(syllable));
        if (near) {
          findings.push({
            severity: "warning",
            code: "MONSTER_NAME_SIMILAR_TO_LEARNING_UNIT",
            where: entry.where,
            message: `Tiếng "${syllable}" trong tên "${entry.text}" chỉ khác thanh với "${near}" của kho học liệu — GV xem.`,
          });
        }
      }
    }
  }
  return findings;
}
