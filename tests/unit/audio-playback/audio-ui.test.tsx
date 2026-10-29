import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AudioSlot } from "@/components/kid/audio-slot";
import { QuestionAudio } from "@/features/scored-practice/ui/question-audio";
import { vi as strings } from "@/strings/vi";

/**
 * R10.3a — AudioSlot / QuestionAudio. Không có âm thanh thật: `Audio` được thay bằng bản giả ghi lại những gì giao diện
 * làm (không tự phát, chạm mới phát, một âm tại một thời điểm, dừng khi đổi câu/rời trang, không giọng trình duyệt).
 */

const t = strings.practice.audio;
const QID = "5b1c3a52-7a43-4c43-9a3e-0d8f6a1d2e11";

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

let canPlay = true;
let speech: ReturnType<typeof vi.fn>;

beforeEach(() => {
  FakeAudio.instances = [];
  canPlay = true;
  vi.stubGlobal("Audio", FakeAudio);
  vi.spyOn(HTMLMediaElement.prototype, "canPlayType").mockImplementation(() => (canPlay ? "maybe" : ""));
  speech = vi.fn();
  vi.stubGlobal("speechSynthesis", { speak: speech });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const source = { url: `/api/student/question-instances/${QID}/audio/stimulus`, mimeType: "audio/wav" };

describe("AudioSlot", () => {
  it("không có nguồn → nút khóa 'Chưa có âm thanh', không có thẻ audio, không tạo Audio", () => {
    const { container } = render(<AudioSlot label="Nghe âm" />);
    const button = screen.getByRole("button");
    expect(button).toBeDisabled();
    expect(button).toHaveTextContent(t.unavailable);
    expect(container.querySelector("audio")).toBeNull();
    expect(FakeAudio.instances).toHaveLength(0);
  });

  it("đang hỏi máy chủ / học sinh tắt âm thanh → nút khóa với lý do, không tạo Audio", () => {
    const { rerender } = render(<AudioSlot label="Nghe âm" pending />);
    expect(screen.getByRole("button")).toBeDisabled();
    expect(screen.getByRole("button")).toHaveTextContent(t.loading);
    rerender(<AudioSlot label="Nghe âm" muted source={source} />);
    expect(screen.getByRole("button")).toBeDisabled();
    expect(screen.getByRole("button")).toHaveTextContent(t.muted);
    expect(FakeAudio.instances).toHaveLength(0);
  });

  it("định dạng trình duyệt không phát được → báo không hỗ trợ, nút khóa, không thử phát", () => {
    canPlay = false;
    render(<AudioSlot label="Nghe âm" source={{ ...source, mimeType: "audio/webm" }} />);
    expect(screen.getByRole("button")).toBeDisabled();
    expect(screen.getByText(t.unsupported)).toBeInTheDocument();
    expect(FakeAudio.instances).toHaveLength(0);
  });

  it("có nguồn: nút ≥ 64 px, KHÔNG tự phát; chạm mới tạo Audio và phát đúng URL cùng nguồn", async () => {
    render(<AudioSlot label="Nghe âm" source={source} />);
    const button = screen.getByRole("button", { name: "Nghe âm" });
    expect(button).toBeEnabled();
    expect(button.className).toContain("min-h-touch-kid");
    expect(FakeAudio.instances).toHaveLength(0);

    fireEvent.click(button);
    expect(FakeAudio.instances).toHaveLength(1);
    const audio = FakeAudio.instances[0]!;
    expect(audio.src).toBe(source.url);
    expect(audio.played).toBe(true);
    expect(audio.preload).toBe("none");
    act(() => audio.emit("playing"));
    expect(screen.getByRole("button")).toHaveTextContent(t.playing);

    act(() => {
      audio.ended = true;
      audio.emit("ended");
    });
    // Nghe lại: nút vẫn bấm được và tạo yêu cầu MỚI (không dùng lại bộ đệm).
    expect(screen.getByRole("button")).toHaveTextContent(t.replay);
    fireEvent.click(screen.getByRole("button"));
    expect(FakeAudio.instances).toHaveLength(2);
    expect(FakeAudio.instances[1]!.src).toBe(source.url);
  });

  it("chạm khi đang phát → dừng; không bao giờ dùng Web Speech API", () => {
    render(<AudioSlot label="Nghe âm" source={source} />);
    fireEvent.click(screen.getByRole("button"));
    const audio = FakeAudio.instances[0]!;
    act(() => audio.emit("playing"));
    fireEvent.click(screen.getByRole("button"));
    expect(audio.paused).toBe(true);
    expect(audio.src).toBe("");
    expect(screen.getByRole("button")).toHaveTextContent("Nghe âm");
    expect(speech).not.toHaveBeenCalled();
  });

  it("một âm tại một thời điểm: phát nút thứ hai thì nút thứ nhất dừng và trở lại sẵn sàng", () => {
    render(
      <>
        <AudioSlot label="Nghe A" source={source} />
        <AudioSlot label="Nghe B" source={{ ...source, url: "/x/b" }} />
      </>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Nghe A" }));
    const first = FakeAudio.instances[0]!;
    act(() => first.emit("playing"));
    fireEvent.click(screen.getByRole("button", { name: "Nghe B" }));
    expect(first.paused).toBe(true);
    expect(screen.getByRole("button", { name: "Nghe A" })).toBeEnabled();
    expect(FakeAudio.instances).toHaveLength(2);
    expect(FakeAudio.instances[1]!.played).toBe(true);
  });

  it("lỗi mạng / máy chủ từ chối (sự kiện error hoặc play() bị từ chối) → thông báo dễ hiểu, bấm thử lại được", async () => {
    render(<AudioSlot label="Nghe âm" source={source} />);
    fireEvent.click(screen.getByRole("button"));
    act(() => FakeAudio.instances[0]!.emit("error"));
    expect(screen.getByText(t.error)).toBeInTheDocument();
    expect(screen.getByRole("button")).toBeEnabled();

    cleanup();
    vi.spyOn(FakeAudio.prototype, "play").mockRejectedValueOnce(new Error("NotAllowedError"));
    render(<AudioSlot label="Nghe âm" source={source} />);
    fireEvent.click(screen.getByRole("button"));
    await waitFor(() => expect(screen.getByText(t.error)).toBeInTheDocument());
  });

  it("rời trang / đổi câu (gỡ thành phần) → dừng âm đang phát và nhả tài nguyên", () => {
    const { unmount } = render(<AudioSlot label="Nghe âm" source={source} />);
    fireEvent.click(screen.getByRole("button"));
    const audio = FakeAudio.instances[0]!;
    act(() => audio.emit("playing"));
    unmount();
    expect(audio.paused).toBe(true);
    expect(audio.src).toBe("");
  });

  it("điều khiển được bằng bàn phím (nút gốc, có tên truy cập)", () => {
    render(<AudioSlot label="Nghe âm" source={source} />);
    const button = screen.getByRole("button", { name: "Nghe âm" });
    button.focus();
    expect(button).toHaveFocus();
    expect(button.tagName).toBe("BUTTON");
    expect(button).toHaveAttribute("type", "button");
  });
});

describe("QuestionAudio", () => {
  const respond = (body: unknown, ok = true) =>
    vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () => ({ ok, json: async () => body }) as unknown as Response,
    );

  it("máy chủ báo có khe stimulus → hiện nút phát với URL /audio/stimulus của CHÍNH câu; chỉ một yêu cầu trạng thái, chưa tải tệp", async () => {
    const fetchMock = respond({ ok: true, data: { muted: false, slots: { stimulus: { mimeType: "audio/wav" } } } });
    vi.stubGlobal("fetch", fetchMock);
    render(<QuestionAudio questionId={QID} role="stimulus" label="Nghe âm" />);
    expect(screen.getByRole("button")).toHaveTextContent(t.loading);
    await waitFor(() => expect(screen.getByRole("button", { name: "Nghe âm" })).toBeEnabled());
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]![0]).toBe(`/api/student/question-instances/${QID}/audio`);
    expect(FakeAudio.instances).toHaveLength(0);

    fireEvent.click(screen.getByRole("button"));
    expect(FakeAudio.instances[0]!.src).toBe(`/api/student/question-instances/${QID}/audio/stimulus`);
  });

  it("cờ tắt / chưa có bản ghi (slots rỗng) → khóa 'Chưa có âm thanh' và KHÔNG gọi API phát tệp", async () => {
    const fetchMock = respond({ ok: true, data: { muted: false, slots: {} } });
    vi.stubGlobal("fetch", fetchMock);
    render(<QuestionAudio questionId={QID} role="stimulus" label="Nghe âm" />);
    await waitFor(() => expect(screen.getByRole("button")).toHaveTextContent(t.unavailable));
    expect(screen.getByRole("button")).toBeDisabled();
    for (const call of fetchMock.mock.calls) expect(String(call[0])).not.toMatch(/\/audio\/(stimulus|model)/u);
  });

  it("khe model vắng (chưa chấm) trong khi stimulus có → nút model khóa", async () => {
    vi.stubGlobal(
      "fetch",
      respond({ ok: true, data: { muted: false, slots: { stimulus: { mimeType: "audio/wav" } } } }),
    );
    render(<QuestionAudio questionId={QID} role="model" label="Nghe đọc mẫu" />);
    await waitFor(() => expect(screen.getByRole("button")).toHaveTextContent(t.unavailable));
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("học sinh tắt âm thanh → thông báo tắt; lỗi mạng hoặc phản hồi lỗi → khóa an toàn, không ném lỗi", async () => {
    vi.stubGlobal("fetch", respond({ ok: true, data: { muted: true, slots: {} } }));
    const { unmount } = render(<QuestionAudio questionId={QID} role="stimulus" label="Nghe âm" />);
    await waitFor(() => expect(screen.getByRole("button")).toHaveTextContent(t.muted));
    unmount();

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Promise.reject(new TypeError("network"))),
    );
    render(<QuestionAudio questionId={QID} role="stimulus" label="Nghe âm" />);
    await waitFor(() => expect(screen.getByRole("button")).toHaveTextContent(t.unavailable));
    expect(screen.getByRole("button")).toBeDisabled();
    cleanup();

    vi.stubGlobal("fetch", respond({ ok: false, code: "UNAUTHENTICATED" }, false));
    render(<QuestionAudio questionId={QID} role="stimulus" label="Nghe âm" />);
    await waitFor(() => expect(screen.getByRole("button")).toHaveTextContent(t.unavailable));
  });

  it("đổi sang câu khác → hỏi lại máy chủ cho câu mới và dừng âm của câu cũ", async () => {
    const other = "6c2d4b63-8b54-4d54-8b4f-1e9f7b2e3f22";
    const fetchMock = respond({ ok: true, data: { muted: false, slots: { stimulus: { mimeType: "audio/wav" } } } });
    vi.stubGlobal("fetch", fetchMock);
    const { rerender } = render(<QuestionAudio questionId={QID} role="stimulus" label="Nghe âm" />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Nghe âm" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button"));
    const audio = FakeAudio.instances[0]!;
    act(() => audio.emit("playing"));

    rerender(<QuestionAudio questionId={other} role="stimulus" label="Nghe âm" />);
    expect(audio.paused).toBe(true);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(fetchMock.mock.calls[1]![0]).toBe(`/api/student/question-instances/${other}/audio`);
  });
});
