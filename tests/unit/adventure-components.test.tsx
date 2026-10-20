import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AchievementBadge } from "@/components/adventure/achievement-badge";
import { AdventureButton, AdventureLink } from "@/components/adventure/adventure-button";
import { AdventureDialog } from "@/components/adventure/adventure-dialog";
import { GameWorldMap } from "@/components/adventure/game-world-map";
import { HeartIndicator } from "@/components/adventure/heart-indicator";
import { LeaderboardPreview } from "@/components/adventure/leaderboard-preview";
import { MilestoneTrail } from "@/components/adventure/milestone-trail";
import { MotionScope, MotionToggle } from "@/components/adventure/motion";
import { ProgressBar } from "@/components/adventure/progress-bar";
import { ScoreBadge } from "@/components/adventure/score-badge";
import { WorldMapCard } from "@/components/adventure/world-map-card";
import { KidAvatar } from "@/components/art/avatars";
import { FriendlyMonster } from "@/components/art/characters";
import { ComingSoonState } from "@/components/ui/coming-soon-state";
import { DEMO_LEADERBOARD } from "@/features/demo/adventure-data";
import { GAME_WORLDS, gameWorld } from "@/features/game-world/catalog";
import { gameUnlockStates } from "@/features/gamification/unlocks";

describe("AdventureButton / AdventureLink", () => {
  it("nút kid cao ≥ 64px (min-h-touch-kid), type=button; liên kết có href thật", () => {
    render(
      <>
        <AdventureButton>Luyện bài</AdventureButton>
        <AdventureLink href="/demo">Chơi thử</AdventureLink>
      </>,
    );
    const button = screen.getByRole("button", { name: "Luyện bài" });
    expect(button).toHaveAttribute("type", "button");
    expect(button.className).toContain("min-h-touch-kid");
    expect(screen.getByRole("link", { name: "Chơi thử" })).toHaveAttribute("href", "/demo");
  });
});

describe("ScoreBadge, ProgressBar", () => {
  it("hiển thị tổng điểm cho trình đọc màn hình, nhãn Minh họa và tiến độ tới mốc kế tiếp", () => {
    render(<ScoreBadge points={135} illustrative />);
    expect(screen.getByText("135 điểm thưởng")).toBeInTheDocument();
    expect(screen.getByText("Minh họa")).toBeInTheDocument();
    const bar = screen.getByRole("progressbar", { name: "Tiến độ tới mốc khám phá tiếp theo" });
    expect(bar).toHaveAttribute("aria-valuenow", "15");
    expect(bar).toHaveAttribute("aria-valuemax", "30");
    expect(bar).toHaveAttribute("aria-valuetext", "Còn 15 điểm tới mốc khám phá tiếp theo");
  });

  it("ô điểm không có nút hay ô nhập nào để sửa điểm", () => {
    const { container } = render(<ScoreBadge points={135} illustrative />);
    expect(container.querySelectorAll("button, input, select, textarea, form")).toHaveLength(0);
  });

  it("ProgressBar kẹp giá trị trong [0, max]", () => {
    render(<ProgressBar value={99} max={30} label="Thanh thử" />);
    expect(screen.getByRole("progressbar", { name: "Thanh thử" })).toHaveAttribute("aria-valuenow", "30");
  });
});

describe("HeartIndicator, AchievementBadge, ComingSoonState", () => {
  it("trái tim có nhãn chữ (không chỉ dựa vào màu)", () => {
    render(<HeartIndicator remaining={2} />);
    expect(screen.getByText("Quái vật còn 2/3 trái tim")).toBeInTheDocument();
  });

  it("huy hiệu ghi rõ Đã đạt / Chưa đạt", () => {
    render(
      <>
        <AchievementBadge title="A" description="a" icon="map" earned />
        <AchievementBadge title="B" description="b" icon="book" earned={false} />
      </>,
    );
    expect(screen.getByText("Đã đạt")).toBeInTheDocument();
    expect(screen.getByText("Chưa đạt")).toBeInTheDocument();
  });

  it("ComingSoonState ghi 'Sắp có – Đang phát triển' và không có nút", () => {
    const { container } = render(<ComingSoonState title="Vinh danh" description="Dự kiến R06" />);
    expect(screen.getByText("Sắp có – Đang phát triển")).toBeInTheDocument();
    expect(container.querySelectorAll("button, a")).toHaveLength(0);
  });
});

describe("AdventureDialog", () => {
  it("nút mở có aria-haspopup; mở bảng thông tin thật có tiêu đề; nút Đóng đóng lại", () => {
    render(
      <AdventureDialog triggerLabel="Xem chi tiết" triggerAriaLabel="Xem chi tiết: Mê cung" title="Mê cung kho báu">
        <p>Nội dung bảng</p>
      </AdventureDialog>,
    );
    const trigger = screen.getByRole("button", { name: "Xem chi tiết: Mê cung" });
    expect(trigger).toHaveAttribute("aria-haspopup", "dialog");
    const dialog = document.querySelector("dialog");
    expect(dialog).not.toHaveAttribute("open");
    fireEvent.click(trigger);
    expect(dialog).toHaveAttribute("open");
    expect(within(dialog as HTMLElement).getByRole("heading", { name: "Mê cung kho báu" })).toBeInTheDocument();
    fireEvent.click(within(dialog as HTMLElement).getByRole("button", { name: "Đóng" }));
    expect(dialog).not.toHaveAttribute("open");
  });
});

describe("MotionScope / MotionToggle (giảm chuyển động)", () => {
  it("mặc định theo hệ điều hành (jsdom: không giảm); bấm công tắc → data-motion=reduce, aria-pressed=true", () => {
    const { container } = render(
      <MotionScope>
        <MotionToggle />
        <span className="animate-float">hoạt cảnh</span>
      </MotionScope>,
    );
    const scope = container.querySelector("[data-motion]");
    const toggle = screen.getByRole("button", { name: /Giảm chuyển động/ });
    expect(scope).toHaveAttribute("data-motion", "full");
    expect(toggle).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(toggle);
    expect(scope).toHaveAttribute("data-motion", "reduce");
    expect(toggle).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(toggle);
    expect(scope).toHaveAttribute("data-motion", "full");
  });

  it("MotionToggle ngoài MotionScope không hiển thị gì", () => {
    const { container } = render(<MotionToggle />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("Game World: bản đồ, thẻ khu vực, mốc khám phá", () => {
  const states = gameUnlockStates(135);

  it("bản đồ có nhãn mô tả, đủ bốn khu vực + trạm luyện tập; ghim chỉ để nhìn", () => {
    const { container } = render(<GameWorldMap states={states} />);
    expect(screen.getByRole("img", { name: /Bản đồ thế giới/ })).toBeInTheDocument();
    for (const game of GAME_WORLDS) expect(container.textContent).toContain(game.name);
    expect(container.textContent).toContain("Trạm luyện tập");
    expect(container.querySelectorAll("a, button")).toHaveLength(0);
  });

  it("thẻ đủ điểm / chưa đủ điểm đúng theo dữ liệu minh họa; nút Vào chơi luôn khóa, không có liên kết tới game", () => {
    const { container } = render(
      <ul>
        {states.map((state) => (
          <WorldMapCard key={state.game} as="li" game={gameWorld(state.game)} state={state} />
        ))}
      </ul>,
    );
    const card = (name: string) => screen.getByRole("listitem", { name });
    expect(within(card("Mê cung kho báu")).getAllByText("Đủ điểm").length).toBeGreaterThan(0);
    expect(within(card("Rừng chữ kỳ diệu")).getAllByText("Đủ điểm").length).toBeGreaterThan(0);
    expect(within(card("Đảo dấu thanh")).getAllByText("Chưa đủ điểm").length).toBeGreaterThan(0);
    expect(within(card("Đảo dấu thanh")).getAllByText("Cần thêm 65 điểm").length).toBeGreaterThan(0);
    expect(within(card("Lâu đài ghép vần")).getAllByText("Cần thêm 165 điểm").length).toBeGreaterThan(0);
    for (const game of GAME_WORLDS) {
      expect(within(card(game.name)).getAllByText(`Mở khi có ${game.minBalance} điểm`).length).toBeGreaterThan(0);
    }
    const play = screen.getAllByRole("button", { name: /Vào chơi/, hidden: true });
    expect(play).toHaveLength(4);
    for (const button of play) expect(button).toBeDisabled();
    expect(container.querySelectorAll("a")).toHaveLength(0);
  });

  it("nút Xem chi tiết mở bảng thông tin của đúng trò chơi", () => {
    const state = states[0];
    if (!state) throw new Error("thiếu dữ liệu");
    render(<WorldMapCard game={gameWorld(state.game)} state={state} />);
    fireEvent.click(screen.getByRole("button", { name: "Xem chi tiết: Mê cung kho báu" }));
    const dialog = document.querySelector("dialog[open]") as HTMLElement;
    expect(within(dialog).getByRole("heading", { level: 2, name: "Mê cung kho báu" })).toBeInTheDocument();
    expect(within(dialog).getByText("Vào chơi không tốn điểm.")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: /Vào chơi – Sắp có/ })).toBeDisabled();
  });

  it("dải mốc: 135 điểm → 4 mốc đã khám phá, mốc 150 là mốc tiếp theo", () => {
    render(<MilestoneTrail earnedTotal={135} />);
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(8);
    expect(items.filter((item) => item.getAttribute("aria-label")?.endsWith("đã khám phá"))).toHaveLength(4);
    expect(items[4]).toHaveAttribute("aria-label", "Mốc 150 điểm, chưa khám phá");
  });
});

describe("Bảng xếp hạng minh họa", () => {
  it("sắp xếp giảm dần, nhãn đọc được, đánh dấu dòng của mình, không từ ngữ gây xấu hổ", () => {
    const { container } = render(<LeaderboardPreview entries={DEMO_LEADERBOARD} />);
    const rows = screen.getAllByRole("listitem");
    expect(rows.map((row) => row.getAttribute("aria-label"))).toEqual([
      "Hạng 1: Bống, 180 điểm",
      "Hạng 2: Mây, 135 điểm",
      "Hạng 3: Na, 120 điểm",
      "Hạng 4: Tí, 95 điểm",
      "Hạng 5: Bin, 70 điểm",
    ]);
    expect(container.textContent).not.toMatch(/thua|kém|cuối bảng/iu);
  });
});

describe("asset SVG", () => {
  it("hình có tiêu đề → role=img + aria-label; không tiêu đề → ẩn khỏi trình đọc màn hình", () => {
    render(
      <>
        <KidAvatar avatar="may" title="Avatar của Mây" />
        <FriendlyMonster />
      </>,
    );
    expect(screen.getByRole("img", { name: "Avatar của Mây" })).toBeInTheDocument();
    expect(document.querySelectorAll("svg[aria-hidden='true']").length).toBeGreaterThan(0);
  });

  it("hai hình giống nhau trên cùng trang không trùng id gradient", () => {
    const { container } = render(
      <>
        <FriendlyMonster />
        <FriendlyMonster />
      </>,
    );
    const ids = [...container.querySelectorAll("[id]")].map((element) => element.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
