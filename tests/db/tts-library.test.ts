import { createHash, randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", async () => {
  const { admin } = await import("./helpers");
  return { createSupabaseAdminClient: () => admin };
});

import {
  enableLocalTestFixtures,
  setLocalFixturesAllowed,
  setLocalStudentTtsPlayback,
  setLocalTtsLibrary,
} from "../../scripts/lib/test-fixtures";
import { wav } from "../unit/audio-library/fixtures";
import { instructionEntryId, libraryEntry, LIBRARY_ENTRIES, type LibraryEntry } from "@/server/tts-library/entries";
import { loadInstructionAudio, resolveInstructionAudio } from "@/server/tts-library/playback";
import type { StudentContext } from "@/server/student-gateway/context";
import { admin, newDevice, newSchool, newTeacher, publicClient, rpcOk, type Actor } from "./helpers";
import { linkedStudent } from "./scoring-helpers";

/**
 * R10.5 — thư viện giọng máy trên Supabase LOCAL thật: hai lần xác nhận của giáo viên (lời đọc → tệp), bất biến, một bản duyệt mỗi lời
 * đọc, thu hồi, cách ly theo trường và hàm gateway kiểm tra lại mọi điều kiện khi phát. Tệp là SÓNG TỔNG HỢP của bộ kiểm thử (không phải
 * giọng của nhà cung cấp nào); KHÔNG gọi dịch vụ ngoài. Hai cờ hệ thống chỉ bật trên local và trả về TẮT khi xong.
 */

const sha = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const BYTES = wav(1);
const err = (r: { error: { message?: string } | null }) => r.error?.message ?? null;

type Room = { schoolId: string; teacher: Actor; classId: string; studentId: string; device: Actor };
let storageUp = false;

async function room(options: { consent?: boolean } = {}): Promise<Room> {
  const schoolId = await newSchool();
  const teacher = await newTeacher(schoolId, "tts");
  const classId = await rpcOk(
    teacher.client.rpc("teacher_create_class", {
      p_name: `TTS ${randomUUID().slice(0, 6)}`,
      p_school_year: "2026-2027",
    }),
  );
  const { studentId, device } = await linkedStudent(teacher.client, classId, { consent: options.consent });
  return { schoolId, teacher, classId, studentId, device };
}

const entry = (variant = "listen_letter"): LibraryEntry => libraryEntry(instructionEntryId(variant))!;

const approveScript = (r: Room, e: LibraryEntry, confirmed = true) =>
  r.teacher.client.rpc("teacher_review_tts_script", {
    p_entry_id: e.id,
    p_content_hash: e.contentHash,
    p_decision: "approve",
    p_pronunciation_confirmed: confirmed,
    p_note: "",
  });

type Registered = { versionId: string; key: string };

/** Đăng ký một tệp (và lưu vào Storage nếu có) như máy chủ làm sau khi tạo; trả mã phiên bản. */
async function register(
  r: Room,
  e: LibraryEntry,
  options: { bytes?: Uint8Array; assetKey?: string; testOnly?: boolean; key?: string } = {},
): Promise<{ result: Awaited<ReturnType<Actor["client"]["rpc"]>>; versionId: string; key: string }> {
  const bytes = options.bytes ?? BYTES;
  const versionId = randomUUID();
  const key = options.key ?? `${r.schoolId}/${versionId}.wav`;
  if (storageUp && !options.key) {
    const up = await admin.storage.from("tts-audio").upload(key, bytes, { contentType: "audio/wav", upsert: false });
    if (up.error) throw up.error;
  }
  const result = await r.teacher.client.rpc("teacher_register_tts_version", {
    p_version_id: versionId,
    p_entry_id: e.id,
    p_purpose: e.purpose,
    p_text: e.text,
    p_content_hash: e.contentHash,
    p_asset_key: options.assetKey ?? e.assetKey,
    p_provider: "viettel",
    p_voice_key: "vi-male-1",
    p_speed: "slow",
    p_config_version: "viettel-minhquan-0.9-v1",
    p_storage_key: key,
    p_mime_type: "audio/wav",
    p_size_bytes: bytes.byteLength,
    p_duration_ms: 1000,
    p_content_sha256: sha(bytes),
    p_test_only: options.testOnly ?? false,
  });
  return { result, versionId, key };
}

const review = (r: Room, versionId: string, decision: "approve" | "reject", overrides: Record<string, unknown> = {}) =>
  r.teacher.client.rpc("teacher_review_tts_version", {
    p_version_id: versionId,
    p_decision: decision,
    p_note: decision === "reject" ? "Đọc chưa tự nhiên" : "",
    p_listened: true,
    p_pronunciation_confirmed: true,
    ...overrides,
  });

/** Dựng một tệp đã DUYỆT đầy đủ cho một lời đọc. */
async function approved(r: Room, e: LibraryEntry = entry()): Promise<Registered> {
  await rpcOk(approveScript(r, e));
  const { result, versionId, key } = await register(r, e);
  await rpcOk(Promise.resolve(result));
  await rpcOk(review(r, versionId, "approve"));
  return { versionId, key };
}

const resolve = (
  r: Room,
  e: LibraryEntry,
  overrides: { auth?: string; student?: string; hash?: string; assetKey?: string } = {},
) =>
  admin.rpc("gateway_resolve_tts_line", {
    p_auth_user_id: overrides.auth ?? r.device.id,
    p_student_id: overrides.student ?? r.studentId,
    p_entry_id: e.id,
    p_content_hash: overrides.hash ?? e.contentHash,
    p_asset_key: overrides.assetKey ?? e.assetKey,
  });

const ctxFor = (r: Room, sound: "on" | "off" = "on", auth?: string): StudentContext => ({
  authUserId: auth ?? r.device.id,
  admin: admin as unknown as StudentContext["admin"],
  students: [
    {
      id: r.studentId,
      displayName: "Bé thử",
      avatarKey: "may",
      motionPreference: "system",
      soundPreference: sound,
      className: "L",
    },
  ],
});

/** Câu giả chỉ để kiểm tra đường phát: dịch vụ chỉ dùng biến thể của câu và mức hỗ trợ/trạng thái của lượt hỏi. */
const questionOf = (r: Room, support: 0 | 1 | 2 | 3 = 3) => ({
  id: randomUUID(),
  student_id: r.studentId,
  status: "open",
  support_level: support,
});
const itemOf = (variant = "listen_letter") => ({ variant }) as never;

beforeAll(async () => {
  const buckets = await admin.storage.listBuckets();
  storageUp = !buckets.error && (buckets.data ?? []).some((bucket) => bucket.name === "tts-audio");
  if (!storageUp && process.env.REQUIRE_STORAGE === "1") {
    throw new Error(
      "REQUIRE_STORAGE=1 nhưng bucket tts-audio không có — chạy `npm run db:start` (bucket khai báo ở config.toml).",
    );
  }
  if (!storageUp) console.warn("BỎ QUA phần đọc tệp: Storage/bucket tts-audio chưa chạy.");
  enableLocalTestFixtures();
  setLocalTtsLibrary(true);
  setLocalStudentTtsPlayback(true);
}, 120_000);

afterAll(() => {
  setLocalStudentTtsPlayback(false);
  setLocalTtsLibrary(false);
});

const storage = (name: string, fn: () => Promise<void>) =>
  it(name, async (ctx) => {
    if (!storageUp) return ctx.skip();
    await fn();
  });

describe("danh mục và khóa tệp", () => {
  it("34 lời đọc cố định (17 câu lệnh + 17 phản hồi), khóa tệp theo nhà cung cấp/giọng/tốc độ/phiên bản cấu hình/chữ, không trùng", () => {
    expect(LIBRARY_ENTRIES).toHaveLength(34);
    expect(LIBRARY_ENTRIES.filter((e) => e.purpose === "instruction")).toHaveLength(17);
    expect(LIBRARY_ENTRIES.filter((e) => e.purpose === "feedback")).toHaveLength(17);
    expect(new Set(LIBRARY_ENTRIES.map((e) => e.id)).size).toBe(34);
    expect(new Set(LIBRARY_ENTRIES.map((e) => e.assetKey)).size).toBeLessThanOrEqual(34);
    for (const e of LIBRARY_ENTRIES) {
      expect(e.id).toMatch(/^(instruction|feedback):[a-z0-9_.]{1,60}$/u);
      expect(e.contentHash).toMatch(/^[0-9a-f]{64}$/u);
      expect(e.assetKey).toMatch(/^[0-9a-f]{64}$/u);
      expect(e.reviewStatus).toBe("pending_review");
    }
  });
});

describe("cờ hệ thống thư viện giọng máy", () => {
  it("cờ TẮT: duyệt lời đọc / đăng ký / duyệt tệp bị từ chối; thu hồi vẫn được; trạng thái báo library_enabled=false", async () => {
    const r = await room();
    const e = entry();
    await rpcOk(approveScript(r, e));
    const reg = await register(r, e);
    await rpcOk(Promise.resolve(reg.result));
    setLocalTtsLibrary(false);
    try {
      expect((await r.teacher.client.rpc("teacher_tts_status")).data).toMatchObject({ library_enabled: false });
      expect(err(await approveScript(r, entry("picture_onset")))).toBe("TTS_LIBRARY_DISABLED");
      expect(err((await register(r, entry("visual_match"))).result)).toBe("TTS_LIBRARY_DISABLED");
      expect(err(await review(r, reg.versionId, "approve"))).toBe("TTS_LIBRARY_DISABLED");
      // Thu hồi luôn được phép (dừng dùng không phụ thuộc cờ).
      const revoked = await r.teacher.client.rpc("teacher_revoke_tts_version", {
        p_version_id: reg.versionId,
        p_reason: "Dừng để kiểm tra",
      });
      expect(revoked.error).toBeNull();
    } finally {
      setLocalTtsLibrary(true);
    }
    expect((await r.teacher.client.rpc("teacher_tts_status")).data).toMatchObject({ library_enabled: true });
  });
});

describe("bước 1: duyệt lời đọc", () => {
  it("duyệt đòi xác nhận cách đọc; từ chối đòi ghi chú; dữ liệu sai → INVALID_INPUT", async () => {
    const r = await room();
    const e = entry();
    expect(err(await approveScript(r, e, false))).toBe("PRONUNCIATION_UNCONFIRMED");
    const noNote = await r.teacher.client.rpc("teacher_review_tts_script", {
      p_entry_id: e.id,
      p_content_hash: e.contentHash,
      p_decision: "reject",
      p_pronunciation_confirmed: false,
      p_note: "",
    });
    expect(err(noNote)).toBe("NOTE_REQUIRED");
    const badId = await r.teacher.client.rpc("teacher_review_tts_script", {
      p_entry_id: "word:ba",
      p_content_hash: e.contentHash,
      p_decision: "approve",
      p_pronunciation_confirmed: true,
      p_note: "",
    });
    expect(err(badId)).toBe("INVALID_INPUT");
    expect((await approveScript(r, e)).error).toBeNull();
  });

  it("đổi quyết định cùng bản băm được (lịch sử vào nhật ký); đổi chữ → bản băm khác nên bản duyệt cũ không còn áp dụng", async () => {
    const r = await room();
    const e = entry();
    await rpcOk(approveScript(r, e));
    const rows = await r.teacher.client.from("tts_script_reviews").select("decision").eq("entry_id", e.id);
    expect(rows.data).toEqual([{ decision: "approved" }]);
    // Chữ đổi → bản băm khác → đăng ký tệp với bản băm mới bị từ chối (chưa duyệt lời đọc mới).
    const changed = await register(r, { ...e, contentHash: "a".repeat(64) });
    expect(err(changed.result)).toBe("SCRIPT_NOT_APPROVED");
  });

  it("rút duyệt lời đọc (từ chối) thu hồi MỌI tệp đang chờ/đang dùng của lời đọc đó", async () => {
    const r = await room();
    const e = entry();
    const done = await approved(r, e);
    await rpcOk(
      r.teacher.client.rpc("teacher_review_tts_script", {
        p_entry_id: e.id,
        p_content_hash: e.contentHash,
        p_decision: "reject",
        p_pronunciation_confirmed: false,
        p_note: "Cần sửa cách xưng hô",
      }),
    );
    const version = await admin
      .from("tts_audio_versions")
      .select("status, revoke_reason")
      .eq("id", done.versionId)
      .single();
    expect(version.data).toMatchObject({ status: "revoked" });
    expect(err(await resolve(r, e))).toBe("AUDIO_NOT_AVAILABLE");
  });
});

describe("bước 2: tệp âm thanh", () => {
  it("đăng ký đòi lời đọc đã duyệt, khóa lưu trữ đúng trường, không tạo trùng khi còn bản đang chờ/đang dùng; luôn bắt đầu chờ duyệt", async () => {
    const r = await room();
    const e = entry();
    expect(err((await register(r, e)).result)).toBe("SCRIPT_NOT_APPROVED");
    await rpcOk(approveScript(r, e));
    const first = await register(r, e);
    expect(first.result.error).toBeNull();
    expect(first.result.data).toMatchObject({ version_no: 1 });
    const row = await admin
      .from("tts_audio_versions")
      .select("status, test_only, provider")
      .eq("id", first.versionId)
      .single();
    expect(row.data).toEqual({ status: "pending_review", test_only: false, provider: "viettel" });
    // Cùng khóa tệp khi còn bản chờ → bị chặn.
    expect((await register(r, e)).result.error).not.toBeNull();
    // Khóa lưu trữ không thuộc trường của giáo viên → từ chối.
    const other = await register(r, entry("picture_onset"), { key: `${randomUUID()}/${randomUUID()}.wav` });
    expect([err(other.result)]).toContain("SCRIPT_NOT_APPROVED");
    await rpcOk(approveScript(r, entry("picture_onset")));
    const scoped = await register(r, entry("picture_onset"), { key: `${randomUUID()}/${randomUUID()}.wav` });
    expect(err(scoped.result)).toBe("TTS_SCOPE_MISMATCH");
  });

  it("duyệt đòi: đã nghe + xác nhận cách đọc; từ chối đòi ghi chú; chỉ bản chờ duyệt mới duyệt được", async () => {
    const r = await room();
    const e = entry();
    await rpcOk(approveScript(r, e));
    const reg = await register(r, e);
    expect(reg.result.error).toBeNull();
    expect(err(await review(r, reg.versionId, "approve", { p_listened: false }))).toBe("LISTEN_REQUIRED");
    expect(err(await review(r, reg.versionId, "approve", { p_pronunciation_confirmed: false }))).toBe(
      "PRONUNCIATION_UNCONFIRMED",
    );
    expect(err(await review(r, reg.versionId, "reject", { p_note: "" }))).toBe("NOTE_REQUIRED");
    expect((await review(r, reg.versionId, "approve")).error).toBeNull();
    expect(err(await review(r, reg.versionId, "approve"))).toBe("STATE_CONFLICT");
  });

  it("mỗi lời đọc chỉ MỘT bản approved: duyệt bản mới thì bản cũ thành superseded", async () => {
    const r = await room();
    const e = entry();
    const first = await approved(r, e);
    // Đổi cấu hình giọng → khóa tệp khác → được tạo bản thứ hai song song.
    const second = await register(r, e, { assetKey: "b".repeat(64) });
    expect(second.result.error).toBeNull();
    expect((await review(r, second.versionId, "approve")).error).toBeNull();
    const rows = await admin
      .from("tts_audio_versions")
      .select("id, status")
      .eq("entry_id", e.id)
      .eq("school_id", r.schoolId);
    const status = Object.fromEntries((rows.data ?? []).map((row) => [row.id, row.status]));
    expect(status[first.versionId]).toBe("superseded");
    expect(status[second.versionId]).toBe("approved");
    expect(Object.values(status).filter((s) => s === "approved")).toHaveLength(1);
  });

  it("bất biến: đổi chữ/khóa/băm/khóa lưu trữ bằng service_role bị chặn; không xóa; không chèn thẳng trạng thái đã duyệt; chuyển trạng thái trái luật bị chặn", async () => {
    const r = await room();
    const done = await approved(r);
    for (const patch of [
      { text_nfc: "Câu khác" },
      { asset_key: "c".repeat(64) },
      { content_hash: "d".repeat(64) },
      { storage_key: `${r.schoolId}/${randomUUID()}.wav` },
      { size_bytes: 5 },
      { provider: "google" },
    ]) {
      const result = await admin.from("tts_audio_versions").update(patch).eq("id", done.versionId);
      expect(result.error?.message, JSON.stringify(patch)).toMatch(/TTS_VERSION_IMMUTABLE/u);
    }
    expect((await admin.from("tts_audio_versions").delete().eq("id", done.versionId)).error?.message).toMatch(
      /TTS_RECORD_NO_DELETE/u,
    );
    const back = await admin.from("tts_audio_versions").update({ status: "pending_review" }).eq("id", done.versionId);
    expect(back.error).not.toBeNull();
    const direct = await admin.from("tts_audio_versions").insert({
      school_id: r.schoolId,
      entry_id: entry().id,
      purpose: "instruction",
      text_nfc: "Câu",
      content_hash: "e".repeat(64),
      asset_key: "e".repeat(64),
      provider: "viettel",
      voice_key: "vi-male-1",
      speed: "slow",
      config_version: "v1",
      version_no: 99,
      status: "approved",
      storage_key: `${r.schoolId}/${randomUUID()}.wav`,
      mime_type: "audio/wav",
      size_bytes: 10,
      duration_ms: 1000,
      content_sha256: "e".repeat(64),
      generated_by: r.teacher.id,
      review_listened: true,
      review_pronunciation_confirmed: true,
      reviewed_by: r.teacher.id,
      reviewed_at: new Date().toISOString(),
    });
    expect(direct.error?.message).toMatch(/TTS_VERSION_MUST_START_PENDING/u);
    expect((await admin.from("tts_script_reviews").delete().eq("school_id", r.schoolId)).error?.message).toMatch(
      /TTS_RECORD_NO_DELETE/u,
    );
  });

  it("thu hồi: bản chờ/đang dùng thu hồi được (cần lý do); sau đó không phát nữa ngay ở yêu cầu kế tiếp", async () => {
    const r = await room();
    const e = entry();
    const done = await approved(r, e);
    expect((await resolve(r, e)).error).toBeNull();
    const noReason = await r.teacher.client.rpc("teacher_revoke_tts_version", {
      p_version_id: done.versionId,
      p_reason: "",
    });
    expect(err(noReason)).toBe("NOTE_REQUIRED");
    await rpcOk(
      r.teacher.client.rpc("teacher_revoke_tts_version", {
        p_version_id: done.versionId,
        p_reason: "Phát âm chưa đúng",
      }),
    );
    expect(err(await resolve(r, e))).toBe("AUDIO_NOT_AVAILABLE");
    const again = await r.teacher.client.rpc("teacher_revoke_tts_version", {
      p_version_id: done.versionId,
      p_reason: "Lần hai",
    });
    expect(err(again)).toBe("STATE_CONFLICT");
  });
});

describe("cách ly theo trường và quyền", () => {
  it("giáo viên trường khác không thấy lời đọc/tệp, không duyệt/thu hồi được tệp của trường này; học sinh và khách không đọc được bảng", async () => {
    const a = await room();
    const b = await room();
    const done = await approved(a);
    const seen = await b.teacher.client.from("tts_audio_versions").select("id").eq("id", done.versionId);
    expect(seen.data).toEqual([]);
    expect(err(await review(b, done.versionId, "approve"))).toBe("NOT_FOUND");
    const revoke = await b.teacher.client.rpc("teacher_revoke_tts_version", {
      p_version_id: done.versionId,
      p_reason: "thử xem",
    });
    expect(err(revoke)).toBe("NOT_FOUND");
    const device = await newDevice();
    for (const table of ["tts_script_reviews", "tts_audio_versions"] as const) {
      expect((await device.client.from(table).select("*")).data ?? [], table).toEqual([]);
      expect((await publicClient().from(table).select("*")).data ?? [], table).toEqual([]);
    }
    for (const fn of [
      "teacher_review_tts_script",
      "teacher_register_tts_version",
      "teacher_review_tts_version",
      "gateway_resolve_tts_line",
    ]) {
      const denied = await device.client.rpc(fn as never, {} as never);
      expect(denied.error, fn).not.toBeNull();
    }
  });
});

describe("hàm CSDL phát cho học sinh: gateway_resolve_tts_line", () => {
  it("cờ phát TẮT → AUDIO_PLAYBACK_DISABLED; bật lại thì phát được", async () => {
    const r = await room();
    const e = entry();
    await approved(r, e);
    setLocalStudentTtsPlayback(false);
    try {
      expect(err(await resolve(r, e))).toBe("AUDIO_PLAYBACK_DISABLED");
    } finally {
      setLocalStudentTtsPlayback(true);
    }
    const ok = await resolve(r, e);
    expect(ok.error).toBeNull();
    expect(ok.data).toMatchObject({ mimeType: "audio/wav", sizeBytes: BYTES.byteLength, contentHash: sha(BYTES) });
  });

  it("chữ hoặc giọng ĐỔI (bản băm / khóa tệp không khớp) → không phát; chưa duyệt / chờ duyệt → không phát", async () => {
    const r = await room();
    const e = entry();
    await rpcOk(approveScript(r, e));
    const reg = await register(r, e);
    expect(reg.result.error).toBeNull();
    expect(err(await resolve(r, e))).toBe("AUDIO_NOT_AVAILABLE"); // chờ duyệt
    await rpcOk(review(r, reg.versionId, "approve"));
    expect((await resolve(r, e)).error).toBeNull();
    expect(err(await resolve(r, e, { hash: "f".repeat(64) }))).toBe("AUDIO_NOT_AVAILABLE");
    expect(err(await resolve(r, e, { assetKey: "f".repeat(64) }))).toBe("AUDIO_NOT_AVAILABLE");
    expect(err(await resolve(r, entry("visual_match")))).toBe("AUDIO_NOT_AVAILABLE");
  });

  it("thiết bị: lạ / hồ sơ của bạn khác → FORBIDDEN; chưa đồng ý learning_data → CONSENT_REQUIRED; trường khác → không có", async () => {
    const r = await room();
    const e = entry();
    await approved(r, e);
    const stranger = await newDevice();
    expect(err(await resolve(r, e, { auth: stranger.id }))).toBe("FORBIDDEN");
    const other = await room();
    expect(err(await resolve(r, e, { auth: other.device.id }))).toBe("FORBIDDEN");
    expect(err(await resolve(r, e, { student: other.studentId }))).toBe("FORBIDDEN");
    expect(err(await resolve(other, e))).toBe("AUDIO_NOT_AVAILABLE"); // trường khác không có bản duyệt
    const noConsent = await room({ consent: false });
    await approved(noConsent, e);
    expect(err(await resolve(noConsent, e))).toBe("CONSENT_REQUIRED");
  });

  it("tệp kiểm thử (test_only) KHÔNG phát khi môi trường kiểm thử tắt; đầu vào xấu → INVALID_INPUT", async () => {
    const r = await room();
    const e = entry();
    await rpcOk(approveScript(r, e));
    const reg = await register(r, e, { testOnly: true });
    expect(reg.result.error).toBeNull();
    await rpcOk(review(r, reg.versionId, "approve"));
    expect((await resolve(r, e)).error).toBeNull();
    setLocalFixturesAllowed(false);
    try {
      expect(err(await resolve(r, e))).toBe("AUDIO_NOT_AVAILABLE");
      expect(err((await register(r, entry("visual_match"), { testOnly: true })).result)).not.toBeNull();
    } finally {
      enableLocalTestFixtures();
    }
    expect(err(await resolve(r, e, { hash: "khong-phai-hash" }))).toBe("INVALID_INPUT");
    const badEntry = await admin.rpc("gateway_resolve_tts_line", {
      p_auth_user_id: r.device.id,
      p_student_id: r.studentId,
      p_entry_id: "word:ba",
      p_content_hash: e.contentHash,
      p_asset_key: e.assetKey,
    });
    expect(err(badEntry)).toBe("INVALID_INPUT");
  });
});

describe("đường phát của máy chủ (đọc Storage riêng tư, chính sách chống lộ đáp án)", () => {
  storage("phát câu lệnh ở H3/H2: đúng byte đã duyệt (kích thước + SHA-256), đúng loại tệp", async () => {
    const r = await room();
    await approved(r, entry("listen_letter"));
    for (const support of [3, 2] as const) {
      const played = await loadInstructionAudio(ctxFor(r), questionOf(r, support), itemOf());
      expect(played.ok, `H${support}`).toBe(true);
      if (played.ok) {
        expect(played.data.mimeType).toBe("audio/wav");
        expect(sha(played.data.bytes)).toBe(sha(BYTES));
      }
    }
  });

  it("câu lệnh bị chính sách giữ lại ở H1 (chỉ qua Trợ giúp, chưa có đường ghi nhận) và H0 (tự làm) → AUDIO_NOT_PERMITTED, không đọc CSDL phát", async () => {
    const r = await room();
    await approved(r, entry("listen_letter"));
    for (const support of [1, 0] as const) {
      expect(await resolveInstructionAudio(ctxFor(r), questionOf(r, support), itemOf())).toEqual({
        ok: false,
        code: "AUDIO_NOT_PERMITTED",
      });
    }
  });

  it("tắt âm thanh / câu đã hủy → AUDIO_NOT_PERMITTED; biến thể chưa có tệp → AUDIO_NOT_AVAILABLE", async () => {
    const r = await room();
    await approved(r, entry("listen_letter"));
    expect(await resolveInstructionAudio(ctxFor(r, "off"), questionOf(r), itemOf())).toEqual({
      ok: false,
      code: "AUDIO_NOT_PERMITTED",
    });
    expect(await resolveInstructionAudio(ctxFor(r), { ...questionOf(r), status: "void" }, itemOf())).toEqual({
      ok: false,
      code: "AUDIO_NOT_PERMITTED",
    });
    const missing = await resolveInstructionAudio(ctxFor(r), questionOf(r), itemOf("visual_match"));
    expect(missing).toEqual({ ok: false, code: "AUDIO_NOT_AVAILABLE" });
  });

  storage("tệp bị thay hoặc mất trong Storage → AUDIO_NOT_AVAILABLE, không phát tệp sai", async () => {
    const r = await room();
    const done = await approved(r, entry("listen_letter"));
    const up = await admin.storage
      .from("tts-audio")
      .upload(done.key, wav(2), { contentType: "audio/wav", upsert: true });
    expect(up.error).toBeNull();
    expect(await loadInstructionAudio(ctxFor(r), questionOf(r), itemOf())).toEqual({
      ok: false,
      code: "AUDIO_NOT_AVAILABLE",
    });
    await admin.storage.from("tts-audio").remove([done.key]);
    expect(await loadInstructionAudio(ctxFor(r), questionOf(r), itemOf())).toEqual({
      ok: false,
      code: "AUDIO_NOT_AVAILABLE",
    });
  });
});
