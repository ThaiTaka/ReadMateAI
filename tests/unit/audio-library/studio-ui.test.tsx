import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { P0_UNITS } from "@/features/audio-library/p0-catalog";
import { vi as strings } from "@/strings/vi";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/server/audio-library/actions", () => {
  const stub = vi.fn(async () => ({ ok: true, data: null }));
  return {
    grantVoiceConsent: stub,
    withdrawVoiceConsent: stub,
    confirmPronunciation: stub,
    saveUnitNote: stub,
    submitAudioVersion: stub,
    discardAudioVersion: stub,
    reviewAudioVersion: stub,
    revokeAudioVersion: stub,
  };
});

import { AudioStudio } from "@/app/teacher/(console)/audio/audio-studio";
import { Recorder } from "@/app/teacher/(console)/audio/recorder";

const t = strings.audioStudio;
const context = { userId: "u1", isAdmin: false, recordingEnabled: true, consentActive: true };

afterEach(cleanup);

describe("AudioStudio", () => {
  it("hiện 38 âm, mọi âm 'Chờ xác nhận cách đọc', tổng quan không có số giả", () => {
    render(<AudioStudio units={P0_UNITS} assets={[]} context={context} />);
    expect(screen.getAllByText(t.unit.awaitingConfirm)).toHaveLength(38);
    const stats = screen.getByLabelText(t.stats.total);
    expect(within(stats).getByText(t.stats.total).nextSibling?.textContent).toBe("38");
    expect(within(stats).getByText(t.stats.missing).nextSibling?.textContent).toBe("38");
    for (const key of ["draft", "pending_review", "approved", "rerecord"] as const) {
      expect(within(stats).getByText(t.stats[key]).nextSibling?.textContent).toBe("0");
    }
  });

  it("thông báo danh sách dự kiến luôn hiện; chế độ xem trước khi tính năng chưa bật", () => {
    const { rerender } = render(<AudioStudio units={P0_UNITS} assets={[]} context={context} />);
    expect(screen.getByText(t.notice.trialTitle)).toBeInTheDocument();
    expect(screen.queryByText(t.notice.previewTitle)).toBeNull();
    rerender(
      <AudioStudio
        units={P0_UNITS}
        assets={[]}
        context={{ ...context, recordingEnabled: false, consentActive: false }}
      />,
    );
    expect(screen.getByText(t.notice.previewTitle)).toBeInTheDocument();
  });

  it("lọc theo trạng thái và tìm theo chữ", () => {
    render(<AudioStudio units={P0_UNITS} assets={[]} context={context} />);
    fireEvent.click(screen.getByRole("button", { name: t.filters.approved }));
    expect(screen.getByText(t.filters.noResult)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: t.filters.all }));
    fireEvent.change(screen.getByLabelText(t.filters.searchLabel), { target: { value: "ngh" } });
    expect(document.querySelectorAll("li[data-unit]")).toHaveLength(1);
    expect(document.querySelector("li[data-unit='phoneme:ngh']")).not.toBeNull();
  });

  it("ô đồng ý dùng giọng KHÔNG chọn sẵn và nút khóa tới khi tự đánh dấu", () => {
    render(<AudioStudio units={P0_UNITS} assets={[]} context={{ ...context, consentActive: false }} />);
    const box = screen.getByRole("checkbox", { name: t.consent.checkbox });
    expect(box).not.toBeChecked();
    expect(screen.getByRole("button", { name: t.consent.grant })).toBeDisabled();
    fireEvent.click(box);
    expect(screen.getByRole("button", { name: t.consent.grant })).toBeEnabled();
  });

  it("mở một âm hiện bảng ghi âm; chưa đồng ý thì khóa ghi và nêu lý do", () => {
    render(<AudioStudio units={P0_UNITS} assets={[]} context={{ ...context, consentActive: false }} />);
    fireEvent.click(screen.getByRole("button", { name: t.unit.openLabel.replace("{unit}", "b") }));
    expect(screen.getByText(t.recorder.needConsent)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: t.recorder.start })).toBeDisabled();
  });
});

describe("Recorder", () => {
  const getUserMedia = vi.fn();
  beforeEach(() => {
    getUserMedia.mockReset();
    Object.defineProperty(navigator, "mediaDevices", { value: { getUserMedia }, configurable: true });
  });

  it("không xin quyền micro khi tải trang — chỉ khi bấm 'Bắt đầu ghi'", () => {
    render(<Recorder blockedReason={null} saving={false} onSave={vi.fn()} />);
    expect(getUserMedia).not.toHaveBeenCalled();
  });

  it("bị từ chối quyền micro → hướng dẫn dễ hiểu, không gửi gì", async () => {
    class FakeRecorder {
      static isTypeSupported = () => true;
    }
    vi.stubGlobal("MediaRecorder", FakeRecorder);
    getUserMedia.mockRejectedValue(new DOMException("denied", "NotAllowedError"));
    const onSave = vi.fn();
    render(<Recorder blockedReason={null} saving={false} onSave={onSave} />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: t.recorder.start }));
    });
    expect(await screen.findByRole("alert")).toHaveTextContent(t.recorder.errors.MIC_DENIED);
    expect(onSave).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("trình duyệt không có MediaRecorder → hướng dẫn tải tệp", async () => {
    vi.stubGlobal("MediaRecorder", undefined);
    render(<Recorder blockedReason={null} saving={false} onSave={vi.fn()} />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: t.recorder.start }));
    });
    expect(await screen.findByRole("alert")).toHaveTextContent(t.recorder.errors.UNSUPPORTED);
    expect(getUserMedia).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("ghi → dừng → nghe lại: KHÔNG tự lưu; chỉ 'Lưu bản nháp' mới gọi onSave", async () => {
    let now = 0;
    vi.spyOn(performance, "now").mockImplementation(() => now);
    const stopTrack = vi.fn();
    getUserMedia.mockResolvedValue({ getTracks: () => [{ stop: stopTrack }], getAudioTracks: () => [{}] });
    class FakeRecorder {
      static isTypeSupported = () => true;
      state = "inactive";
      mimeType = "audio/webm;codecs=opus";
      ondataavailable: ((e: { data: Blob }) => void) | null = null;
      onstop: (() => void) | null = null;
      onerror: (() => void) | null = null;
      start() {
        this.state = "recording";
      }
      stop() {
        this.state = "inactive";
        this.ondataavailable?.({ data: new Blob([new Uint8Array(200)]) });
        this.onstop?.();
      }
    }
    vi.stubGlobal("MediaRecorder", FakeRecorder);
    vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: () => "blob:fake", revokeObjectURL: () => undefined }));
    const onSave = vi.fn();
    render(<Recorder blockedReason={null} saving={false} onSave={onSave} />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: t.recorder.start }));
    });
    expect(getUserMedia).toHaveBeenCalledTimes(1);
    now = 1500;
    await act(async () => {
      fireEvent.click(await screen.findByRole("button", { name: t.recorder.stop }));
    });
    expect(stopTrack).toHaveBeenCalled(); // micro được tắt ngay khi dừng
    expect(onSave).not.toHaveBeenCalled(); // dừng ghi KHÔNG tự gửi
    expect(screen.getByRole("button", { name: t.recorder.listenAgain })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: t.recorder.save }));
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0]?.[0]).toBeInstanceOf(Blob);
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("bị khóa (chưa đồng ý/chưa bật) thì không ghi được", () => {
    render(<Recorder blockedReason={t.recorder.disabled} saving={false} onSave={vi.fn()} />);
    expect(screen.getByRole("button", { name: t.recorder.start })).toBeDisabled();
    expect(screen.getByText(t.recorder.disabled)).toBeInTheDocument();
  });
});
