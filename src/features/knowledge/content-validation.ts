import { createHash } from "node:crypto";
import { VIETNAMESE_ALPHABET, isVowelLetter } from "../../lib/vietnamese/characters.ts";
import { diagnoseSyllable, ENGINE_DIAGNOSTIC_CODES, ENGINE_RULE_IDS } from "../../lib/vietnamese/diagnostics.ts";
import { estimateDifficulty } from "../../lib/vietnamese/difficulty.ts";
import { inspectText, isNFC, toLowerVi } from "../../lib/vietnamese/normalize.ts";
import { SPELLING_RULE_SPECS, STOP_CODA_ALLOWED_TONES } from "../../lib/vietnamese/spelling-rules.ts";
import type { SyllableAnalysis } from "../../lib/vietnamese/syllable.ts";
import { syllableTokens, tokenize } from "../../lib/vietnamese/tokenize.ts";
import { applyTone, TONE_COMBINING_MARKS, TONE_IDS } from "../../lib/vietnamese/tone.ts";
import { unitsIntroducedThrough } from "./curriculum.ts";
import {
  KB_FILES,
  loadKnowledgeBase,
  MANIFEST_FILE,
  PROFILES_DIR,
  provenanceOf,
  SERIES_DIR,
  type FileMeta,
  type KbFileKey,
  type KnowledgeBase,
} from "./load.ts";
import { buildPrerequisiteGraph, findCycle } from "./prerequisites.ts";
import type { Provenance, Review, ReviewStatus } from "./schema.ts";

/**
 * Bộ kiểm tra nội dung (`npm run content:check`). CHỈ chạy trong Node (dùng node:crypto) —
 * không import vào mã giao diện.
 *
 * Mức độ:
 * - `error`: sai chắc chắn (JSON/lược đồ, ID trùng, không NFC, tham chiếu hỏng, vòng tiên quyết,
 *   lỗi chính tả theo quy tắc chắc chắn, duyệt không hợp lệ, dữ liệu cá nhân) → lệnh thoát mã 1.
 * - `warning`: cần đánh giá chuyên môn của giáo viên (quy ước chưa xác nhận, tiếng chưa phân tích
 *   được, nội dung chờ duyệt, độ khó lệch…) → không chặn build nhưng phải rà soát.
 * - `info`: thông tin thống kê.
 * Bộ kiểm tra KHÔNG tự sửa nội dung.
 */

export type Severity = "error" | "warning" | "info";
export type ContentIssue = { severity: Severity; code: string; file: string; itemId?: string; message: string };

export type ContentStats = {
  datasetVersion: string | null;
  letters: number;
  phonemes: number;
  multiLetterPhonemes: number;
  tones: number;
  rimes: number;
  rules: number;
  confusions: number;
  prerequisiteEdges: number;
  topics: number;
  syllables: number;
  words: number;
  sentences: number;
  series: number;
  profiles: number;
  /** Trạng thái duyệt của ngữ liệu (tiếng + từ + câu). */
  corpusReview: Record<ReviewStatus, number>;
  /** Trạng thái duyệt cấp tệp của dữ liệu tham chiếu. */
  fileReview: Partial<Record<KbFileKey, ReviewStatus>>;
};

export type ContentReport = { issues: ContentIssue[]; stats: ContentStats; errorCount: number; warningCount: number };

const FORBIDDEN_KEYS =
  /^(full_?name|ho_?ten|birth_?date|birthday|dob|date_?of_?birth|gender|sex|address|phone|email|parent_?name|guardian_?name|student_?(name|id)|ten_?hoc_?sinh)$/iu;
const PERSONAL_PATTERNS: ReadonlyArray<[string, RegExp]> = [
  ["địa chỉ email", /[\w.+-]+@[\w-]+\.[a-z]{2,}/iu],
  ["số điện thoại", /(?:\+84|\b0)(?:3|5|7|8|9)\d{8}\b/u],
  ["số định danh (9 hoặc 12 chữ số)", /\b\d{9}(?:\d{3})?\b/u],
];
const AI_REVIEWER = /\b(ai|claude|gpt|chatgpt|gemini|bot|llm|system|hệ thống|tự động)\b/iu;
const NUCLEI = new Set([
  "a",
  "ă",
  "â",
  "e",
  "ê",
  "i",
  "y",
  "o",
  "ô",
  "ơ",
  "u",
  "ư",
  "oo",
  "ia",
  "ya",
  "ua",
  "ưa",
  "iê",
  "yê",
  "uô",
  "ươ",
]);
const CODAS = new Set(["c", "ch", "m", "n", "ng", "nh", "p", "t", "i", "y", "o", "u"]);
const NUCLEI_WITHOUT_CODA = new Set(["ia", "ya", "ua", "ưa"]);
const NUCLEI_REQUIRING_CODA = new Set(["ă", "â", "oo", "iê", "yê", "uô", "ươ"]);
const MEDIAL_TARGETS: Readonly<Record<string, ReadonlySet<string>>> = {
  o: new Set(["a", "ă", "e"]),
  u: new Set(["y", "ya", "yê", "ê", "â", "ơ"]),
};
const REQUIRED_MULTI_LETTER = ["ch", "gh", "gi", "kh", "ng", "ngh", "nh", "ph", "qu", "th", "tr"];

/** SHA-256 của nội dung (bỏ trường `review`), khóa sắp xếp ổn định — dùng để gắn quyết định duyệt với nội dung. */
export function computeContentHash(value: unknown): string {
  const strip = (input: unknown): unknown => {
    if (Array.isArray(input)) return input.map(strip);
    if (input && typeof input === "object") {
      return Object.fromEntries(
        Object.entries(input as Record<string, unknown>)
          .filter(([key]) => key !== "review")
          .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
          .map(([key, inner]) => [key, strip(inner)]),
      );
    }
    return input;
  };
  return createHash("sha256")
    .update(JSON.stringify(strip(value)))
    .digest("hex");
}

/** Kiểm tra toàn bộ dữ liệu trong content/. `files`: đường dẫn tương đối (dấu /) → nội dung tệp. */
export function validateContent(files: ReadonlyMap<string, string>): ContentReport {
  const issues: ContentIssue[] = [];
  const add = (severity: Severity, code: string, file: string, message: string, itemId?: string) =>
    issues.push({ severity, code, file, message, ...(itemId ? { itemId } : {}) });

  // 1. Danh mục tệp
  const required = [MANIFEST_FILE, ...Object.values(KB_FILES)];
  for (const path of required) {
    if (!files.has(path)) add("error", "MISSING_FILE", path, "Thiếu tệp dữ liệu bắt buộc.");
  }
  const isCurriculumFile = (path: string, dir: string) =>
    path.startsWith(dir) && /^[a-z0-9-]+\.json$/u.test(path.slice(dir.length));
  for (const path of files.keys()) {
    // media/ (danh mục giấy phép asset, R02) có bộ kiểm tra riêng: src/features/media/license-validation.ts.
    const known =
      required.includes(path) ||
      isCurriculumFile(path, SERIES_DIR) ||
      isCurriculumFile(path, PROFILES_DIR) ||
      path === "media/licenses.json" ||
      // games/ (màn Mê cung, R07.3) có bộ kiểm riêng: src/features/game-engine/levels/.
      path.startsWith("games/");
    if (!known)
      add(
        "error",
        "UNEXPECTED_FILE",
        path,
        "Tệp không thuộc cấu trúc kho tri thức (xem docs/VIETNAMESE_ENGINE.md §2).",
      );
  }

  // 2. Mức tệp thô: BOM, NFC, cú pháp JSON, quét dữ liệu cá nhân và ký tự lạ
  const parsed = new Map<string, unknown>();
  for (const [path, raw] of files) {
    if (raw.charCodeAt(0) === 0xfeff) add("error", "BOM", path, "Tệp có BOM ở đầu — lưu lại dạng UTF-8 không BOM.");
    if (!isNFC(raw)) add("error", "NOT_NFC", path, "Nội dung tệp chưa ở dạng Unicode NFC.");
    try {
      const value: unknown = JSON.parse(raw);
      parsed.set(path, value);
      scanValue(value, path, "", add);
    } catch (error) {
      add("error", "JSON_SYNTAX", path, `JSON không hợp lệ: ${(error as Error).message}`);
    }
  }

  // 3. Lược đồ (zod)
  const seriesFiles = [...parsed.entries()].filter(([path]) => isCurriculumFile(path, SERIES_DIR));
  const profileFiles = [...parsed.entries()].filter(([path]) => isCurriculumFile(path, PROFILES_DIR));
  const load = loadKnowledgeBase({
    manifest: parsed.get(MANIFEST_FILE),
    kb: Object.fromEntries(Object.entries(KB_FILES).map(([key, path]) => [key, parsed.get(path)])) as Record<
      KbFileKey,
      unknown
    >,
    series: seriesFiles,
    profiles: profileFiles,
  });
  if (!load.ok) {
    for (const issue of load.issues) {
      if (!parsed.has(issue.file)) continue; // đã báo thiếu tệp/JSON hỏng
      add("error", "SCHEMA_INVALID", issue.file, `${issue.path || "(gốc)"}: ${issue.message}`);
    }
    return finish(issues, null);
  }
  const kb = load.kb;

  checkIdentifiers(kb, add);
  checkReferenceData(kb, add);
  checkRules(kb, add);
  checkPrerequisites(kb, add);
  checkCorpus(kb, add);
  checkReview(kb, add);
  checkCurriculum(kb, seriesFiles, profileFiles, add);

  return finish(issues, kb);
}

type Add = (severity: Severity, code: string, file: string, message: string, itemId?: string) => void;

function scanValue(value: unknown, file: string, path: string, add: Add): void {
  if (typeof value === "string") {
    for (const issue of inspectText(value)) add("error", `TEXT_${issue.code}`, file, `${path}: ${issue.message}`);
    for (const [label, pattern] of PERSONAL_PATTERNS) {
      if (pattern.test(value)) {
        add(
          "error",
          "PERSONAL_DATA_PATTERN",
          file,
          `${path}: có chuỗi giống ${label} — kho tri thức không được chứa dữ liệu cá nhân.`,
        );
      }
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((inner, index) => scanValue(inner, file, `${path}[${index}]`, add));
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, inner] of Object.entries(value as Record<string, unknown>)) {
      if (FORBIDDEN_KEYS.test(key)) {
        add(
          "error",
          "FORBIDDEN_FIELD",
          file,
          `${path}.${key}: trường dữ liệu cá nhân không được phép trong kho tri thức.`,
        );
      }
      scanValue(inner, file, path ? `${path}.${key}` : key, add);
    }
  }
}

function checkIdentifiers(kb: KnowledgeBase, add: Add): void {
  const seen = new Map<string, string>();
  const register = (id: string, file: string) => {
    const previous = seen.get(id);
    if (previous) add("error", "DUPLICATE_ID", file, `ID "${id}" bị trùng (đã có ở ${previous}).`, id);
    else seen.set(id, file);
  };
  kb.letters.forEach((item) => register(item.id, KB_FILES.letters));
  kb.phonemes.forEach((item) => register(item.id, KB_FILES.phonemes));
  kb.tones.forEach((item) => register(item.id, KB_FILES.tones));
  kb.rimes.forEach((item) => register(item.id, KB_FILES.rimes));
  kb.rules.forEach((item) => register(item.id, KB_FILES.rules));
  kb.confusions.forEach((item) => register(item.id, KB_FILES.confusions));
  kb.topics.forEach((item) => register(item.id, KB_FILES.topics));
  kb.syllables.forEach((item) => register(item.id, KB_FILES.syllables));
  kb.words.forEach((item) => register(item.id, KB_FILES.words));
  kb.sentences.forEach((item) => register(item.id, KB_FILES.sentences));
  kb.series.forEach((item) => register(item.id, SERIES_DIR));
  kb.profiles.forEach((item) => register(item.id, PROFILES_DIR));

  const expectId = (actual: string, expected: string, file: string) => {
    if (actual !== expected)
      add("error", "ID_MISMATCH", file, `ID "${actual}" không khớp nội dung (mong đợi "${expected}").`, actual);
  };
  kb.letters.forEach((item) => expectId(item.id, `letter:${item.lower}`, KB_FILES.letters));
  kb.phonemes.forEach((item) => expectId(item.id, `phoneme:${item.text}`, KB_FILES.phonemes));
  kb.tones.forEach((item) => expectId(item.id, `tone:${item.toneId}`, KB_FILES.tones));
  kb.rimes.forEach((item) => expectId(item.id, `rime:${item.text}`, KB_FILES.rimes));
  kb.syllables.forEach((item) => expectId(item.id, `syllable:${item.text}`, KB_FILES.syllables));
  kb.words.forEach((item) => expectId(item.id, `word:${item.text.replaceAll(" ", "-")}`, KB_FILES.words));

  for (const [file, items] of [
    [KB_FILES.syllables, kb.syllables],
    [KB_FILES.words, kb.words],
    [KB_FILES.sentences, kb.sentences],
  ] as const) {
    const texts = new Map<string, string>();
    for (const item of items) {
      const key = toLowerVi(item.text);
      const previous = texts.get(key);
      if (previous) add("error", "DUPLICATE_TEXT", file, `"${item.text}" trùng nội dung với ${previous}.`, item.id);
      else texts.set(key, item.id);
    }
  }
}

function unitUniverse(kb: KnowledgeBase): Set<string> {
  return new Set([
    ...kb.letters.map((item) => item.id),
    ...kb.phonemes.map((item) => item.id),
    ...kb.tones.map((item) => item.id),
    ...kb.rimes.map((item) => item.id),
  ]);
}

function checkReferenceData(kb: KnowledgeBase, add: Add): void {
  // Bảng chữ cái: đúng 29 chữ, đúng thứ tự, khớp thư viện ngôn ngữ.
  const lowers = kb.letters.map((letter) => letter.lower);
  if (lowers.join(",") !== VIETNAMESE_ALPHABET.join(",")) {
    add(
      "error",
      "ALPHABET_MISMATCH",
      KB_FILES.letters,
      `Bảng chữ cái phải gồm đúng 29 chữ theo thứ tự: ${VIETNAMESE_ALPHABET.join(" ")}.`,
    );
  }
  kb.letters.forEach((letter, index) => {
    if (letter.order !== index + 1)
      add(
        "error",
        "ALPHABET_MISMATCH",
        KB_FILES.letters,
        `Thứ tự của "${letter.lower}" phải là ${index + 1}.`,
        letter.id,
      );
    if (letter.upper !== letter.lower.toUpperCase())
      add(
        "error",
        "ALPHABET_MISMATCH",
        KB_FILES.letters,
        `Chữ hoa của "${letter.lower}" phải là "${letter.lower.toUpperCase()}".`,
        letter.id,
      );
    const expectedClass = isVowelLetter(letter.lower) ? "vowel" : "consonant";
    if (letter.letterClass !== expectedClass)
      add(
        "error",
        "ALPHABET_MISMATCH",
        KB_FILES.letters,
        `"${letter.lower}" phải được phân loại là ${expectedClass}.`,
        letter.id,
      );
  });

  // Thanh: đúng 6 thanh, dấu Unicode và quy tắc âm cuối khớp thư viện.
  const toneIds = kb.tones.map((tone) => tone.toneId).sort();
  if (toneIds.join(",") !== [...TONE_IDS].sort().join(",")) {
    add("error", "TONE_DATA_MISMATCH", KB_FILES.tones, "Phải có đúng 6 thanh: ngang, huyền, sắc, hỏi, ngã, nặng.");
  }
  for (const tone of kb.tones) {
    const mark = tone.toneId === "ngang" ? null : TONE_COMBINING_MARKS[tone.toneId];
    const expectedMark = mark === null ? null : `U+${mark.codePointAt(0)?.toString(16).toUpperCase().padStart(4, "0")}`;
    const expectedPosition = tone.toneId === "ngang" ? "none" : tone.toneId === "nang" ? "below" : "above";
    const problems = [
      tone.combiningMark !== expectedMark && `dấu Unicode phải là ${expectedMark ?? "null"}`,
      tone.markPosition !== expectedPosition && `vị trí dấu phải là ${expectedPosition}`,
      tone.example !== applyTone("a", tone.toneId, 0) && `ví dụ phải là "${applyTone("a", tone.toneId, 0)}"`,
      tone.allowedWithStopCoda !== STOP_CODA_ALLOWED_TONES.includes(tone.toneId) && "allowedWithStopCoda sai",
    ].filter(Boolean);
    if (problems.length > 0)
      add("error", "TONE_DATA_MISMATCH", KB_FILES.tones, `Thanh ${tone.toneId}: ${problems.join("; ")}.`, tone.id);
  }

  // Âm (chữ ghi âm)
  const letterIds = new Set(kb.letters.map((letter) => letter.id));
  const ruleIds = new Set(kb.rules.map((rule) => rule.id));
  for (const phoneme of kb.phonemes) {
    for (const letter of phoneme.letters) {
      if (!letterIds.has(letter))
        add(
          "error",
          "UNKNOWN_REFERENCE",
          KB_FILES.phonemes,
          `Âm "${phoneme.text}" tham chiếu chữ cái không tồn tại "${letter}".`,
          phoneme.id,
        );
    }
    const spelled = phoneme.letters.map((letter) => letter.replace(/^letter:/u, "")).join("");
    const length = Array.from(phoneme.text).length;
    const expectedType = length === 1 ? "single" : length === 2 ? "digraph" : "trigraph";
    const expectedClass = length === 1 && isVowelLetter(phoneme.text) ? "vowel" : "consonant";
    const problems = [
      spelled !== phoneme.text && `các chữ cái ghép thành "${spelled}" chứ không phải "${phoneme.text}"`,
      phoneme.graphemeType !== expectedType && `graphemeType phải là ${expectedType}`,
      phoneme.phonemeClass !== expectedClass && `phonemeClass phải là ${expectedClass}`,
    ].filter(Boolean);
    if (problems.length > 0)
      add("error", "PHONEME_INVALID", KB_FILES.phonemes, `Âm "${phoneme.text}": ${problems.join("; ")}.`, phoneme.id);
    if (phoneme.spellingRule && !ruleIds.has(phoneme.spellingRule)) {
      add(
        "error",
        "UNKNOWN_REFERENCE",
        KB_FILES.phonemes,
        `Âm "${phoneme.text}" tham chiếu quy tắc không tồn tại "${phoneme.spellingRule}".`,
        phoneme.id,
      );
    }
  }
  const phonemeTexts = new Set(kb.phonemes.map((phoneme) => phoneme.text));
  for (const grapheme of REQUIRED_MULTI_LETTER) {
    if (!phonemeTexts.has(grapheme))
      add("error", "REQUIRED_PHONEME_MISSING", KB_FILES.phonemes, `Thiếu tổ hợp chữ ghi âm "${grapheme}".`);
  }

  // Vần: cấu tạo khai báo phải hợp lệ và ghép đúng thành chữ viết.
  const codaPhonemes = new Set(
    kb.phonemes.filter((phoneme) => phoneme.positions.includes("coda")).map((phoneme) => phoneme.text),
  );
  for (const rime of kb.rimes) {
    const problems: string[] = [];
    if ((rime.medial ?? "") + rime.nucleus + (rime.coda ?? "") !== rime.text)
      problems.push("âm đệm + âm chính + âm cuối không ghép thành chữ viết của vần");
    if (!NUCLEI.has(rime.nucleus)) problems.push(`âm chính "${rime.nucleus}" không hợp lệ`);
    if (rime.coda !== undefined && !CODAS.has(rime.coda)) problems.push(`âm cuối "${rime.coda}" không hợp lệ`);
    if (rime.coda !== undefined && !codaPhonemes.has(rime.coda))
      problems.push(`âm cuối "${rime.coda}" chưa được khai báo trong phonemes.json`);
    if (NUCLEI_WITHOUT_CODA.has(rime.nucleus) && rime.coda !== undefined)
      problems.push(`"${rime.nucleus}" không đi với âm cuối`);
    if (NUCLEI_REQUIRING_CODA.has(rime.nucleus) && rime.coda === undefined)
      problems.push(`"${rime.nucleus}" phải có âm cuối`);
    if (rime.medial !== undefined && !MEDIAL_TARGETS[rime.medial]?.has(rime.nucleus))
      problems.push(`âm đệm "${rime.medial}" không đứng trước "${rime.nucleus}"`);
    if (rime.nucleus === "ya" && rime.medial !== "u") problems.push(`"ya" chỉ xuất hiện sau âm đệm u (uya)`);
    if (problems.length > 0)
      add("error", "RIME_STRUCTURE_INVALID", KB_FILES.rimes, `Vần "${rime.text}": ${problems.join("; ")}.`, rime.id);
  }

  // Cặp nhầm lẫn và chủ đề
  const units = unitUniverse(kb);
  for (const confusion of kb.confusions) {
    for (const unit of confusion.units) {
      if (!units.has(unit))
        add(
          "error",
          "UNKNOWN_REFERENCE",
          KB_FILES.confusions,
          `Tham chiếu đơn vị không tồn tại "${unit}".`,
          confusion.id,
        );
    }
    if (confusion.units[0] === confusion.units[1])
      add(
        "error",
        "CONFUSION_INVALID",
        KB_FILES.confusions,
        "Cặp nhầm lẫn phải gồm hai đơn vị khác nhau.",
        confusion.id,
      );
  }
  const topicIds = new Set(kb.topics.map((topic) => topic.id));
  for (const [file, items] of [
    [KB_FILES.words, kb.words],
    [KB_FILES.sentences, kb.sentences],
  ] as const) {
    for (const item of items) {
      for (const topic of item.topics) {
        if (!topicIds.has(topic)) add("error", "UNKNOWN_REFERENCE", file, `Chủ đề không tồn tại "${topic}".`, item.id);
      }
    }
  }
}

function checkRules(kb: KnowledgeBase, add: Add): void {
  const file = KB_FILES.rules;
  const rules = new Map(kb.rules.map((rule) => [rule.id, rule]));
  for (const ruleId of ENGINE_RULE_IDS) {
    if (!rules.has(ruleId))
      add("error", "RULE_MISSING", file, `Bộ máy dùng quy tắc "${ruleId}" nhưng rules.json chưa mô tả.`);
  }
  const knownCodes = new Set<string>(ENGINE_DIAGNOSTIC_CODES);
  for (const rule of kb.rules) {
    for (const code of rule.detectedBy) {
      if (!knownCodes.has(code))
        add("error", "UNKNOWN_ENGINE_CODE", file, `Mã "${code}" không phải mã bộ máy trả về.`, rule.id);
    }
    const engineSpec = SPELLING_RULE_SPECS[rule.id];
    if (engineSpec !== undefined) {
      if (rule.spec === undefined)
        add(
          "error",
          "RULE_SPEC_MISSING",
          file,
          "Quy tắc đã hiện thực trong bộ máy phải có `spec` máy đọc được.",
          rule.id,
        );
      else if (JSON.stringify(rule.spec) !== JSON.stringify(engineSpec)) {
        add("error", "RULE_SPEC_MISMATCH", file, `\`spec\` lệch với bộ máy: ${JSON.stringify(engineSpec)}.`, rule.id);
      }
    }
    if (rule.certainty === "established" && rule.counterExamples.length === 0) {
      add(
        "warning",
        "RULE_WITHOUT_COUNTEREXAMPLE",
        file,
        "Quy tắc chắc chắn nên có ít nhất một ví dụ sai để tự kiểm thử.",
        rule.id,
      );
    }
    for (const example of rule.examples) {
      const diagnosis = diagnoseSyllable(example, kb.inventory);
      if (diagnosis.status !== "ok") {
        add(
          "error",
          "RULE_EXAMPLE_FAILED",
          file,
          `Ví dụ đúng "${example}" bị bộ máy đánh giá là ${diagnosis.status}: ${diagnosis.diagnostics.map((d) => d.code).join(", ")}.`,
          rule.id,
        );
      }
    }
    for (const counter of rule.counterExamples) {
      if (!rule.detectedBy.includes(counter.expectedCode)) {
        add(
          "error",
          "RULE_COUNTEREXAMPLE_INVALID",
          file,
          `Mã mong đợi "${counter.expectedCode}" không nằm trong detectedBy.`,
          rule.id,
        );
      }
      const codes = diagnoseSyllable(counter.text, kb.inventory).diagnostics.map(
        (diagnostic) => diagnostic.code as string,
      );
      if (!codes.includes(counter.expectedCode)) {
        add(
          "error",
          "RULE_COUNTEREXAMPLE_FAILED",
          file,
          `Ví dụ sai "${counter.text}" không bị phát hiện bằng ${counter.expectedCode} (bộ máy trả về: ${codes.join(", ") || "không có"}).`,
          rule.id,
        );
      }
    }
  }
}

function checkPrerequisites(kb: KnowledgeBase, add: Add): void {
  const file = KB_FILES.prerequisites;
  const units = unitUniverse(kb);
  for (const edge of kb.prerequisites) {
    for (const unit of [edge.unit, ...edge.requires]) {
      if (!units.has(unit))
        add("error", "UNKNOWN_REFERENCE", file, `Tham chiếu đơn vị không tồn tại "${unit}".`, edge.unit);
    }
    if (edge.requires.includes(edge.unit))
      add("error", "PREREQUISITE_CYCLE", file, `"${edge.unit}" không thể là tiên quyết của chính nó.`, edge.unit);
  }
  const cycle = findCycle(buildPrerequisiteGraph(kb).graph);
  if (cycle) add("error", "PREREQUISITE_CYCLE", file, `Quan hệ tiên quyết bị vòng lặp: ${cycle.join(" → ")}.`);
}

type CorpusKind = "syllable" | "word" | "sentence";

function checkCorpus(kb: KnowledgeBase, add: Add): void {
  const bank = new Set(kb.syllables.map((item) => item.text));
  const outsideBank = new Set<string>();

  const analyzeTokens = (kind: CorpusKind, file: string, id: string, text: string, declaredDifficulty: number) => {
    const analyses: SyllableAnalysis[] = [];
    let complete = true;
    const conventionNotes: string[] = [];
    for (const token of syllableTokens(text)) {
      const lower = toLowerVi(token.text);
      if (kind !== "syllable" && !bank.has(lower)) outsideBank.add(lower);
      const diagnosis = diagnoseSyllable(token.text, kb.inventory);
      for (const diagnostic of diagnosis.diagnostics) {
        const suggestion = diagnostic.suggestions.length > 0 ? ` (gợi ý: ${diagnostic.suggestions.join(" / ")})` : "";
        if (diagnostic.severity === "error") {
          add(
            "error",
            "CORPUS_SPELLING_ERROR",
            file,
            `"${token.text}" — ${diagnostic.code}: ${diagnostic.message}${suggestion}`,
            id,
          );
        } else if (diagnosis.status === "unverified") {
          add(
            "warning",
            "UNVERIFIED_SYLLABLE",
            file,
            `"${token.text}" chưa phân tích chắc chắn — ${diagnostic.message}${suggestion}`,
            id,
          );
        } else {
          conventionNotes.push(`"${token.text}": ${diagnostic.message}`);
        }
      }
      if (diagnosis.analysis && diagnosis.status === "ok") analyses.push(diagnosis.analysis);
      else complete = false;
    }
    if (conventionNotes.length > 0) {
      add(
        "warning",
        "CONVENTION_DEPENDENT",
        file,
        `Phụ thuộc quy ước chưa xác nhận — ${conventionNotes.join("; ")}`,
        id,
      );
    }
    if (complete && analyses.length > 0) {
      const estimate = estimateDifficulty(analyses, kind);
      if (Math.abs(estimate.level - declaredDifficulty) >= 2) {
        add(
          "warning",
          "DIFFICULTY_DIVERGENCE",
          file,
          `Độ khó dự kiến ${declaredDifficulty} lệch nhiều so với ước lượng theo cấu tạo (${estimate.level}) — GV xem lại.`,
          id,
        );
      }
    }
    return analyses;
  };

  for (const item of kb.syllables) {
    const file = KB_FILES.syllables;
    const tokens = tokenize(item.text);
    if (tokens.length !== 1 || tokens[0]?.kind !== "syllable" || item.text !== toLowerVi(item.text)) {
      add(
        "error",
        "SYLLABLE_FORMAT",
        file,
        "Mục trong ngân hàng tiếng phải là một tiếng viết thường, không dấu câu.",
        item.id,
      );
      continue;
    }
    const diagnosis = diagnoseSyllable(item.text, kb.inventory);
    analyzeTokens("syllable", file, item.id, item.text, item.difficulty);
    if (item.expected === null) {
      if (diagnosis.status === "ok") {
        add(
          "warning",
          "EXPECTED_ANALYSIS_MISSING",
          file,
          "Bộ phân tích đã phân tích được tiếng này — hãy ghi phân tích mong đợi để GV xác nhận.",
          item.id,
        );
      }
      continue;
    }
    const analysis = diagnosis.analysis;
    if (!analysis) {
      add(
        "error",
        "ANALYSIS_MISMATCH",
        file,
        "Đã khai báo phân tích nhưng bộ phân tích không phân tích được tiếng này.",
        item.id,
      );
      continue;
    }
    const mismatches = [
      analysis.onset !== item.expected.onset &&
        `âm đầu: khai báo "${item.expected.onset ?? "∅"}", bộ máy "${analysis.onset ?? "∅"}"`,
      analysis.rime !== item.expected.rime && `vần: khai báo "${item.expected.rime}", bộ máy "${analysis.rime}"`,
      analysis.tone !== item.expected.tone && `thanh: khai báo "${item.expected.tone}", bộ máy "${analysis.tone}"`,
    ].filter(Boolean);
    if (mismatches.length > 0) add("error", "ANALYSIS_MISMATCH", file, mismatches.join("; "), item.id);
  }

  for (const item of kb.words) {
    const file = KB_FILES.words;
    if (tokenize(item.text).some((token) => token.kind !== "syllable") || item.text !== toLowerVi(item.text)) {
      add(
        "error",
        "WORD_FORMAT",
        file,
        "Từ chỉ gồm các tiếng viết thường, cách nhau một dấu cách, không dấu câu.",
        item.id,
      );
      continue;
    }
    analyzeTokens("word", file, item.id, item.text, item.difficulty);
  }

  for (const item of kb.sentences) {
    const file = KB_FILES.sentences;
    const tokens = tokenize(item.text);
    const first = tokens[0];
    const last = tokens.at(-1);
    if (
      !first ||
      first.kind !== "syllable" ||
      first.text[0] !== first.text[0]?.toUpperCase() ||
      !last ||
      !/^[.!?]$/u.test(last.text)
    ) {
      add(
        "warning",
        "SENTENCE_FORMAT",
        file,
        "Câu nên viết hoa chữ đầu và kết thúc bằng dấu chấm, chấm hỏi hoặc chấm than.",
        item.id,
      );
    }
    if (tokens.some((token) => token.kind === "number" || token.kind === "symbol")) {
      add("error", "SENTENCE_FORMAT", file, "Câu cho lớp 1 không chứa chữ số hay ký hiệu.", item.id);
    }
    // Chữ viết hoa giữa câu = tên riêng: phải được khai báo là nhân vật hư cấu.
    const declared = new Set(item.properNouns ?? []);
    tokens.forEach((token, index) => {
      if (token.kind !== "syllable" || index === 0) return;
      const previous = tokens[index - 1];
      const startsSentence = previous?.kind === "punctuation" && /^[.!?]$/u.test(previous.text);
      if (!startsSentence && token.text[0] !== token.text[0]?.toLowerCase() && !declared.has(token.text)) {
        add(
          "warning",
          "PROPER_NOUN_REVIEW",
          file,
          `"${token.text}" viết hoa giữa câu — nếu là tên riêng, khai báo trong properNouns và xác nhận là nhân vật hư cấu.`,
          item.id,
        );
      }
    });
    for (const name of declared) {
      if (!tokens.some((token) => token.text === name)) {
        add("warning", "PROPER_NOUN_REVIEW", file, `Tên riêng khai báo "${name}" không xuất hiện trong câu.`, item.id);
      } else {
        add(
          "info",
          "PROPER_NOUN_DECLARED",
          file,
          `Tên nhân vật hư cấu "${name}" — GV kiểm tra không trùng biệt danh học sinh thật.`,
          item.id,
        );
      }
    }
    analyzeTokens("sentence", file, item.id, item.text, item.difficulty);
  }

  if (outsideBank.size > 0) {
    add(
      "info",
      "SYLLABLES_NOT_IN_BANK",
      KB_FILES.syllables,
      `${outsideBank.size} tiếng trong từ/câu chưa có trong ngân hàng tiếng (chỉ được phân tích tự động): ${[...outsideBank].sort().join(", ")}.`,
    );
  }
}

function checkApproval(
  review: Review,
  provenance: Provenance,
  hash: string,
  file: string,
  itemId: string | undefined,
  add: Add,
): void {
  if (review.status !== "approved") return;
  if (review.reviewedBy && AI_REVIEWER.test(review.reviewedBy)) {
    add(
      "error",
      "APPROVAL_BY_AI",
      file,
      `Người duyệt "${review.reviewedBy}" giống AI/hệ thống — chỉ giáo viên được duyệt.`,
      itemId,
    );
  }
  if (review.reviewedAt && review.reviewedAt < provenance.createdAt) {
    add("error", "APPROVAL_DATE_INVALID", file, "Ngày duyệt sớm hơn ngày tạo nội dung.", itemId);
  }
  if (review.contentHash && review.contentHash !== hash) {
    add(
      "error",
      "APPROVAL_STALE",
      file,
      `Nội dung đã thay đổi sau khi duyệt (hash hiện tại ${hash}) — phải duyệt lại.`,
      itemId,
    );
  }
}

function checkReview(kb: KnowledgeBase, add: Add): void {
  for (const key of Object.keys(KB_FILES) as KbFileKey[]) {
    const meta: FileMeta = kb.fileMeta[key];
    const items = kb[key] as unknown[];
    checkApproval(meta.review, meta.provenance, computeContentHash(items), KB_FILES[key], undefined, add);
  }

  const corpus = [
    ["syllables", kb.syllables],
    ["words", kb.words],
    ["sentences", kb.sentences],
  ] as const;
  for (const [key, items] of corpus) {
    const file = KB_FILES[key];
    const counts: Record<ReviewStatus, number> = { draft: 0, pending_review: 0, approved: 0, rejected: 0 };
    for (const item of items) {
      counts[item.review.status] += 1;
      checkApproval(item.review, provenanceOf(item, kb.fileMeta[key]), computeContentHash(item), file, item.id, add);
    }
    const waiting = counts.pending_review + counts.draft;
    if (waiting > 0) {
      add(
        "warning",
        "PENDING_REVIEW",
        file,
        `${counts.pending_review} mục chờ GV duyệt, ${counts.draft} bản nháp, ${counts.approved} đã duyệt — chưa dùng được để giao bài thật.`,
      );
    }
  }
  for (const key of [
    "letters",
    "phonemes",
    "tones",
    "rimes",
    "rules",
    "confusions",
    "prerequisites",
    "topics",
  ] as const) {
    const status = kb.fileMeta[key].review.status;
    if (status !== "approved") {
      add(
        "warning",
        "PENDING_REVIEW",
        KB_FILES[key],
        `Dữ liệu tham chiếu ở trạng thái "${status}" — cần GV rà soát (xem docs/TEACHER_REVIEW_CHECKLIST.md).`,
      );
    }
  }

  // Mục đã duyệt không nên dựa vào mục chưa duyệt.
  const syllableStatus = new Map(kb.syllables.map((item) => [item.text, item.review.status]));
  const wordStatus = new Map(kb.words.map((item) => [toLowerVi(item.text), item.review.status]));
  for (const word of kb.words.filter((item) => item.review.status === "approved")) {
    const unapproved = syllableTokens(word.text)
      .map((token) => toLowerVi(token.text))
      .filter((text) => syllableStatus.has(text) && syllableStatus.get(text) !== "approved");
    if (unapproved.length > 0) {
      add(
        "warning",
        "APPROVED_DEPENDS_ON_UNAPPROVED",
        KB_FILES.words,
        `Từ đã duyệt nhưng tiếng ${unapproved.join(", ")} chưa được duyệt.`,
        word.id,
      );
    }
  }
  for (const sentence of kb.sentences.filter((item) => item.review.status === "approved")) {
    const lowered = toLowerVi(sentence.text);
    const unapproved = [...wordStatus.entries()]
      .filter(
        ([text, status]) => status !== "approved" && new RegExp(`(^|[^\\p{L}])${text}([^\\p{L}]|$)`, "u").test(lowered),
      )
      .map(([text]) => text);
    if (unapproved.length > 0) {
      add(
        "warning",
        "APPROVED_DEPENDS_ON_UNAPPROVED",
        KB_FILES.sentences,
        `Câu đã duyệt nhưng từ ${unapproved.join(", ")} chưa được duyệt.`,
        sentence.id,
      );
    }
  }
}

function checkCurriculum(
  kb: KnowledgeBase,
  seriesFiles: ReadonlyArray<readonly [string, unknown]>,
  profileFiles: ReadonlyArray<readonly [string, unknown]>,
  add: Add,
): void {
  const units = unitUniverse(kb);
  const { graph } = buildPrerequisiteGraph(kb);
  const fileOf = (files: ReadonlyArray<readonly [string, unknown]>, index: number, fallback: string) =>
    files[index]?.[0] ?? fallback;

  kb.series.forEach((series, index) => {
    const file = fileOf(seriesFiles, index, SERIES_DIR);
    if (file !== `${SERIES_DIR}${series.id.replace(/^series:/u, "")}.json`) {
      add("error", "FILE_ID_MISMATCH", file, `Tên tệp phải khớp ID "${series.id}".`, series.id);
    }
    if (series.seriesKind === "textbook" && series.source === null) {
      add(
        "error",
        "SERIES_SOURCE_MISSING",
        file,
        "Thứ tự bài của bộ sách phải ghi nguồn (tên sách, nhà xuất bản, năm).",
        series.id,
      );
    }
    if (series.seriesKind === "illustrative") {
      add(
        "info",
        "SERIES_ILLUSTRATIVE",
        file,
        "Chuỗi bài minh họa — chỉ dùng để kiểm thử/demo, không dùng cho lớp thật.",
        series.id,
      );
    }
    series.lessons.forEach((lesson, position) => {
      if (lesson.ordinal !== position + 1)
        add("error", "SERIES_ORDINALS", file, `Bài thứ ${position + 1} phải có ordinal ${position + 1}.`, series.id);
    });
    const codes = series.lessons.map((lesson) => lesson.code);
    if (new Set(codes).size !== codes.length) add("error", "SERIES_ORDINALS", file, "Mã bài bị trùng.", series.id);

    const introducedAt = new Map<string, number>();
    for (const lesson of series.lessons) {
      for (const unit of [...lesson.introduces, ...lesson.reviews]) {
        if (!units.has(unit))
          add("error", "UNKNOWN_REFERENCE", file, `Bài ${lesson.code}: đơn vị không tồn tại "${unit}".`, series.id);
      }
      for (const unit of lesson.introduces) {
        if (introducedAt.has(unit)) {
          add(
            "warning",
            "DUPLICATE_INTRODUCTION",
            file,
            `"${unit}" được giới thiệu lại ở bài ${lesson.code} (đã có ở bài ${introducedAt.get(unit)}).`,
            series.id,
          );
        } else introducedAt.set(unit, lesson.ordinal);
      }
    }
    for (const lesson of series.lessons) {
      const known = unitsIntroducedThrough(series, lesson.ordinal);
      for (const unit of lesson.reviews) {
        if (!known.has(unit))
          add(
            "warning",
            "REVIEW_BEFORE_INTRODUCTION",
            file,
            `Bài ${lesson.code} ôn "${unit}" khi chưa giới thiệu.`,
            series.id,
          );
      }
      for (const unit of lesson.introduces) {
        for (const prerequisite of graph.get(unit) ?? []) {
          if (prerequisite.startsWith("letter:")) continue; // chữ cái học qua âm, không phải bài riêng
          if (!known.has(prerequisite)) {
            add(
              "warning",
              "PREREQUISITE_ORDER",
              file,
              `Bài ${lesson.code} giới thiệu "${unit}" trước tiên quyết "${prerequisite}".`,
              series.id,
            );
          }
        }
      }
    }
  });

  kb.profiles.forEach((profile, index) => {
    const file = fileOf(profileFiles, index, PROFILES_DIR);
    if (file !== `${PROFILES_DIR}${profile.id.replace(/^profile:/u, "")}.json`) {
      add("error", "FILE_ID_MISMATCH", file, `Tên tệp phải khớp ID "${profile.id}".`, profile.id);
    }
    const series = profile.seriesId === null ? undefined : kb.series.find((entry) => entry.id === profile.seriesId);
    if (profile.seriesId !== null && !series) {
      add("error", "UNKNOWN_REFERENCE", file, `Bộ bài không tồn tại "${profile.seriesId}".`, profile.id);
    }
    if (profile.seriesId === null && profile.currentLessonOrdinal !== null) {
      add("error", "PROFILE_INVALID", file, "Có vị trí bài học nhưng chưa có bộ bài.", profile.id);
    }
    if (
      series &&
      profile.currentLessonOrdinal !== null &&
      !series.lessons.some((lesson) => lesson.ordinal === profile.currentLessonOrdinal)
    ) {
      add(
        "error",
        "PROFILE_INVALID",
        file,
        `Bộ bài "${series.id}" không có bài số ${profile.currentLessonOrdinal}.`,
        profile.id,
      );
    }
    for (const unit of [
      ...profile.additionalTaughtUnits,
      ...profile.excludedUnits,
      ...profile.reviewFocusUnits,
      ...profile.extendingAllowedUnits,
    ]) {
      if (!units.has(unit)) add("error", "UNKNOWN_REFERENCE", file, `Đơn vị không tồn tại "${unit}".`, profile.id);
    }
    if (profile.status === "confirmed") {
      if (series?.seriesKind === "illustrative") {
        add(
          "error",
          "PROFILE_USES_ILLUSTRATIVE_SERIES",
          file,
          "Hồ sơ đã xác nhận không được dùng chuỗi bài minh họa như chương trình thật.",
          profile.id,
        );
      }
      if (series && series.review.status !== "approved") {
        add(
          "error",
          "PROFILE_USES_UNAPPROVED_SERIES",
          file,
          "Hồ sơ đã xác nhận phải dùng bộ bài đã được duyệt.",
          profile.id,
        );
      }
      if (profile.confirmation && AI_REVIEWER.test(profile.confirmation.confirmedBy)) {
        add("error", "APPROVAL_BY_AI", file, "Chỉ giáo viên được xác nhận hồ sơ lớp.", profile.id);
      }
      if (Object.values(profile.conventions).some((value) => value === null)) {
        add(
          "warning",
          "CONVENTIONS_INCOMPLETE",
          file,
          "Hồ sơ đã xác nhận nhưng còn quy ước chưa chọn — các tiếng phụ thuộc quy ước sẽ là “chưa xác định”.",
          profile.id,
        );
      }
    } else if (profile.status === "unconfirmed") {
      add(
        "warning",
        "PROFILE_UNCONFIRMED",
        file,
        "Hồ sơ lớp chưa được GV xác nhận (bộ sách, vị trí bài, quy ước) — không dùng để giao bài.",
        profile.id,
      );
    } else {
      add("info", "PROFILE_ILLUSTRATIVE", file, "Hồ sơ minh họa (hư cấu) cho kiểm thử/demo.", profile.id);
    }
  });
}

function finish(issues: ContentIssue[], kb: KnowledgeBase | null): ContentReport {
  const corpusReview: Record<ReviewStatus, number> = { draft: 0, pending_review: 0, approved: 0, rejected: 0 };
  const fileReview: ContentStats["fileReview"] = {};
  if (kb) {
    for (const item of [...kb.syllables, ...kb.words, ...kb.sentences]) corpusReview[item.review.status] += 1;
    for (const key of Object.keys(KB_FILES) as KbFileKey[]) fileReview[key] = kb.fileMeta[key].review.status;
  }
  const stats: ContentStats = {
    datasetVersion: kb?.datasetVersion ?? null,
    letters: kb?.letters.length ?? 0,
    phonemes: kb?.phonemes.length ?? 0,
    multiLetterPhonemes: kb?.phonemes.filter((phoneme) => phoneme.graphemeType !== "single").length ?? 0,
    tones: kb?.tones.length ?? 0,
    rimes: kb?.rimes.length ?? 0,
    rules: kb?.rules.length ?? 0,
    confusions: kb?.confusions.length ?? 0,
    prerequisiteEdges: kb ? buildPrerequisiteGraph(kb).edges.length : 0,
    topics: kb?.topics.length ?? 0,
    syllables: kb?.syllables.length ?? 0,
    words: kb?.words.length ?? 0,
    sentences: kb?.sentences.length ?? 0,
    series: kb?.series.length ?? 0,
    profiles: kb?.profiles.length ?? 0,
    corpusReview,
    fileReview,
  };
  return {
    issues,
    stats,
    errorCount: issues.filter((issue) => issue.severity === "error").length,
    warningCount: issues.filter((issue) => issue.severity === "warning").length,
  };
}
