import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { CoverageView } from "@/app/teacher/(console)/audio-coverage/coverage-view";
import { buildAudioCoverage, type CoverageInput, type LibraryLineInput } from "@/features/audio-coverage/build";
import { RIME_TOTAL, WIRED_PURPOSES } from "@/features/audio-coverage/catalog";
import { AUDIO_UNITS } from "@/features/audio-library/p0-catalog";
import type { AssetSummary, VersionSummary } from "@/features/audio-library/unit-state";
import { STUDY_UNITS } from "@/features/audio-playback/study-catalog";
import type { ReviewRow, VersionRow } from "@/features/tts-library/state";
import { LIBRARY_ENTRIES } from "@/server/tts-library/entries";

/**
 * Báo cáo độ phủ âm thanh (R10.5): hàm thuần + khung hiển thị. Điều quan trọng nhất: KHÔNG BAO GIỜ kết luận "đủ" khi còn thiếu, chỉ tệp
 * ĐÃ DUYỆT mới được tính, và mọi nút nghe trong Học tập được nối với một khe âm thanh có thật.
 */

const LINES: LibraryLineInput[] = LIBRARY_ENTRIES.map((entry) => ({
  id: entry.id,
  contentHash: entry.contentHash,
  assetKey: entry.assetKey,
  text: entry.text,
  purpose: entry.purpose === "feedback" ? "feedback" : "instruction",
}));

const base = (over: Partial<CoverageInput> = {}): CoverageInput => ({
  units: AUDIO_UNITS,
  assets: [],
  userId: "gv-1",
  lines: LINES,
  reviews: [],
  versions: [],
  studyUnits: STUDY_UNITS,
  rimeTotal: RIME_TOTAL,
  wiredPurposes: WIRED_PURPOSES,
  ...over,
});

const version = (over: Partial<VersionSummary> = {}): VersionSummary => ({
  id: "v1",
  versionNo: 1,
  status: "approved",
  spokenLabel: "bờ",
  mimeType: "audio/wav",
  sizeBytes: 100,
  durationMs: 1000,
  createdBy: "gv-1",
  createdAt: "2026-10-29T00:00:00Z",
  submittedAt: null,
  reviewedAt: null,
  reviewNote: null,
  revokeReason: null,
  ...over,
});

const assetFor = (key: string, status: VersionSummary["status"] = "approved"): AssetSummary => {
  const [unitKind, unitText] = key.split(":") as [string, string];
  return {
    id: `asset-${key}`,
    unitKind,
    unitText,
    proposedLabel: "x",
    confirmedLabel: status === "approved" ? "x" : null,
    confirmedAt: null,
    note: null,
    activeVersionId: status === "approved" ? "v1" : null,
    versions: [version({ status })],
  };
};

const reviewOf = (line: LibraryLineInput, over: Partial<ReviewRow> = {}): ReviewRow => ({
  entryId: line.id,
  contentHash: line.contentHash,
  decision: "approved",
  pronunciationConfirmed: true,
  ...over,
});

const versionOf = (line: LibraryLineInput, over: Partial<VersionRow> = {}): VersionRow => ({
  id: `ver-${line.id}`,
  entryId: line.id,
  contentHash: line.contentHash,
  assetKey: line.assetKey,
  versionNo: 1,
  status: "approved",
  testOnly: false,
  durationMs: 1000,
  reviewNote: null,
  revokeReason: null,
  generatedAt: "2026-10-29T00:00:00Z",
  ...over,
});

describe("danh mục thật", () => {
  it("29 tên chữ cái + các âm; 17 câu lệnh + 17 lời phản hồi; mọi nút nghe trong Học tập nối với một khe âm thanh có thật", () => {
    const coverage = buildAudioCoverage(base());
    expect(coverage.letters.rows).toHaveLength(29);
    expect(coverage.phonemes.rows.length + coverage.letters.rows.length).toBe(AUDIO_UNITS.length);
    expect(coverage.instruction.total).toBe(17);
    expect(coverage.feedback.total).toBe(17);
    expect(coverage.study.positions).toBe(STUDY_UNITS.length);
    // Đây là phép kiểm "mọi vị trí chạm chữ được nối đúng khe âm thanh": không nút nào trỏ tới đơn vị không có trong danh sách ghi âm.
    expect(coverage.study.unmapped).toBe(0);
    expect(coverage.rimes).toEqual({ tracked: false, total: RIME_TOTAL });
    expect(RIME_TOTAL).toBeGreaterThan(0);
    expect(coverage.words).toEqual({ tracked: false });
  });

  it("chưa có dữ liệu: mọi mục là 'chưa ghi', không có gì được tính là đủ", () => {
    const coverage = buildAudioCoverage(base());
    expect(coverage.letters.counts).toMatchObject({ approved: 0, missing: 29, total: 29 });
    expect(coverage.study.ready).toBe(0);
    expect(coverage.instruction.usable).toBe(0);
    expect(coverage.lettersAndSoundsComplete).toBe(false);
    expect(coverage.instructionsComplete).toBe(false);
    expect(coverage.missingTotal).toBe(AUDIO_UNITS.length + 17);
  });

  it("tổng các trạng thái luôn bằng tổng số mục", () => {
    const coverage = buildAudioCoverage(
      base({
        assets: [
          assetFor("letter:b", "approved"),
          assetFor("letter:c", "pending_review"),
          assetFor("letter:d", "rejected"),
          assetFor("phoneme:b", "draft"),
        ],
      }),
    );
    for (const group of [coverage.letters, coverage.phonemes]) {
      const { total, ...states } = group.counts;
      expect(Object.values(states).reduce((sum, n) => sum + n, 0)).toBe(total);
    }
    expect(coverage.letters.counts).toMatchObject({ approved: 1, pending_review: 1, rerecord: 1 });
    expect(coverage.phonemes.counts).toMatchObject({ draft: 1 });
  });
});

describe("chỉ tệp ĐÃ DUYỆT được tính", () => {
  it.each(["draft", "pending_review", "rejected", "revoked"] as const)(
    "bản ở trạng thái %s không tính là có",
    (status) => {
      const coverage = buildAudioCoverage(base({ assets: [assetFor("letter:b", status)] }));
      expect(coverage.letters.rows.find((row) => row.key === "letter:b")?.valid).toBe(false);
      expect(coverage.letters.counts.approved).toBe(0);
    },
  );

  it("bản đã duyệt được tính, và nút nghe tương ứng trong Học tập sẵn sàng", () => {
    const before = buildAudioCoverage(base());
    const after = buildAudioCoverage(base({ assets: [assetFor("letter:b"), assetFor("phoneme:b")] }));
    expect(after.letters.counts.approved).toBe(1);
    expect(after.phonemes.counts.approved).toBe(1);
    expect(after.study.ready).toBe(before.study.ready + 2);
  });

  it("'i' dùng chung bản ghi với 'y': duyệt âm i thì nút nghe của y cũng sẵn sàng", () => {
    const ofI = AUDIO_UNITS.find((unit) => unit.key === "phoneme:i");
    expect(ofI?.alsoCovers).toContain("y");
    const before = buildAudioCoverage(base());
    const after = buildAudioCoverage(base({ assets: [assetFor("phoneme:i")] }));
    const touchesBoth = STUDY_UNITS.filter(
      (unit) => unit.kind === "phoneme" && (unit.text === "i" || unit.text === "y"),
    );
    expect(after.study.ready - before.study.ready).toBe(touchesBoth.length);
  });

  it("đủ mọi tên chữ cái và mọi âm đã duyệt → 'đủ chữ và âm' (câu lệnh vẫn tính riêng)", () => {
    const all = AUDIO_UNITS.map((unit) => assetFor(unit.key));
    const coverage = buildAudioCoverage(base({ assets: all }));
    expect(coverage.lettersAndSoundsComplete).toBe(true);
    expect(coverage.instructionsComplete).toBe(false);
    expect(coverage.study.ready).toBe(coverage.study.positions);
    expect(coverage.missingTotal).toBe(17);
  });

  it("thiếu MỘT mục thì không bao giờ 'đủ'", () => {
    const [, ...rest] = AUDIO_UNITS;
    const coverage = buildAudioCoverage(base({ assets: rest.map((unit) => assetFor(unit.key)) }));
    expect(coverage.lettersAndSoundsComplete).toBe(false);
    expect(coverage.missingTotal).toBe(1 + 17);
  });
});

describe("lời đọc giọng máy", () => {
  const [first, second, third] = LINES.filter((line) => line.purpose === "instruction") as [
    LibraryLineInput,
    LibraryLineInput,
    LibraryLineInput,
  ];

  it("dùng được khi lời đọc đã duyệt VÀ tệp đã duyệt khớp cấu hình hiện hành", () => {
    const coverage = buildAudioCoverage(base({ reviews: [reviewOf(first)], versions: [versionOf(first)] }));
    const row = coverage.instruction.rows.find((r) => r.id === first.id)!;
    expect(row).toMatchObject({ usable: true, scriptStatus: "approved", audioStatus: "approved", stale: false });
    expect(coverage.instruction.usable).toBe(1);
  });

  it("tệp đã duyệt nhưng lời đọc chưa duyệt, hoặc ngược lại → chưa dùng được", () => {
    const noScript = buildAudioCoverage(base({ versions: [versionOf(first)] }));
    expect(noScript.instruction.rows.find((r) => r.id === first.id)?.usable).toBe(false);
    const noFile = buildAudioCoverage(base({ reviews: [reviewOf(first)] }));
    const row = noFile.instruction.rows.find((r) => r.id === first.id)!;
    expect(row).toMatchObject({ usable: false, scriptStatus: "approved", audioStatus: "missing" });
  });

  it("đổi chữ/giọng → tệp cũ không tính và được đánh dấu lỗi thời; chờ duyệt và bị thu hồi không tính", () => {
    const coverage = buildAudioCoverage(
      base({
        reviews: [reviewOf(first), reviewOf(second), reviewOf(third)],
        versions: [
          versionOf(first, { assetKey: "0".repeat(64) }),
          versionOf(second, { status: "pending_review" }),
          versionOf(third, { status: "revoked" }),
        ],
      }),
    );
    const byId = (id: string) => coverage.instruction.rows.find((r) => r.id === id)!;
    expect(byId(first.id)).toMatchObject({ usable: false, stale: true, audioStatus: "missing" });
    expect(byId(second.id)).toMatchObject({ usable: false, audioStatus: "pending_review" });
    expect(byId(third.id)).toMatchObject({ usable: false, audioStatus: "revoked" });
    expect(coverage.instruction.pendingReview).toBe(1);
    expect(coverage.instruction.usable).toBe(0);
  });

  it("tệp kiểm thử (test_only) không bao giờ tính vào độ phủ", () => {
    const coverage = buildAudioCoverage(
      base({ reviews: [reviewOf(first)], versions: [versionOf(first, { testOnly: true })] }),
    );
    expect(coverage.instruction.usable).toBe(0);
  });

  it("mọi câu lệnh dùng được → 'đủ câu lệnh'", () => {
    const instructions = LINES.filter((line) => line.purpose === "instruction");
    const coverage = buildAudioCoverage(
      base({ reviews: instructions.map((l) => reviewOf(l)), versions: instructions.map((l) => versionOf(l)) }),
    );
    expect(coverage.instructionsComplete).toBe(true);
    expect(coverage.instruction.missing).toBe(0);
  });

  it("chỉ câu lệnh đã nối vào màn hình học sinh; lời phản hồi thì chưa — báo cáo nói đúng như vậy", () => {
    expect(WIRED_PURPOSES).toEqual(["instruction"]);
    const coverage = buildAudioCoverage(base());
    expect(coverage.instruction.rows.every((row) => row.wiredForStudents)).toBe(true);
    expect(coverage.feedback.rows.every((row) => !row.wiredForStudents)).toBe(true);
  });
});

describe("khung hiển thị", () => {
  it("thiếu → nói 'Chưa đủ', liệt kê mục cần bổ sung, nêu rõ phần chưa theo dõi; không có lời tuyên bố 'đủ'", () => {
    render(<CoverageView coverage={buildAudioCoverage(base({ assets: [assetFor("letter:b")] }))} />);
    const verdict = screen.getByTestId("coverage-verdict");
    expect(verdict).toHaveAttribute("data-complete", "no");
    expect(verdict.textContent).toMatch(/Chưa đủ để nói “mọi chữ đều đọc được”/u);
    expect(verdict.textContent).not.toMatch(/Đã có tệp đã duyệt cho mọi/u);
    expect(screen.getByTestId("coverage-letters").textContent).toBe("1 / 29 đã duyệt");
    expect(screen.getByTestId("coverage-todo").textContent).toMatch(/Chưa có bản ghi đã duyệt/u);
    expect(screen.getByTestId("coverage-untracked").textContent).toMatch(/Vần:/u);
    expect(screen.getByText(/chưa nghe được lời phản hồi/iu)).toBeInTheDocument();
    expect(document.querySelectorAll('[data-testid="coverage-letters-list"] li')).toHaveLength(29);
    expect(document.querySelectorAll('[data-unit="letter:b"][data-state="approved"]')).toHaveLength(1);
  });

  it("đủ chữ, âm và câu lệnh → thông báo đủ nhưng vẫn nhắc vần/từ/câu chưa theo dõi", () => {
    const instructions = LINES.filter((line) => line.purpose === "instruction");
    render(
      <CoverageView
        coverage={buildAudioCoverage(
          base({
            assets: AUDIO_UNITS.map((unit) => assetFor(unit.key)),
            reviews: instructions.map((l) => reviewOf(l)),
            versions: instructions.map((l) => versionOf(l)),
          }),
        )}
      />,
    );
    const verdict = screen.getByTestId("coverage-verdict");
    expect(verdict).toHaveAttribute("data-complete", "yes");
    expect(verdict.textContent).toMatch(/chưa thể nói mọi thứ đều đọc được/u);
    expect(screen.getByTestId("coverage-todo").textContent).toMatch(/Không còn mục nào thiếu/u);
    expect(screen.getByTestId("coverage-untracked")).toBeInTheDocument();
  });
});
