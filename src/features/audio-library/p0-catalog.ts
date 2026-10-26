import phonemes from "../../../content/kb/phonemes.json";

/**
 * Danh sách P0 DỰ KIẾN (docs/AUDIO_RECORDING_PLAN §3): cách gọi âm của chữ ghi âm mà bài "Nghe âm – chọn chữ" cần bản
 * ghi giáo viên. Nhãn lấy từ `content/kb/phonemes.json` (đề xuất của AI, chờ GV xác nhận — Q-02), KHÔNG tự đặt ở đây.
 * `i` và `y` chung một cách gọi nên chung một bản ghi (trừ khi GV chọn "i dài" cho y — khi đó xác nhận nhãn riêng).
 */

export type AudioUnit = {
  /** Khóa ổn định, ví dụ `phoneme:ngh`. */
  key: string;
  kind: "phoneme";
  /** Chữ ghi âm (NFC) — cũng là `unit_text` trong CSDL. */
  text: string;
  /** Chữ hiển thị (ví dụ "i / y"). */
  displayText: string;
  /** Cách gọi dự kiến (chưa được GV xác nhận). */
  proposedLabel: string;
  /** Chữ khác dùng chung bản ghi này. */
  alsoCovers: readonly string[];
  /** Điểm quy ước cần GV chốt trước khi ghi (AUDIO_RECORDING_PLAN §3). */
  needsDecision: boolean;
};

/** Chữ có cách gọi phụ thuộc quy ước nhà trường — phải được GV chốt trước khi ghi. */
const NEEDS_DECISION = new Set(["k", "gh", "ngh", "gi", "qu", "ă", "â", "i"]);

type RawPhoneme = { id: string; text: string; teachingLabel: { proposed: string } };

function build(): readonly AudioUnit[] {
  const items = (phonemes as { items: RawPhoneme[] }).items;
  const byText = new Map(items.map((item) => [item.text.normalize("NFC"), item]));
  const units: AudioUnit[] = [];
  for (const item of items) {
    const text = item.text.normalize("NFC");
    const proposedLabel = item.teachingLabel.proposed.normalize("NFC");
    // y dùng chung bản ghi của i khi hai nhãn trùng nhau.
    if (text === "y" && byText.get("i")?.teachingLabel.proposed === item.teachingLabel.proposed) continue;
    const alsoCovers =
      text === "i" && byText.get("y")?.teachingLabel.proposed === item.teachingLabel.proposed ? ["y"] : [];
    units.push({
      key: `phoneme:${text}`,
      kind: "phoneme",
      text,
      displayText: [text, ...alsoCovers].join(" / "),
      proposedLabel,
      alsoCovers,
      needsDecision: NEEDS_DECISION.has(text),
    });
  }
  return units;
}

export const P0_UNITS: readonly AudioUnit[] = build();

export const P0_UNIT_BY_KEY: ReadonlyMap<string, AudioUnit> = new Map(P0_UNITS.map((unit) => [unit.key, unit]));

export function findP0Unit(kind: string, text: string): AudioUnit | undefined {
  return kind === "phoneme" ? P0_UNIT_BY_KEY.get(`phoneme:${text}`) : undefined;
}
