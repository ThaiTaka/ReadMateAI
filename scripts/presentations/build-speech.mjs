// Tạo docs/presentations/ReadMateAI_LoiThuyetTrinh.md từ speech.mjs (cùng nguồn với ghi chú diễn giả trong PPTX).
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { SPEECH } from "./speech.mjs";

const out = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "docs",
  "presentations",
  "ReadMateAI_LoiThuyetTrinh.md",
);
const words = SPEECH.reduce((n, s) => n + s.text.split(/\s+/).length, 0);
// Tốc độ nói tự nhiên của người Việt khi thuyết trình: ≈ 135 từ/phút.
const secOf = (s) => Math.round((s.text.split(/\s+/).length / 135) * 60);
const secs = SPEECH.reduce((n, s) => n + secOf(s), 0);
const fmt = (s) => `${Math.floor(s / 60)} phút ${String(s % 60).padStart(2, "0")} giây`;

const lines = [
  "# ReadMate AI — Lời thuyết trình",
  "",
  `Bài trình chiếu: [ReadMateAI_BaoCaoDuAn.pptx](ReadMateAI_BaoCaoDuAn.pptx) · ${SPEECH.length} slide · khoảng ${words} từ · thời lượng gợi ý **${fmt(secs)}** (đọc tự nhiên, chưa kể hỏi đáp).`,
  "",
  "Lời dẫn cũng nằm trong phần ghi chú diễn giả của từng slide. Nguồn chung: `scripts/presentations/speech.mjs`.",
  "",
  "**Nhớ nói rõ khi trình bày:** tất cả hình ảnh là bản chơi thử với dữ liệu hư cấu; chạm trán học tập trong Mê cung, âm thanh, học liệu đã duyệt, bảng xếp hạng cho học sinh và góc phụ huynh **chưa hoàn thành**; dự án chưa triển khai chính thức và chưa thí điểm với học sinh; ba trò chơi còn lại phát triển sau khi nộp.",
  "",
];
SPEECH.forEach((s, i) => {
  lines.push(`## Slide ${i + 1} — ${s.title} (≈ ${secOf(s)} giây)`, "", s.text, "");
});
writeFileSync(out, lines.join("\n"), "utf8");
console.log("Đã ghi", out, words, "từ", fmt(secs));
