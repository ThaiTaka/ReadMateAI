import manifest from "../../../content/manifest.json";
import confusions from "../../../content/kb/confusions.json";
import letters from "../../../content/kb/letters.json";
import phonemes from "../../../content/kb/phonemes.json";
import prerequisites from "../../../content/kb/prerequisites.json";
import rimes from "../../../content/kb/rimes.json";
import rules from "../../../content/kb/rules.json";
import sentences from "../../../content/kb/sentences.json";
import syllables from "../../../content/kb/syllables.json";
import tones from "../../../content/kb/tones.json";
import topics from "../../../content/kb/topics.json";
import words from "../../../content/kb/words.json";
import class1a2 from "../../../content/curriculum/profiles/class-1a2.json";
import illustrativeDemo from "../../../content/curriculum/profiles/illustrative-demo.json";
import illustrativeSeries from "../../../content/curriculum/series/illustrative-v1.json";
import { loadKnowledgeBase, type KnowledgeBase, type RawKnowledgeData } from "./load.ts";

/**
 * Kho tri thức đóng gói sẵn từ content/ (import tĩnh qua bundler — dùng trong ứng dụng và Vitest).
 * Thêm tệp bộ bài/hồ sơ mới thì đăng ký vào danh sách dưới đây; một unit test bảo đảm không sót tệp.
 */

export const DEFAULT_KNOWLEDGE_DATA: RawKnowledgeData = {
  manifest,
  kb: { letters, phonemes, tones, rimes, rules, confusions, prerequisites, topics, syllables, words, sentences },
  series: [["curriculum/series/illustrative-v1.json", illustrativeSeries]],
  profiles: [
    ["curriculum/profiles/class-1a2.json", class1a2],
    ["curriculum/profiles/illustrative-demo.json", illustrativeDemo],
  ],
};

function loadDefault(): KnowledgeBase {
  const result = loadKnowledgeBase(DEFAULT_KNOWLEDGE_DATA);
  if (!result.ok) {
    const first = result.issues
      .slice(0, 5)
      .map((issue) => `${issue.file} ${issue.path}: ${issue.message}`)
      .join("; ");
    throw new Error(`Kho tri thức trong content/ không hợp lệ — chạy "npm run content:check". ${first}`);
  }
  return result.kb;
}

export const KNOWLEDGE_BASE: KnowledgeBase = loadDefault();
