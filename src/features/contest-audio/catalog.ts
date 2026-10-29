import { sha256Hex } from "../../server/tts/hash.ts";
import { CONTEST_PROVIDER_ID, CONTEST_VOICE, type ContestEntryKind, type ContestRiskClass } from "./config.ts";
import { classifyRisk, type RiskReason } from "./risk.ts";

/**
 * Danh mục lời đọc của chế độ trình diễn (101 mục): 29 tên chữ cái + 38 âm của chữ + 17 câu lệnh + 17 lời phản hồi. HÀM THUẦN: nhận
 * dữ liệu kho tri thức và danh mục thư viện giọng máy làm đầu vào (không đọc tệp, không mạng) để dùng được ở cả máy chủ Next lẫn script.
 *
 * Không bịa cách đọc: chữ đọc lấy NGUYÊN VĂN từ `teachingLabel.proposed` (âm), `name.proposed` (tên chữ cái) của kho tri thức
 * (đề xuất, chưa giáo viên xác nhận) và từ chữ cố định của thư viện câu lệnh/phản hồi. Phép biến đổi duy nhất: dấu gạch nối của tên
 * nhiều tiếng ("e-lờ") đổi thành dấu cách để bộ tổng hợp đọc từng tiếng.
 */

export type RawLetter = { lower: string; order: number; name: { proposed: string } };
export type RawPhoneme = { text: string; teachingLabel: { proposed: string } };
export type RawLibraryLine = { id: string; text: string; attention?: readonly string[] };

export type ContestEntry = {
  /** `letter:b` · `phoneme:gh` · `instruction:listen_letter` · `feedback:retry.tone`. */
  id: string;
  kind: ContestEntryKind;
  /** Phần sau dấu hai chấm của `id`. */
  unit: string;
  /** Chữ gửi cho bộ tổng hợp (NFC). */
  text: string;
  /** Băm nội dung (loại + khóa + chữ): đổi chữ thì bản trình diễn cũ không còn khớp. */
  contentHash: string;
  /** Khóa dùng lại tệp: nhà cung cấp + giọng + tốc độ + phiên bản cấu hình + chữ. Hai mục cùng chữ dùng chung MỘT lần gọi. */
  assetKey: string;
  riskClass: ContestRiskClass;
  riskReasons: RiskReason[];
  /** Cờ chú ý của danh mục thư viện (xưng hô, từ phủ định) — chỉ để báo cáo. */
  attention: string[];
};

// Dấu phân cách trường (U+0001) dựng bằng mã ký tự để tệp nguồn không chứa ký tự điều khiển (CLAUDE.md §9.6.6).
const SEP = String.fromCharCode(1);
// Các dấu gạch nối Unicode (U+2010, U+2011) dựng bằng mã để tệp nguồn không chứa ký tự đặc biệt.
const HYPHENS = new RegExp(`[-${String.fromCharCode(0x2010)}${String.fromCharCode(0x2011)}]+`, "gu");

export const nfcText = (value: string): string => value.normalize("NFC").trim();

/** Tên nhiều tiếng ghi bằng gạch nối → đọc từng tiếng. */
export function spokenFromLabel(label: string): string {
  return nfcText(label).replace(HYPHENS, " ").replace(/\s+/gu, " ").trim();
}

export function contestAssetKey(text: string): string {
  return sha256Hex(
    [CONTEST_PROVIDER_ID, CONTEST_VOICE.voiceKey, CONTEST_VOICE.speed, CONTEST_VOICE.configVersion, nfcText(text)].join(
      SEP,
    ),
  );
}

export function contestContentHash(kind: ContestEntryKind, unit: string, text: string): string {
  return sha256Hex(["contest-v1", kind, nfcText(unit), nfcText(text)].join(SEP));
}

function entry(kind: ContestEntryKind, unit: string, text: string, attention: readonly string[] = []): ContestEntry {
  const unitNfc = nfcText(unit);
  const spoken = nfcText(text);
  const risk = classifyRisk({ kind, unit: unitNfc, spoken });
  return {
    id: `${kind}:${unitNfc}`,
    kind,
    unit: unitNfc,
    text: spoken,
    contentHash: contestContentHash(kind, unitNfc, spoken),
    assetKey: contestAssetKey(spoken),
    riskClass: risk.riskClass,
    riskReasons: risk.reasons,
    attention: [...attention],
  };
}

export type ContestCatalog = {
  entries: readonly ContestEntry[];
  byId: ReadonlyMap<string, ContestEntry>;
};

export function buildContestCatalog(input: {
  letters: readonly RawLetter[];
  phonemes: readonly RawPhoneme[];
  library: readonly RawLibraryLine[];
}): ContestCatalog {
  const entries: ContestEntry[] = [];
  for (const letter of [...input.letters].sort((a, b) => a.order - b.order)) {
    entries.push(entry("letter", letter.lower, spokenFromLabel(letter.name.proposed)));
  }
  for (const phoneme of input.phonemes) {
    entries.push(entry("phoneme", phoneme.text, spokenFromLabel(phoneme.teachingLabel.proposed)));
  }
  for (const line of input.library) {
    const match = /^(instruction|feedback):(.+)$/u.exec(line.id);
    if (!match) continue;
    entries.push(entry(match[1] as "instruction" | "feedback", match[2]!, line.text, line.attention ?? []));
  }
  return { entries, byId: new Map(entries.map((item) => [item.id, item])) };
}

/** Số lần gọi nhà cung cấp tối thiểu để phủ cả danh mục: các mục cùng chữ dùng chung một tệp. */
export function distinctAssetKeys(entries: readonly ContestEntry[]): string[] {
  return [...new Set(entries.map((item) => item.assetKey))];
}
