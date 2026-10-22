/**
 * FIXTURE KIỂM THỬ R08.2 — câu bài tập HƯ CẤU chỉ dùng trên Supabase LOCAL để kiểm thử phân bổ 7 chạm trán × 21 câu.
 *
 * Không phải học liệu thật: kho tri thức `content/` vẫn có 0 mục đã duyệt (CLAUDE.md §9.2.3) nên lượt chơi thật ở
 * production luôn trả INSUFFICIENT_CONTENT. Bộ này dùng chuỗi bài kiểm thử RIÊNG (không đụng bộ R04), gắn
 * origin = test_fixture; CSDL chỉ nhận/phát khi private.test_environment.fixtures_allowed bật (chỉ script local bật).
 * Không được cài bởi `db:seed` — chỉ bộ kiểm thử tích hợp cài khi cần. Cùng dạng bài `visual_match` như bộ R04.
 */
import { fixtureItem, type FixtureExercise } from "./scoring-items.ts";

export const GAME_FIXTURE_SERIES_KEY = "series:test-fixture-r08";
export const GAME_FIXTURE_TAG = "fixture:r08-game";

const POOL = "abcdeghklmnopqrstuvxy".split("");

/** Thông số thứ `index`: chữ mẫu + hai chữ gây nhiễu, đôi một khác nhau (kể cả khi vòng lại bảng chữ). */
function spec(index: number) {
  const round = Math.floor(index / POOL.length);
  const sample = POOL[index % POOL.length]!;
  const d1 = POOL[(index + 3 + 2 * round) % POOL.length]!;
  const d2 = POOL[(index + 7 + 3 * round) % POOL.length]!;
  return { sample, distractors: [d1, d2] as [string, string] };
}

const items = Array.from({ length: 40 }, (_, index) => fixtureItem(spec(index), index, index % 3, ".r08"));

/** Số nội dung KHÁC NHAU phát được cho Nhóm 2/1 ở bài 2 (bài 1: 24 + bài 2: 8), không tính bản sao/chưa học/chưa duyệt. */
export const GAME_FIXTURE_DISTINCT_ELIGIBLE = 32;
/** Nhóm 3 (đến bài trước = bài 1): 24 nội dung khác nhau — đủ 21. */
export const GAME_FIXTURE_DISTINCT_FOUNDATION = 24;

export const GAME_FIXTURE_EXERCISES: readonly FixtureExercise[] = [
  {
    key: "fixture:r08:letters-a",
    title: "Kiểm thử R08.2 — bài 1 A",
    lessonOrdinal: 1,
    status: "approved",
    items: items.slice(0, 12),
  },
  {
    key: "fixture:r08:letters-b",
    title: "Kiểm thử R08.2 — bài 1 B",
    lessonOrdinal: 1,
    status: "approved",
    items: items.slice(12, 24),
  },
  {
    key: "fixture:r08:letters-c",
    title: "Kiểm thử R08.2 — bài 2",
    lessonOrdinal: 2,
    status: "approved",
    items: items.slice(24, 32),
  },
  {
    // CÙNG nội dung với câu đầu tiên nhưng mã câu và thứ tự phương án khác — chống trùng vân tay.
    key: "fixture:r08:duplicate",
    title: "Kiểm thử R08.2 — bản sao nội dung",
    lessonOrdinal: 1,
    status: "approved",
    items: [fixtureItem(spec(0), 0, 2, ".r08.seed-khac")],
  },
  {
    key: "fixture:r08:not-yet-taught",
    title: "Kiểm thử R08.2 — chưa học",
    lessonOrdinal: 3,
    status: "approved",
    items: items.slice(32, 36),
  },
  {
    key: "fixture:r08:unreviewed",
    title: "Kiểm thử R08.2 — chưa duyệt",
    lessonOrdinal: 1,
    status: "in_review",
    items: items.slice(36, 40),
  },
];
