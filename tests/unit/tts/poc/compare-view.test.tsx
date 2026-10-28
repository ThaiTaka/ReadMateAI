import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TtsCompareView } from "@/app/teacher/(console)/tts-compare/tts-compare-view";
import { POC_FILE_PATTERN, type PocSample } from "@/server/tts/poc/manifest";
import { POC_CATALOG_SENTENCES, POC_DIAGNOSTIC_SENTENCES } from "@/server/tts/poc/sentences";
import { vi } from "@/strings/vi";

const hash = (n: number) => n.toString(16).padStart(64, "0");

function sample(n: number, over: Partial<PocSample> = {}): PocSample {
  const sentence = POC_CATALOG_SENTENCES[0]!;
  return {
    requestKey: hash(n),
    file: `${hash(n + 1000)}.mp3`,
    sha256: hash(n + 1000),
    provider: "fpt",
    voiceKey: "fpt-banmai",
    providerVoice: "banmai",
    speed: "normal",
    format: "mp3",
    mime: "audio/mpeg",
    sentenceId: sentence.id,
    sentenceKind: "catalog",
    text: sentence.text,
    chars: sentence.text.length,
    bytes: 20480,
    durationMs: 2500,
    latencyMs: 4200,
    createdAt: "2026-10-28T09:00:00.000Z",
    ...over,
  };
}

describe("trang so sánh giọng AI (chỉ giáo viên, chỉ nghe)", () => {
  const t = vi.ttsCompare;

  it("luôn hiện dòng BẢN THỬ NGHIỆM — DỮ LIỆU MINH HỌA và bảng ghi nhận 'Chưa nghe'", () => {
    render(<TtsCompareView samples={[]} problem="MISSING" />);
    expect(screen.getByText("BẢN THỬ NGHIỆM — DỮ LIỆU MINH HỌA")).toBeInTheDocument();
    expect(screen.getAllByText(t.notesPending).length).toBeGreaterThan(0);
    for (const criterion of t.criteria) expect(screen.getByText(criterion)).toBeInTheDocument();
  });

  it("chưa có tệp: nói rõ chưa gọi API thật, không thẻ audio", () => {
    const { container } = render(<TtsCompareView samples={[]} problem="MISSING" />);
    expect(screen.getByText(t.emptyTitle)).toBeInTheDocument();
    expect(container.querySelectorAll("audio")).toHaveLength(0);
    expect(container.textContent).toContain("chưa gọi API của nhà cung cấp nào");
  });

  it("sổ hỏng: báo lỗi, không audio", () => {
    const { container } = render(<TtsCompareView samples={[]} problem="INVALID" />);
    expect(screen.getByText(t.invalidTitle)).toBeInTheDocument();
    expect(container.querySelectorAll("audio")).toHaveLength(0);
  });

  it("A/B: mỗi tệp có <audio controls> trỏ route giáo viên, không tự phát, không URL nhà cung cấp", () => {
    const samples = [
      sample(1),
      sample(2, { voiceKey: "fpt-lannhi", providerVoice: "lannhi" }),
      sample(3, { speed: "slow" }),
    ];
    const { container } = render(<TtsCompareView samples={samples} problem="NONE" />);
    const audios = [...container.querySelectorAll("audio")];
    expect(audios).toHaveLength(3);
    for (const audio of audios) {
      expect(audio.hasAttribute("controls")).toBe(true);
      expect(audio.hasAttribute("autoplay")).toBe(false);
      expect(audio.getAttribute("preload")).toBe("none");
      const src = audio.getAttribute("src") ?? "";
      expect(src).toMatch(/^\/api\/teacher\/tts-poc\//u);
      expect(POC_FILE_PATTERN.test(src.split("/").pop() ?? "")).toBe(true);
      expect(src).not.toMatch(/amazonaws|fpt\.ai|googleapis/iu);
    }
    const article = screen.getByRole("article", { name: POC_CATALOG_SENTENCES[0]!.id });
    expect(within(article).getByText(/FPT\.AI banmai · Tốc độ bình thường/u)).toBeInTheDocument();
    expect(within(article).getByText(/FPT\.AI lannhi/u)).toBeInTheDocument();
    expect(within(article).getByText(/FPT\.AI banmai · Tốc độ chậm vừa/u)).toBeInTheDocument();
  });

  it("câu chẩn đoán được đánh dấu 'không phải học liệu'", () => {
    const diagnostic = POC_DIAGNOSTIC_SENTENCES[0]!;
    render(
      <TtsCompareView
        samples={[sample(5, { sentenceId: diagnostic.id, sentenceKind: "diagnostic", text: diagnostic.text })]}
        problem="NONE"
      />,
    );
    const article = screen.getByRole("article", { name: diagnostic.id });
    expect(within(article).getByText(t.diagnosticNote)).toBeInTheDocument();
  });

  it("không có nút duyệt/chọn giọng/gửi; chi phí thật 'Chưa có số liệu'; không từ cấm", () => {
    const { container } = render(<TtsCompareView samples={[sample(1)]} problem="NONE" />);
    expect(screen.queryAllByRole("button")).toHaveLength(0);
    expect(container.querySelectorAll("form, input, textarea, select")).toHaveLength(0);
    expect(screen.getByText(t.costUnknown)).toBeInTheDocument();
    const text = container.textContent ?? "";
    expect(text).not.toMatch(/đã duyệt|phiếu|ở lớp|tại lớp|trên lớp/iu);
    // Số liệu đo: 1 tệp, 4,2 giây, 20 KB, 2,5 giây.
    expect(text).toContain("4.2 giây");
    expect(text).toContain("20 KB");
  });

  it("liệt kê đủ giọng đang thử với nhà cung cấp, vùng miền", () => {
    render(<TtsCompareView samples={[]} problem="MISSING" />);
    expect(screen.getAllByRole("table").length).toBeGreaterThanOrEqual(2);
    for (const voice of ["hcm-minhquan", "banmai", "lannhi", "thuminh", "vi-VN-Neural2-A", "vi-VN-Neural2-D"]) {
      expect(screen.getByText(voice)).toBeInTheDocument();
    }
  });

  it("Viettel Minh Quân: hiện nam, miền Nam; chưa có tệp thì nói chưa nghe; có tệp thì cho nghe nhưng không ghi 'đã duyệt'", () => {
    const { container, rerender } = render(<TtsCompareView samples={[]} problem="MISSING" />);
    const row = screen.getByText("hcm-minhquan").closest("tr")!;
    expect(within(row).getByText("Viettel AI")).toBeInTheDocument();
    // Cột giới tính và vùng miền đều ghi "Nam" (nam, miền Nam).
    expect(within(row).getAllByText(t.regions.south)).toHaveLength(2);
    expect(within(row).getByText(t.candidateStatus.noSample)).toBeInTheDocument();
    expect(container.textContent).toContain("chưa được kiểm chứng bằng token thật");

    const viettel = sample(7, {
      provider: "viettel",
      voiceKey: "viettel-hcm-minhquan",
      providerVoice: "hcm-minhquan",
    });
    rerender(<TtsCompareView samples={[viettel]} problem="NONE" />);
    const audios = container.querySelectorAll("audio");
    expect(audios).toHaveLength(1);
    expect(audios[0]!.getAttribute("src")).toMatch(/^\/api\/teacher\/tts-poc\/[0-9a-f]{64}\.mp3$/u);
    const article = screen.getByRole("article", { name: POC_CATALOG_SENTENCES[0]!.id });
    expect(
      within(article).getByText(/Viettel AI Minh Quân \(nam, miền Nam\) · Tốc độ bình thường/u),
    ).toBeInTheDocument();
    expect(screen.getByText(/Có 1 tệp để nghe/u)).toBeInTheDocument();
    expect(screen.queryAllByRole("button")).toHaveLength(0);
    expect(container.textContent ?? "").not.toMatch(/đã duyệt/iu);
    // Bảng ghi nhận chỉ còn cột của giọng đã có tệp, mọi ô vẫn là "Chưa nghe".
    const notes = screen.getByRole("heading", { name: t.notesTitle }).closest("section")!;
    expect(within(notes).getAllByRole("columnheader")).toHaveLength(2);
    expect(within(notes).getAllByText(t.notesPending)).toHaveLength(t.criteria.length);
  });
});
