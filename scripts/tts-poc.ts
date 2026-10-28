/**
 * Công cụ NGHE THỬ giọng AI tiếng Việt (R10.3b2-P0; docs/AUDIO_ENGINE.md §15). Mặc định CHẠY KHÔ: chỉ in kế hoạch, không mạng.
 *
 *   npm run tts:poc                                   # chạy khô (6 câu × 2 giọng FPT.AI, tốc độ bình thường)
 *   npm run tts:poc -- --speed slow --voices fpt-banmai,google-neural2-a
 *   npm run tts:poc -- --set diagnostic               # câu chẩn đoán "bà, bá, mẹ, nhà" (KHÔNG phải học liệu)
 *   npm run tts:poc -- --live                         # GỌI API THẬT — cần TTS_POC_COST_CONFIRMED=yes và khóa trong .env.local
 *
 * Tệp lưu ở `.tts-poc/` (được .gitignore). Khóa API chỉ đọc từ biến môi trường, không bao giờ in ra. Không dùng dữ liệu học
 * sinh. Không gửi gì tới trình duyệt; giáo viên nghe ở /teacher/tts-compare.
 */
import { createFptProvider, FPT_SUGGESTED_TIMEOUT_MS } from "../src/server/tts/fpt-provider.ts";
import { planPocRun, POC_MAX_CHARS_PER_RUN, POC_MAX_REQUESTS_PER_RUN } from "../src/server/tts/poc/plan.ts";
import {
  COST_CONFIRM_ENV,
  decidePocMode,
  FPT_KEY_ENV,
  GOOGLE_KEY_ENV,
  parsePocArgs,
} from "../src/server/tts/poc/options.ts";
import { runPocJobs } from "../src/server/tts/poc/run.ts";
import { createFsPocStore, defaultPocDir, readPocManifest } from "../src/server/tts/poc/store.ts";
import { createGoogleProvider } from "../src/server/tts/providers.ts";
import type { TtsProvider } from "../src/server/tts/types.ts";

const NOT_TRIED = "CHƯA THỬ API THẬT";

const parsed = parsePocArgs(process.argv.slice(2));
if (!parsed.ok) {
  console.error(`Lỗi: ${parsed.error}`);
  process.exit(2);
}
const { options } = parsed;
const dir = defaultPocDir();
const existing = await readPocManifest(dir);
if (existing.problem === "INVALID") {
  console.error(`Lỗi: ${dir}/manifest.json không hợp lệ. Kiểm tra tay, không tự ghi đè.`);
  process.exit(2);
}

const plan = planPocRun({
  voices: options.voices,
  set: options.set,
  speed: options.speed,
  format: options.format,
  existingKeys: new Set(existing.manifest.samples.map((sample) => sample.requestKey)),
  maxRequests: options.maxRequests,
});
if (!plan.ok) {
  console.error(
    `Từ chối kế hoạch (${plan.code}): tối đa ${POC_MAX_REQUESTS_PER_RUN} lần gọi và ${POC_MAX_CHARS_PER_RUN} ký tự mỗi lần chạy.`,
  );
  process.exit(2);
}

console.log(
  `Kế hoạch: ${plan.jobs.length} lần gọi mới (${plan.chars} ký tự), ${plan.cached.length} đã có tệp (không gọi lại).`,
);
for (const job of plan.jobs) console.log(`  - ${job.voice.label} · ${job.speed} · ${job.format} · ${job.sentence.id}`);

const mode = decidePocMode(options, process.env);
switch (mode.mode) {
  case "dry":
    console.log(
      `\n${NOT_TRIED}. Chạy khô — không gọi mạng. Muốn nghe thật: thêm --live (xem docs/AUDIO_ENGINE.md §15).`,
    );
    process.exit(0);
  case "refused":
    console.error(
      `\n${NOT_TRIED}. Từ chối chạy thật: chưa có ${COST_CONFIRM_ENV}=yes. Chỉ đặt sau khi chủ dự án đã xác nhận quota/thanh toán của nhà cung cấp.`,
    );
    process.exit(3);
  case "no_keys":
    console.error(
      `\n${NOT_TRIED}. Thiếu khóa API cho: ${mode.missing.join(", ")} (biến ${FPT_KEY_ENV} / ${GOOGLE_KEY_ENV} trong .env.local; không in giá trị).`,
    );
    process.exit(3);
  case "live":
    break;
}

if (mode.skippedVoices.length > 0) console.warn(`Bỏ qua (thiếu khóa): ${mode.skippedVoices.join(", ")}`);
const runnable = plan.jobs.filter((job) => mode.voices.includes(job.voice.key));

const providers: Partial<Record<"fpt" | "google", TtsProvider>> = {};
if (mode.keys.fpt) {
  providers.fpt = createFptProvider({
    apiKey: mode.keys.fpt,
    format: options.format,
    onDiagnostic: (reason, detail) => console.warn(`  [FPT] ${reason}${detail ? ` (${detail})` : ""}`),
  });
}
if (mode.keys.google) providers.google = createGoogleProvider(mode.keys.google, fetch, options.format);

const results = await runPocJobs({
  jobs: runnable,
  providers,
  store: createFsPocStore(dir),
  clock: () => performance.now(),
  nowIso: () => new Date().toISOString(),
  timeoutMs: FPT_SUGGESTED_TIMEOUT_MS,
});

for (const result of results) {
  const detail = result.status === "saved" ? `${result.bytes} byte, ${result.latencyMs} ms` : (result.code ?? "");
  console.log(`  ${result.status.padEnd(26)} ${result.voiceKey} · ${result.sentenceId} ${detail}`);
}
const saved = results.filter((result) => result.status === "saved").length;
console.log(`\nĐã lưu ${saved}/${results.length} tệp vào ${dir}. Giáo viên nghe ở /teacher/tts-compare.`);
process.exit(saved === results.length ? 0 : 1);
