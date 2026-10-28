import type { MazeEntryDto } from "../scored-practice/types.ts";

/**
 * Nút vào Mê cung trên trang của học sinh nên nói gì (hàm thuần, R-nối nút "Vào chơi" với bàn chơi thật).
 * Chỉ để chọn NHÃN và MÀN dẫn tới — mọi quyết định thật (ngưỡng điểm, mùa, đồng ý, nội dung) vẫn ở CSDL khi mở bàn chơi.
 *
 * - `resume`: có lượt đang dở ở một màn trong mùa hiện tại → mở đúng màn đó (R08.7: lượt dở luôn được tiếp tục).
 * - `replay`: đã hoàn thành lượt tính điểm của MỌI màn trong mùa → chơi lại cho vui (không cộng/trừ điểm, R08.6).
 * - `start`: còn màn chưa đi hết → vào màn đầu tiên chưa hoàn thành (cần đủ ngưỡng điểm để BẮT ĐẦU lượt tính điểm mới).
 */
export type MazeRunSummary = { levelKey: string; status: string; scored: boolean; seasonId: string };

export function mazeEntry(
  levelKeys: readonly string[],
  runs: readonly MazeRunSummary[],
  activeSeasonId: string | null,
): MazeEntryDto {
  if (levelKeys.length === 0) return { mode: "start", level: 1 };
  const inSeason = activeSeasonId === null ? [] : runs.filter((run) => run.seasonId === activeSeasonId);

  const resumeIndex = levelKeys.findIndex((key) =>
    inSeason.some((run) => run.levelKey === key && run.status === "in_progress"),
  );
  if (resumeIndex >= 0) return { mode: "resume", level: resumeIndex + 1 };

  const unfinished = levelKeys.findIndex(
    (key) => !inSeason.some((run) => run.levelKey === key && run.status === "completed" && run.scored),
  );
  if (unfinished < 0) return { mode: "replay", level: 1 };
  return { mode: "start", level: unfinished + 1 };
}

/** Học sinh vào được bàn chơi ngay bây giờ? Đủ điểm, hoặc đã có lượt dở / đã đi hết (khi đó ngưỡng không áp dụng). */
export function mazeEnterable(entry: MazeEntryDto, eligible: boolean): boolean {
  return eligible || entry.mode !== "start";
}
