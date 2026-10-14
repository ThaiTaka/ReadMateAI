/**
 * npm run content:check — kiểm tra toàn bộ kho tri thức trong content/.
 *
 * Chạy trực tiếp bằng Node 24 (bỏ kiểu TypeScript gốc), nên mọi import nội bộ dùng đường dẫn
 * tương đối có đuôi `.ts` (không dùng alias "@/"). Mã thoát 1 khi có lỗi; cảnh báo không chặn
 * nhưng phải được giáo viên rà soát.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { validateContent, type ContentIssue } from "../src/features/knowledge/content-validation.ts";

const CONTENT_DIR = join(process.cwd(), "content");

const files = new Map<string, string>();
for (const entry of readdirSync(CONTENT_DIR, { recursive: true, withFileTypes: true })) {
  if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
  const fullPath = join(entry.parentPath, entry.name);
  files.set(relative(CONTENT_DIR, fullPath).split(sep).join("/"), readFileSync(fullPath, "utf8"));
}

const report = validateContent(files);
const { stats } = report;

const line = (issue: ContentIssue, marker: string) =>
  `  ${marker} [${issue.code}] ${issue.file}${issue.itemId ? ` (${issue.itemId})` : ""}: ${issue.message}`;
const section = (title: string, severity: ContentIssue["severity"], marker: string) => {
  const selected = report.issues.filter((issue) => issue.severity === severity);
  console.log(`\n${title} (${selected.length})`);
  for (const issue of selected) console.log(line(issue, marker));
};

console.log(`ReadMate AI — kiểm tra kho tri thức (content/) · phiên bản dữ liệu ${stats.datasetVersion ?? "?"}`);
console.log(
  `Tham chiếu: ${stats.letters} chữ cái · ${stats.phonemes} âm (${stats.multiLetterPhonemes} tổ hợp chữ) · ` +
    `${stats.tones} thanh · ${stats.rimes} vần · ${stats.rules} quy tắc · ${stats.confusions} cặp dễ nhầm · ` +
    `${stats.prerequisiteEdges} quan hệ tiên quyết · ${stats.topics} chủ đề`,
);
console.log(
  `Ngữ liệu: ${stats.syllables} tiếng · ${stats.words} từ · ${stats.sentences} câu — ` +
    `đã duyệt ${stats.corpusReview.approved} · chờ duyệt ${stats.corpusReview.pending_review} · ` +
    `nháp ${stats.corpusReview.draft} · từ chối ${stats.corpusReview.rejected}`,
);
console.log(`Tiến độ học tập: ${stats.series} bộ bài · ${stats.profiles} hồ sơ lớp`);

section("LỖI — phải sửa", "error", "✗");
section("CẢNH BÁO — cần giáo viên rà soát", "warning", "!");
section("THÔNG TIN", "info", "·");

console.log(
  `\nKết quả: ${report.errorCount === 0 ? "ĐẠT" : "KHÔNG ĐẠT"} — ${report.errorCount} lỗi, ${report.warningCount} cảnh báo.`,
);
process.exitCode = report.errorCount === 0 ? 0 : 1;
