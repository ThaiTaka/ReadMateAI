import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi as vitest } from "vitest";
import { SeasonReset } from "@/app/teacher/(console)/classes/[classId]/leaderboard/season-reset";
import { vi } from "@/strings/vi";

const refresh = vitest.hoisted(() => vitest.fn());
const resetSeason = vitest.hoisted(() => vitest.fn());
vitest.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vitest.mock("@/server/teacher/season", () => ({ resetSeason }));

const t = vi.leaderboard.teacher.reset;
const ids = {
  classId: "5eed0000-0000-4000-8000-0000000000a1",
  seasonId: "5eed0000-0000-4000-8000-0000000000c1",
};

const renderIt = (props: Partial<Parameters<typeof SeasonReset>[0]> = {}) =>
  render(<SeasonReset classId={ids.classId} className="1A2" seasonId={ids.seasonId} isOwner {...props} />);

const toStep2 = () => {
  fireEvent.click(screen.getByRole("button", { name: t.open }));
  fireEvent.click(screen.getByRole("button", { name: t.next }));
};
const confirmButton = () => screen.getByRole("button", { name: t.confirm });

beforeEach(() => {
  refresh.mockReset();
  resetSeason.mockReset();
});
afterEach(cleanup);

describe("SeasonReset — hộp thoại hai bước", () => {
  it("bước 1 nêu đủ hệ quả và không gọi máy chủ khi hủy/đóng", () => {
    renderIt();
    fireEvent.click(screen.getByRole("button", { name: t.open }));
    for (const line of [...t.effects, ...t.keeps]) expect(screen.getByText(line)).toBeInTheDocument();
    expect(screen.getAllByText(t.irreversible)).toHaveLength(2);
    fireEvent.click(screen.getAllByRole("button", { name: t.cancel })[0]!);
    expect(resetSeason).not.toHaveBeenCalled();
  });

  it("nút xác nhận chỉ bật khi gõ đúng tên lớp", () => {
    renderIt();
    toStep2();
    expect(confirmButton()).toBeDisabled();
    fireEvent.change(screen.getByLabelText(t.inputLabel), { target: { value: "1a2" } });
    expect(confirmButton()).toBeDisabled();
    fireEvent.change(screen.getByLabelText(t.inputLabel), { target: { value: "  1A2 " } });
    expect(confirmButton()).toBeEnabled();
  });

  it("không phải chủ nhiệm hoặc chưa có mùa: nút mở bị khóa kèm lý do", () => {
    renderIt({ isOwner: false });
    expect(screen.getByRole("button", { name: t.open })).toBeDisabled();
    expect(screen.getByText(t.ownerOnly)).toBeInTheDocument();
    cleanup();
    renderIt({ seasonId: null });
    expect(screen.getByRole("button", { name: t.open })).toBeDisabled();
    expect(screen.getByText(t.noSeason)).toBeInTheDocument();
  });

  it("thành công: gửi đúng tham số, thông báo mùa mới và làm mới dữ liệu", async () => {
    resetSeason.mockResolvedValue({ ok: true, data: { newSeasonId: "x", seqNo: 2 } });
    renderIt();
    toStep2();
    fireEvent.change(screen.getByLabelText(t.inputLabel), { target: { value: "1A2" } });
    fireEvent.click(confirmButton());
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
    expect(resetSeason).toHaveBeenCalledTimes(1);
    expect(resetSeason.mock.calls[0]![0]).toMatchObject({
      classId: ids.classId,
      expectedSeasonId: ids.seasonId,
      confirmation: "1A2",
    });
    expect(screen.getByText(t.done.replace("{no}", "2"))).toBeInTheDocument();
  });

  it("bấm đúp chỉ gửi một yêu cầu", async () => {
    let finish: (value: unknown) => void = () => {};
    resetSeason.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    renderIt();
    toStep2();
    fireEvent.change(screen.getByLabelText(t.inputLabel), { target: { value: "1A2" } });
    fireEvent.click(confirmButton());
    fireEvent.click(confirmButton());
    expect(resetSeason).toHaveBeenCalledTimes(1);
    finish({ ok: true, data: { newSeasonId: "x", seqNo: 2 } });
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it("thử lại sau lỗi tạm thời dùng lại ĐÚNG requestId; mở lại hộp thoại mới tạo requestId mới", async () => {
    resetSeason.mockResolvedValueOnce({ ok: false, code: "UNKNOWN" });
    resetSeason.mockResolvedValueOnce({ ok: false, code: "UNKNOWN" });
    renderIt();
    toStep2();
    fireEvent.change(screen.getByLabelText(t.inputLabel), { target: { value: "1A2" } });
    fireEvent.click(confirmButton());
    await screen.findByText(vi.errors.UNKNOWN);
    fireEvent.click(confirmButton());
    await waitFor(() => expect(resetSeason).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByLabelText(t.inputLabel)).toBeEnabled());
    const [first, second] = resetSeason.mock.calls.map((call) => (call[0] as { requestId: string }).requestId);
    expect(first).toMatch(/^[0-9a-f-]{36}$/u);
    expect(second).toBe(first);
    fireEvent.click(screen.getAllByRole("button", { name: t.cancel })[0]!);
    toStep2();
    fireEvent.change(screen.getByLabelText(t.inputLabel), { target: { value: "1A2" } });
    resetSeason.mockResolvedValueOnce({ ok: false, code: "UNKNOWN" });
    fireEvent.click(confirmButton());
    await waitFor(() => expect(resetSeason).toHaveBeenCalledTimes(3));
    expect((resetSeason.mock.calls[2]![0] as { requestId: string }).requestId).not.toBe(first);
  });

  it("SEASON_MISMATCH: báo mùa đã đổi, ẩn nút xác nhận, chỉ cho tải lại thông tin", async () => {
    resetSeason.mockResolvedValue({ ok: false, code: "SEASON_MISMATCH" });
    renderIt();
    toStep2();
    fireEvent.change(screen.getByLabelText(t.inputLabel), { target: { value: "1A2" } });
    fireEvent.click(confirmButton());
    expect(await screen.findByText(vi.errors.SEASON_MISMATCH)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: t.confirm })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: t.reload }));
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(resetSeason).toHaveBeenCalledTimes(1);
  });

  it("CONFIRMATION_MISMATCH: báo lỗi và xóa ô để nhập lại", async () => {
    resetSeason.mockResolvedValue({ ok: false, code: "CONFIRMATION_MISMATCH" });
    renderIt();
    toStep2();
    fireEvent.change(screen.getByLabelText(t.inputLabel), { target: { value: "1A2" } });
    fireEvent.click(confirmButton());
    expect(await screen.findByText(vi.errors.CONFIRMATION_MISMATCH)).toBeInTheDocument();
    expect(screen.getByLabelText(t.inputLabel)).toHaveValue("");
    expect(confirmButton()).toBeDisabled();
  });

  it("chuỗi giao diện không dùng từ gay gắt", () => {
    const text = JSON.stringify(t);
    expect(text).not.toMatch(/nguy hiểm|cảnh báo đỏ|xóa sạch/iu);
  });
});
