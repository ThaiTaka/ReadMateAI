import { describe, expect, it } from "vitest";
import { buildHonorSnapshot, type HonorRank } from "@/features/honors/honors";
import {
  INITIAL_PLAYBACK,
  currentTierRank,
  isTierRevealed,
  primaryLabel,
  reducePlayback,
  tierLayout,
  type PlaybackAction,
  type PlaybackState,
} from "@/features/honors/playback";

const run = (actions: PlaybackAction[], total: number): PlaybackState =>
  actions.reduce((state, action) => reducePlayback(state, action, total), INITIAL_PLAYBACK);

const entry = (rank: number, alias: string, points: number) => ({ rank, alias, avatar_key: "may", points });
const snapshot = (entries: ReturnType<typeof entry>[]) =>
  buildHonorSnapshot({
    id: "5eed0000-0000-4000-8000-000000000001",
    season_no: 1,
    class_name: "1A2",
    created_at: "2026-10-21T01:00:00Z",
    entries,
  })!;

/** Danh sách hạng đã hiện sau từng lần bấm "Tiếp tục". */
function revealSequence(order: readonly HonorRank[]): HonorRank[][] {
  const steps: HonorRank[][] = [];
  let state = reducePlayback(INITIAL_PLAYBACK, "start", order.length);
  for (let guard = 0; guard < 10 && state.phase === "playing"; guard += 1) {
    steps.push(order.filter((rank) => isTierRevealed(state, order, rank)));
    state = reducePlayback(state, "next", order.length);
  }
  return steps;
}

describe("thứ tự trình chiếu theo playbackOrder của ảnh chụp", () => {
  it("hạng 1–2–3: phát 3 → 2 → 1 rồi sang tổng kết", () => {
    const order = snapshot([entry(1, "A", 50), entry(2, "B", 40), entry(3, "C", 30)]).playbackOrder;
    expect(order).toEqual([3, 2, 1]);
    expect(revealSequence(order)).toEqual([[3], [3, 2], [3, 2, 1]]);
    expect(run(["start", "next", "next", "next"], 3)).toEqual({ phase: "summary", revealed: 3 });
  });

  it("hạng 1–1–3: bỏ bậc 2 (3 → 1)", () => {
    const shot = snapshot([entry(1, "A", 50), entry(1, "B", 50), entry(3, "C", 30)]);
    expect(shot.playbackOrder).toEqual([3, 1]);
    expect(shot.tiers.find((tier) => tier.rank === 1)?.entries).toHaveLength(2);
    expect(revealSequence(shot.playbackOrder)).toEqual([[3], [3, 1]]);
  });

  it("hạng 1–1–1: chỉ một bậc", () => {
    const shot = snapshot([entry(1, "A", 50), entry(1, "B", 50), entry(1, "C", 50)]);
    expect(shot.playbackOrder).toEqual([1]);
    expect(revealSequence(shot.playbackOrder)).toEqual([[1]]);
    expect(run(["start", "next"], 1).phase).toBe("summary");
  });

  it("không bắt đầu thì chưa bậc nào hiện; bậc hiện tại theo bước", () => {
    const order: HonorRank[] = [3, 2, 1];
    expect(isTierRevealed(INITIAL_PLAYBACK, order, 3)).toBe(false);
    expect(currentTierRank(INITIAL_PLAYBACK, order)).toBeNull();
    expect(currentTierRank(run(["start", "next"], 3), order)).toBe(2);
    expect(currentTierRank(run(["skip"], 3), order)).toBeNull();
  });
});

describe("bỏ qua, xem lại, bậc trống", () => {
  it("Bỏ qua → tổng kết, mọi bậc đã hiện", () => {
    const order: HonorRank[] = [3, 1];
    const state = run(["start", "skip"], 2);
    expect(state).toEqual({ phase: "summary", revealed: 2 });
    expect(order.every((rank) => isTierRevealed(state, order, rank))).toBe(true);
    expect(run(["skip"], 2).phase).toBe("summary"); // bỏ qua ngay từ đầu
  });

  it("Xem lại → phát từ đầu, kể cả sau tổng kết; 'next' ở tổng kết không đổi", () => {
    expect(run(["start", "skip", "replay"], 3)).toEqual(INITIAL_PLAYBACK);
    const summary = run(["skip"], 3);
    expect(reducePlayback(summary, "next", 3)).toBe(summary);
    expect(reducePlayback(summary, "start", 3)).toBe(summary);
  });

  it("không có bậc nào → bắt đầu đi thẳng tổng kết", () => {
    expect(run(["start"], 0)).toEqual({ phase: "summary", revealed: 0 });
  });

  it("nhãn nút chính: Bắt đầu → Tiếp tục → Tổng kết ở bậc cuối", () => {
    expect(primaryLabel(INITIAL_PLAYBACK, 3)).toBe("start");
    expect(primaryLabel(run(["start"], 3), 3)).toBe("next");
    expect(primaryLabel(run(["start", "next", "next"], 3), 3)).toBe("summary");
  });
});

describe("bố cục bậc", () => {
  it("tối đa 6 avatar theo hàng; nhiều hơn → lưới, không cắt bớt người đồng hạng", () => {
    expect(tierLayout(1)).toBe("row");
    expect(tierLayout(6)).toBe("row");
    expect(tierLayout(7)).toBe("grid");
    const many = snapshot(Array.from({ length: 9 }, (_, i) => entry(1, `Bạn ${i + 1}`, 20)));
    expect(many.tiers[0]?.entries).toHaveLength(9);
  });
});
