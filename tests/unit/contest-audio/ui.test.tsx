import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LearningAudioProvider, LearningAudioStatus, ListenableLetter } from "@/components/kid/learning-audio";
import { SoundMuteButton } from "@/components/kid/sound-mute";
import { QuestionAudio } from "@/features/scored-practice/ui/question-audio";
import { vi as strings } from "@/strings/vi";

/**
 * Giao diện chế độ trình diễn: nói đúng nguồn (giọng máy tạo sẵn ≠ cô giáo), mục chờ kiểm chứng bị khóa với lý do thật, nút tắt tiếng, nút lời
 * nhắn chỉ vẽ khi có tệp. `Audio`/`fetch` là bản giả; không âm thanh thật.
 */

const STUDENT = "5b1c3a52-7a43-4c43-9a3e-0d8f6a1d2e11";
const QUESTION = "7c2d3e41-1111-4222-8333-444455556666";
const t = strings.studyAudio;
const audioT = strings.practice.audio;
const c = strings.contest;

class FakeAudio {
  static instances: FakeAudio[] = [];
  preload = "";
  src = "";
  played = false;
  paused = true;
  private listeners = new Map<string, Set<() => void>>();
  constructor() {
    FakeAudio.instances.push(this);
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
  removeAttribute() {
    this.src = "";
  }
  load() {}
}

let fetchMock: ReturnType<typeof vi.fn>;
const answer = (data: unknown) => {
  fetchMock = vi.fn(async () => ({ json: async () => ({ ok: true, data }) }));
  vi.stubGlobal("fetch", fetchMock);
};

beforeEach(() => {
  FakeAudio.instances = [];
  vi.stubGlobal("Audio", FakeAudio);
  vi.spyOn(HTMLMediaElement.prototype, "canPlayType").mockImplementation(() => "maybe");
});
afterEach(() => {
  // Trả nút tắt tiếng (trạng thái trong bộ nhớ của trang) về mặc định cho bài sau.
  const mute = screen.queryByTestId("sound-mute");
  if (mute?.getAttribute("aria-pressed") === "true") fireEvent.click(mute);
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const study = () => (
  <LearningAudioProvider studentId={STUDENT}>
    <LearningAudioStatus />
    <SoundMuteButton />
    <ListenableLetter
      display="b"
      upper="B"
      name={{ kind: "letter", text: "b" }}
      sound={{ kind: "phoneme", text: "b" }}
    />
    <ListenableLetter display="gh" upper={null} name={null} sound={{ kind: "phoneme", text: "gh" }} />
    <ListenableLetter display="ă" upper="Ă" name={{ kind: "letter", text: "ă" }} sound={null} />
  </LearningAudioProvider>
);

describe("Học tập ở chế độ trình diễn", () => {
  it("nói thật: giọng máy tạo sẵn (không gọi là bản ghi của cô giáo), nêu số chữ chờ kiểm chứng; mục bị giữ khóa với lý do thật", async () => {
    answer({
      muted: false,
      preview: true,
      units: [
        { kind: "letter", text: "b", mimeType: "audio/mpeg", source: "contest_preview" },
        { kind: "phoneme", text: "b", mimeType: "audio/mpeg", source: "contest_preview" },
      ],
      held: [{ kind: "phoneme", text: "gh" }],
    });
    render(study());
    const status = await screen.findByTestId("learning-audio-status");
    await waitFor(() => expect(status.textContent).toContain(c.chip));
    expect(status.textContent).toContain("giọng máy tạo sẵn");
    expect(status.textContent).toContain("1 chữ đang chờ kiểm chứng cách đọc");
    expect(status.textContent).not.toMatch(/bản ghi của cô giáo/u);

    const b = document.querySelector('[data-letter="b"]') as HTMLElement;
    expect(within(b).getByRole("button", { name: t.nameAria.replace("{letter}", "b") })).toBeEnabled();
    const gh = document.querySelector('[data-letter="gh"]') as HTMLElement;
    const held = within(gh).getByRole("button");
    expect(held).toBeDisabled();
    expect(held).toHaveTextContent(c.held);
    expect(held).not.toHaveTextContent(audioT.unavailable);
    // Chữ chưa có tệp nào vẫn là 'Chưa có âm thanh'.
    const breve = document.querySelector('[data-letter="ă"]') as HTMLElement;
    expect(within(breve).getByRole("button")).toHaveTextContent(audioT.unavailable);
  });

  it("mục chờ kiểm chứng đã được chủ dự án cho phép phát: có ghi chú rõ ngay dưới nút", async () => {
    answer({
      muted: false,
      preview: true,
      units: [{ kind: "letter", text: "ă", mimeType: "audio/mpeg", source: "contest_preview", unverified: true }],
    });
    render(study());
    const breve = document.querySelector('[data-letter="ă"]') as HTMLElement;
    await waitFor(() => expect(within(breve).getByRole("button")).toBeEnabled());
    expect(breve.textContent).toContain(c.unverifiedNote);
  });

  it("chỉ có mục bị giữ: trạng thái vẫn nói chế độ trình diễn, không nói 'chưa có bản ghi của cô giáo'", async () => {
    answer({ muted: false, units: [], held: [{ kind: "phoneme", text: "gh" }] });
    render(study());
    const status = screen.getByTestId("learning-audio-status");
    await waitFor(() => expect(status.textContent).toContain(c.chip));
    expect(status.textContent).not.toContain(t.status.none);
  });

  it("chạm nút: chỉ lúc đó mới tạo Audio; tắt tiếng dừng âm đang phát và khóa mọi nút; bật lại thì nghe được", async () => {
    answer({
      muted: false,
      preview: true,
      units: [
        { kind: "letter", text: "b", mimeType: "audio/mpeg", source: "contest_preview" },
        { kind: "phoneme", text: "b", mimeType: "audio/mpeg", source: "contest_preview" },
      ],
    });
    render(study());
    const b = document.querySelector('[data-letter="b"]') as HTMLElement;
    const name = await waitFor(() => {
      const button = within(b).getByRole("button", { name: t.nameAria.replace("{letter}", "b") });
      expect(button).toBeEnabled();
      return button;
    });
    expect(FakeAudio.instances).toHaveLength(0); // không tự phát khi mở trang
    fireEvent.click(name);
    expect(FakeAudio.instances).toHaveLength(1);
    expect(FakeAudio.instances[0]!.src).toBe(`/api/student/learning-audio/letter/b?student=${STUDENT}`);
    expect(FakeAudio.instances[0]!.played).toBe(true);

    // Chạm chữ khác → âm trước dừng (không phát chồng).
    fireEvent.click(within(b).getByRole("button", { name: t.soundAria.replace("{letter}", "b") }));
    expect(FakeAudio.instances).toHaveLength(2);
    expect(FakeAudio.instances[0]!.paused).toBe(true);

    // Tắt tiếng: dừng ngay, mọi nút khóa với lý do, không yêu cầu mới.
    fireEvent.click(screen.getByTestId("sound-mute"));
    expect(screen.getByTestId("sound-mute")).toHaveAttribute("aria-pressed", "true");
    expect(FakeAudio.instances[1]!.paused).toBe(true);
    for (const button of within(b).getAllByRole("button")) {
      expect(button).toBeDisabled();
      expect(button).toHaveTextContent(audioT.muted);
    }
    expect(FakeAudio.instances).toHaveLength(2);

    fireEvent.click(screen.getByTestId("sound-mute"));
    expect(within(b).getByRole("button", { name: t.nameAria.replace("{letter}", "b") })).toBeEnabled();
  });
});

describe("QuestionAudio — lời nhắn và ghi chú giọng trình diễn", () => {
  it("lời nhắn: hỏi kèm mã dòng; có tệp → vẽ nút, URL phát mang mã dòng; ghi chú 'Giọng máy trình diễn' khi là tệp trình diễn", async () => {
    answer({ muted: false, slots: { feedback: { mimeType: "audio/mpeg" } }, preview: ["feedback"] });
    render(<QuestionAudio questionId={QUESTION} role="feedback" feedbackRef="retry.sound" label={c.feedbackButton} />);
    const button = await screen.findByRole("button", { name: new RegExp(`^${c.feedbackButton}`, "u") });
    expect(fetchMock.mock.calls[0]![0]).toBe(`/api/student/question-instances/${QUESTION}/audio?feedback=retry.sound`);
    expect(document.body.textContent).toContain(c.voiceNote);
    expect(FakeAudio.instances).toHaveLength(0);
    fireEvent.click(button);
    expect(FakeAudio.instances[0]!.src).toBe(
      `/api/student/question-instances/${QUESTION}/audio/feedback?line=retry.sound`,
    );
  });

  it("lời nhắn chưa có tệp: KHÔNG vẽ gì (không khung 'Chưa có âm thanh' lặp lại sau mỗi câu)", async () => {
    answer({ muted: false, slots: {} });
    const { container } = render(
      <QuestionAudio questionId={QUESTION} role="feedback" feedbackRef="correct_title_1" label={c.feedbackButton} />,
    );
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    await act(async () => undefined);
    expect(container.querySelector("button")).toBeNull();
  });

  it("câu lệnh chưa có tệp vẫn nói thật 'Chưa có âm thanh' (khác lời nhắn); tắt tiếng tạm khóa nút", async () => {
    answer({ muted: false, slots: {} });
    render(
      <>
        <SoundMuteButton />
        <QuestionAudio questionId={QUESTION} role="instruction" label={audioT.instruction} />
      </>,
    );
    const button = await screen.findByRole("button", { name: new RegExp(`^${audioT.instruction}`, "u") });
    expect(button).toBeDisabled();
    expect(button).toHaveTextContent(audioT.unavailable);
  });
});

describe("nút tắt tiếng", () => {
  it("không lưu ở đâu cả: không localStorage/cookie; chỉ là trạng thái tạm của trang", () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    render(<SoundMuteButton />);
    const button = screen.getByTestId("sound-mute");
    expect(button).toHaveTextContent(strings.soundMute.turnOff);
    fireEvent.click(button);
    expect(button).toHaveTextContent(strings.soundMute.turnOn);
    expect(setItem).not.toHaveBeenCalled();
    expect(document.cookie).toBe("");
    expect(button.className).toContain("min-h-touch-kid");
  });
});
