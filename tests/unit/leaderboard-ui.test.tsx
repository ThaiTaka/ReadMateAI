import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi as vitest } from "vitest";
import { KidAvatar } from "@/components/art/avatars";
import { DemoLeaderboard } from "@/components/leaderboard/demo-leaderboard";
import { LeaderboardBoard, type BoardRow } from "@/components/leaderboard/leaderboard-board";
import { AVATAR_KEYS, AVATAR_OPTIONS } from "@/features/avatars/catalog";
import { DEMO_LEADERBOARD } from "@/features/demo/adventure-data";
import type { LeaderboardDto, LeaderboardRowDto } from "@/features/leaderboard/types";
import { StudentLeaderboard } from "@/features/leaderboard/ui/student-leaderboard";
import { vi } from "@/strings/vi";

afterEach(() => {
  cleanup();
  vitest.restoreAllMocks();
});

const row = (alias: string, rank: number, points: number, extra: Partial<BoardRow> = {}): BoardRow => ({
  rowKey: `k-${alias}`,
  rank,
  alias,
  avatarKey: "may",
  points,
  ...extra,
});

describe("LeaderboardBoard — thanh điểm, huy hiệu, trợ năng", () => {
  const rows = [row("Mây", 1, 250), row("Bống", 2, 200), row("Na", 2, 200, { isMe: true }), row("Tí", 4, 160)];

  it("mỗi hàng đọc được 'Hạng n, tên, điểm' bằng trình đọc màn hình; hàng của con có nhãn", () => {
    render(<LeaderboardBoard rows={rows} maxPoints={250} />);
    expect(screen.getByText("Hạng 1, Mây, 250 điểm")).toBeInTheDocument();
    expect(screen.getByText("Hạng 2, Bống, 200 điểm")).toBeInTheDocument();
    expect(screen.getByText("Hạng 2, Na (con), 200 điểm")).toBeInTheDocument();
    expect(screen.getByText("Hạng 4, Tí, 160 điểm")).toBeInTheDocument();
    expect(screen.getAllByTestId("leaderboard-row").map((r) => r.getAttribute("data-rank"))).toEqual([
      "1",
      "2",
      "2",
      "4",
    ]);
    expect(screen.getAllByTestId("leaderboard-row").filter((r) => r.getAttribute("data-me") === "true")).toHaveLength(
      1,
    );
  });

  it("thanh điểm là phần trang trí (aria-hidden) và tỉ lệ đúng với điểm cao nhất", () => {
    const { container } = render(<LeaderboardBoard rows={rows} maxPoints={250} />);
    const bars = screen.getAllByTestId("score-bar");
    expect(bars.every((bar) => bar.getAttribute("aria-hidden") === "true")).toBe(true);
    expect(bars.map((bar) => Number(bar.firstElementChild?.getAttribute("data-width")))).toEqual([100, 80, 80, 64]);
    expect(container.querySelectorAll("[tabindex]")).toHaveLength(0);
  });

  it("tất cả 0 điểm: thanh rỗng, không NaN, không huy hiệu hạng nhất cho ai", () => {
    const zeros = [row("A", 1, 0), row("B", 1, 0)];
    const { container } = render(<LeaderboardBoard rows={zeros} maxPoints={0} />);
    const bars = screen.getAllByTestId("score-bar");
    expect(bars.map((bar) => bar.firstElementChild?.getAttribute("data-width"))).toEqual(["0", "0"]);
    expect(container.innerHTML).not.toContain("NaN");
    expect(container.querySelectorAll(".animate-pop-in")).toHaveLength(0);
  });

  it("TOP 3 có huy hiệu hình khi có điểm; hạng 4 trở đi không có", () => {
    const { container } = render(<LeaderboardBoard rows={rows} maxPoints={250} />);
    const items = screen.getAllByTestId("leaderboard-row");
    expect(items[0]!.querySelector(".animate-pop-in")).not.toBeNull();
    expect(items[3]!.querySelector(".animate-pop-in")).toBeNull();
    expect(container.querySelectorAll(".animate-pop-in")).toHaveLength(3);
  });

  it("hàng của con nằm ngoài đầu bảng được tách riêng, có nhãn", () => {
    render(<LeaderboardBoard rows={rows.slice(0, 2)} maxPoints={250} myRow={row("Bin", 9, 10)} />);
    const lists = screen.getAllByRole("list");
    expect(lists).toHaveLength(2);
    expect(within(lists[1]!).getByText("Hạng 9, Bin (con), 10 điểm")).toBeInTheDocument();
  });

  it("không có màu đỏ/cảnh báo và không có từ ngữ gây xấu hổ trong chuỗi giao diện của bảng", () => {
    const { container } = render(<LeaderboardBoard rows={rows} maxPoints={250} />);
    expect(container.innerHTML).not.toMatch(/coral|red-|rose-|animate-pulse|animate-ping/u);
    const strings = JSON.stringify([
      vi.leaderboard.board,
      vi.leaderboard.student,
      vi.leaderboard.presentation,
      vi.leaderboard.demo,
    ]);
    // LEADERBOARD_SPEC §5 "Không dùng": cuối bảng, bét, thua, kém, tụt hạng.
    expect(strings).not.toMatch(
      /cuối bảng|(^|[^\p{L}])bét([^\p{L}]|$)|(^|[^\p{L}])thua([^\p{L}]|$)|(^|[^\p{L}])kém([^\p{L}]|$)|tụt hạng/iu,
    );
  });
});

type OkBoard = Extract<LeaderboardDto, { status: "ok" }>;
const dtoRow = (alias: string, rank: number, points: number, isMe = false): LeaderboardRowDto => ({
  rowKey: `k-${alias}`,
  rank,
  alias,
  avatarKey: "may",
  points,
  isMe,
});

describe("StudentLeaderboard — tải từ API, các trạng thái", () => {
  const ok: OkBoard = {
    status: "ok",
    view: "top10_and_me",
    seasonNo: 1,
    maxPoints: 40,
    rows: [dtoRow("Bống", 1, 40), dtoRow("Mây", 2, 20, true)],
    myRow: null,
    viewerListed: true,
    generatedAt: "2026-10-21T10:00:00.000Z",
  };
  const respond = (board: LeaderboardDto, balance = 20) =>
    vitest.fn<typeof fetch>(async (url) => {
      const text = String(url);
      const data = text.includes("/api/student/home") ? { score: { balance } } : board;
      return new Response(JSON.stringify({ ok: true, data }), { status: 200 });
    });
  const props = {
    studentId: "00000000-0000-4000-8000-000000000001",
    homeHref: "/learn/me",
    practiceHref: "/learn/me/practice",
  };

  it("đang tải → hiện khung chờ, rồi bảng thật lấy từ API (không dữ liệu cứng)", async () => {
    const fetchMock = respond(ok);
    vitest.stubGlobal("fetch", fetchMock);
    render(<StudentLeaderboard {...props} />);
    expect(screen.getByTestId("leaderboard-skeleton")).toBeInTheDocument();
    expect(await screen.findByTestId("leaderboard-ready")).toBeInTheDocument();
    expect(screen.getByText("Hạng 1, Bống, 40 điểm")).toBeInTheDocument();
    expect(screen.getByTestId("my-points")).toHaveTextContent("20");
    const urls = fetchMock.mock.calls.map(([url]) => String(url));
    expect(urls.some((url) => url.startsWith("/api/student/leaderboard?studentId="))).toBe(true);
    expect(fetchMock.mock.calls.every((call) => call[1]?.cache === "no-store")).toBe(true);
    vitest.unstubAllGlobals();
  });

  it("bảng tắt → thông báo thân thiện, không có hàng nào", async () => {
    vitest.stubGlobal("fetch", respond({ status: "disabled" }));
    render(<StudentLeaderboard {...props} />);
    expect(await screen.findByTestId("leaderboard-disabled")).toHaveTextContent(
      "Bảng điểm của lớp hiện chưa được mở. Con vẫn có thể tiếp tục luyện tập và tích điểm nhé!",
    );
    expect(screen.queryAllByTestId("leaderboard-row")).toHaveLength(0);
    vitest.unstubAllGlobals();
  });

  it("chưa có ai trên bảng → trạng thái trống; em chưa hiện trên bảng → lời nhắn trung tính", async () => {
    vitest.stubGlobal("fetch", respond({ ...ok, rows: [], viewerListed: false } satisfies OkBoard, 0));
    render(<StudentLeaderboard {...props} />);
    expect(await screen.findByTestId("leaderboard-empty")).toBeInTheDocument();
    expect(screen.getByText(/Tên của con chưa hiện trên bảng của lớp/u)).toBeInTheDocument();
    vitest.unstubAllGlobals();
  });

  it("lỗi mạng → thông báo + nút 'Thử lại'; thử lại thành công → bảng quay về", async () => {
    let calls = 0;
    vitest.stubGlobal(
      "fetch",
      vitest.fn(async (url: string | URL | Request) => {
        calls += 1;
        if (calls <= 2) throw new TypeError("network");
        const data = String(url).includes("/api/student/home") ? { score: { balance: 20 } } : ok;
        return new Response(JSON.stringify({ ok: true, data }), { status: 200 });
      }),
    );
    render(<StudentLeaderboard {...props} />);
    const alert = await screen.findByTestId("leaderboard-error");
    expect(alert).toHaveTextContent("Chưa mở được bảng điểm");
    fireEvent.click(within(alert).getByRole("button", { name: "Thử lại" }));
    expect(await screen.findByTestId("leaderboard-ready")).toBeInTheDocument();
    vitest.unstubAllGlobals();
  });

  it("nút 'Cập nhật bảng' tải lại và giữ bảng cũ trong lúc chờ (không nhảy bố cục)", async () => {
    let board: LeaderboardDto = ok;
    vitest.stubGlobal(
      "fetch",
      vitest.fn(async (url: string | URL | Request) => {
        const data = String(url).includes("/api/student/home") ? { score: { balance: 20 } } : board;
        return new Response(JSON.stringify({ ok: true, data }), { status: 200 });
      }),
    );
    render(<StudentLeaderboard {...props} />);
    await screen.findByTestId("leaderboard-ready");
    board = { ...ok, maxPoints: 60, rows: [dtoRow("Mây", 1, 60, true), dtoRow("Bống", 2, 40)] };
    fireEvent.click(screen.getByRole("button", { name: "Cập nhật bảng" }));
    await waitFor(() => expect(screen.getByText("Hạng 1, Mây (con), 60 điểm")).toBeInTheDocument());
    expect(screen.queryByTestId("leaderboard-skeleton")).toBeNull();
    vitest.unstubAllGlobals();
  });
});

describe("DemoLeaderboard — bản chơi thử không kết nối dữ liệu thật", () => {
  it("có nhãn minh họa, đổi điểm → sắp lại, đồng hạng, đổi avatar; không gọi mạng", () => {
    const fetchMock = vitest.fn();
    vitest.stubGlobal("fetch", fetchMock);
    render(<DemoLeaderboard entries={DEMO_LEADERBOARD} />);
    expect(screen.getByText("BẢN CHƠI THỬ – DỮ LIỆU MINH HỌA")).toBeInTheDocument();
    const order = () => screen.getAllByTestId("leaderboard-row").map((r) => r.getAttribute("data-rank"));
    expect(order()).toEqual(["1", "2", "3", "4", "5"]);
    // Chọn Mây (135) rồi "làm bằng điểm với bạn liền trên" (Bống 180) → đồng hạng nhất.
    fireEvent.click(screen.getByRole("button", { name: "Làm bằng điểm với bạn liền trên" }));
    expect(screen.getByText("Hạng 1, Mây (con), 180 điểm")).toBeInTheDocument();
    expect(order().slice(0, 2)).toEqual(["1", "1"]);
    fireEvent.click(screen.getByRole("button", { name: /Trả lời đúng/u }));
    expect(screen.getByText("Hạng 1, Mây (con), 190 điểm")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Trả lời sai/u }));
    expect(screen.getByText("Hạng 1, Mây (con), 185 điểm")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Đặt lại" }));
    expect(screen.getByText("Hạng 2, Mây (con), 135 điểm")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
    vitest.unstubAllGlobals();
  });
});

describe("bộ avatar", () => {
  it("16 avatar, khóa duy nhất, đều là danh mục hợp lệ cho CSDL (^[a-z][a-z0-9-]{0,39}$) và chờ duyệt", () => {
    expect(AVATAR_KEYS).toHaveLength(16);
    expect(new Set(AVATAR_KEYS).size).toBe(16);
    expect(AVATAR_OPTIONS.map((option) => option.key)).toEqual([...AVATAR_KEYS]);
    for (const option of AVATAR_OPTIONS) {
      expect(option.key).toMatch(/^[a-z][a-z0-9-]{0,39}$/u);
      expect(option.status).toBe("pending_review");
      expect(option.label.length).toBeGreaterThan(0);
    }
    expect(new Set(AVATAR_OPTIONS.map((option) => option.label)).size).toBe(16);
  });

  it("mọi avatar dựng được và có hình riêng (không trùng nhau)", () => {
    const markups = AVATAR_KEYS.map((key) => {
      const { container, unmount } = render(<KidAvatar avatar={key} />);
      // Bỏ id sinh ngẫu nhiên của gradient trước khi so sánh.
      const html = container.innerHTML.replace(/rm[A-Za-z0-9_-]+/gu, "id");
      unmount();
      return html;
    });
    expect(new Set(markups).size).toBe(16);
    expect(markups.every((html) => html.includes("<svg"))).toBe(true);
  });
});
