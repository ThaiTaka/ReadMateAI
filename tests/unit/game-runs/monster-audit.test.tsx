import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { LEGACY_MONSTER_KEYS, MONSTER_KEYS } from "../../../src/features/game-runs/monsters";
import { auditMonsterTexts, type MonsterTextEntry } from "../../../src/features/game-runs/monster-audit";
import { containsForm } from "../../../src/features/exercises/core/leaks";
import { moduleOf } from "../../../src/features/exercises/registry";
import type { ExerciseItem } from "../../../src/features/exercises/items";
import type { VariantId } from "../../../src/features/exercises/core/module";
import { toPublicQuestion } from "../../../src/server/question-instances/service";
import type { Json } from "../../../src/lib/supabase/database.types";
import { KNOWLEDGE_BASE } from "../../../src/features/knowledge/default-kb";
import {
  canonicalMonsterKey,
  monsterHue,
  monsterName,
  publicMonsterKey,
} from "../../../src/features/game-engine/ui/encounter/monster-catalog";
import { MonsterView } from "../../../src/features/game-engine/ui/encounter/monster-view";
import { validateMediaLicenses } from "../../../src/features/media/license-validation";
import { vi } from "../../../src/strings/vi";
import { demoItems } from "../exercises/helpers";

/**
 * R08.5 — Soát quái vật: tên/nhãn/lời thoại/thuộc tính HTML không được gợi đáp án; mã trung tính; giấy phép; hồ sơ GV chưa duyệt.
 * Dùng dữ liệu minh họa (chế độ demo), không tự duyệt học liệu thật. So khớp tự động chỉ là một lớp kiểm — kết luận cuối do GV.
 */

const ROOT = process.cwd();
const BANDS = ["extending", "developing", "foundation"] as const;
const VARIANT_LIST: VariantId[] = [
  "picture_onset",
  "visual_match",
  "which_rime",
  "find_with_unit",
  "missing_rime",
  "choose_picture",
  "match_pairs",
  "sentence_picture",
  "comprehension_question",
  "arrange_words",
];

const allItems: ExerciseItem[] = VARIANT_LIST.flatMap((variant) =>
  BANDS.flatMap((band) => {
    try {
      return demoItems(variant, band);
    } catch {
      return [];
    }
  }),
);
const auditedItems = allItems.map((item, index) => ({
  id: `${item.variant}#${index}`,
  forbiddenForms: moduleOf(item)
    .textExposure(item)
    .forbidden.map((entry) => entry.form),
}));

/** Mọi tiếng của kho học liệu (từ, tiếng, câu, vần, âm, chữ), chữ thường NFC. */
function lexiconOf(kb: typeof KNOWLEDGE_BASE): Set<string> {
  const out = new Set<string>();
  const add = (text: unknown) => {
    if (typeof text !== "string") return;
    for (const part of text
      .normalize("NFC")
      .toLowerCase()
      .split(/[^\p{L}]+/u))
      if (part) out.add(part);
  };
  for (const list of [kb.words, kb.syllables, kb.sentences, kb.rimes, kb.phonemes, kb.letters]) {
    for (const entry of list as unknown as Record<string, unknown>[]) {
      for (const field of ["text", "syllable", "form", "symbol", "name", "rime", "letter"]) add(entry[field]);
    }
  }
  return out;
}
const lexicon = lexiconOf(KNOWLEDGE_BASE);

/** Mọi chữ quái vật có thể hiện/đọc TRƯỚC khi câu đóng (tên, nhãn trợ năng, lời dẫn) — kèm vị trí nguồn. */
function monsterEntries(keys: readonly string[]): MonsterTextEntry[] {
  const entries: MonsterTextEntry[] = [];
  for (const key of keys) {
    const name = vi.monsters[key] ?? "";
    entries.push({ where: `src/strings/vi.ts#monsters.${key}`, kind: "name", text: name });
    entries.push({
      where: `vi.encounter.monsterLabel (${key})`,
      kind: "label",
      text: vi.encounter.monsterLabel.replace("{name}", name),
    });
    entries.push({
      where: `vi.encounter.dialogLabel (${key})`,
      kind: "label",
      text: vi.encounter.dialogLabel.replace("{name}", name),
    });
  }
  const lines: [string, string][] = [
    ["encounter.preparing", vi.encounter.preparing],
    ["encounter.hearts", vi.encounter.hearts.replace("{n}", "2").replace("{total}", "3")],
    ["encounter.saveFailedText", vi.encounter.saveFailedText],
    ["encounter.activateFailedText", vi.encounter.activateFailedText],
    ["encounter.pauseText", vi.encounter.pauseText],
    ["monsterFallback", vi.monsterFallback],
    ["gameWorld.monsterLine", vi.gameWorld.monsterLine],
  ];
  for (const [where, text] of lines) entries.push({ where: `src/strings/vi.ts#${where}`, kind: "line", text });
  return entries;
}

afterEach(cleanup);

describe("R08.5 — danh mục quái vật", () => {
  it("10 mã duy nhất, hợp hình dạng CSDL, mỗi mã có tên + màu riêng, không dùng tên chung", () => {
    expect(new Set(MONSTER_KEYS).size).toBe(10);
    const names = new Set<string>();
    const hues = new Set<number>();
    for (const key of MONSTER_KEYS) {
      expect(key).toMatch(/^[a-z0-9][a-z0-9_-]{1,47}$/);
      const name = monsterName(key);
      expect(name).not.toBe(vi.monsterFallback);
      expect(name).toBe(vi.monsters[key]);
      names.add(name);
      hues.add(monsterHue(key));
    }
    expect(names.size).toBe(10);
    expect(hues.size).toBe(10);
    expect(Object.keys(vi.monsters).sort()).toEqual([...MONSTER_KEYS].sort());
  });

  it("mã lạ dùng tên chung và màu mặc định, không lấy chữ từ mã, không đưa ra DOM", () => {
    expect(publicMonsterKey("mon-sao-nho")).toBe("mon-03");
    expect(publicMonsterKey("mon-x-lạ")).toBe("mon-00");
    expect(monsterName("mon-x-lạ")).toBe(vi.monsterFallback);
    expect(monsterHue("khong-co")).toBe(0);
  });

  it("mã cũ (R08.2–R08.4) của lượt chơi đang dở đổi sang cùng quái vật mới, không còn tên cũ", () => {
    expect(Object.keys(LEGACY_MONSTER_KEYS)).toHaveLength(10);
    for (const [legacy, current] of Object.entries(LEGACY_MONSTER_KEYS)) {
      expect(MONSTER_KEYS).toContain(current);
      expect(canonicalMonsterKey(legacy)).toBe(current);
      expect(monsterName(legacy)).toBe(vi.monsters[current]);
      expect(MONSTER_KEYS as readonly string[]).not.toContain(legacy);
    }
  });

  it("mã không chứa tiếng/từ của kho học liệu (mã nằm trong thuộc tính HTML)", () => {
    for (const key of MONSTER_KEYS) {
      for (const part of key.split("-")) expect(lexicon.has(part)).toBe(false);
    }
  });
});

describe("R08.5 — bộ soát chữ quái vật", () => {
  it("có dữ liệu để soát: đủ câu minh họa với dạng đáp án bị cấm", () => {
    expect(allItems.length).toBeGreaterThanOrEqual(30);
    expect(auditedItems.some((item) => item.forbiddenForms.length > 0)).toBe(true);
    expect(lexicon.size).toBeGreaterThan(100);
  });

  it("tên, nhãn trợ năng và lời thoại hiện tại: không lộ đáp án câu nào, không trùng/gần tiếng của kho", () => {
    const findings = auditMonsterTexts({
      entries: monsterEntries(MONSTER_KEYS),
      items: auditedItems,
      lexicon,
    });
    expect(findings).toEqual([]);
  });

  it("bắt lộ trực tiếp: tên trùng dạng đáp án của câu là lỗi, có vị trí nguồn", () => {
    const [item] = auditedItems.filter((candidate) => candidate.forbiddenForms.length > 0);
    const form = item!.forbiddenForms[0]!;
    const findings = auditMonsterTexts({
      entries: [{ where: "vi.ts#monsters.mon-test", kind: "name", text: `Bé ${form.toUpperCase()}` }],
      items: [item!],
      lexicon: new Set(),
    });
    const leak = findings.find((finding) => finding.code === "MONSTER_TEXT_LEAKS_ANSWER");
    expect(leak?.severity).toBe("error");
    expect(leak?.where).toBe("vi.ts#monsters.mon-test");
    expect(leak?.message).toContain(form);
  });

  it("bắt cả nhãn trợ năng (không chỉ chữ nhìn thấy)", () => {
    const findings = auditMonsterTexts({
      entries: [{ where: "aria-label", kind: "label", text: "Bạn quái vật hình con mèo" }],
      items: [{ id: "q", forbiddenForms: ["mèo"] }],
      lexicon: new Set(),
    });
    expect(findings.map((finding) => finding.code)).toEqual(["MONSTER_TEXT_LEAKS_ANSWER"]);
  });

  it("không báo nhầm chữ cái/âm đơn nằm trong tiếng khác (c ≠ cá)", () => {
    const findings = auditMonsterTexts({
      entries: [{ where: "x", kind: "line", text: "Cá bơi" }],
      items: [{ id: "q", forbiddenForms: ["c", "b"] }],
      lexicon: new Set(),
    });
    expect(findings).toEqual([]);
  });

  it("tên cũ của R08.4 bị bộ soát gắn cờ cảnh báo cho GV (ví dụ Cá Vàng, Mèo Ngủ, tiền tố Bé)", () => {
    const oldNames = ["Bé Cá Vàng", "Bé Mèo Ngủ", "Bé Sao Nhỏ"];
    const findings = auditMonsterTexts({
      entries: oldNames.map((text, index) => ({ where: `old#${index}`, kind: "name", text })),
      items: [],
      lexicon,
    });
    const flagged = new Set(findings.map((finding) => finding.where));
    expect(flagged.size).toBe(3);
    expect(findings.every((finding) => finding.severity === "warning")).toBe(true);
    expect(findings.some((finding) => finding.message.includes('"mèo"'))).toBe(true);
    expect(findings.some((finding) => finding.message.includes('"bé"'))).toBe(true);
  });

  it("chuẩn hóa Unicode: dạng tổ hợp vẫn bị bắt; chữ chưa NFC hoặc khoảng trắng thừa bị báo", () => {
    const decomposed = "ca" + String.fromCharCode(0x301); // "cá" dạng tổ hợp
    const findings = auditMonsterTexts({
      entries: [{ where: "x", kind: "name", text: `${decomposed}  vàng` }],
      items: [{ id: "q", forbiddenForms: ["cá"] }],
      lexicon: new Set(),
    });
    const codes = findings.map((finding) => finding.code);
    expect(codes).toContain("MONSTER_TEXT_NOT_NORMALIZED");
    expect(codes).toContain("MONSTER_TEXT_LEAKS_ANSWER");
  });

  it("cảnh báo khác thanh, tên rỗng và tên trùng nhau", () => {
    const findings = auditMonsterTexts({
      entries: [
        { where: "a", kind: "name", text: "Ba" },
        { where: "b", kind: "name", text: "" },
        { where: "c", kind: "name", text: "Pu" },
        { where: "d", kind: "name", text: "pu" },
      ],
      items: [],
      lexicon: new Set(["bà"]),
    });
    expect(findings.find((finding) => finding.where === "a")?.code).toBe("MONSTER_NAME_SIMILAR_TO_LEARNING_UNIT");
    expect(findings.find((finding) => finding.where === "b")?.code).toBe("MONSTER_NAME_MISSING");
    expect(findings.find((finding) => finding.where === "d")?.code).toBe("MONSTER_NAME_DUPLICATE");
  });
});

describe("R08.5 — hình quái vật: không có chữ gợi đáp án ở bất kỳ thuộc tính nào", () => {
  it("mọi mã × mọi trạng thái: title/aria-label/alt/data-*/chữ không chứa dạng đáp án bị cấm", () => {
    const forbidden = [...new Set(auditedItems.flatMap((item) => item.forbiddenForms))];
    for (const key of [...MONSTER_KEYS, ...Object.keys(LEGACY_MONSTER_KEYS)]) {
      for (const mood of ["idle", "defeated", "undefeated"] as const) {
        const { container, unmount } = render(<MonsterView monsterKey={key} mood={mood} entrance />);
        const texts: string[] = [];
        for (const element of container.querySelectorAll("*")) {
          for (const attribute of element.getAttributeNames()) {
            if (attribute === "class" || attribute === "style" || attribute === "d" || attribute === "id") continue;
            texts.push(element.getAttribute(attribute) ?? "");
          }
          if (element.children.length === 0) texts.push(element.textContent ?? "");
        }
        for (const text of new Set(texts.filter(Boolean))) {
          const hit = forbidden.find((form) => containsForm(text, form));
          expect(hit, `${key}/${mood}: "${text}"`).toBeUndefined();
        }
        const root = container.querySelector('[data-testid="monster-view"]')!;
        expect(root.getAttribute("data-monster")).toBe(canonicalMonsterKey(key));
        expect(container.querySelector("svg")?.getAttribute("role")).toBe("img");
        expect(container.querySelector("svg")?.getAttribute("aria-label")).toBe(
          vi.encounter.monsterLabel.replace("{name}", monsterName(key)),
        );
        unmount();
      }
    }
  }, 60_000);
});

describe("R08.5 — câu trong chạm trán: đáp án chỉ ra sau khi câu đóng", () => {
  const row = (item: ExerciseItem, patch: Record<string, unknown> = {}) =>
    ({
      id: "00000000-0000-4000-8000-000000000001",
      student_id: "00000000-0000-4000-8000-000000000002",
      season_id: "00000000-0000-4000-8000-000000000003",
      practice_session_id: null,
      game_encounter_id: "00000000-0000-4000-8000-000000000009",
      position: 1,
      exercise_item_id: "00000000-0000-4000-8000-000000000005",
      view: { type: item.type, variant: item.variant, content: item.content } as unknown as Json,
      status: "open",
      attempts_used: 0,
      max_attempts: 3,
      support_level: 3,
      scorable: true,
      ...patch,
    }) as Parameters<typeof toPublicQuestion>[0];

  it("câu mở không có answer/reveal/nhãn dữ liệu ẩn; câu đóng mới có reveal", () => {
    for (const variant of VARIANT_LIST) {
      const item = demoItems(variant, "extending")[0]!;
      const open = toPublicQuestion(row(item), item, [], 8);
      expect(open.reveal).toBeNull();
      expect(JSON.stringify(open)).not.toMatch(/"answer"|"correctIds"|"pictureNames?"|"distractorTags"|"explanation"/u);
      const wrong = { attempt_no: 1, is_correct: false, error_tags: [], marks: {}, response: {} };
      const closed = toPublicQuestion(row(item, { status: "exhausted", attempts_used: 3 }), item, [wrong], 8);
      expect(closed.reveal).not.toBeNull();
    }
  });
});

describe("R08.5 — hoạt cảnh: không nhấp nháy, tôn trọng giảm chuyển động", () => {
  const tokens = readFileSync(join(ROOT, "src/styles/tokens.css"), "utf8");
  const globals = readFileSync(join(ROOT, "src/app/globals.css"), "utf8");

  it("ba hoạt cảnh quái vật chạy một lần (không lặp vô hạn) và mỗi lần ≥ 1 giây hoặc là hiện dần", () => {
    for (const name of ["monster-in", "monster-spin", "monster-away"]) {
      const line = tokens.split("\n").find((entry) => entry.includes(`--animate-${name}:`));
      expect(line, name).toBeTruthy();
      expect(line).not.toMatch(/infinite/u);
      expect(line).toMatch(/both/u);
    }
  });

  it("công tắc Giảm chuyển động và prefers-reduced-motion dừng mọi hoạt cảnh", () => {
    expect(globals).toMatch(/@media \(prefers-reduced-motion: reduce\)/u);
    expect(globals).toMatch(/\[data-motion="reduce"\][\s\S]*animation: none !important/u);
  });
});

describe("R08.5 — giấy phép và trạng thái duyệt của hình quái vật", () => {
  const raw = readFileSync(join(ROOT, "content/media/licenses.json"), "utf8");
  const { issues, assets } = validateMediaLicenses(raw, (path) => {
    try {
      readFileSync(join(ROOT, path));
      return true;
    } catch {
      return false;
    }
  });

  it("danh mục giấy phép hợp lệ, mọi đường dẫn tồn tại", () => {
    expect(issues.filter((issue) => issue.severity === "error")).toEqual([]);
  });

  it("hình quái vật và hoạt cảnh có dòng giấy phép với tác giả, nguồn, quyền và mục đích; đều chờ GV duyệt", () => {
    for (const id of ["art.character.friendly-monster", "art.animation.monster-encounter"]) {
      const asset = assets.find((entry) => entry.id === id);
      expect(asset, id).toBeTruthy();
      expect(asset!.author.length).toBeGreaterThan(10);
      expect(asset!.source.length).toBeGreaterThan(10);
      expect(asset!.license.length).toBeGreaterThan(10);
      expect(asset!.usage).toMatch(/chạm trán|quái vật/u);
      expect(asset!.paths.length).toBeGreaterThan(0);
      expect(asset!.review.status).toBe("pending_review");
      expect(asset!.review.teacherReviewed).toBe(false);
      expect(asset!.review.reviewedBy).toBeNull();
      expect(asset!.review.reviewedAt).toBeNull();
    }
  });

  it("dòng giấy phép của quái vật không nhắc tới nguồn thương mại/ảnh tìm kiếm", () => {
    const monsterText = JSON.stringify(assets.filter((entry) => /monster/u.test(entry.id)));
    expect(monsterText).not.toMatch(/google|disney|nintendo|pokemon|pokémon/iu);
  });
});

describe("R08.5 — hồ sơ GV (docs/reviews/R08_MONSTER_REVIEW.md) chưa có đánh giá giả", () => {
  const doc = readFileSync(join(ROOT, "docs/reviews/R08_MONSTER_REVIEW.md"), "utf8");

  it("có đủ 7 tiêu chí, mỗi tiêu chí đang là 'Chưa đánh giá'", () => {
    for (const criterion of [
      "Hình ảnh phù hợp học sinh lớp 1",
      "Quái vật không gây sợ hãi",
      "Tên gọi dễ hiểu",
      "Lời thoại thân thiện",
      "Không vô tình gợi đáp án",
      "Hoạt cảnh nhẹ nhàng",
      "Có thể đưa vào sử dụng thật",
    ]) {
      expect(doc).toContain(`| ${criterion} | Chưa đánh giá |`);
    }
  });

  it("phần xác nhận chính thức để trống và không tuyên bố GV đã duyệt", () => {
    expect(doc).toMatch(/Họ tên giáo viên:\s*_{3,}/u);
    expect(doc).toMatch(/Ngày xem xét:\s*_{3,}/u);
    expect(doc).toMatch(/Kết luận:\s*☐ Đồng ý\s+☐ Cần chỉnh sửa\s+☐ Chưa đồng ý/u);
    expect(doc).not.toMatch(/teacherReviewed:\s*true|review:\s*approved|☑|\[x\]/iu);
    expect(doc).not.toMatch(/giáo viên đã duyệt/iu);
  });

  it("nêu mọi tên quái vật hiện hành", () => {
    for (const key of MONSTER_KEYS) expect(doc).toContain(vi.monsters[key]!);
  });
});
