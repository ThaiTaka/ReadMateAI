import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { VariantId } from "@/features/exercises/core/module";
import { runtimeOf } from "@/features/exercises/runtime-registry";
import { emptyResponseFor, isCompleteFor } from "@/features/scored-practice/ui/view-player";
import type { QuestionView } from "@/features/scored-practice/types";
import { vi } from "@/strings/vi";
import { demoItems } from "../exercises/helpers";

const ROOT = process.cwd();

function sources(dir: string) {
  return readdirSync(join(ROOT, dir), { withFileTypes: true, recursive: true })
    .filter((entry) => entry.isFile() && /\.(ts|tsx)$/u.test(entry.name))
    .map((entry) => {
      const path = join(entry.parentPath, entry.name);
      const text = readFileSync(path, "utf8")
        .replace(/\/\*[\s\S]*?\*\//gu, "")
        .replace(/^\s*\/\/.*$/gmu, "");
      return { path, text };
    });
}

describe("giao diện có điểm: chỉ nói chuyện với student gateway, không lưu ở trình duyệt", () => {
  const files = sources("src/features/scored-practice");

  it("không localStorage/sessionStorage/IndexedDB/cookie/WebSocket/sendBeacon; mọi fetch tới /api/student/", () => {
    expect(
      files
        .filter((file) =>
          /localStorage|sessionStorage|indexedDB|document\.cookie|WebSocket|sendBeacon/u.test(file.text),
        )
        .map((file) => file.path),
    ).toEqual([]);
    const calls = files.flatMap((file) => [...file.text.matchAll(/(?:fetch|call<[^>]+>)\(\s*([`"])([^`"]*)\1/gu)]);
    expect(calls.length).toBeGreaterThan(0);
    for (const match of calls) expect(match[2]).toMatch(/^\/api\/student\//u);
  });

  it("không chấm ở trình duyệt: không gọi grade/reveal/hints/correctResponse", () => {
    for (const file of files.filter((entry) => entry.path.includes(`${join("scored-practice", "ui")}`))) {
      expect(file.text).not.toMatch(/\.grade\(|\.reveal\(|\.hints\(|correctResponse/u);
    }
  });

  it("bộ lập buổi luyện thuần: không Math.random/Date.now", () => {
    const planner = files.find((file) => file.path.endsWith("planner.ts"))!;
    expect(planner.text).not.toMatch(/Math\.random|Date\.now|new Date/u);
  });
});

describe("emptyResponse/isComplete chạy được với `view` (không cần đáp án)", () => {
  const variants: VariantId[] = [
    "picture_onset",
    "visual_match",
    "picture_build",
    "which_rime",
    "find_with_unit",
    "missing_rime",
    "choose_picture",
    "match_pairs",
    "sentence_picture",
    "comprehension_question",
    "arrange_words",
  ];
  for (const variant of variants) {
    it(variant, () => {
      const item = demoItems(variant, "extending")[0]!;
      const view = { type: item.type, variant: item.variant, content: item.content } as QuestionView;
      const runtime = runtimeOf(item);
      expect(emptyResponseFor(view)).toEqual(runtime.emptyResponse(item));
      const correct = runtime.correctResponse(item);
      expect(isCompleteFor(view, correct)).toBe(runtime.isComplete(item, correct));
      expect(isCompleteFor(view, emptyResponseFor(view))).toBe(false);
    });
  }
});

describe("câu chữ điểm thưởng tích cực, trung tính khi trừ (CLAUDE.md §7.10)", () => {
  it("không có từ gây xấu hổ/phạt", () => {
    const text = JSON.stringify([
      vi.scoredPractice,
      vi.learnMe.score,
      vi.learnMe.practice,
      vi.learnMe.map,
      vi.learnMe.games,
    ]);
    expect(text).not.toMatch(/thua|kém|cuối bảng|phạt|tệ|dốt|sai rồi/iu);
    expect(text).not.toMatch(/ở lớp|tại lớp|trên lớp|phiếu/iu);
    expect(vi.scoredPractice.practiceOnly).toBe("Câu luyện thêm – Không tính điểm");
    expect(vi.gameWorld.inDevelopment).toBe("Mini-game đang phát triển");
  });
});
