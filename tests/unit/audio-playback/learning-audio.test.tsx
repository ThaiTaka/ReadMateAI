import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LearningAudioProvider, LearningAudioStatus, ListenableLetter } from "@/components/kid/learning-audio";
import { AUDIO_UNITS, LETTER_UNITS, P0_UNITS } from "@/features/audio-library/p0-catalog";
import { learningUnitInfo } from "@/features/audio-playback/learning-units";
import { STUDY_DIGRAPHS, STUDY_LETTERS, STUDY_UNITS } from "@/features/audio-playback/study-catalog";
import { vi as strings } from "@/strings/vi";

/**
 * R10.4 — "Chữ có thể nghe": danh mục (ba loại âm thanh không bị gộp), bố cục trang học và hành vi của nút nghe.
 * Không có âm thanh thật: `Audio` và `fetch` được thay bằng bản giả ghi lại những gì giao diện làm.
 */

const STUDENT = "5b1c3a52-7a43-4c43-9a3e-0d8f6a1d2e11";
const t = strings.studyAudio;
const audioT = strings.practice.audio;

describe("danh mục: tên chữ cái ≠ âm của chữ ≠ tiếng/từ", () => {
  it("29 tên chữ cái + 38 âm = 67 đơn vị, khóa không trùng, mỗi loại một khóa riêng", () => {
    expect(LETTER_UNITS).toHaveLength(29);
    expect(P0_UNITS).toHaveLength(38);
    expect(AUDIO_UNITS).toHaveLength(67);
    expect(new Set(AUDIO_UNITS.map((unit) => unit.key)).size).toBe(67);
    expect(LETTER_UNITS.every((unit) => unit.kind === "letter" && unit.key === `letter:${unit.text}`)).toBe(true);
    expect(P0_UNITS.every((unit) => unit.kind === "phoneme" && unit.key === `phoneme:${unit.text}`)).toBe(true);
  });

  it('chữ b có HAI cách đọc khác nhau: tên chữ "bê" và âm "bờ"; p, ph, ng, ngh, qu, gi theo kho tri thức (chờ giáo viên chốt)', () => {
    expect(learningUnitInfo("letter", "b")?.label).toBe("bê");
    expect(learningUnitInfo("phoneme", "b")?.label).toBe("bờ");
    expect(learningUnitInfo("letter", "b")?.label).not.toBe(learningUnitInfo("phoneme", "b")?.label);
    for (const text of ["p", "ph", "ng", "ngh", "qu", "gi"]) {
      expect(learningUnitInfo("phoneme", text), text).toBeDefined();
    }
    // q là chữ cái có tên riêng nhưng âm của nó là "qu" (chữ ghép), không có âm "q" đơn lẻ.
    expect(learningUnitInfo("letter", "q")).toBeDefined();
    expect(learningUnitInfo("phoneme", "q")).toBeUndefined();
  });

  it("y dùng chung bản ghi âm của i (khi chưa tách); tên chữ y và i vẫn là hai tên chữ khác nhau", () => {
    expect(learningUnitInfo("phoneme", "y")?.fallback).toBe("i");
    expect(learningUnitInfo("phoneme", "i")?.fallback).toBeNull();
    expect(learningUnitInfo("letter", "y")?.label).not.toBe(learningUnitInfo("letter", "i")?.label);
    expect(learningUnitInfo("letter", "y")?.fallback).toBeNull();
  });

  it("loại hoặc chữ lạ bị từ chối: trình duyệt không chọn được tài nguyên ngoài danh mục (kể cả tiếng/từ)", () => {
    for (const [kind, text] of [
      ["rime", "an"],
      ["word", "bà"],
      ["syllable", "ba"],
      ["letter", "bb"],
      ["phoneme", "z"],
      ["letter", ""],
    ] as const) {
      expect(learningUnitInfo(kind, text), `${kind}:${text}`).toBeUndefined();
    }
  });

  it("trang học: 29 ô chữ cái (q chỉ có tên chữ) + 11 ô chữ ghép (chỉ có âm); mỗi đơn vị hỏi máy chủ đúng một lần", () => {
    expect(STUDY_LETTERS).toHaveLength(29);
    expect(STUDY_DIGRAPHS).toHaveLength(11);
    expect(STUDY_LETTERS.every((tile) => tile.name?.kind === "letter")).toBe(true);
    expect(STUDY_LETTERS.find((tile) => tile.display === "q")?.sound).toBeNull();
    expect(STUDY_LETTERS.find((tile) => tile.display === "b")?.sound).toEqual({ kind: "phoneme", text: "b" });
    expect(STUDY_LETTERS.find((tile) => tile.display === "y")?.sound).toEqual({ kind: "phoneme", text: "y" });
    expect(STUDY_DIGRAPHS.map((tile) => tile.display)).toEqual(
      expect.arrayContaining(["ch", "gh", "gi", "kh", "ng", "ngh", "nh", "ph", "qu", "th", "tr"]),
    );
    expect(STUDY_DIGRAPHS.every((tile) => tile.name === null && tile.sound?.kind === "phoneme")).toBe(true);
    expect(STUDY_UNITS).toHaveLength(29 + 28 + 11);
    expect(new Set(STUDY_UNITS.map((unit) => `${unit.kind}:${unit.text}`)).size).toBe(STUDY_UNITS.length);
    // Mọi đơn vị của trang đều có cách đọc trong kho tri thức (không có nút không nguồn gốc).
    for (const unit of STUDY_UNITS)
      expect(learningUnitInfo(unit.kind, unit.text), `${unit.kind}:${unit.text}`).toBeDefined();
  });
});

class FakeAudio {
  static instances: FakeAudio[] = [];
  preload = "";
  ended = false;
  played = false;
  paused = true;
  private srcValue = "";
  private listeners = new Map<string, Set<() => void>>();
  constructor() {
    FakeAudio.instances.push(this);
  }
  get src() {
    return this.srcValue;
  }
  set src(value: string) {
    this.srcValue = value;
  }
  addEventListener(type: string, fn: () => void) {
    const set = this.listeners.get(type) ?? new Set();
    set.add(fn);
    this.listeners.set(type, set);
  }
  emit(type: string) {
    for (const fn of this.listeners.get(type) ?? []) fn();
  }
  play() {
    this.played = true;
    this.paused = false;
    return Promise.resolve();
  }
  pause() {
    if (this.paused) return;
    this.paused = true;
    this.emit("pause");
  }
  removeAttribute(name: string) {
    if (name === "src") this.srcValue = "";
  }
  load() {}
}

type Unit = { kind: "letter" | "phoneme"; text: string; mimeType: string };
let fetchMock: ReturnType<typeof vi.fn>;
let speech: ReturnType<typeof vi.fn>;

function answerStatus(units: Unit[], muted = false) {
  fetchMock = vi.fn(async () => ({ json: async () => ({ ok: true, data: { muted, units } }) }));
  vi.stubGlobal("fetch", fetchMock);
}

beforeEach(() => {
  FakeAudio.instances = [];
  vi.stubGlobal("Audio", FakeAudio);
  vi.spyOn(HTMLMediaElement.prototype, "canPlayType").mockImplementation(() => "maybe");
  speech = vi.fn();
  vi.stubGlobal("speechSynthesis", { speak: speech });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const tile = () => (
  <LearningAudioProvider studentId={STUDENT}>
    <LearningAudioStatus />
    <ListenableLetter
      display="b"
      upper="B"
      name={{ kind: "letter", text: "b" }}
      sound={{ kind: "phoneme", text: "b" }}
    />
    <ListenableLetter display="c" upper="C" name={{ kind: "letter", text: "c" }} sound={null} />
  </LearningAudioProvider>
);

describe("ListenableLetter (Chữ có thể nghe)", () => {
  it("đang hỏi máy chủ: nút khóa 'Đang tải âm thanh…', chưa tạo Audio; hỏi đúng một lần với mã học sinh", async () => {
    answerStatus([]);
    render(tile());
    for (const button of screen.getAllByRole("button")) {
      expect(button).toBeDisabled();
      expect(button).toHaveTextContent(audioT.loading);
    }
    expect(screen.getByTestId("learning-audio-status")).toHaveTextContent(t.status.pending);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock.mock.calls[0]![0]).toBe(`/api/student/learning-audio?student=${STUDENT}`);
    expect(FakeAudio.instances).toHaveLength(0);
  });

  it("chưa có bản ghi đã duyệt (hoặc cờ tắt): nút khóa 'Chưa có âm thanh', báo trung thực, không giả lập, không Web Speech", async () => {
    answerStatus([]);
    render(tile());
    await screen.findByText(t.status.none);
    for (const button of screen.getAllByRole("button")) {
      expect(button).toBeDisabled();
      expect(button).toHaveTextContent(audioT.unavailable);
    }
    expect(FakeAudio.instances).toHaveLength(0);
    expect(speech).not.toHaveBeenCalled();
  });

  it("hai nút khác nhau cho hai loại: tên chữ và âm; ô chỉ có tên chữ chỉ vẽ một nút; không tự phát", async () => {
    answerStatus([
      { kind: "letter", text: "b", mimeType: "audio/wav" },
      { kind: "phoneme", text: "b", mimeType: "audio/wav" },
      { kind: "letter", text: "c", mimeType: "audio/wav" },
    ]);
    render(tile());
    await screen.findByText(t.status.some.replace("{n}", "3"));
    const b = document.querySelector('[data-letter="b"]') as HTMLElement;
    expect(within(b).getAllByRole("button")).toHaveLength(2);
    const name = within(b).getByRole("button", { name: t.nameAria.replace("{letter}", "b") });
    const sound = within(b).getByRole("button", { name: t.soundAria.replace("{letter}", "b") });
    expect(name).toBeEnabled();
    expect(sound).toBeEnabled();
    expect(name).toHaveTextContent(t.nameButton);
    expect(sound).toHaveTextContent(t.soundButton);
    const c = document.querySelector('[data-letter="c"]') as HTMLElement;
    expect(within(c).getAllByRole("button")).toHaveLength(1);
    // Vùng chạm ≥ 64 px và chưa có gì được tạo/phát trước khi chạm.
    expect(name.className).toContain("min-h-touch-kid");
    expect(FakeAudio.instances).toHaveLength(0);
  });

  it("chạm tên chữ → phát đúng URL của TÊN CHỮ; chạm âm → dừng cái cũ và phát đúng URL của ÂM (không phát chồng)", async () => {
    answerStatus([
      { kind: "letter", text: "b", mimeType: "audio/wav" },
      { kind: "phoneme", text: "b", mimeType: "audio/wav" },
    ]);
    render(tile());
    await screen.findByText(t.status.some.replace("{n}", "2"));
    fireEvent.click(screen.getByRole("button", { name: t.nameAria.replace("{letter}", "b") }));
    expect(FakeAudio.instances).toHaveLength(1);
    const first = FakeAudio.instances[0]!;
    expect(first.src).toBe(`/api/student/learning-audio/letter/b?student=${STUDENT}`);
    expect(first.played).toBe(true);
    act(() => first.emit("playing"));

    fireEvent.click(screen.getByRole("button", { name: t.soundAria.replace("{letter}", "b") }));
    expect(FakeAudio.instances).toHaveLength(2);
    const second = FakeAudio.instances[1]!;
    expect(second.src).toBe(`/api/student/learning-audio/phoneme/b?student=${STUDENT}`);
    expect(first.paused).toBe(true);
    expect(second.paused).toBe(false);
    expect(FakeAudio.instances.filter((audio) => !audio.paused)).toHaveLength(1);
    expect(speech).not.toHaveBeenCalled();
  });

  it("chạm lại cùng nút khi đang phát thì dừng; phát xong thì 'Nghe lại' và là một lần chạm mới", async () => {
    answerStatus([{ kind: "letter", text: "b", mimeType: "audio/wav" }]);
    render(tile());
    await screen.findByText(t.status.some.replace("{n}", "1"));
    const name = () => within(document.querySelector('[data-letter="b"]') as HTMLElement).getAllByRole("button")[0]!;
    fireEvent.click(name());
    const audio = FakeAudio.instances[0]!;
    act(() => audio.emit("playing"));
    expect(name()).toHaveTextContent(audioT.playing);
    fireEvent.click(name());
    expect(audio.paused).toBe(true);
    expect(name()).toHaveTextContent(t.nameButton);

    fireEvent.click(name());
    const replay = FakeAudio.instances[1]!;
    act(() => {
      replay.ended = true;
      replay.emit("ended");
    });
    expect(name()).toHaveTextContent(audioT.replay);
    fireEvent.click(name());
    expect(FakeAudio.instances).toHaveLength(3);
  });

  it("học sinh tắt âm thanh: nút khóa với lý do, không tạo Audio", async () => {
    answerStatus([{ kind: "letter", text: "b", mimeType: "audio/wav" }], true);
    render(tile());
    await screen.findByText(t.status.muted);
    for (const button of screen.getAllByRole("button")) expect(button).toBeDisabled();
    expect(screen.getAllByText(new RegExp(audioT.muted, "u")).length).toBeGreaterThan(0);
    expect(FakeAudio.instances).toHaveLength(0);
  });

  it("lỗi mạng khi hỏi trạng thái: coi như chưa có âm thanh (không ném lỗi, không nút giả)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("offline");
      }),
    );
    render(tile());
    await screen.findByText(t.status.none);
    for (const button of screen.getAllByRole("button")) expect(button).toBeDisabled();
  });

  it("định dạng trình duyệt không phát được: báo không hỗ trợ, không thử phát", async () => {
    vi.spyOn(HTMLMediaElement.prototype, "canPlayType").mockImplementation(() => "");
    answerStatus([{ kind: "letter", text: "b", mimeType: "audio/webm" }]);
    render(tile());
    await screen.findByText(t.status.some.replace("{n}", "1"));
    expect(screen.getAllByText(audioT.unsupported).length).toBeGreaterThan(0);
    expect(FakeAudio.instances).toHaveLength(0);
  });
});
