import type { AudioUnit } from "../audio-library/p0-catalog.ts";
import {
  countStates,
  deriveUnitState,
  type AssetSummary,
  type UnitCounts,
  type UnitState,
} from "../audio-library/unit-state.ts";
import {
  deriveLineState,
  type AudioStatus,
  type LineKey,
  type ReviewRow,
  type ScriptStatus,
  type VersionRow,
} from "../tts-library/state.ts";

/**
 * Báo cáo độ phủ âm thanh (R10.5) — hàm thuần, chạy trên dữ liệu ĐÃ ĐỌC (RLS của giáo viên quyết định thấy gì), không đọc CSDL, không
 * có đường tự tính "đủ". Quy tắc:
 *  - Chỉ tệp ĐÃ DUYỆT mới được tính là "có" (bản nháp, chờ duyệt, bị từ chối, đã thu hồi, lỗi thời đều là "chưa có").
 *  - Mỗi mục có ĐÚNG MỘT trạng thái, tổng các trạng thái = tổng số mục (kiểm bằng test).
 *  - Thứ chưa được theo dõi (vần, từ, tiếng, câu) được ghi là "chưa theo dõi", KHÔNG đếm là đủ hay thiếu.
 *  - `lettersAndSoundsComplete` chỉ đúng khi mọi tên chữ cái và mọi âm của chữ đều có tệp đã duyệt: báo cáo không bao giờ kết luận
 *    "mọi chữ đều đọc được" khi còn thiếu.
 */

export type UnitRow = {
  key: string;
  kind: AudioUnit["kind"];
  display: string;
  /** Cách đọc đang hiển thị: đã xác nhận nếu có, nếu không thì cách đọc dự kiến. */
  label: string;
  labelConfirmed: boolean;
  needsDecision: boolean;
  state: UnitState;
  /** Có tệp đã duyệt (học sinh nghe được khi các cờ hệ thống bật). */
  valid: boolean;
};

export type LineRow = {
  id: string;
  purpose: "instruction" | "feedback";
  text: string;
  scriptStatus: ScriptStatus;
  audioStatus: AudioStatus;
  /** Có bản đã duyệt của chữ/giọng cũ — không còn phát. */
  stale: boolean;
  /** Lời đọc đã duyệt + tệp đã duyệt khớp cấu hình hiện hành. */
  usable: boolean;
  /** Học sinh có nghe được lời đọc loại này không (phụ thuộc việc đã nối vào màn hình học, không phụ thuộc tệp). */
  wiredForStudents: boolean;
};

export type LibraryLineInput = LineKey & { text: string; purpose: LineRow["purpose"] };

export type CoverageInput = {
  units: readonly AudioUnit[];
  assets: readonly AssetSummary[];
  userId: string;
  lines: readonly LibraryLineInput[];
  reviews: readonly ReviewRow[];
  versions: readonly VersionRow[];
  /** Các vị trí chạm nghe trong Học tập (tên chữ cái / âm của chữ). */
  studyUnits: readonly { kind: string; text: string }[];
  /** Số vần trong kho tri thức (chưa có công cụ ghi âm vần). */
  rimeTotal: number;
  /** Loại lời đọc đã được nối vào màn hình học sinh. */
  wiredPurposes: readonly LineRow["purpose"][];
};

export type LineGroup = { rows: LineRow[]; total: number; usable: number; pendingReview: number; missing: number };

export type Coverage = {
  letters: { rows: UnitRow[]; counts: UnitCounts };
  phonemes: { rows: UnitRow[]; counts: UnitCounts };
  study: { positions: number; ready: number; unmapped: number };
  rimes: { tracked: false; total: number };
  words: { tracked: false };
  instruction: LineGroup;
  feedback: LineGroup;
  lettersAndSoundsComplete: boolean;
  instructionsComplete: boolean;
  /** Số mục tên chữ cái + âm + câu lệnh chưa có tệp đã duyệt. */
  missingTotal: number;
};

function unitRows(units: readonly AudioUnit[], assets: readonly AssetSummary[], userId: string): UnitRow[] {
  const byKey = new Map(assets.map((asset) => [`${asset.unitKind}:${asset.unitText}`, asset]));
  return units.map((unit): UnitRow => {
    const asset = byKey.get(unit.key);
    const state = deriveUnitState(asset, userId);
    return {
      key: unit.key,
      kind: unit.kind,
      display: unit.displayText,
      label: asset?.confirmedLabel ?? unit.proposedLabel,
      labelConfirmed: Boolean(asset?.confirmedLabel),
      needsDecision: unit.needsDecision,
      state,
      valid: state === "approved",
    };
  });
}

function lineGroup(rows: LineRow[]): LineGroup {
  return {
    rows,
    total: rows.length,
    usable: rows.filter((row) => row.usable).length,
    pendingReview: rows.filter((row) => !row.usable && row.audioStatus === "pending_review").length,
    missing: rows.filter((row) => !row.usable).length,
  };
}

export function buildAudioCoverage(input: CoverageInput): Coverage {
  const rows = unitRows(input.units, input.assets, input.userId);
  const letters = rows.filter((row) => row.kind === "letter");
  const phonemes = rows.filter((row) => row.kind === "phoneme");

  // Một bản ghi có thể phủ nhiều chữ (i / y dùng chung): khóa phủ gồm cả `alsoCovers`.
  const validKeys = new Set<string>();
  for (const unit of input.units) {
    const row = rows.find((candidate) => candidate.key === unit.key);
    if (!row?.valid) continue;
    validKeys.add(unit.key);
    for (const other of unit.alsoCovers) validKeys.add(`${unit.kind}:${other}`);
  }
  const known = new Set<string>();
  for (const unit of input.units) {
    known.add(unit.key);
    for (const other of unit.alsoCovers) known.add(`${unit.kind}:${other}`);
  }
  const positions = input.studyUnits.map((unit) => `${unit.kind}:${unit.text}`);

  const lineRows = input.lines.map((line): LineRow => {
    const state = deriveLineState(line, input.reviews, input.versions);
    return {
      id: line.id,
      purpose: line.purpose,
      text: line.text,
      scriptStatus: state.scriptStatus,
      audioStatus: state.audioStatus,
      stale: state.staleApproved,
      usable: state.usable,
      wiredForStudents: input.wiredPurposes.includes(line.purpose),
    };
  });
  const instruction = lineGroup(lineRows.filter((row) => row.purpose === "instruction"));
  const feedback = lineGroup(lineRows.filter((row) => row.purpose === "feedback"));

  const lettersAndSoundsComplete = rows.length > 0 && rows.every((row) => row.valid);
  const instructionsComplete = instruction.total > 0 && instruction.usable === instruction.total;
  return {
    letters: { rows: letters, counts: countStates(letters.map((row) => row.state)) },
    phonemes: { rows: phonemes, counts: countStates(phonemes.map((row) => row.state)) },
    study: {
      positions: positions.length,
      ready: positions.filter((key) => validKeys.has(key)).length,
      unmapped: positions.filter((key) => !known.has(key)).length,
    },
    rimes: { tracked: false, total: input.rimeTotal },
    words: { tracked: false },
    instruction,
    feedback,
    lettersAndSoundsComplete,
    instructionsComplete,
    missingTotal: rows.filter((row) => !row.valid).length + (instruction.total - instruction.usable),
  };
}
