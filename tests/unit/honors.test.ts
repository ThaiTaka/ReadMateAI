import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { RankableRow } from "@/features/gamification/ranking";
import { buildHonorSnapshot, buildHonorSummaries, buildStudentHonors, selectHonorees } from "@/features/honors/honors";

const row = (key: string, points: number, reachedAt: string | null = "2026-10-20T01:00:00Z"): RankableRow => ({
  key,
  alias: `Bạn ${key}`,
  avatarKey: "an",
  points,
  reachedAt,
  isMe: false,
});

const ranks = (rows: RankableRow[]) => selectHonorees(rows).map((r) => [r.key, r.rank]);

describe("selectHonorees — hạng ≤ 3 và điểm > 0 theo Ranking Engine", () => {
  it("TOP 3 chính xác, bỏ người từ hạng 4", () => {
    expect(ranks([row("e", 10), row("a", 50), row("d", 20), row("b", 40), row("c", 30)])).toEqual([
      ["a", 1],
      ["b", 2],
      ["c", 3],
    ]);
  });

  it("đồng hạng 1–1–3: hai bạn cùng bậc 1, bậc 2 trống, bạn kế tiếp hạng 3", () => {
    expect(ranks([row("a", 60), row("b", 60), row("c", 40), row("d", 30)])).toEqual([
      ["a", 1],
      ["b", 1],
      ["c", 3],
    ]);
  });

  it("đồng hạng 1–2–2: không có bạn hạng 3 (bạn kế tiếp là hạng 4)", () => {
    expect(ranks([row("a", 60), row("b", 40), row("c", 40), row("d", 10)])).toEqual([
      ["a", 1],
      ["b", 2],
      ["c", 2],
    ]);
  });

  it("nhiều bạn đồng hạng 3 đều được vinh danh", () => {
    expect(ranks([row("a", 60), row("b", 50), row("c", 40), row("d", 40), row("e", 40)]).map(([, r]) => r)).toEqual([
      1, 2, 3, 3, 3,
    ]);
  });

  it("tất cả 0 điểm → không ai được vinh danh", () => {
    expect(selectHonorees([row("a", 0), row("b", 0), row("c", 0, null)])).toEqual([]);
  });

  it("điểm 0 ở hạng ≤ 3 bị loại, người có điểm > 0 vẫn được", () => {
    expect(ranks([row("a", 10), row("b", 0), row("c", 0)])).toEqual([["a", 1]]);
  });

  it("không có học sinh đủ điều kiện → rỗng; đầu vào không bị sửa", () => {
    expect(selectHonorees([])).toEqual([]);
    const input = [row("a", 5), row("b", 9)];
    selectHonorees(input);
    expect(input.map((r) => r.key)).toEqual(["a", "b"]);
  });
});

const ID = "11111111-2222-4333-8444-555555555555";
const entry = (rank: number, alias: string, points: number) => ({ rank, alias, avatar_key: "an", points });
const snapshot = (entries: unknown[]) => ({
  id: ID,
  season_no: 1,
  class_name: "1A2",
  created_at: "2026-10-21T00:00:00Z",
  entries,
});

describe("buildHonorSnapshot — DTO từ ảnh chụp đã lưu", () => {
  it("nhóm theo bậc, bỏ bậc trống, thứ tự phát TOP 3 → TOP 2 → TOP 1", () => {
    const dto = buildHonorSnapshot(snapshot([entry(1, "Mai", 90), entry(1, "Nam", 90), entry(3, "Lan", 40)]))!;
    expect(dto.tiers.map((tier) => [tier.rank, tier.entries.length])).toEqual([
      [1, 2],
      [3, 1],
    ]);
    expect(dto.playbackOrder).toEqual([3, 1]);
  });

  it("đủ ba bậc → phát 3, 2, 1", () => {
    const dto = buildHonorSnapshot(snapshot([entry(1, "A", 9), entry(2, "B", 8), entry(3, "C", 7)]))!;
    expect(dto.playbackOrder).toEqual([3, 2, 1]);
  });

  it("DTO không có trường định danh dù dữ liệu thô có", () => {
    const dto = buildHonorSnapshot(
      snapshot([{ ...entry(1, "Mai", 9), student_id: ID, class_id: ID, band: "foundation" }]),
    )!;
    expect(JSON.stringify(dto)).not.toMatch(/student|class_id|band|foundation/u);
  });

  it("dữ liệu sai lược đồ → null (hạng 4, điểm 0, tên rỗng, thiếu trường)", () => {
    expect(buildHonorSnapshot(snapshot([entry(4, "A", 9)]))).toBeNull();
    expect(buildHonorSnapshot(snapshot([entry(1, "A", 0)]))).toBeNull();
    expect(buildHonorSnapshot(snapshot([entry(1, "", 9)]))).toBeNull();
    expect(buildHonorSnapshot({ id: ID })).toBeNull();
  });

  it("danh sách rỗng hợp lệ (mọi hàng đã bị ẩn) → không bậc nào", () => {
    const dto = buildHonorSnapshot(snapshot([]))!;
    expect(dto.tiers).toEqual([]);
    expect(dto.playbackOrder).toEqual([]);
  });

  it("danh sách ảnh chụp: chỉ id, số mùa, thời điểm", () => {
    expect(buildHonorSummaries([{ id: ID, season_no: 2, created_at: "2026-10-21T00:00:00Z", created_by: ID }])).toEqual(
      [{ id: ID, seasonNo: 2, createdAt: "2026-10-21T00:00:00Z" }],
    );
    expect(buildHonorSummaries([{ id: "x" }])).toBeNull();
  });
});

describe("migration vinh danh", () => {
  const sql = readFileSync(
    `supabase/migrations/${readdirSync("supabase/migrations").find((name) => name.endsWith("_r06_honors.sql"))}`,
    "utf8",
  );

  it("không bật cờ hệ thống và không cấp quyền đọc thẳng bảng hàng cho authenticated", () => {
    expect(sql).not.toMatch(/feature_flags/u);
    expect(sql).not.toMatch(/grant\s+select\s+on\s+public\.honor_snapshot_entries/iu);
    expect(sql).toMatch(/honor_snapshot_entries_no_direct_read/u);
  });

  it("ảnh chụp bất biến: trigger chặn sửa/xóa cho cả hai bảng", () => {
    expect(sql.match(/block_direct_change/gu)?.length).toBe(2);
  });
});

describe("buildStudentHonors (R06.5)", () => {
  const entry = (rank: number, alias: string) => ({ rank, alias, avatar_key: "may", points: 30 });

  it("disabled/none không kèm dữ liệu", () => {
    expect(buildStudentHonors({ status: "disabled" })).toEqual({ status: "disabled" });
    expect(buildStudentHonors({ status: "none", entries: [entry(1, "Lộ")] })).toEqual({ status: "none" });
  });

  it("ok: bậc theo hạng, đồng hạng chung bậc, thứ tự phát 3→1, không có mã định danh", () => {
    const dto = buildStudentHonors({
      status: "ok",
      season_no: 2,
      created_at: "2026-10-21T00:00:00Z",
      entries: [entry(1, "Bống"), entry(1, "Na"), entry(3, "Mây")],
    });
    expect(dto).toEqual({
      status: "ok",
      seasonNo: 2,
      honoredAt: "2026-10-21T00:00:00Z",
      tiers: [
        {
          rank: 1,
          entries: [
            { rank: 1, alias: "Bống", avatarKey: "may", points: 30 },
            { rank: 1, alias: "Na", avatarKey: "may", points: 30 },
          ],
        },
        { rank: 3, entries: [{ rank: 3, alias: "Mây", avatarKey: "may", points: 30 }] },
      ],
      playbackOrder: [3, 1],
    });
    expect(JSON.stringify(dto)).not.toMatch(/student|class|id"/iu);
  });

  it("dữ liệu sai hình → null", () => {
    expect(buildStudentHonors({ status: "ok", season_no: 0, created_at: "x", entries: [] })).toBeNull();
    expect(buildStudentHonors({ status: "ok", season_no: 1, created_at: "x", entries: [entry(4, "A")] })).toBeNull();
    expect(buildStudentHonors(null)).toBeNull();
  });
});

describe("migration chống trùng vinh danh (R06.5)", () => {
  const sql = readFileSync(
    `supabase/migrations/${readdirSync("supabase/migrations").find((name) => name.endsWith("_r06_honor_dedupe.sql"))}`,
    "utf8",
  );

  it("khóa lớp, khóa ý định, khoảng chống lặp; gỡ đường gọi cũ; gateway chỉ service_role", () => {
    expect(sql).toMatch(/from public\.classes c where c\.id = p_class_id for update/u);
    expect(sql).toMatch(/honor_snapshot_requests r where r\.request_id = p_request_id/u);
    expect(sql).toMatch(/dedupe_seconds/u);
    expect(sql).toMatch(/drop function public\.teacher_create_honor_snapshot\(uuid\)/u);
    expect(sql).toMatch(/grant execute on function public\.gateway_latest_honors\(uuid, uuid\) to service_role;/u);
    expect(sql).not.toMatch(/gateway_latest_honors[^;]*to[^;]*authenticated/u);
    expect(sql).not.toMatch(/feature_flags/u);
  });
});
