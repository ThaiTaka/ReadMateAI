/**
 * Phần dùng chung của công cụ `npm run audio:contest` (chế độ trình diễn cuộc thi — docs/CONTEST_AUDIO.md).
 * Chạy bằng Node 24 trực tiếp (import tương đối, có đuôi .ts). CHỈ Supabase LOCAL; không đụng bản ghi giáo viên hay thư viện đã duyệt.
 */
import { spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildContestCatalog,
  type ContestCatalog,
  type ContestEntry,
} from "../../src/features/contest-audio/catalog.ts";
import {
  CONTEST_BUCKET,
  CONTEST_FLAG_ENABLED,
  CONTEST_FLAG_PLAY_UNVERIFIED,
  CONTEST_LIFETIME_MAX_REQUESTS,
  CONTEST_VOICE,
} from "../../src/features/contest-audio/config.ts";
import { evaluateDecoded, type DecodedStats } from "../../src/features/contest-audio/verify.ts";
import { LIBRARY_ENTRIES } from "../../src/server/tts-library/entries.ts";
import { assertAllFlags, parseFlagRows, stdoutOrThrow } from "./flag-query.ts";
import { adminClient, isLocalUrl, scriptEnv } from "./local-supabase.ts";

export const GATE_KEY = "contest_audio_allowed";
export const FLAG_KEYS = [CONTEST_FLAG_ENABLED, CONTEST_FLAG_PLAY_UNVERIFIED] as const;

const ROOT = join(import.meta.dirname, "..", "..");
export const DATA_DIR = join(ROOT, ".contest-audio");
const FILES_DIR = join(DATA_DIR, "files");
const LEDGER_FILE = join(DATA_DIR, "ledger.json");
const VERIFY_FILE = join(DATA_DIR, "verify.json");

export function loadCatalog(): ContestCatalog {
  const read = (path: string) => (JSON.parse(readFileSync(join(ROOT, path), "utf8")) as { items: never[] }).items;
  return buildContestCatalog({
    letters: read("content/kb/letters.json"),
    phonemes: read("content/kb/phonemes.json"),
    library: LIBRARY_ENTRIES.map((entry) => ({ id: entry.id, text: entry.text, attention: entry.attention })),
  });
}

// ---------------------------------------------------------------------------------------------------------------------
// Bộ nhớ đệm tệp + sổ ghi yêu cầu + kết quả kiểm tra (thư mục .contest-audio/, được .gitignore)
// ---------------------------------------------------------------------------------------------------------------------

const ensureDirs = () => mkdirSync(FILES_DIR, { recursive: true });
const fileOf = (assetKey: string) => join(FILES_DIR, `${assetKey}.mp3`);

export const hasCachedFile = (assetKey: string) => existsSync(fileOf(assetKey));
export const readCachedFile = (assetKey: string): Uint8Array<ArrayBuffer> => {
  const buffer = readFileSync(fileOf(assetKey));
  return new Uint8Array(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer);
};
export function saveCachedFile(assetKey: string, bytes: Uint8Array): void {
  ensureDirs();
  writeFileSync(fileOf(assetKey), bytes);
}

export type Ledger = {
  version: 1;
  requests: Array<{ assetKey: string; at: string; outcome?: "saved" | "failed"; code?: string }>;
};

export function readLedger(): Ledger {
  if (!existsSync(LEDGER_FILE)) return { version: 1, requests: [] };
  const parsed = JSON.parse(readFileSync(LEDGER_FILE, "utf8")) as Ledger;
  if (parsed.version !== 1 || !Array.isArray(parsed.requests))
    throw new Error("Sổ ghi yêu cầu không hợp lệ — kiểm tra tay, không tự ghi đè.");
  return parsed;
}

/** Ghi sổ MỘT yêu cầu NGAY trước khi gửi (kể cả khi sau đó lỗi: nhà cung cấp có thể đã tính lượt). */
export function recordRequest(assetKey: string): void {
  ensureDirs();
  const ledger = readLedger();
  if (ledger.requests.length >= CONTEST_LIFETIME_MAX_REQUESTS)
    throw new Error("Đã chạm hạn mức tổng số yêu cầu — không gửi thêm.");
  ledger.requests.push({ assetKey, at: new Date().toISOString() });
  writeFileSync(LEDGER_FILE, JSON.stringify(ledger, null, 2));
}

/** Ghi kết quả của yêu cầu GẦN NHẤT của khóa này. */
export function recordOutcome(assetKey: string, ok: boolean, code?: string): void {
  const ledger = readLedger();
  for (let index = ledger.requests.length - 1; index >= 0; index--) {
    const item = ledger.requests[index]!;
    if (item.assetKey === assetKey && item.outcome === undefined) {
      item.outcome = ok ? "saved" : "failed";
      if (code) item.code = code;
      break;
    }
  }
  writeFileSync(LEDGER_FILE, JSON.stringify(ledger, null, 2));
}

/** Khóa tệp đã từng bị nhà cung cấp trả lỗi và chưa có tệp (không tự gọi lại). */
export function failedKeys(): Set<string> {
  return new Set(
    readLedger()
      .requests.filter((item) => item.outcome === "failed" && !hasCachedFile(item.assetKey))
      .map((item) => item.assetKey),
  );
}

export type VerifyRecord = DecodedStats & {
  ok: boolean;
  problems: string[];
  warnings: string[];
  sha256: string;
  checkedAt: string;
};
export type VerifyStore = Record<string, VerifyRecord>;

export function readVerify(): VerifyStore {
  if (!existsSync(VERIFY_FILE)) return {};
  return JSON.parse(readFileSync(VERIFY_FILE, "utf8")) as VerifyStore;
}
export function writeVerify(store: VerifyStore): void {
  ensureDirs();
  writeFileSync(VERIFY_FILE, JSON.stringify(store, null, 2));
}

// ---------------------------------------------------------------------------------------------------------------------
// Giải mã thật bằng Chromium (Playwright) để đo thời lượng, biên độ, tỉ lệ có tiếng — phát hiện tệp im lặng / hỏng
// ---------------------------------------------------------------------------------------------------------------------

export async function decodeAll(
  items: ReadonlyArray<{ key: string; bytes: Uint8Array }>,
): Promise<Map<string, DecodedStats | null>> {
  const { chromium } = await import("@playwright/test");
  const browser = await chromium.launch();
  const results = new Map<string, DecodedStats | null>();
  try {
    const page = await browser.newPage();
    await page.goto("about:blank");
    for (const item of items) {
      const stats = await page.evaluate(async (b64: string) => {
        try {
          const bin = atob(b64);
          const arr = new Uint8Array(bin.length);
          for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
          const ctx = new AudioContext();
          const buffer = await ctx.decodeAudioData(arr.buffer);
          const data = buffer.getChannelData(0);
          let peak = 0;
          let sum = 0;
          let voiced = 0;
          for (const value of data) {
            const abs = Math.abs(value);
            if (abs > peak) peak = abs;
            sum += value * value;
            if (abs > 0.02) voiced += 1;
          }
          await ctx.close();
          return {
            durationMs: Math.round(buffer.duration * 1000),
            sampleRate: buffer.sampleRate,
            peak,
            rms: Math.sqrt(sum / data.length),
            voicedRatio: voiced / data.length,
          };
        } catch {
          return null;
        }
      }, Buffer.from(item.bytes).toString("base64"));
      results.set(item.key, stats);
    }
  } finally {
    await browser.close();
  }
  return results;
}

export const sha256 = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");

/** Kiểm tra kỹ thuật các tệp đã có trong bộ nhớ đệm; cập nhật `verify.json`. Trả khóa tệp không qua được. */
export async function verifyCached(
  keys: readonly string[],
  force = false,
): Promise<{ checked: number; failed: string[] }> {
  const store = readVerify();
  const todo = keys.filter(
    (key) => hasCachedFile(key) && (force || !store[key] || store[key]?.sha256 !== sha256(readCachedFile(key))),
  );
  if (todo.length > 0) {
    const bytesByKey = new Map(todo.map((key) => [key, readCachedFile(key)]));
    const decoded = await decodeAll(todo.map((key) => ({ key, bytes: bytesByKey.get(key)! })));
    for (const key of todo) {
      const stats = decoded.get(key) ?? null;
      const bytes = bytesByKey.get(key)!;
      if (!stats) {
        store[key] = {
          durationMs: 0,
          sampleRate: 0,
          peak: 0,
          rms: 0,
          voicedRatio: 0,
          ok: false,
          problems: ["DECODE_FAILED"],
          warnings: [],
          sha256: sha256(bytes),
          checkedAt: new Date().toISOString(),
        };
        continue;
      }
      const verdict = evaluateDecoded(stats);
      store[key] = { ...stats, ...verdict, sha256: sha256(bytes), checkedAt: new Date().toISOString() };
    }
    writeVerify(store);
  }
  return { checked: todo.length, failed: keys.filter((key) => hasCachedFile(key) && store[key] && !store[key]!.ok) };
}

// ---------------------------------------------------------------------------------------------------------------------
// Supabase LOCAL: cờ + cổng (qua `supabase db query --local`), kho lưu trữ + đăng ký (qua khóa secret local)
// ---------------------------------------------------------------------------------------------------------------------

export function localEnvOrThrow() {
  const env = scriptEnv();
  if (!isLocalUrl(env.apiUrl))
    throw new Error("Từ chối: công cụ này chỉ chạy với Supabase local (127.0.0.1/localhost).");
  return env;
}

function sql(statement: string): string {
  // Câu SQL do mã này dựng từ hằng số cố định (không nhận chữ từ dòng lệnh), chỉ có nháy đơn → an toàn khi bọc trong nháy kép.
  const result = spawnSync(`npx supabase db query --local --agent no --output-format json "${statement}"`, {
    encoding: "utf8",
    shell: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  return stdoutOrThrow(result);
}

const ALL_KEYS = [...FLAG_KEYS, GATE_KEY] as const;

/** Đọc ba công tắc từ CSDL: hai cờ hệ thống + cổng local. */
export function readSwitches(): Map<string, boolean> {
  const keys = FLAG_KEYS.map((key) => `'${key}'`).join(", ");
  const raw = sql(
    `select key, enabled from private.feature_flags where key in (${keys}) union all select '${GATE_KEY}' as key, contest_audio_allowed as enabled from private.test_environment where singleton`,
  );
  return parseFlagRows(raw, ALL_KEYS);
}

export function setSwitches(values: {
  enabled?: boolean;
  gate?: boolean;
  playUnverified?: boolean;
}): Map<string, boolean> {
  const flag = (key: string, on: boolean) =>
    sql(`update private.feature_flags set enabled = ${on}, updated_at = now() where key = '${key}'`);
  if (values.enabled !== undefined) flag(CONTEST_FLAG_ENABLED, values.enabled);
  if (values.playUnverified !== undefined) flag(CONTEST_FLAG_PLAY_UNVERIFIED, values.playUnverified);
  if (values.gate !== undefined) {
    sql(
      `update private.test_environment set contest_audio_allowed = ${values.gate}, updated_at = now() where singleton`,
    );
  }
  const after = readSwitches();
  const expected: Array<[string, boolean | undefined]> = [
    [CONTEST_FLAG_ENABLED, values.enabled],
    [CONTEST_FLAG_PLAY_UNVERIFIED, values.playUnverified],
    [GATE_KEY, values.gate],
  ];
  for (const [key, want] of expected) {
    if (want !== undefined) assertAllFlags(new Map([[key, after.get(key) ?? !want]]), want);
  }
  return after;
}

export type School = { id: string; name: string };

/** Trường do bộ kiểm thử tự động tạo ("Trường thử xxxx") — không phải trường của chủ dự án, không đăng ký âm thanh trình diễn cho chúng. */
export const isTestSchool = (name: string) => /^Trường thử /u.test(name);

/** Mọi trường trên Supabase local TRỪ trường do kiểm thử tạo; `only` (mã trường) thu hẹp thêm. */
export async function listSchools(only?: readonly string[]): Promise<School[]> {
  const admin = adminClient(localEnvOrThrow());
  const { data, error } = await admin.from("schools").select("id, name").order("created_at");
  if (error) throw new Error("Không đọc được danh sách trường.");
  const real = (data ?? []).filter((school) => !isTestSchool(school.name));
  return only && only.length > 0 ? real.filter((school) => only.includes(school.id)) : real;
}

/** Dọn dấu vết do kiểm thử để lại ở trường "Trường thử …": thu hồi bản ghi còn dùng và xóa đối tượng Storage tương ứng. */
export async function purgeTestSchoolRows(): Promise<{ schools: number; revoked: number; objects: number }> {
  const admin = adminClient(localEnvOrThrow());
  const { data: schools, error } = await admin.from("schools").select("id, name");
  if (error) throw new Error("Không đọc được danh sách trường.");
  const testSchools = (schools ?? []).filter((school) => isTestSchool(school.name));
  let revoked = 0;
  let objects = 0;
  for (const school of testSchools) {
    const rows = await admin
      .from("contest_audio_assets")
      .select("storage_key")
      .eq("school_id", school.id)
      .is("revoked_at", null);
    if (!rows.data || rows.data.length === 0) continue;
    const result = await admin.rpc("gateway_revoke_contest_audio", {
      p_school_id: school.id,
      p_reason: "cleanup_test_school",
    });
    if (result.error) throw new Error("Không thu hồi được bản ghi của trường thử.");
    revoked += typeof result.data === "number" ? result.data : rows.data.length;
    const removed = await admin.storage.from(CONTEST_BUCKET).remove(rows.data.map((row) => row.storage_key));
    objects += removed.data?.length ?? 0;
  }
  return { schools: testSchools.length, revoked, objects };
}

export async function countTeachers(): Promise<number> {
  const admin = adminClient(localEnvOrThrow());
  const { count, error } = await admin.from("staff_profiles").select("id", { count: "exact", head: true });
  if (error) throw new Error("Không đọc được tài khoản giáo viên.");
  return count ?? 0;
}

export async function ensureBucket(): Promise<"exists" | "created"> {
  const admin = adminClient(localEnvOrThrow());
  const found = await admin.storage.getBucket(CONTEST_BUCKET);
  if (found.data) return "exists";
  const created = await admin.storage.createBucket(CONTEST_BUCKET, {
    public: false,
    fileSizeLimit: "2MiB",
    allowedMimeTypes: ["audio/mpeg", "audio/wav", "audio/ogg"],
  });
  if (created.error) throw new Error("Không tạo được bucket contest-audio.");
  return "created";
}

export type RegisterSummary = { registered: number; reused: number; skippedUnverified: number; failed: string[] };

/** Đăng ký mọi mục đã có tệp ĐÃ QUA kiểm tra kỹ thuật cho từng trường. Idempotent. */
export async function registerAll(
  entries: readonly ContestEntry[],
  schools: readonly School[],
): Promise<RegisterSummary> {
  const admin = adminClient(localEnvOrThrow());
  const verify = readVerify();
  const summary: RegisterSummary = { registered: 0, reused: 0, skippedUnverified: 0, failed: [] };
  for (const school of schools) {
    for (const entry of entries) {
      const record = verify[entry.assetKey];
      if (!hasCachedFile(entry.assetKey) || !record?.ok) continue;
      const live = await admin
        .from("contest_audio_assets")
        .select("id, asset_key, content_hash")
        .eq("school_id", school.id)
        .eq("entry_id", entry.id)
        .is("revoked_at", null)
        .maybeSingle();
      if (live.data && live.data.asset_key === entry.assetKey && live.data.content_hash === entry.contentHash) {
        summary.reused += 1;
        continue;
      }
      const bytes = readCachedFile(entry.assetKey);
      const versionId = randomUUID();
      const storageKey = `${school.id}/${versionId}.mp3`;
      const upload = await admin.storage
        .from(CONTEST_BUCKET)
        .upload(storageKey, bytes, { contentType: "audio/mpeg", upsert: false });
      if (upload.error) {
        summary.failed.push(entry.id);
        continue;
      }
      const registered = await admin.rpc("gateway_register_contest_audio", {
        p_school_id: school.id,
        p_version_id: versionId,
        p_entry_id: entry.id,
        p_spoken_text: entry.text,
        p_content_hash: entry.contentHash,
        p_asset_key: entry.assetKey,
        p_config_version: CONTEST_VOICE.configVersion,
        p_risk_class: entry.riskClass,
        p_risk_reasons: entry.riskReasons.join(","),
        p_storage_key: storageKey,
        p_mime_type: "audio/mpeg",
        p_size_bytes: bytes.byteLength,
        p_duration_ms: record.durationMs,
        p_content_sha256: record.sha256,
        p_peak_milli: Math.min(1000, Math.round(record.peak * 1000)),
        p_rms_milli: Math.min(1000, Math.round(record.rms * 1000)),
      });
      if (registered.error) {
        await admin.storage.from(CONTEST_BUCKET).remove([storageKey]);
        summary.failed.push(entry.id);
        continue;
      }
      summary.registered += 1;
    }
  }
  return summary;
}

export type LiveRow = {
  school_id: string;
  entry_id: string;
  risk_class: string;
  asset_key: string;
  storage_key: string;
  content_sha256: string;
};

export async function liveRows(): Promise<LiveRow[]> {
  const admin = adminClient(localEnvOrThrow());
  const { data, error } = await admin
    .from("contest_audio_assets")
    .select("school_id, entry_id, risk_class, asset_key, storage_key, content_sha256")
    .is("revoked_at", null);
  if (error) throw new Error("Không đọc được bảng contest_audio_assets (đã áp dụng migration chưa?).");
  return data ?? [];
}

/** Đối chiếu SHA-256 của các tệp ĐANG DÙNG trong Storage với metadata. Trả các mục lệch/mất. */
export async function verifyRemote(rows: readonly LiveRow[]): Promise<string[]> {
  const admin = adminClient(localEnvOrThrow());
  const bad: string[] = [];
  for (const row of rows) {
    const { data, error } = await admin.storage.from(CONTEST_BUCKET).download(row.storage_key);
    if (error || !data) {
      bad.push(`${row.entry_id} (mất tệp)`);
      continue;
    }
    if (sha256(new Uint8Array(await data.arrayBuffer())) !== row.content_sha256) bad.push(`${row.entry_id} (băm lệch)`);
  }
  return bad;
}

/** Thu hồi mọi tệp đang dùng + xóa đối tượng Storage + tắt chế độ. Luôn dùng được. */
export async function revokeEverything(reason: string): Promise<{ revoked: number; removedObjects: number }> {
  const admin = adminClient(localEnvOrThrow());
  const rows = await liveRows();
  const { data, error } = await admin.rpc("gateway_revoke_contest_audio", { p_school_id: null, p_reason: reason });
  if (error) throw new Error("Không thu hồi được (hàm CSDL báo lỗi).");
  let removedObjects = 0;
  for (let index = 0; index < rows.length; index += 50) {
    const keys = rows.slice(index, index + 50).map((row) => row.storage_key);
    const removed = await admin.storage.from(CONTEST_BUCKET).remove(keys);
    removedObjects += removed.data?.length ?? 0;
  }
  return { revoked: typeof data === "number" ? data : rows.length, removedObjects };
}
