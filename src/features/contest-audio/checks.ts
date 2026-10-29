import { checkTtsRequest } from "../../server/tts/request.ts";
import type { ContestEntry } from "./catalog.ts";
import { CONTEST_CHAR_LIMIT } from "./config.ts";

/**
 * Bước `prepare`: kiểm tra TĨNH mọi lời đọc trước khi gửi nhà cung cấp. HÀM THUẦN. Không nghe, không gọi mạng.
 *
 *  - NFC, độ dài 1…300 ký tự, không giống dữ liệu cá nhân / thẻ học / mã nhúng (dùng lại `checkTtsRequest` của cổng TTS);
 *  - câu lệnh/phản hồi cố định KHÔNG được chứa chữ đứng riêng một mình (một ký tự), chữ trong dấu nháy hay chữ số — dấu hiệu có thể
 *    làm lộ đáp án (docs/AUDIO_ENGINE.md §7). Chữ/âm của Học tập thì không có câu hỏi nên không áp dụng luật này;
 *  - đếm số mục dùng chung một tệp (cùng chữ → cùng khóa → một lần gọi).
 */

export type PrepareIssue = {
  entryId: string;
  code: "NOT_NFC" | "BAD_LENGTH" | "REJECTED_BY_GATE" | "POSSIBLE_ANSWER_LEAK";
};

const QUOTES = new RegExp(
  `["${String.fromCharCode(0x201c)}${String.fromCharCode(0x201d)}${String.fromCharCode(0x201e)}'${String.fromCharCode(0x2018)}${String.fromCharCode(0x2019)}${String.fromCharCode(0xab)}${String.fromCharCode(0xbb)}]`,
  "u",
);
const DIGITS = /\d/u;
/** Một chữ cái đứng riêng giữa các khoảng trắng/dấu câu (không phải một từ tiếng Việt thường). */
const LONE_LETTER = /(^|[\s,.;:!?()])\p{L}(?=$|[\s,.;:!?()])/u;

export function checkEntry(item: ContestEntry): PrepareIssue[] {
  const issues: PrepareIssue[] = [];
  const add = (code: PrepareIssue["code"]) => issues.push({ entryId: item.id, code });
  if (item.text !== item.text.normalize("NFC")) add("NOT_NFC");
  if (item.text.length < 1 || item.text.length > CONTEST_CHAR_LIMIT) add("BAD_LENGTH");
  const gate = checkTtsRequest({ text: item.text, purpose: "word", voiceKey: "vi-male-1", speed: "slow" });
  if (!gate.ok) add("REJECTED_BY_GATE");
  if (item.kind === "instruction" || item.kind === "feedback") {
    if (QUOTES.test(item.text) || DIGITS.test(item.text) || LONE_LETTER.test(item.text)) add("POSSIBLE_ANSWER_LEAK");
  }
  return issues;
}

export type PrepareReport = {
  total: number;
  distinctRequests: number;
  issues: PrepareIssue[];
  sharedFiles: number;
  needsVerification: number;
};

export function prepareCatalog(entries: readonly ContestEntry[]): PrepareReport {
  const issues = entries.flatMap(checkEntry);
  const keys = new Set(entries.map((item) => item.assetKey));
  return {
    total: entries.length,
    distinctRequests: keys.size,
    issues,
    sharedFiles: entries.length - keys.size,
    needsVerification: entries.filter((item) => item.riskClass === "needs_verification").length,
  };
}
