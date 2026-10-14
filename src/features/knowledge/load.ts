import type { z } from "zod";
import type { RimeSpec, SyllableInventory } from "../../lib/vietnamese/syllable.ts";
import {
  confusionsFileSchema,
  lettersFileSchema,
  manifestSchema,
  phonemesFileSchema,
  prerequisitesFileSchema,
  profileSchema,
  rimesFileSchema,
  rulesFileSchema,
  seriesSchema,
  sentencesFileSchema,
  syllablesFileSchema,
  tonesFileSchema,
  topicsFileSchema,
  wordsFileSchema,
  type Confusion,
  type CurriculumProfile,
  type Letter,
  type Phoneme,
  type PrerequisiteEdge,
  type Provenance,
  type Review,
  type Rime,
  type Rule,
  type SentenceItem,
  type Series,
  type SyllableItem,
  type Tone,
  type Topic,
  type WordItem,
} from "./schema.ts";

/**
 * Nạp kho tri thức từ dữ liệu thô (JSON đã đọc) và kiểm tra lược đồ.
 * Không đọc tệp: nơi gọi tự cung cấp dữ liệu (import tĩnh trong ứng dụng, fs trong script).
 */

/** Đường dẫn (tương đối với content/) của các tệp kho tri thức lớp 1. */
export const KB_FILES = {
  letters: "kb/letters.json",
  phonemes: "kb/phonemes.json",
  tones: "kb/tones.json",
  rimes: "kb/rimes.json",
  rules: "kb/rules.json",
  confusions: "kb/confusions.json",
  prerequisites: "kb/prerequisites.json",
  topics: "kb/topics.json",
  syllables: "kb/syllables.json",
  words: "kb/words.json",
  sentences: "kb/sentences.json",
} as const;
export type KbFileKey = keyof typeof KB_FILES;

export const MANIFEST_FILE = "manifest.json";
export const SERIES_DIR = "curriculum/series/";
export const PROFILES_DIR = "curriculum/profiles/";

export type RawKnowledgeData = {
  manifest: unknown;
  kb: Record<KbFileKey, unknown>;
  /** Mỗi phần tử: [đường dẫn tương đối, nội dung JSON]. */
  series: ReadonlyArray<readonly [string, unknown]>;
  profiles: ReadonlyArray<readonly [string, unknown]>;
};

export type FileMeta = { description: string; review: Review; provenance: Provenance };

export type KnowledgeBase = {
  datasetVersion: string;
  letters: Letter[];
  phonemes: Phoneme[];
  tones: Tone[];
  rimes: Rime[];
  rules: Rule[];
  confusions: Confusion[];
  prerequisites: PrerequisiteEdge[];
  topics: Topic[];
  syllables: SyllableItem[];
  words: WordItem[];
  sentences: SentenceItem[];
  series: Series[];
  profiles: CurriculumProfile[];
  fileMeta: Record<KbFileKey, FileMeta>;
  inventory: SyllableInventory;
};

export type LoadIssue = { file: string; path: string; message: string };
export type LoadResult = { ok: true; kb: KnowledgeBase } | { ok: false; issues: LoadIssue[] };

export function loadKnowledgeBase(raw: RawKnowledgeData): LoadResult {
  const issues: LoadIssue[] = [];
  const parse = <Schema extends z.ZodType>(file: string, schema: Schema, value: unknown): z.infer<Schema> | null => {
    const result = schema.safeParse(value);
    if (result.success) return result.data;
    for (const issue of result.error.issues) {
      issues.push({ file, path: issue.path.join("."), message: issue.message });
    }
    return null;
  };

  const manifest = parse(MANIFEST_FILE, manifestSchema, raw.manifest);
  const letters = parse(KB_FILES.letters, lettersFileSchema, raw.kb.letters);
  const phonemes = parse(KB_FILES.phonemes, phonemesFileSchema, raw.kb.phonemes);
  const tones = parse(KB_FILES.tones, tonesFileSchema, raw.kb.tones);
  const rimes = parse(KB_FILES.rimes, rimesFileSchema, raw.kb.rimes);
  const rules = parse(KB_FILES.rules, rulesFileSchema, raw.kb.rules);
  const confusions = parse(KB_FILES.confusions, confusionsFileSchema, raw.kb.confusions);
  const prerequisites = parse(KB_FILES.prerequisites, prerequisitesFileSchema, raw.kb.prerequisites);
  const topics = parse(KB_FILES.topics, topicsFileSchema, raw.kb.topics);
  const syllables = parse(KB_FILES.syllables, syllablesFileSchema, raw.kb.syllables);
  const words = parse(KB_FILES.words, wordsFileSchema, raw.kb.words);
  const sentences = parse(KB_FILES.sentences, sentencesFileSchema, raw.kb.sentences);
  const series = raw.series.map(([file, value]) => parse(file, seriesSchema, value));
  const profiles = raw.profiles.map(([file, value]) => parse(file, profileSchema, value));

  if (
    !manifest ||
    !letters ||
    !phonemes ||
    !tones ||
    !rimes ||
    !rules ||
    !confusions ||
    !prerequisites ||
    !topics ||
    !syllables ||
    !words ||
    !sentences ||
    series.some((entry) => entry === null) ||
    profiles.some((entry) => entry === null)
  ) {
    return { ok: false, issues };
  }

  const meta = (file: { description: string; review: Review; provenance: Provenance }): FileMeta => ({
    description: file.description,
    review: file.review,
    provenance: file.provenance,
  });

  return {
    ok: true,
    kb: {
      datasetVersion: manifest.datasetVersion,
      letters: letters.items,
      phonemes: phonemes.items,
      tones: tones.items,
      rimes: rimes.items,
      rules: rules.items,
      confusions: confusions.items,
      prerequisites: prerequisites.items,
      topics: topics.items,
      syllables: syllables.items,
      words: words.items,
      sentences: sentences.items,
      series: series.filter((entry): entry is Series => entry !== null),
      profiles: profiles.filter((entry): entry is CurriculumProfile => entry !== null),
      fileMeta: {
        letters: meta(letters),
        phonemes: meta(phonemes),
        tones: meta(tones),
        rimes: meta(rimes),
        rules: meta(rules),
        confusions: meta(confusions),
        prerequisites: meta(prerequisites),
        topics: meta(topics),
        syllables: meta(syllables),
        words: meta(words),
        sentences: meta(sentences),
      },
      inventory: buildInventory(phonemes.items, rimes.items),
    },
  };
}

/** Dữ liệu cho bộ phân tích tiếng: âm đầu (âm có vị trí `onset`) và danh mục vần. */
export function buildInventory(phonemes: readonly Phoneme[], rimes: readonly Rime[]): SyllableInventory {
  return {
    onsets: phonemes.filter((phoneme) => phoneme.positions.includes("onset")).map((phoneme) => phoneme.text),
    rimes: new Map(
      rimes.map((rime): [string, RimeSpec] => [
        rime.text,
        { text: rime.text, medial: rime.medial ?? null, nucleus: rime.nucleus, coda: rime.coda ?? null },
      ]),
    ),
  };
}

/** Nguồn gốc thực tế của một mục ngữ liệu (mục ghi riêng, nếu không thì theo tệp). */
export function provenanceOf(item: { provenance?: Provenance | undefined }, file: FileMeta): Provenance {
  return item.provenance ?? file.provenance;
}

/** Tên tệp kho tri thức chứa một loại ngữ liệu. */
export function corpusFileKey(kind: "syllable" | "word" | "sentence"): KbFileKey {
  return kind === "syllable" ? "syllables" : kind === "word" ? "words" : "sentences";
}
