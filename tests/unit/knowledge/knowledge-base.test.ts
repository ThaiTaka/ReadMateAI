import { readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DEFAULT_KNOWLEDGE_DATA, KNOWLEDGE_BASE as kb } from "@/features/knowledge/default-kb";
import { loadKnowledgeBase } from "@/features/knowledge/load";
import { buildPrerequisiteGraph, findCycle, structuralEdges } from "@/features/knowledge/prerequisites";
import { diagnoseSyllable } from "@/lib/vietnamese/diagnostics";
import { syllableTokens } from "@/lib/vietnamese/tokenize";

describe("kho tri thức nạp được và có kiểu rõ ràng", () => {
  it("nạp thành công từ content/ với phiên bản dữ liệu", () => {
    expect(kb.datasetVersion).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("mọi tệp bộ bài và hồ sơ trong content/curriculum đều được đăng ký trong default-kb", () => {
    const onDisk = (dir: string) =>
      readdirSync(join(process.cwd(), "content", "curriculum", dir))
        .filter((name) => name.endsWith(".json"))
        .map((name) => `curriculum/${dir}/${name}`)
        .sort();
    expect(DEFAULT_KNOWLEDGE_DATA.series.map(([path]) => path).sort()).toEqual(onDisk("series"));
    expect(DEFAULT_KNOWLEDGE_DATA.profiles.map(([path]) => path).sort()).toEqual(onDisk("profiles"));
  });

  it("dữ liệu sai lược đồ bị từ chối khi nạp, không bị bỏ qua", () => {
    const broken = { ...DEFAULT_KNOWLEDGE_DATA, kb: { ...DEFAULT_KNOWLEDGE_DATA.kb, tones: { kind: "tones" } } };
    const result = loadKnowledgeBase(broken);
    expect(result.ok).toBe(false);
    expect(!result.ok && result.issues.some((issue) => issue.file === "kb/tones.json")).toBe(true);
  });
});

describe("bảng chữ cái: tên chữ và cách gọi âm là hai trường riêng", () => {
  it("29 chữ cái, chữ thường/chữ hoa, đúng thứ tự", () => {
    expect(kb.letters).toHaveLength(29);
    expect(kb.letters.map((letter) => letter.upper).join("")).toBe("AĂÂBCDĐEÊGHIKLMNOÔƠPQRSTUƯVXY");
  });

  it.each([
    ["b", "bê", "bờ"],
    ["c", "xê", "cờ"],
    ["d", "dê", "dờ"],
    ["g", "giê", "gờ"],
    ["h", "hát", "hờ"],
    ["l", "e-lờ", "lờ"],
    ["s", "ét-xì", "sờ"],
  ])("chữ %s: tên chữ cái “%s” khác cách gọi âm khi đánh vần “%s”", (letter, name, label) => {
    const entry = kb.letters.find((item) => item.lower === letter);
    const phoneme = kb.phonemes.find((item) => item.text === letter);
    expect(entry?.name.proposed).toBe(name);
    expect(phoneme?.teachingLabel.proposed).toBe(label);
  });

  it("chữ q không có âm riêng: chỉ xuất hiện trong tổ hợp qu", () => {
    expect(kb.phonemes.some((phoneme) => phoneme.text === "q")).toBe(false);
    expect(kb.phonemes.find((phoneme) => phoneme.text === "qu")?.letters).toEqual(["letter:q", "letter:u"]);
  });
});

describe("chữ ghi âm và tổ hợp chữ", () => {
  it.each(["ch", "gh", "gi", "kh", "ng", "nh", "ph", "qu", "th", "tr"])("%s là tổ hợp hai chữ, làm âm đầu", (text) => {
    const phoneme = kb.phonemes.find((item) => item.text === text);
    expect(phoneme).toMatchObject({ graphemeType: "digraph", phonemeClass: "consonant" });
    expect(phoneme?.positions).toContain("onset");
  });

  it("ngh là tổ hợp ba chữ", () => {
    expect(kb.phonemes.find((item) => item.text === "ngh")).toMatchObject({
      graphemeType: "trigraph",
      letters: ["letter:n", "letter:g", "letter:h"],
    });
  });

  it("c/k, g/gh, ng/ngh, i/y được nhóm theo âm và gắn quy tắc chính tả", () => {
    const group = (soundGroup: string) =>
      kb.phonemes.filter((phoneme) => phoneme.soundGroup === soundGroup).map((phoneme) => phoneme.text);
    expect(group("k")).toEqual(["c", "k"]);
    expect(group("g")).toEqual(["g", "gh"]);
    expect(group("ng")).toEqual(["ng", "ngh"]);
    expect(group("i")).toEqual(["i", "y"]);
  });

  it("ch, ng, nh vừa làm âm đầu vừa làm âm cuối", () => {
    for (const text of ["ch", "ng", "nh"]) {
      expect(kb.phonemes.find((item) => item.text === text)?.positions).toEqual(["onset", "coda"]);
    }
  });
});

describe("thanh, vần, quy tắc", () => {
  it("chỉ thanh sắc và nặng đi được với âm cuối p, t, c, ch", () => {
    expect(kb.tones.filter((tone) => tone.allowedWithStopCoda).map((tone) => tone.toneId)).toEqual(["sac", "nang"]);
  });

  it("danh mục vần đủ lớn và khai báo cấu tạo tường minh", () => {
    expect(kb.rimes.length).toBeGreaterThanOrEqual(150);
    const oan = kb.rimes.find((rime) => rime.text === "oan");
    expect(oan).toMatchObject({ medial: "o", nucleus: "a", coda: "n" });
  });

  it("mọi quy tắc 'established' có ví dụ sai để tự kiểm thử", () => {
    for (const rule of kb.rules.filter((item) => item.certainty === "established")) {
      expect(rule.counterExamples.length).toBeGreaterThan(0);
    }
  });

  it("quy ước (qu, gi, kiểu đặt dấu) được đánh dấu là convention, không phải quy tắc chắc chắn", () => {
    const conventions = kb.rules.filter((rule) => rule.certainty === "convention").map((rule) => rule.id);
    expect(conventions).toEqual(["tone.placement_style", "syllable.qu_onset", "syllable.gi_onset"]);
  });
});

describe("quan hệ tiên quyết", () => {
  it("suy ra theo cấu tạo: vần an cần âm a và âm n; âm ngh cần chữ n, g, h", () => {
    const edges = structuralEdges(kb);
    const targets = (from: string) => edges.filter((edge) => edge.from === from).map((edge) => edge.to);
    expect(targets("rime:an")).toEqual(["phoneme:a", "phoneme:n"]);
    expect(targets("rime:ươn")).toEqual(["phoneme:ư", "phoneme:ơ", "phoneme:n"]);
    expect(targets("phoneme:ngh")).toEqual(["letter:n", "letter:g", "letter:h"]);
  });

  it("gộp cạnh khai báo (gh sau g) và không có vòng lặp", () => {
    const { graph } = buildPrerequisiteGraph(kb);
    expect(graph.get("phoneme:gh")?.has("phoneme:g")).toBe(true);
    expect(findCycle(graph)).toBeNull();
  });

  it("findCycle phát hiện vòng lặp và trả về đường đi khép kín", () => {
    const graph = new Map([
      ["a", new Set(["b"])],
      ["b", new Set(["c"])],
      ["c", new Set(["a"])],
    ]);
    expect(findCycle(graph)).toEqual(["a", "b", "c", "a"]);
  });
});

describe("ngữ liệu: tiếng, từ, câu", () => {
  it("quy mô ngữ liệu minh họa trong khoảng 100–150 mục", () => {
    const total = kb.syllables.length + kb.words.length + kb.sentences.length;
    expect(total).toBeGreaterThanOrEqual(100);
    expect(total).toBeLessThanOrEqual(150);
  });

  it("KHÔNG có mục nào được duyệt sẵn: nội dung do AI soạn phải chờ giáo viên", () => {
    for (const item of [...kb.syllables, ...kb.words, ...kb.sentences]) {
      expect(item.review.status).not.toBe("approved");
    }
    for (const meta of Object.values(kb.fileMeta)) expect(meta.review.status).not.toBe("approved");
    for (const series of kb.series) expect(series.review.status).not.toBe("approved");
  });

  it.each(kb.syllables.filter((item) => item.expected !== null).map((item) => [item.text, item.expected] as const))(
    "ngân hàng tiếng: “%s” khớp phân tích đã khai báo",
    (text, expected) => {
      const analysis = diagnoseSyllable(text, kb.inventory).analysis;
      expect({ onset: analysis?.onset, rime: analysis?.rime, tone: analysis?.tone }).toEqual(expected);
    },
  );

  it("tiếng chưa phân tích chắc chắn (expected = null) thì bộ máy cũng không kết luận", () => {
    for (const item of kb.syllables.filter((entry) => entry.expected === null)) {
      expect(diagnoseSyllable(item.text, kb.inventory).status).toBe("unverified");
    }
  });

  it("mọi tiếng trong từ và câu viết đúng chính tả theo quy tắc chắc chắn", () => {
    for (const item of [...kb.words, ...kb.sentences]) {
      for (const token of syllableTokens(item.text)) {
        expect(diagnoseSyllable(token.text, kb.inventory).status, `${item.id}: ${token.text}`).not.toBe("error");
      }
    }
  });

  it("từ chỉ dùng chủ đề đã khai báo và có độ quen thuộc ước lượng", () => {
    const topics = new Set(kb.topics.map((topic) => topic.id));
    for (const word of kb.words) {
      expect(word.topics.every((topic) => topics.has(topic))).toBe(true);
      expect(["everyday", "common", "less_common"]).toContain(word.familiarity);
    }
  });

  it("câu viết hoa chữ đầu và có dấu kết thúc", () => {
    for (const sentence of kb.sentences) expect(sentence.text).toMatch(/^\p{Lu}.*[.!?]$/u);
  });
});
