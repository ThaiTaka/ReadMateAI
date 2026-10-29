/**
 * npm run audio:contest -- <lệnh> — chế độ TRÌNH DIỄN cuộc thi cho âm thanh (docs/CONTEST_AUDIO.md).
 *
 *   status                       công tắc, số tệp, số yêu cầu đã gửi
 *   prepare                      kiểm tra tĩnh mọi lời đọc (NFC, độ dài, dữ liệu cá nhân, nghi lộ đáp án, trùng lặp) — không mạng
 *   generate [--live] [--max-requests N]
 *                                tạo tệp còn thiếu bằng Viettel AI (giọng hcm-minhquan, 0,9). Mặc định CHẠY KHÔ; --live cần token + xác nhận hạn mức
 *   verify [--force]             giải mã từng tệp bằng Chromium: thời lượng, biên độ, tỉ lệ có tiếng, tệp im lặng/hỏng; đối chiếu SHA-256 trong Storage
 *   report                       báo cáo trung thực: phát được / thiếu / cần kiểm chứng cách đọc
 *   setup [--live] [--yes]       prepare → generate → verify → bật chế độ trình diễn (local) → đăng ký → báo cáo
 *   enable | disable [--yes]     bật/tắt chế độ trình diễn (chỉ Supabase local)
 *   allow-unverified on|off      cho phép/chặn phát những mục có rủi ro cách đọc (mặc định chặn)
 *   revoke [--yes]               THU HỒI toàn bộ: tắt chế độ, thu hồi mọi tệp, xóa đối tượng trong bucket contest-audio
 *
 * AN TOÀN: chỉ Supabase LOCAL (từ chối URL khác); không đụng bản ghi giáo viên hay thư viện đã duyệt; không tạo/đổi tài khoản giáo viên;
 * không tạo bất kỳ trạng thái "đã duyệt" nào; token Viettel chỉ đọc từ .env.local, không bao giờ in ra; chỉ gửi chữ cố định của danh mục,
 * không dữ liệu học sinh; có hạn mức yêu cầu mỗi lần chạy và tổng cộng; không tự thử lại.
 */
import { exit, stderr, stdout } from "node:process";
import { parseArgs } from "node:util";
import { prepareCatalog } from "../src/features/contest-audio/checks.ts";
import {
  CONTEST_FLAG_ENABLED,
  CONTEST_FLAG_PLAY_UNVERIFIED,
  CONTEST_LIFETIME_MAX_REQUESTS,
  CONTEST_RUN_HARD_MAX_REQUESTS,
  CONTEST_VOICE,
} from "../src/features/contest-audio/config.ts";
import { planContestRun } from "../src/features/contest-audio/plan.ts";
import { buildContestReport, formatContestReport } from "../src/features/contest-audio/report.ts";
import { runContestJobs } from "../src/server/contest-audio/generate.ts";
import { createViettelProvider, VIETTEL_SUGGESTED_TIMEOUT_MS } from "../src/server/tts/viettel-provider.ts";
import { COST_CONFIRM_ENV } from "../src/server/tts/poc/options.ts";
import {
  countTeachers,
  failedKeys,
  recordOutcome,
  DATA_DIR,
  ensureBucket,
  hasCachedFile,
  liveRows,
  listSchools,
  purgeTestSchoolRows,
  loadCatalog,
  localEnvOrThrow,
  readLedger,
  readSwitches,
  readVerify,
  recordRequest,
  registerAll,
  revokeEverything,
  saveCachedFile,
  setSwitches,
  verifyCached,
  verifyRemote,
  GATE_KEY,
} from "./lib/contest-audio.ts";
import { askLine, InputError } from "./lib/hidden-input.ts";

const out = (line = "") => stdout.write(`${line}\n`);
const err = (line = "") => stderr.write(`${line}\n`);
const reason = (error: unknown) => (error instanceof Error ? error.message.split("\n")[0] : "không rõ");

const catalog = loadCatalog();
const entries = catalog.entries;

function showSwitches(prefix: string, flags: ReadonlyMap<string, boolean>): void {
  out(prefix);
  out(
    `  ${flags.get(CONTEST_FLAG_ENABLED) ? "BẬT" : "TẮT"}  ${CONTEST_FLAG_ENABLED}  — chế độ trình diễn (cờ hệ thống)`,
  );
  out(`  ${flags.get(GATE_KEY) ? "BẬT" : "TẮT"}  ${GATE_KEY}  — cổng LOCAL của CSDL`);
  out(
    `  ${flags.get(CONTEST_FLAG_PLAY_UNVERIFIED) ? "BẬT" : "TẮT"}  ${CONTEST_FLAG_PLAY_UNVERIFIED}  — cho phát mục chờ kiểm chứng cách đọc`,
  );
}

async function confirm(question: string, yes: boolean): Promise<boolean> {
  if (yes) return true;
  return /^(y|yes|có|co)$/iu.test(await askLine(`${question} Gõ y để đồng ý: `));
}

// ---------------------------------------------------------------------------------------------------------------------

function cmdPrepare(): number {
  const report = prepareCatalog(entries);
  out(
    `Danh mục: ${report.total} mục; ${report.distinctRequests} yêu cầu riêng biệt (${report.sharedFiles} mục dùng chung tệp).`,
  );
  out(`Mục có rủi ro cách đọc (sẽ bị GIỮ, không phát): ${report.needsVerification}.`);
  if (report.issues.length === 0) {
    out("Kiểm tra tĩnh: 0 vấn đề (NFC, độ dài ≤ 300, không dữ liệu cá nhân, không dấu hiệu lộ đáp án).");
    return 0;
  }
  for (const issue of report.issues) err(`  ${issue.code}  ${issue.entryId}`);
  err("Kiểm tra tĩnh CÓ VẤN ĐỀ — chưa gửi gì cho nhà cung cấp.");
  return 1;
}

function liveDecision(live: boolean): { live: true; token: string } | { live: false; why: string[] } {
  const why: string[] = [];
  if (!live) why.push("chưa thêm --live");
  const token = process.env.TTS_VIETTEL_TOKEN?.trim() ?? "";
  if (!token) why.push("thiếu TTS_VIETTEL_TOKEN trong .env.local");
  if (process.env[COST_CONFIRM_ENV]?.trim() !== "yes")
    why.push(`chưa có ${COST_CONFIRM_ENV}=yes (chủ dự án xác nhận hạn mức/chi phí)`);
  return why.length > 0 ? { live: false, why } : { live: true, token };
}

type GenerateOptions = {
  live: boolean;
  maxRequests: number | undefined;
  only: readonly string[] | undefined;
  retryFailed: boolean;
  gapMs: number;
  /** Giới hạn trường được đăng ký (mã trường); bỏ trống = mọi trường trừ trường do kiểm thử tạo. */
  schools?: readonly string[] | undefined;
};

async function cmdGenerate(options: GenerateOptions): Promise<number> {
  if (cmdPrepare() !== 0) return 1;
  const have = new Set(entries.filter((entry) => hasCachedFile(entry.assetKey)).map((entry) => entry.assetKey));
  const ledger = readLedger();
  const scope = options.only ? entries.filter((entry) => options.only!.includes(entry.id)) : entries;
  if (options.only && scope.length === 0) {
    err("--only không khớp mục nào của danh mục (ví dụ: letter:b,phoneme:gh).");
    return 2;
  }
  const plan = planContestRun({
    entries: scope,
    haveKeys: have,
    maxRequests: options.maxRequests,
    lifetimeUsed: ledger.requests.length,
    failedKeys: failedKeys(),
    retryFailed: options.retryFailed,
  });
  out(
    `Kế hoạch: ${plan.jobs.length} yêu cầu mới (tối đa ${plan.maxRequests}/lần, còn ${plan.lifetimeRemaining} trong hạn mức tổng ${CONTEST_LIFETIME_MAX_REQUESTS}); ${plan.reusedKeys.length} tệp đã có — KHÔNG gọi lại.`,
  );
  if (plan.previouslyFailed.length > 0) {
    out(
      `  ${plan.previouslyFailed.length} khóa từng bị nhà cung cấp trả lỗi — KHÔNG tự gọi lại (muốn thử lại: --retry-failed --only <mục>):`,
    );
    for (const job of plan.previouslyFailed) out(`    - ${job.entryIds.join(" + ")}: "${job.text}"`);
  }
  if (plan.deferred.length > 0) {
    out(
      `  Hoãn ${plan.deferred.length} yêu cầu do ${plan.blockedBy === "LIFETIME_CAP" ? "hạn mức tổng" : "hạn mức mỗi lần chạy"}.`,
    );
  }
  if (plan.jobs.length === 0) {
    out(
      plan.deferred.length === 0
        ? "Không cần gọi nhà cung cấp: mọi tệp đã có."
        : "Không gửi yêu cầu nào (hết hạn mức).",
    );
    return plan.deferred.length === 0 ? 0 : 3;
  }

  const decision = liveDecision(options.live);
  if (!decision.live) {
    out(`\nCHẠY KHÔ — không gửi gì tới nhà cung cấp (${decision.why.join("; ")}).`);
    for (const job of plan.jobs) out(`  - ${job.entryIds.join(" + ")}: "${job.text}"`);
    out("\nCHƯA tạo tệp nào. Không được coi là hoàn thành.");
    return 3;
  }

  let stop = false;
  const provider = createViettelProvider({
    token: decision.token,
    onDiagnostic: (code, detail) => {
      err(`  [Viettel] ${code}${detail ? ` (${detail})` : ""}`);
      if (code === "HTTP_UNAUTHORIZED" || code === "HTTP_RATE_LIMITED") stop = true;
    },
  });
  out(
    `\nGỌI THẬT Viettel AI (${CONTEST_VOICE.voiceKey} → hcm-minhquan, tốc độ 0,9): ${plan.jobs.length} yêu cầu, tuần tự, không thử lại.`,
  );
  const results = await runContestJobs(plan.jobs, {
    provider,
    timeoutMs: VIETTEL_SUGGESTED_TIMEOUT_MS,
    saveBytes: async (key, bytes) => saveCachedFile(key, bytes),
    recordRequest: async (key) => recordRequest(key),
    recordOutcome: async (key, ok, code) => recordOutcome(key, ok, code),
    shouldStop: () => stop,
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    gapMs: options.gapMs,
  });
  const saved = results.filter((result) => result.status === "saved").length;
  const failed = results.filter((result) => result.status === "failed");
  const skipped = results.filter((result) => result.status === "skipped_stopped").length;
  out(`Đã lưu ${saved}/${results.length} tệp. Lỗi: ${failed.length}. Bỏ qua vì đã dừng: ${skipped}.`);
  for (const item of failed)
    err(
      `  lỗi ${item.code ?? ""}  ${plan.jobs.find((job) => job.assetKey === item.assetKey)?.entryIds.join("+") ?? ""}`,
    );
  return failed.length === 0 && skipped === 0 && plan.deferred.length === 0 ? 0 : 1;
}

async function cmdVerify(force: boolean): Promise<number> {
  const keys = [...new Set(entries.map((entry) => entry.assetKey))];
  const present = keys.filter((key) => hasCachedFile(key));
  out(`Giải mã ${present.length}/${keys.length} tệp có sẵn bằng Chromium…`);
  const result = await verifyCached(keys, force);
  out(`Đã kiểm tra mới ${result.checked} tệp; không qua: ${result.failed.length}.`);
  const store = readVerify();
  for (const key of result.failed) {
    const names = entries
      .filter((entry) => entry.assetKey === key)
      .map((entry) => entry.id)
      .join("+");
    err(`  KHÔNG QUA ${names}: ${store[key]?.problems.join(",")}`);
  }
  let remoteBad: string[] = [];
  try {
    const rows = await liveRows();
    remoteBad = await verifyRemote(rows);
    out(`Đối chiếu SHA-256 trong Storage: ${rows.length - remoteBad.length}/${rows.length} khớp.`);
    for (const item of remoteBad) err(`  LỆCH ${item}`);
  } catch (error) {
    out(`Chưa đối chiếu được Storage: ${reason(error)}`);
  }
  out("Đây là kiểm tra KỸ THUẬT. Chưa ai nghe cách đọc; không có tệp nào được coi là đã kiểm duyệt.");
  return result.failed.length === 0 && remoteBad.length === 0 ? 0 : 1;
}

async function cmdReport(): Promise<number> {
  const switches = readSwitches();
  const rows = await liveRows().catch(() => []);
  const schools = await listSchools();
  const registered = new Map<string, number>();
  const schoolIds = new Set(schools.map((school) => school.id));
  for (const row of rows) {
    if (schoolIds.has(row.school_id)) registered.set(row.entry_id, (registered.get(row.entry_id) ?? 0) + 1);
  }
  const report = buildContestReport({
    entries,
    cachedKeys: new Set(entries.filter((entry) => hasCachedFile(entry.assetKey)).map((entry) => entry.assetKey)),
    verify: readVerify(),
    registeredSchools: registered,
    schoolCount: schools.length,
    requestsUsed: readLedger().requests.length,
    modeEnabled: switches.get(CONTEST_FLAG_ENABLED) === true,
    gateEnabled: switches.get(GATE_KEY) === true,
    playUnverified: switches.get(CONTEST_FLAG_PLAY_UNVERIFIED) === true,
  });
  for (const line of formatContestReport(report)) out(line);
  return report.technicallyComplete ? 0 : 3;
}

async function cmdSetup(options: { yes: boolean } & GenerateOptions): Promise<number> {
  const env = localEnvOrThrow();
  out(`1/8 Môi trường: Supabase local (${env.apiUrl}).`);
  const teachers = await countTeachers();
  const schools = await listSchools(options.schools);
  out(`2/8 Tài khoản giáo viên hiện có: ${teachers} (${schools.length} trường) — không tạo mới, không đổi.`);
  if (teachers === 0) {
    err(
      "Chưa có tài khoản giáo viên nào trên máy này. Chạy `npm run teacher:bootstrap -- --email <email>` trước (công cụ này không tạo hộ).",
    );
    return 3;
  }
  const decision = liveDecision(options.live);
  const credentialPresent = Boolean(process.env.TTS_VIETTEL_TOKEN?.trim());
  const costConfirmed = process.env[COST_CONFIRM_ENV]?.trim() === "yes";
  out(
    `3/8 Token Viettel: ${credentialPresent ? "có (không in giá trị)" : "THIẾU"}. Xác nhận hạn mức: ${costConfirmed ? "có" : "CHƯA"}.`,
  );
  out("4/8 Kiểm tra tĩnh danh mục…");
  if (cmdPrepare() !== 0) return 1;
  out("5/8 Tạo tệp còn thiếu (theo lô có giới hạn)…");
  const generated = await cmdGenerate(options);
  if (!decision.live) out("   (Chạy khô: các bước sau chỉ xử lý tệp ĐÃ CÓ.)");
  out("6/8 Kiểm tra kỹ thuật các tệp có sẵn…");
  const verified = await cmdVerify(false);
  out("7/8 Bật chế độ trình diễn trên Supabase local rồi đăng ký tệp…");
  out(
    "   Chế độ này phát giọng máy tạo tự động, CHƯA ai nghe/duyệt, chỉ cho học sinh hư cấu trên máy này. Thu hồi bất cứ lúc nào: `npm run audio:contest -- revoke`.",
  );
  if (!(await confirm("   Bật chế độ trình diễn?", options.yes))) {
    err("Đã hủy: chưa bật chế độ và chưa đăng ký tệp.");
    return 3;
  }
  const bucket = await ensureBucket();
  out(`   Bucket contest-audio: ${bucket === "created" ? "đã tạo" : "đã có"}.`);
  showSwitches("   Sau khi bật (đọc lại từ CSDL):", setSwitches({ enabled: true, gate: true }));
  const registered = await registerAll(entries, schools);
  out(`   Đăng ký: mới ${registered.registered}, đã có ${registered.reused}, lỗi ${registered.failed.length}.`);
  for (const id of registered.failed) err(`     lỗi đăng ký ${id}`);
  out("8/8 Báo cáo:");
  const reported = await cmdReport();
  return generated === 0 && verified === 0 && registered.failed.length === 0 && reported === 0 ? 0 : 3;
}

// ---------------------------------------------------------------------------------------------------------------------

async function main(): Promise<number> {
  const { values, positionals } = parseArgs({
    options: {
      live: { type: "boolean", default: false },
      yes: { type: "boolean", default: false },
      force: { type: "boolean", default: false },
      "max-requests": { type: "string" },
      only: { type: "string" },
      "retry-failed": { type: "boolean", default: false },
      school: { type: "string", multiple: true },
      "gap-ms": { type: "string" },
      help: { type: "boolean", default: false },
    },
    allowPositionals: true,
  });
  const command = positionals[0] ?? "status";
  const known = [
    "status",
    "prepare",
    "generate",
    "verify",
    "report",
    "setup",
    "enable",
    "disable",
    "allow-unverified",
    "cleanup-test",
    "revoke",
  ];
  if (values.help || !known.includes(command)) {
    out(`Dùng: npm run audio:contest -- ${known.join(" | ")} [--live] [--yes] [--max-requests N] [--force]`);
    return values.help ? 0 : 2;
  }
  const requested = values["max-requests"] === undefined ? undefined : Number(values["max-requests"]);
  if (
    requested !== undefined &&
    (!Number.isInteger(requested) || requested < 1 || requested > CONTEST_RUN_HARD_MAX_REQUESTS)
  ) {
    err(`--max-requests phải là số nguyên từ 1 đến ${CONTEST_RUN_HARD_MAX_REQUESTS}.`);
    return 2;
  }

  const gap = values["gap-ms"] === undefined ? 1500 : Number(values["gap-ms"]);
  if (!Number.isInteger(gap) || gap < 500 || gap > 30_000) {
    err("--gap-ms phải là số nguyên từ 500 đến 30000.");
    return 2;
  }
  const generateOptions: GenerateOptions = {
    live: values.live,
    maxRequests: requested,
    only: values.only
      ? values.only
          .split(",")
          .map((item) => item.trim().normalize("NFC"))
          .filter(Boolean)
      : undefined,
    retryFailed: values["retry-failed"],
    gapMs: gap,
    schools: values.school,
  };
  if (command === "prepare") return cmdPrepare();
  try {
    localEnvOrThrow();
  } catch (error) {
    err(`${reason(error)} Chạy \`npm run db:start\` rồi \`npm run db:env\`.`);
    return 3;
  }

  switch (command) {
    case "status": {
      showSwitches("Công tắc chế độ trình diễn (Supabase LOCAL):", readSwitches());
      out(
        `Tệp trong bộ nhớ đệm: ${new Set(entries.filter((e) => hasCachedFile(e.assetKey)).map((e) => e.assetKey)).size} khóa; yêu cầu đã gửi: ${readLedger().requests.length}/${CONTEST_LIFETIME_MAX_REQUESTS}. Thư mục dữ liệu: ${DATA_DIR}`,
      );
      return 0;
    }
    case "generate":
      return cmdGenerate(generateOptions);
    case "verify":
      return cmdVerify(values.force);
    case "report":
      return cmdReport();
    case "setup":
      return cmdSetup({ ...generateOptions, yes: values.yes });
    case "enable": {
      if (!(await confirm("Bật chế độ trình diễn (giọng máy tạo tự động, chưa duyệt, chỉ local)?", values.yes)))
        return 3;
      showSwitches("Sau khi bật:", setSwitches({ enabled: true, gate: true }));
      return 0;
    }
    case "disable": {
      showSwitches("Sau khi tắt:", setSwitches({ enabled: false, gate: false, playUnverified: false }));
      return 0;
    }
    case "allow-unverified": {
      const mode = positionals[1];
      if (mode !== "on" && mode !== "off") {
        err("Dùng: allow-unverified on | off");
        return 2;
      }
      if (
        mode === "on" &&
        !(await confirm("Cho phép phát cả mục CHƯA kiểm chứng cách đọc (giao diện sẽ ghi chú rõ)?", values.yes))
      )
        return 3;
      showSwitches("Sau khi đổi:", setSwitches({ playUnverified: mode === "on" }));
      return 0;
    }
    case "cleanup-test": {
      const result = await purgeTestSchoolRows();
      out(
        `Dọn trường do kiểm thử tạo (${result.schools} trường): thu hồi ${result.revoked} bản ghi, xóa ${result.objects} đối tượng Storage.`,
      );
      return 0;
    }
    case "revoke": {
      if (
        !(await confirm("THU HỒI toàn bộ âm thanh trình diễn (tắt chế độ, thu hồi, xóa tệp trong bucket)?", values.yes))
      )
        return 3;
      setSwitches({ enabled: false, gate: false, playUnverified: false });
      const result = await revokeEverything("revoked_by_owner_command");
      out(`Đã tắt chế độ; thu hồi ${result.revoked} bản ghi; xóa ${result.removedObjects} đối tượng trong Storage.`);
      showSwitches("Trạng thái cuối:", readSwitches());
      return 0;
    }
    default:
      return 2;
  }
}

main()
  .then((code) => {
    // Đặt mã thoát rồi để vòng lặp tự dọn: gọi exit() ngay sau khi đóng Chromium trên Windows gây lỗi libuv "UV_HANDLE_CLOSING".
    process.exitCode = code;
  })
  .catch((error: unknown) => {
    if (error instanceof InputError) {
      err("Cần terminal tương tác hoặc --yes.");
      exit(2);
    }
    err(`Lỗi: ${reason(error)}`);
    exit(4);
  });
