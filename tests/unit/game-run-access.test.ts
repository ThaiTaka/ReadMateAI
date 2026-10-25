import { describe, expect, it } from "vitest";
import { runKeepsAccess } from "@/server/game-runs/student";

describe("R08.7 — runKeepsAccess (ngưỡng điểm chỉ áp dụng khi bắt đầu lượt tính điểm mới)", () => {
  it("lượt đang dở — tính điểm hoặc chơi lại — luôn được tiếp tục", () => {
    expect(runKeepsAccess({ status: "in_progress", scored: true })).toBe(true);
    expect(runKeepsAccess({ status: "in_progress", scored: false })).toBe(true);
  });

  it("chỉ lượt tính điểm đã hoàn thành mới cho vào để chọn chơi lại", () => {
    expect(runKeepsAccess({ status: "completed", scored: true })).toBe(true);
    expect(runKeepsAccess({ status: "completed", scored: false })).toBe(false);
  });

  it("lượt đã vô hiệu hóa hoặc trạng thái lạ không cấp quyền", () => {
    expect(runKeepsAccess({ status: "voided", scored: true })).toBe(false);
    expect(runKeepsAccess({ status: "abandoned", scored: false })).toBe(false);
  });
});
