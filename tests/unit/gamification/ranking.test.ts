import { describe, expect, it } from "vitest";
import {
  calculateBarWidth,
  compareAlias,
  eligibilityBlockers,
  getTopRankedStudents,
  maxPointsOf,
  normalizeLeaderboardRows,
  rankScores,
  selectVisibleRows,
  type LeaderboardCandidate,
  type RankableRow,
} from "@/features/gamification/ranking";
import { buildPresentation, buildStudentLeaderboard, opaqueRowKey } from "@/features/leaderboard/build";

const row = (alias: string, points: number, extra: Partial<RankableRow> = {}): RankableRow => ({
  key: `k-${alias}`,
  alias,
  avatarKey: "may",
  points,
  reachedAt: null,
  isMe: false,
  ...extra,
});

describe("rankScores — LEADERBOARD_SPEC §3", () => {
  it("sắp điểm giảm dần", () => {
    const ranked = rankScores([row("Tí", 160), row("Mây", 250), row("Bin", 100)]);
    expect(ranked.map((r) => r.alias)).toEqual(["Mây", "Tí", "Bin"]);
    expect(ranked.map((r) => r.points)).toEqual([250, 160, 100]);
  });

  it("đồng hạng kiểu thi đấu 1–2–2–4–5 (không phải 1–2–2–3)", () => {
    const ranked = rankScores([row("Mây", 250), row("Bống", 200), row("Na", 200), row("Tí", 160), row("Bin", 100)]);
    expect(ranked.map((r) => r.rank)).toEqual([1, 2, 2, 4, 5]);
  });

  it("ví dụ của đặc tả §3: 120, 80, 80, 50, 0, 0 → 1, 2, 2, 4, 5, 5", () => {
    const ranked = rankScores([
      row("A", 0),
      row("B", 120, { reachedAt: "2026-10-20T09:10:00Z" }),
      row("C", 80, { reachedAt: "2026-10-20T08:30:00Z" }),
      row("D", 50),
      row("E", 80, { reachedAt: "2026-10-20T08:00:00Z" }),
      row("F", 0),
    ]);
    expect(ranked.map((r) => [r.alias, r.rank])).toEqual([
      ["B", 1],
      ["E", 2],
      ["C", 2],
      ["D", 4],
      ["A", 5],
      ["F", 5],
    ]);
  });

  it("hai học sinh cùng đồng hạng nhất, người kế tiếp hạng 3", () => {
    const ranked = rankScores([row("Na", 90), row("Mây", 90), row("Tí", 40)]);
    expect(ranked.map((r) => r.rank)).toEqual([1, 1, 3]);
  });

  it("tất cả 0 điểm → cùng hạng nhất", () => {
    const ranked = rankScores([row("Na", 0), row("Mây", 0), row("Tí", 0)]);
    expect(ranked.map((r) => r.rank)).toEqual([1, 1, 1]);
  });

  it("một học sinh, không có học sinh", () => {
    expect(rankScores([row("Mây", 30)]).map((r) => r.rank)).toEqual([1]);
    expect(rankScores([])).toEqual([]);
  });

  it("điểm đổi → hạng tính lại", () => {
    const before = rankScores([row("A", 50), row("B", 60)]);
    expect(before.map((r) => [r.alias, r.rank])).toEqual([
      ["B", 1],
      ["A", 2],
    ]);
    const tie = rankScores([row("A", 60), row("B", 60)]);
    expect(tie.map((r) => r.rank)).toEqual([1, 1]);
    const after = rankScores([row("A", 70), row("B", 60)]);
    expect(after.map((r) => [r.alias, r.rank])).toEqual([
      ["A", 1],
      ["B", 2],
    ]);
    const dropped = rankScores([row("A", 65), row("B", 60)]);
    expect(dropped.map((r) => [r.alias, r.rank])).toEqual([
      ["A", 1],
      ["B", 2],
    ]);
  });

  it("thứ tự hiển thị khi bằng điểm: đạt sớm hơn trước, rồi theo tên, rồi theo khóa; ổn định giữa các lần gọi", () => {
    const rows = [
      row("Cúc", 80, { reachedAt: "2026-10-20T08:30:00Z", key: "3" }),
      row("Bống", 80, { reachedAt: "2026-10-20T08:00:00Z", key: "2" }),
      row("Ân", 80, { reachedAt: "2026-10-20T08:30:00Z", key: "1" }),
      row("Zed", 80, { reachedAt: null, key: "4" }),
    ];
    const order = rankScores(rows).map((r) => r.alias);
    expect(order).toEqual(["Bống", "Ân", "Cúc", "Zed"]);
    expect(rankScores([...rows].reverse()).map((r) => r.alias)).toEqual(order);
    expect(rankScores(rows).every((r) => r.rank === 1)).toBe(true);
  });

  it("thời điểm không hợp lệ được coi như chưa có (xếp sau, không làm sập)", () => {
    const ranked = rankScores([
      row("B", 10, { reachedAt: "không-phải-ngày" }),
      row("A", 10, { reachedAt: "2026-10-20T08:00:00Z" }),
    ]);
    expect(ranked.map((r) => r.alias)).toEqual(["A", "B"]);
  });

  it("không sửa mảng đầu vào", () => {
    const input = [row("A", 1), row("B", 2)];
    rankScores(input);
    expect(input.map((r) => r.alias)).toEqual(["A", "B"]);
  });

  it("tên Unicode tiếng Việt: NFC và NFD cho cùng thứ tự; so sánh theo bảng chữ cái tiếng Việt", () => {
    expect(compareAlias("Ân".normalize("NFD"), "Ân".normalize("NFC"))).toBe(0);
    expect(compareAlias("Ân", "Bống")).toBeLessThan(0);
    expect(compareAlias("Đào", "Dũng")).toBeGreaterThan(0);
    const ranked = rankScores([row("Đào".normalize("NFD"), 5, { key: "x" }), row("Dũng", 5, { key: "y" })]);
    expect(ranked.map((r) => r.key)).toEqual(["y", "x"]);
  });

  it("thuộc tính: hạng không giảm theo thứ tự hiển thị; cùng điểm ⇔ cùng hạng", () => {
    let seed = 7;
    const next = () => (seed = (seed * 1103515245 + 12345) % 2147483648);
    for (let round = 0; round < 50; round += 1) {
      const rows = Array.from({ length: 1 + (next() % 20) }, (_, i) => row(`H${i}`, next() % 6));
      const ranked = rankScores(rows);
      for (let i = 1; i < ranked.length; i += 1) {
        expect(ranked[i]!.rank).toBeGreaterThanOrEqual(ranked[i - 1]!.rank);
        expect(ranked[i]!.points === ranked[i - 1]!.points).toBe(ranked[i]!.rank === ranked[i - 1]!.rank);
      }
      expect(ranked[0]!.rank).toBe(1);
    }
  });
});

describe("calculateBarWidth — LEADERBOARD_SPEC §4", () => {
  it("tỉ lệ tuyến tính: 250/250 = 100, 200/250 = 80, 125/250 = 50", () => {
    expect(calculateBarWidth(250, 250)).toBe(100);
    expect(calculateBarWidth(200, 250)).toBe(80);
    expect(calculateBarWidth(125, 250)).toBe(50);
  });
  it("0 điểm → thanh rỗng, không có độ dài tối thiểu giả", () => {
    expect(calculateBarWidth(0, 250)).toBe(0);
  });
  it("không chia cho 0: cả lớp 0 điểm → mọi thanh rỗng", () => {
    expect(calculateBarWidth(0, 0)).toBe(0);
    expect(calculateBarWidth(10, 0)).toBe(0);
    expect(maxPointsOf([])).toBe(0);
  });
  it("giá trị lạ không làm hỏng: âm, NaN, vượt tối đa", () => {
    expect(calculateBarWidth(-5, 100)).toBe(0);
    expect(calculateBarWidth(Number.NaN, 100)).toBe(0);
    expect(calculateBarWidth(150, 100)).toBe(100);
  });
});

describe("getTopRankedStudents / selectVisibleRows", () => {
  const many = rankScores(Array.from({ length: 14 }, (_, i) => row(`H${String(i).padStart(2, "0")}`, 140 - i * 10)));

  it("TOP 10: mọi hạng ≤ 10", () => {
    expect(getTopRankedStudents(many)).toHaveLength(10);
  });

  it("không cắt giữa nhóm đồng hạng; có trần cứng", () => {
    const ties = rankScores(Array.from({ length: 12 }, (_, i) => row(`H${i}`, i < 9 ? 100 : 100 - i)));
    expect(getTopRankedStudents(ties).length).toBeGreaterThanOrEqual(10);
    const allTied = rankScores(Array.from({ length: 50 }, (_, i) => row(`H${i}`, 10)));
    expect(getTopRankedStudents(allTied)).toHaveLength(30);
  });

  it("TOP 10 + Con: hàng của em ngoài đầu bảng được tách riêng; trong đầu bảng thì không lặp", () => {
    const withMe = rankScores(
      Array.from({ length: 14 }, (_, i) => row(`H${String(i).padStart(2, "0")}`, 140 - i * 10, { isMe: i === 12 })),
    );
    const view = selectVisibleRows(withMe, "top10_and_me");
    expect(view.rows).toHaveLength(10);
    expect(view.myRow?.alias).toBe("H12");
    const inTop = rankScores(
      Array.from({ length: 14 }, (_, i) => row(`H${String(i).padStart(2, "0")}`, 140 - i * 10, { isMe: i === 2 })),
    );
    expect(selectVisibleRows(inTop, "top10_and_me").myRow).toBeNull();
  });

  it("toàn bộ lớp: mọi hàng đủ điều kiện, không hàng riêng", () => {
    const view = selectVisibleRows(many, "full");
    expect(view.rows).toHaveLength(14);
    expect(view.myRow).toBeNull();
  });
});

describe("điều kiện hiển thị — chỉ học sinh đủ điều kiện lên bảng", () => {
  const base: LeaderboardCandidate = {
    key: "a",
    status: "active",
    alias: "Mây",
    aliasApproved: true,
    learningDataConsent: true,
    leaderboardConsent: true,
    points: 40,
    reachedAt: null,
    avatarKey: "may",
  };

  it("đủ điều kiện → có hàng", () => {
    expect(eligibilityBlockers(base)).toEqual([]);
    expect(normalizeLeaderboardRows([base])).toHaveLength(1);
  });

  it.each([
    ["đã tạm ngưng", { status: "paused" as const }, "STUDENT_INACTIVE"],
    ["thiếu đồng ý dữ liệu học tập", { learningDataConsent: false }, "NO_LEARNING_CONSENT"],
    ["thiếu đồng ý hiển thị", { leaderboardConsent: false }, "NO_LEADERBOARD_CONSENT"],
    ["tên hiển thị chưa duyệt", { aliasApproved: false }, "NO_APPROVED_ALIAS"],
    ["chưa có tên hiển thị", { alias: null }, "NO_APPROVED_ALIAS"],
    ["tên hiển thị rỗng", { alias: "  " }, "NO_APPROVED_ALIAS"],
  ])("%s → không lên bảng", (_label, patch, blocker) => {
    const candidate = { ...base, ...patch };
    expect(eligibilityBlockers(candidate)).toContain(blocker);
    expect(normalizeLeaderboardRows([candidate])).toEqual([]);
  });

  it("không dùng họ tên thật thay cho tên hiển thị thiếu; bỏ điểm không hợp lệ; đánh dấu hàng của người xem", () => {
    const rows = normalizeLeaderboardRows(
      [
        base,
        { ...base, key: "b", alias: "Bống", points: -3 },
        { ...base, key: "c", alias: "Na".normalize("NFD"), points: 5 },
      ],
      "c",
    );
    expect(rows.map((r) => r.alias)).toEqual(["Mây", "Na"]);
    expect(rows.find((r) => r.key === "c")?.isMe).toBe(true);
  });
});

describe("DTO — không lộ định danh, nhóm năng lực hay dữ liệu ẩn", () => {
  const now = new Date("2026-10-21T10:00:00Z");
  const FORBIDDEN = [
    "student_id",
    "studentId",
    "class_id",
    "classId",
    "auth_user_id",
    "earned",
    "deducted",
    "band",
    "support",
    "email",
    "consent",
    "reachedAt",
    "reached_at",
  ];
  const gateway = {
    status: "ok",
    view: "top10_and_me",
    season_no: 1,
    viewer_listed: true,
    rows: [
      { alias: "Mây", avatar_key: "may", points: 250, reached_at: "2026-10-20T08:00:00Z", is_me: false },
      { alias: "Bống", avatar_key: "bong", points: 200, reached_at: "2026-10-20T08:10:00Z", is_me: true },
      { alias: "Na", avatar_key: "na", points: 200, reached_at: "2026-10-20T08:20:00Z", is_me: false },
    ],
  };

  it("hàng trả về đúng 6 trường và không có khóa cấm", () => {
    const dto = buildStudentLeaderboard(gateway, now);
    expect(dto?.status).toBe("ok");
    if (dto?.status !== "ok") return;
    expect(dto.rows.map((r) => r.rank)).toEqual([1, 2, 2]);
    expect(dto.maxPoints).toBe(250);
    for (const r of dto.rows) {
      expect(Object.keys(r).sort()).toEqual(["alias", "avatarKey", "isMe", "points", "rank", "rowKey"]);
    }
    const text = JSON.stringify(dto);
    for (const word of FORBIDDEN) expect(text).not.toContain(word);
  });

  it("khóa hàng là băm mờ, ổn định theo mùa + tên, không chứa tên hay mã", () => {
    const key = opaqueRowKey(1, "Mây");
    expect(key).toMatch(/^[0-9a-f]{16}$/u);
    expect(key).toBe(opaqueRowKey(1, "Mây".normalize("NFD")));
    expect(key).not.toBe(opaqueRowKey(2, "Mây"));
  });

  it("bảng tắt / chưa có mùa: không có trường dữ liệu nào ngoài trạng thái", () => {
    expect(buildStudentLeaderboard({ status: "disabled" }, now)).toEqual({ status: "disabled" });
    expect(buildStudentLeaderboard({ status: "no_season" }, now)).toEqual({ status: "no_season" });
  });

  it("dữ liệu sai hình dạng bị từ chối (không chuyển tiếp)", () => {
    expect(buildStudentLeaderboard({ status: "ok", rows: "x" }, now)).toBeNull();
    expect(buildStudentLeaderboard({ ...gateway, rows: [{ ...gateway.rows[0], points: -1 }] }, now)).toBeNull();
    expect(
      buildStudentLeaderboard({ ...gateway, rows: [{ ...gateway.rows[0], alias: "x".repeat(21) }] }, now),
    ).toBeNull();
  });

  it("lớp trống / một học sinh / tất cả 0 điểm", () => {
    const empty = buildStudentLeaderboard({ ...gateway, rows: [], viewer_listed: false }, now);
    expect(empty).toMatchObject({ status: "ok", maxPoints: 0, rows: [], myRow: null, viewerListed: false });
    const zeros = buildStudentLeaderboard(
      { ...gateway, rows: gateway.rows.map((r) => ({ ...r, points: 0, reached_at: null })) },
      now,
    );
    expect(zeros).toMatchObject({ status: "ok", maxPoints: 0 });
    if (zeros?.status === "ok") expect(zeros.rows.map((r) => r.rank)).toEqual([1, 1, 1]);
  });

  it("TOP 10 + Con tách hàng của em; dữ liệu trình chiếu không có cờ isMe", () => {
    const rows = Array.from({ length: 13 }, (_, i) => ({
      alias: `H${String(i).padStart(2, "0")}`,
      avatar_key: "may",
      points: 130 - i * 10,
      reached_at: null,
      is_me: i === 11,
    }));
    const dto = buildStudentLeaderboard({ ...gateway, rows }, now);
    if (dto?.status !== "ok") throw new Error("expected ok");
    expect(dto.rows).toHaveLength(10);
    expect(dto.myRow?.alias).toBe("H11");
    const presentation = buildPresentation(
      {
        season_no: 1,
        class_name: "1A2",
        rows: rows.map((r) => ({
          alias: r.alias,
          avatar_key: r.avatar_key,
          points: r.points,
          reached_at: r.reached_at,
        })),
      },
      now,
    );
    expect(presentation?.rows).toHaveLength(13);
    expect(JSON.stringify(presentation)).not.toContain("isMe");
  });
});
