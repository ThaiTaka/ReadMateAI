import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { HonorStage } from "@/components/honors/honor-stage";
import { buildHonorSnapshot } from "@/features/honors/honors";
import { vi } from "@/strings/vi";

afterEach(cleanup);

const t = vi.honors.stage;
const entry = (rank: number, alias: string, points: number) => ({ rank, alias, avatar_key: "may", points });
const snapshot = (entries: ReturnType<typeof entry>[]) =>
  buildHonorSnapshot({
    id: "5eed0000-0000-4000-8000-000000000001",
    season_no: 2,
    class_name: "1A2",
    created_at: "2026-10-21T01:00:00Z",
    entries,
  })!;

const full = () => snapshot([entry(1, "Mây", 50), entry(2, "Bống", 40), entry(3, "Na", 30)]);
const revealed = () =>
  screen
    .getAllByTestId("honor-tier")
    .filter((tier) => tier.getAttribute("data-revealed") === "true")
    .map((tier) => Number(tier.getAttribute("data-rank")));
const click = (name: string) => fireEvent.click(screen.getByRole("button", { name: new RegExp(name, "u") }));

describe("HonorStage — trình chiếu 3 → 2 → 1", () => {
  it("bắt đầu từ sân khấu trống; mỗi lần Tiếp tục hiện thêm một bậc, hạng 3 trước", () => {
    render(<HonorStage snapshot={full()} exitHref="/x" />);
    expect(screen.getByTestId("honor-stage")).toHaveAttribute("data-phase", "ready");
    expect(revealed()).toEqual([]);
    click(t.start);
    expect(revealed()).toEqual([3]);
    expect(screen.getByTestId("honor-announce")).toHaveTextContent("Hạng 3: Na, 30 điểm");
    click(t.next);
    expect(revealed().sort()).toEqual([2, 3]);
    click(t.next);
    expect(revealed().sort()).toEqual([1, 2, 3]);
    expect(screen.getByTestId("honor-halo")).toBeInTheDocument();
    expect(screen.getByTestId("honor-confetti")).toBeInTheDocument();
    click(t.toSummary);
    expect(screen.getByTestId("honor-stage")).toHaveAttribute("data-phase", "summary");
    expect(screen.getByTestId("honor-summary-title")).toHaveTextContent(t.summaryTitle);
  });

  it("Bỏ qua → tổng kết ngay (đủ bậc); Xem lại → về đầu, sân khấu trống", () => {
    render(<HonorStage snapshot={full()} exitHref="/x" />);
    click(t.skip);
    expect(revealed().sort()).toEqual([1, 2, 3]);
    expect(screen.getByRole("button", { name: t.replay })).toHaveFocus();
    click(t.replay);
    expect(screen.getByTestId("honor-stage")).toHaveAttribute("data-phase", "ready");
    expect(revealed()).toEqual([]);
    expect(screen.getByRole("link", { name: t.exit })).toHaveAttribute("href", "/x");
  });

  it("đồng hạng 1–1–3: bậc 2 không tồn tại, hai bạn hạng 1 cùng một bậc", () => {
    render(
      <HonorStage snapshot={snapshot([entry(1, "Mây", 50), entry(1, "Bống", 50), entry(3, "Na", 30)])} exitHref="/x" />,
    );
    expect(screen.getAllByTestId("honor-tier").map((tier) => tier.getAttribute("data-rank"))).toEqual(["1", "3"]);
    click(t.start);
    expect(revealed()).toEqual([3]);
    click(t.next);
    expect(revealed().sort()).toEqual([1, 3]);
    expect(screen.getAllByTestId("honor-tier")[0]?.querySelectorAll('[data-testid="honor-entry"]')).toHaveLength(2);
  });

  it("nhiều hơn 6 bạn cùng hạng: đủ mọi người, bố cục lưới", () => {
    const entries = Array.from({ length: 8 }, (_, i) => entry(1, `Bạn ${i + 1}`, 20));
    render(<HonorStage snapshot={snapshot(entries)} exitHref="/x" />);
    click(t.skip);
    expect(screen.getAllByTestId("honor-entry")).toHaveLength(8);
    expect(screen.getByRole("list").className).toContain("grid");
  });

  it("công tắc giảm chuyển động đặt data-motion=reduce; Bỏ qua/Xem lại vẫn dùng được", () => {
    const { container } = render(<HonorStage snapshot={full()} exitHref="/x" />);
    fireEvent.click(screen.getByRole("button", { name: new RegExp(vi.adventure.motion.label, "u") }));
    expect(container.querySelector('[data-motion="reduce"]')).not.toBeNull();
    click(t.skip);
    expect(revealed().sort()).toEqual([1, 2, 3]);
    click(t.replay);
    expect(revealed()).toEqual([]);
  });

  it("không chứa mã định danh học sinh trong HTML", () => {
    const { container } = render(<HonorStage snapshot={full()} exitHref="/x" />);
    click(t.skip);
    expect(container.innerHTML).not.toMatch(/student|class_id|classId|band/iu);
  });
});
