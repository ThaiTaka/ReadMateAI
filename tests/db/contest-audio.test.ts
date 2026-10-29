import { createHash, randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", async () => {
  const { admin } = await import("./helpers");
  return { createSupabaseAdminClient: () => admin };
});

import { setLocalContestAudio } from "../../scripts/lib/test-fixtures";
import { wav } from "../unit/audio-library/fixtures";
import type { ContestEntry } from "@/features/contest-audio/catalog";
import { CONTEST_BUCKET, CONTEST_VOICE } from "@/features/contest-audio/config";
import { learningAudioStatus, loadLearningAudio } from "@/server/audio-playback/learning";
import { contestEntry } from "@/server/contest-audio/catalog";
import { listContestAudio, loadContestAudio, resolveContestAudio } from "@/server/contest-audio/playback";
import type { StudentContext } from "@/server/student-gateway/context";
import { admin, newSchool, newTeacher, publicClient, rpcOk, type Actor } from "./helpers";
import { linkedStudent } from "./scoring-helpers";

/**
 * Chế độ trình diễn âm thanh (docs/CONTEST_AUDIO.md) trên Supabase LOCAL thật: cổng bật/tắt, đăng ký idempotent, bất biến, thu hồi, cô lập
 * theo trường, thiết bị/đồng ý, chặn mục rủi ro cách đọc, RLS, đọc Storage riêng + toàn vẹn SHA-256, và miền dữ liệu tách hẳn bản ghi giáo
 * viên / giọng máy đã duyệt. Tệp là SÓNG TỔNG HỢP của bộ kiểm thử (không phải giọng nhà cung cấp nào); KHÔNG gọi dịch vụ ngoài.
 */

const sha = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const SOUND = wav(1);
const err = (r: { error: { message?: string } | null }) => r.error?.message ?? null;

let storageUp = false;
const storage = (name: string, fn: () => Promise<void>) =>
  it(name, async (ctx) => {
    if (!storageUp) return ctx.skip();
    await fn();
  });

type Room = { schoolId: string; teacher: Actor; classId: string; studentId: string; device: Actor };

async function room(options: { consent?: boolean } = {}): Promise<Room> {
  const schoolId = await newSchool();
  const teacher = await newTeacher(schoolId, "contest");
  const classId = await rpcOk(
    teacher.client.rpc("teacher_create_class", {
      p_name: `CA ${randomUUID().slice(0, 6)}`,
      p_school_year: "2026-2027",
    }),
  );
  const { studentId, device } = await linkedStudent(teacher.client, classId, { consent: options.consent });
  return { schoolId, teacher, classId, studentId, device };
}

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

const entryOf = (id: string): ContestEntry => contestEntry(id)!;

type Registered = { versionId: string; key: string };

/** Đăng ký như công cụ `audio:contest` (khóa secret local): tải lên bucket riêng rồi gọi hàm CSDL. */
async function register(
  r: { schoolId: string },
  entry: ContestEntry,
  options: { bytes?: Uint8Array; assetKey?: string; contentHash?: string; upload?: boolean } = {},
) {
  const bytes = options.bytes ?? SOUND;
  const versionId = randomUUID();
  const key = `${r.schoolId}/${versionId}.mp3`;
  if (storageUp && options.upload !== false) {
    const up = await admin.storage
      .from(CONTEST_BUCKET)
      .upload(key, bytes, { contentType: "audio/mpeg", upsert: false });
    if (up.error) throw up.error;
  }
  const result = await admin.rpc("gateway_register_contest_audio", {
    p_school_id: r.schoolId,
    p_version_id: versionId,
    p_entry_id: entry.id,
    p_spoken_text: entry.text,
    p_content_hash: options.contentHash ?? entry.contentHash,
    p_asset_key: options.assetKey ?? entry.assetKey,
    p_config_version: CONTEST_VOICE.configVersion,
    p_risk_class: entry.riskClass,
    p_risk_reasons: entry.riskReasons.join(","),
    p_storage_key: key,
    p_mime_type: "audio/mpeg",
    p_size_bytes: bytes.byteLength,
    p_duration_ms: 1000,
    p_content_sha256: sha(bytes),
    p_peak_milli: 800,
    p_rms_milli: 100,
  });
  return { result, versionId, key } satisfies { result: unknown } & Registered;
}

const resolveRpc = (r: Room, entry: ContestEntry, auth?: string) =>
  admin.rpc("gateway_resolve_contest_audio", {
    p_auth_user_id: auth ?? r.device.id,
    p_student_id: r.studentId,
    p_entry_id: entry.id,
    p_content_hash: entry.contentHash,
    p_asset_key: entry.assetKey,
  });

const listRpc = (r: Room, entries: ContestEntry[]) =>
  admin.rpc("gateway_list_contest_audio", {
    p_auth_user_id: r.device.id,
    p_student_id: r.studentId,
    p_units: entries.map((e) => ({ entryId: e.id, contentHash: e.contentHash, assetKey: e.assetKey })),
  });

const on = () => setLocalContestAudio({ enabled: true, gate: true });
const off = () => setLocalContestAudio({ enabled: false, gate: false });

beforeAll(async () => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
  const buckets = await admin.storage.listBuckets();
  storageUp = !buckets.error;
  if (!storageUp && process.env.REQUIRE_STORAGE === "1") {
    throw new Error("REQUIRE_STORAGE=1 nhưng Storage local không chạy — dùng `npm run db:start`.");
  }
  if (storageUp && !buckets.data?.some((bucket) => bucket.name === CONTEST_BUCKET)) {
    const created = await admin.storage.createBucket(CONTEST_BUCKET, { public: false });
    if (created.error) throw created.error;
  }
  on();
}, 120_000);

afterAll(() => {
  off();
  vi.unstubAllEnvs();
});

const B = () => entryOf("letter:b");
const GH = () => entryOf("phoneme:gh");

describe("cổng bật/tắt: cả cờ hệ thống VÀ cổng local đều phải bật", () => {
  it("chưa bật → không đăng ký, không phát, danh sách rỗng (không lỗi)", async () => {
    const r = await room();
    for (const state of [
      { enabled: false, gate: false },
      { enabled: true, gate: false },
      { enabled: false, gate: true },
    ]) {
      setLocalContestAudio(state);
      try {
        const reg = await register(r, B(), { upload: false });
        expect(err(reg.result as { error: { message?: string } | null })).toBe("CONTEST_AUDIO_DISABLED");
        expect(err(await resolveRpc(r, B()))).toBe("CONTEST_AUDIO_DISABLED");
        const none = await listRpc(r, [B()]);
        expect(none.error).toBeNull();
        expect(none.data).toEqual([]);
      } finally {
        on();
      }
    }
  });

  it("tắt lại sau khi đã đăng ký → ngừng phát ngay (tệp vẫn còn nhưng không ai nghe được)", async () => {
    const r = await room();
    await register(r, B(), { upload: false });
    expect(err(await resolveRpc(r, B()))).toBeNull();
    off();
    try {
      expect(err(await resolveRpc(r, B()))).toBe("CONTEST_AUDIO_DISABLED");
    } finally {
      on();
    }
  });
});

describe("đăng ký và điều kiện phát", () => {
  it("đăng ký rồi phát: trả metadata (không phải đường dẫn công khai); đăng ký lại cùng nội dung → reused", async () => {
    const r = await room();
    const first = await register(r, B(), { upload: false });
    expect(err(first.result as never)).toBeNull();
    expect((first.result as unknown as { data: { reused: boolean } }).data.reused).toBe(false);
    const again = await register(r, B(), { upload: false });
    expect((again.result as unknown as { data: { reused: boolean; versionId: string } }).data).toMatchObject({
      reused: true,
      versionId: first.versionId,
    });
    const resolved = await resolveRpc(r, B());
    expect(resolved.data).toMatchObject({
      versionId: first.versionId,
      mimeType: "audio/mpeg",
      riskClass: "standard",
      playable: true,
    });
    expect(JSON.stringify(resolved.data)).not.toMatch(/https?:|signed|token/u);
  });

  it("chữ/giọng đã đổi (băm nội dung hoặc khóa tệp lệch) → tệp cũ không còn khớp", async () => {
    const r = await room();
    await register(r, B(), { upload: false });
    const stale = { ...B(), contentHash: "0".repeat(64) } as ContestEntry;
    expect(err(await resolveRpc(r, stale))).toBe("AUDIO_NOT_AVAILABLE");
    const otherKey = { ...B(), assetKey: "1".repeat(64) } as ContestEntry;
    expect(err(await resolveRpc(r, otherKey))).toBe("AUDIO_NOT_AVAILABLE");
  });

  it("đăng ký bản mới (khóa tệp khác) thay thế bản cũ: chỉ MỘT bản đang dùng", async () => {
    const r = await room();
    const first = await register(r, B(), { upload: false });
    const second = await register(r, B(), { upload: false, assetKey: "2".repeat(64) });
    expect(err(second.result as never)).toBeNull();
    const rows = await admin
      .from("contest_audio_assets")
      .select("id, revoked_at, revoke_reason")
      .eq("school_id", r.schoolId)
      .eq("entry_id", "letter:b");
    expect(rows.data?.filter((row) => row.revoked_at === null)).toHaveLength(1);
    expect(rows.data?.find((row) => row.id === first.versionId)?.revoke_reason).toBe("superseded_by_new_version");
  });

  it("thiết bị lạ → FORBIDDEN; chưa có đồng ý learning_data → CONSENT_REQUIRED", async () => {
    const r = await room();
    await register(r, B(), { upload: false });
    expect(err(await resolveRpc(r, B(), randomUUID()))).toBe("FORBIDDEN");
    const noConsent = await room({ consent: false });
    await register(noConsent, B(), { upload: false });
    expect(err(await resolveRpc(noConsent, B()))).toBe("CONSENT_REQUIRED");
  });

  it("cô lập theo trường: học sinh trường khác không nghe được tệp của trường này", async () => {
    const a = await room();
    const b = await room();
    await register(a, B(), { upload: false });
    expect(err(await resolveRpc(a, B()))).toBeNull();
    expect(err(await resolveRpc(b, B()))).toBe("AUDIO_NOT_AVAILABLE");
    const listed = await listRpc(b, [B()]);
    expect(listed.data).toEqual([]);
  });

  it("mục rủi ro cách đọc: mặc định GIỮ (không phát, danh sách ghi 'held'); chỉ phát khi cờ riêng bật", async () => {
    const r = await room();
    await register(r, GH(), { upload: false });
    await register(r, B(), { upload: false });
    expect(err(await resolveRpc(r, GH()))).toBe("AUDIO_NOT_AVAILABLE");
    const held = await listRpc(r, [B(), GH()]);
    expect(held.data).toEqual([
      expect.objectContaining({ entryId: "letter:b", state: "playable", riskClass: "standard" }),
      expect.objectContaining({ entryId: "phoneme:gh", state: "held", riskClass: "needs_verification" }),
    ]);
    setLocalContestAudio({ enabled: true, gate: true, playUnverified: true });
    try {
      expect(err(await resolveRpc(r, GH()))).toBeNull();
      const allowed = await listRpc(r, [GH()]);
      expect(allowed.data).toEqual([expect.objectContaining({ state: "playable", riskClass: "needs_verification" })]);
    } finally {
      on();
    }
  });

  it("thu hồi toàn bộ luôn dùng được kể cả khi chế độ đã tắt; sau đó không phát được và không đăng ký lại được tệp cũ trùng", async () => {
    const r = await room();
    await register(r, B(), { upload: false });
    off();
    try {
      const revoked = await admin.rpc("gateway_revoke_contest_audio", {
        p_school_id: r.schoolId,
        p_reason: "revoked_by_test",
      });
      expect(revoked.error).toBeNull();
      expect(revoked.data).toBe(1);
    } finally {
      on();
    }
    expect(err(await resolveRpc(r, B()))).toBe("AUDIO_NOT_AVAILABLE");
    expect(err(await admin.rpc("gateway_revoke_contest_audio", { p_school_id: r.schoolId, p_reason: "x" }))).toBe(
      "INVALID_INPUT",
    );
  });
});

describe("bất biến và nguồn gốc cố định", () => {
  it("không xóa; chỉ thu hồi một lần; mọi cột khác bất biến", async () => {
    const r = await room();
    const reg = await register(r, B(), { upload: false });
    const id = reg.versionId;
    expect((await admin.from("contest_audio_assets").delete().eq("id", id)).error?.message).toMatch(
      /CONTEST_AUDIO_NO_DELETE/u,
    );
    for (const patch of [
      { spoken_text: "bờ" },
      { risk_class: "needs_verification" as const },
      { storage_key: `${r.schoolId}/${randomUUID()}.mp3` },
      { content_sha256: "f".repeat(64) },
    ]) {
      expect((await admin.from("contest_audio_assets").update(patch).eq("id", id)).error?.message).toMatch(
        /CONTEST_AUDIO_IMMUTABLE/u,
      );
    }
    expect(
      (
        await admin
          .from("contest_audio_assets")
          .update({ revoked_at: new Date().toISOString(), revoke_reason: "bởi kiểm thử" })
          .eq("id", id)
      ).error,
    ).toBeNull();
    expect(
      (await admin.from("contest_audio_assets").update({ revoke_reason: "đổi lại" }).eq("id", id)).error?.message,
    ).toMatch(/CONTEST_AUDIO_IMMUTABLE/u);
  });

  it("nguồn gốc bị ràng buộc cứng: không thể ghi 'teacher_recording' hay trạng thái khác", async () => {
    const r = await room();
    const row = {
      school_id: r.schoolId,
      entry_id: "letter:b",
      entry_kind: "letter",
      spoken_text: "bê",
      content_hash: "a".repeat(64),
      asset_key: "b".repeat(64),
      provider: "viettel",
      voice_key: "vi-male-1",
      speed: "slow",
      config_version: CONTEST_VOICE.configVersion,
      risk_class: "standard",
      storage_key: `${r.schoolId}/${randomUUID()}.mp3`,
      mime_type: "audio/mpeg",
      size_bytes: 100,
      duration_ms: 1000,
      content_sha256: "c".repeat(64),
      peak_milli: 500,
      rms_milli: 50,
    };
    for (const bad of [
      { origin: "teacher_recording" },
      { purpose: "teacher_approved" },
      { technical_check: "approved" },
      { provider: "mock" },
      { config_version: "provisional-0" },
      { config_version: "viettel-minhquan-0.9-v1" },
    ]) {
      const result = await admin.from("contest_audio_assets").insert({ ...row, ...bad } as never);
      expect(result.error, JSON.stringify(bad)).not.toBeNull();
    }
    // Khóa đối tượng phải nằm trong thư mục của CHÍNH trường (migration 20261104090100): không trỏ sang đối tượng của trường khác.
    const otherSchool = await newSchool();
    const foreign = await admin
      .from("contest_audio_assets")
      .insert({ ...row, storage_key: `${otherSchool}/${randomUUID()}.mp3` } as never);
    expect(foreign.error?.message).toMatch(/contest_audio_assets_key_in_school_folder/u);
    expect((await admin.from("contest_audio_assets").insert(row as never)).error).toBeNull();
  });

  it("miền tách biệt: đăng ký âm thanh trình diễn không tạo dòng nào ở bản ghi giáo viên hay giọng máy đã duyệt", async () => {
    const r = await room();
    await register(r, B(), { upload: false });
    await register(r, entryOf("instruction:listen_letter"), { upload: false });
    for (const table of ["audio_assets", "audio_asset_versions", "tts_audio_versions", "tts_script_reviews"] as const) {
      const rows = await admin.from(table).select("id", { count: "exact", head: true }).eq("school_id", r.schoolId);
      expect(rows.count, table).toBe(0);
    }
  });
});

describe("RLS", () => {
  it("giáo viên đọc được tệp của TRƯỜNG MÌNH, không thấy trường khác, không ghi được; khách và thiết bị học sinh không đọc được", async () => {
    const a = await room();
    const b = await room();
    const reg = await register(a, B(), { upload: false });
    const own = await a.teacher.client
      .from("contest_audio_assets")
      .select("id, origin, purpose")
      .eq("id", reg.versionId);
    expect(own.data).toEqual([{ id: reg.versionId, origin: "ai_generated", purpose: "contest_preview" }]);
    expect((await b.teacher.client.from("contest_audio_assets").select("id").eq("id", reg.versionId)).data).toEqual([]);
    expect((await a.device.client.from("contest_audio_assets").select("id")).data ?? []).toEqual([]);
    expect((await publicClient().from("contest_audio_assets").select("id")).error).not.toBeNull();
    expect((await a.teacher.client.from("contest_audio_assets").insert({} as never)).error).not.toBeNull();
    expect(
      (await a.teacher.client.from("contest_audio_assets").update({ risk_class: "standard" }).eq("id", reg.versionId))
        .data ?? [],
    ).toEqual([]);
    expect((await a.teacher.client.from("contest_audio_assets").delete().eq("id", reg.versionId)).error).not.toBeNull();
    for (const fn of [
      "gateway_register_contest_audio",
      "gateway_resolve_contest_audio",
      "gateway_list_contest_audio",
      "gateway_revoke_contest_audio",
    ] as const) {
      const called = await a.teacher.client.rpc(fn as never, {} as never);
      expect(called.error, fn).not.toBeNull();
    }
  });
});

describe("dịch vụ máy chủ: đọc Storage riêng tư, toàn vẹn, không đi vòng", () => {
  storage("phát tệp đúng nội dung; tệp bị thay hoặc mất → không phát", async () => {
    const r = await room();
    const reg = await register(r, B());
    const loaded = await loadContestAudio(ctxFor(r), r.studentId, B());
    expect(loaded.ok).toBe(true);
    if (loaded.ok) expect(sha(loaded.data.bytes)).toBe(sha(SOUND));

    const replaced = await admin.storage.from(CONTEST_BUCKET).update(reg.key, wav(2), { contentType: "audio/mpeg" });
    expect(replaced.error).toBeNull();
    expect((await loadContestAudio(ctxFor(r), r.studentId, B())).ok).toBe(false);

    await admin.storage.from(CONTEST_BUCKET).remove([reg.key]);
    const gone = await loadContestAudio(ctxFor(r), r.studentId, B());
    expect(gone.ok).toBe(false);
  });

  storage("ngoài máy local (URL Supabase là Cloud) → không hỏi CSDL, không phát", async () => {
    const r = await room();
    await register(r, B());
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://abcdefgh.supabase.co");
    try {
      expect((await resolveContestAudio(ctxFor(r), r.studentId, B())).ok).toBe(false);
      expect(await listContestAudio(ctxFor(r), r.studentId, [B()])).toEqual({ ok: true, data: [] });
    } finally {
      vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
    }
  });

  storage(
    "Học tập: chữ chưa có bản ghi giáo viên → dùng tệp trình diễn, ghi rõ nguồn; mục rủi ro nằm trong 'held'",
    async () => {
      const r = await room();
      await register(r, B());
      await register(r, entryOf("phoneme:b"));
      await register(r, GH());
      const status = await learningAudioStatus(ctxFor(r), r.studentId);
      expect(status.ok).toBe(true);
      if (!status.ok) return;
      expect(status.data.preview).toBe(true);
      expect(status.data.units).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ kind: "letter", text: "b", source: "contest_preview" }),
          expect.objectContaining({ kind: "phoneme", text: "b", source: "contest_preview" }),
        ]),
      );
      expect(status.data.units.some((unit) => unit.text === "gh")).toBe(false);
      expect(status.data.held).toEqual([{ kind: "phoneme", text: "gh" }]);

      const audio = await loadLearningAudio(ctxFor(r), r.studentId, "letter", "b");
      expect(audio.ok).toBe(true);
      // Mục bị giữ không phát được qua đường nghe chữ.
      expect((await loadLearningAudio(ctxFor(r), r.studentId, "phoneme", "gh")).ok).toBe(false);
      // Học sinh đã tắt âm thanh → không phát, không đi vòng sang nguồn trình diễn.
      const muted = await loadLearningAudio(ctxFor(r, "off"), r.studentId, "letter", "b");
      expect(muted.ok).toBe(false);
      expect(
        (await learningAudioStatus(ctxFor(r, "off"), r.studentId)).ok &&
          (await learningAudioStatus(ctxFor(r, "off"), r.studentId)),
      ).toMatchObject({ data: { muted: true, units: [] } });
    },
  );

  storage("chế độ tắt → Học tập không có đơn vị trình diễn và không phát được", async () => {
    const r = await room();
    await register(r, B());
    off();
    try {
      const status = await learningAudioStatus(ctxFor(r), r.studentId);
      expect(status.ok && status.data.units.filter((unit) => unit.source === "contest_preview")).toEqual([]);
      expect((await loadLearningAudio(ctxFor(r), r.studentId, "letter", "b")).ok).toBe(false);
    } finally {
      on();
    }
  });
});
