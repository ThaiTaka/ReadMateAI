import { createHash, randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", async () => {
  const { admin } = await import("./helpers");
  return { createSupabaseAdminClient: () => admin };
});

import {
  enableLocalTestFixtures,
  setLocalStudentAudioPlayback,
  setLocalTeacherAudioApproval,
} from "../../scripts/lib/test-fixtures";
import { wav } from "../unit/audio-library/fixtures";
import { learningAudioStatus, loadLearningAudio } from "@/server/audio-playback/learning";
import type { StudentContext } from "@/server/student-gateway/context";
import { admin, newDevice, newSchool, newTeacher, rpcOk, type Actor } from "./helpers";
import { linkedStudent } from "./scoring-helpers";

/**
 * R10.4 — nghe chữ KHI HỌC trên Supabase LOCAL thật: hàm CSDL `gateway_resolve_learning_audio` / `gateway_list_learning_audio`
 * (điều kiện đủ/thiếu, tên chữ cái ≠ âm của chữ, cách ly theo trường, thu hồi) và dịch vụ máy chủ (đọc Storage riêng tư, toàn vẹn
 * tệp). Bản ghi là SÓNG TỔNG HỢP của bộ kiểm thử — không giọng người thật. Cờ hệ thống chỉ bật trên local và trả về TẮT khi xong.
 */

type Room = { schoolId: string; teacher: Actor; classId: string; studentId: string; device: Actor };

let storageUp = false;
const sha = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const SOUND = wav(1);
const err = (r: { error: { message?: string } | null }) => r.error?.message ?? null;

const ctxFor = (room: Room, sound: "on" | "off" = "on", auth?: string): StudentContext => ({
  authUserId: auth ?? room.device.id,
  admin: admin as unknown as StudentContext["admin"],
  students: [
    {
      id: room.studentId,
      displayName: "Bé thử",
      avatarKey: "may",
      motionPreference: "system",
      soundPreference: sound,
      className: "L",
    },
  ],
});

async function room(options: { consent?: boolean } = {}): Promise<Room> {
  const schoolId = await newSchool();
  const teacher = await newTeacher(schoolId, "au-learn");
  const classId = await rpcOk(
    teacher.client.rpc("teacher_create_class", {
      p_name: `AL ${randomUUID().slice(0, 6)}`,
      p_school_year: "2026-2027",
    }),
  );
  const { studentId, device } = await linkedStudent(teacher.client, classId, { consent: options.consent });
  return { schoolId, teacher, classId, studentId, device };
}

type Stage = "draft" | "pending" | "approved";
type Recording = { assetId: string; versionId: string; key: string };

async function record(
  r: Room,
  kind: "letter" | "phoneme",
  unit: string,
  label: string,
  options: { stage?: Stage; confirm?: string | null; bytes?: Uint8Array } = {},
): Promise<Recording> {
  const stage = options.stage ?? "approved";
  const bytes = options.bytes ?? SOUND;
  const t = r.teacher.client;
  await rpcOk(t.rpc("teacher_grant_audio_consent", { p_notice_version: "v1" }));
  const assetId = await rpcOk(
    t.rpc("teacher_ensure_audio_asset", { p_unit_kind: kind, p_unit_text: unit, p_proposed_label: label }),
  );
  if (options.confirm !== null) {
    await rpcOk(
      t.rpc("teacher_confirm_audio_pronunciation", { p_asset_id: assetId, p_label: options.confirm ?? label }),
    );
  }
  const versionId = randomUUID();
  const key = `${r.schoolId}/${assetId}/${versionId}.wav`;
  if (storageUp) {
    const up = await admin.storage
      .from("teacher-audio")
      .upload(key, bytes, { contentType: "audio/wav", upsert: false });
    if (up.error) throw up.error;
  }
  await rpcOk(
    t.rpc("teacher_create_audio_version", {
      p_asset_id: assetId,
      p_version_id: versionId,
      p_storage_key: key,
      p_content_hash: sha(bytes),
      p_mime_type: "audio/wav",
      p_size_bytes: bytes.byteLength,
      p_duration_ms: 1000,
    }),
  );
  if (stage !== "draft") await rpcOk(t.rpc("teacher_submit_audio_version", { p_version_id: versionId }));
  if (stage === "approved") {
    await rpcOk(
      t.rpc("teacher_review_audio_version", {
        p_version_id: versionId,
        p_decision: "approve",
        p_note: "",
        p_listened: true,
      }),
    );
  }
  return { assetId, versionId, key };
}

/** Gọi thẳng hàm CSDL như student gateway (khóa dịch vụ). */
const resolve = (r: Room, kind: string, unit: string, label: string, fallback = "", auth?: string, student?: string) =>
  admin.rpc("gateway_resolve_learning_audio", {
    p_auth_user_id: auth ?? r.device.id,
    p_student_id: student ?? r.studentId,
    p_unit_kind: kind,
    p_unit_text: unit,
    p_fallback_unit_text: fallback,
    p_expected_label: label,
  });

const list = (r: Room, units: Array<{ kind: string; text: string; fallback: string; label: string }>, auth?: string) =>
  admin.rpc("gateway_list_learning_audio", {
    p_auth_user_id: auth ?? r.device.id,
    p_student_id: r.studentId,
    p_units: units,
  });

beforeAll(async () => {
  const buckets = await admin.storage.listBuckets();
  storageUp = !buckets.error;
  if (!storageUp && process.env.REQUIRE_STORAGE === "1") {
    throw new Error("REQUIRE_STORAGE=1 nhưng Storage local không chạy — dùng `npm run db:start`.");
  }
  if (!storageUp) console.warn("BỎ QUA phần đọc tệp: Storage chưa chạy (db:start:lite).");
  enableLocalTestFixtures();
  setLocalTeacherAudioApproval(true);
  setLocalStudentAudioPlayback(true);
}, 120_000);

afterAll(() => {
  setLocalStudentAudioPlayback(false);
  setLocalTeacherAudioApproval(false);
});

const storage = (name: string, fn: () => Promise<void>) =>
  it(name, async (ctx) => {
    if (!storageUp) return ctx.skip();
    await fn();
  });

describe("hàm CSDL: điều kiện phát chữ/âm khi học", () => {
  it("cờ TẮT → AUDIO_PLAYBACK_DISABLED; danh sách rỗng (không lỗi); cờ bật lại thì phát được", async () => {
    const r = await room();
    await record(r, "letter", "b", "bê");
    setLocalStudentAudioPlayback(false);
    try {
      expect(err(await resolve(r, "letter", "b", "bê"))).toBe("AUDIO_PLAYBACK_DISABLED");
      const none = await list(r, [{ kind: "letter", text: "b", fallback: "", label: "bê" }]);
      expect(none.error).toBeNull();
      expect(none.data).toEqual([]);
    } finally {
      setLocalStudentAudioPlayback(true);
    }
    const ok = await resolve(r, "letter", "b", "bê");
    expect(ok.error).toBeNull();
    expect(ok.data).toMatchObject({ mimeType: "audio/wav", sizeBytes: SOUND.byteLength, contentHash: sha(SOUND) });
  });

  it("TÊN CHỮ CÁI và ÂM CỦA CHỮ là hai tài nguyên khác nhau: bản ghi loại này không bao giờ phát cho loại kia", async () => {
    const r = await room();
    const nameOnly = await record(r, "letter", "b", "bê");
    expect((await resolve(r, "letter", "b", "bê")).data).toMatchObject({ versionId: nameOnly.versionId });
    // Chỉ có tên chữ: âm của chữ b chưa có → không phát, dù cùng chữ "b".
    expect(err(await resolve(r, "phoneme", "b", "bờ"))).toBe("AUDIO_NOT_AVAILABLE");
    const sound = await record(r, "phoneme", "b", "bờ");
    const soundRow = await resolve(r, "phoneme", "b", "bờ");
    expect(soundRow.data).toMatchObject({ versionId: sound.versionId });
    expect((soundRow.data as { versionId: string }).versionId).not.toBe(nameOnly.versionId);
    // Cách đọc của loại này không khớp loại kia: "bờ" ≠ "bê".
    expect(err(await resolve(r, "letter", "b", "bờ"))).toBe("LABEL_MISMATCH");
    expect(err(await resolve(r, "phoneme", "b", "bê"))).toBe("LABEL_MISMATCH");
  });

  it("chỉ bản approved đang dùng: bản nháp / chờ duyệt / chưa có đều AUDIO_NOT_AVAILABLE", async () => {
    const r = await room();
    expect(err(await resolve(r, "letter", "c", "xê"))).toBe("AUDIO_NOT_AVAILABLE");
    await record(r, "letter", "c", "xê", { stage: "draft" });
    expect(err(await resolve(r, "letter", "c", "xê"))).toBe("AUDIO_NOT_AVAILABLE");
    const pending = await room();
    await record(pending, "letter", "c", "xê", { stage: "pending" });
    expect(err(await resolve(pending, "letter", "c", "xê"))).toBe("AUDIO_NOT_AVAILABLE");
  });

  it("cách đọc giáo viên đã xác nhận phải KHỚP cách đọc kho tri thức khai báo; không khớp → LABEL_MISMATCH", async () => {
    const r = await room();
    await record(r, "letter", "đ", "đê"); // giáo viên xác nhận "đê"
    expect(err(await resolve(r, "letter", "đ", "đờ"))).toBe("LABEL_MISMATCH"); // kho tri thức khai báo khác
    expect((await resolve(r, "letter", "đ", "đê")).error).toBeNull();
  });

  it("cách ly theo TRƯỜNG: bản ghi của trường khác không bao giờ khớp", async () => {
    const a = await room();
    const b = await room();
    await record(a, "phoneme", "m", "mờ");
    expect((await resolve(a, "phoneme", "m", "mờ")).error).toBeNull();
    expect(err(await resolve(b, "phoneme", "m", "mờ"))).toBe("AUDIO_NOT_AVAILABLE");
  });

  it("y dùng chung bản ghi của i khi KHÔNG có tài nguyên riêng; có tài nguyên riêng thì chỉ dùng cái riêng", async () => {
    const r = await room();
    const shared = await record(r, "phoneme", "i", "i");
    expect((await resolve(r, "phoneme", "y", "i", "i")).data).toMatchObject({ versionId: shared.versionId });
    const own = await record(r, "phoneme", "y", "i dài");
    expect((await resolve(r, "phoneme", "y", "i dài", "i")).data).toMatchObject({ versionId: own.versionId });
    expect(err(await resolve(r, "phoneme", "y", "i", "i"))).toBe("LABEL_MISMATCH");
  });

  it("người ghi rút đồng ý dùng giọng / giáo viên thu hồi → không phát nữa ngay ở yêu cầu kế tiếp", async () => {
    const r = await room();
    const rec = await record(r, "letter", "t", "tê");
    expect((await resolve(r, "letter", "t", "tê")).error).toBeNull();
    await rpcOk(
      r.teacher.client.rpc("teacher_revoke_audio_version", { p_version_id: rec.versionId, p_reason: "ghi lại" }),
    );
    expect(err(await resolve(r, "letter", "t", "tê"))).toBe("AUDIO_NOT_AVAILABLE");

    const w = await room();
    await record(w, "letter", "v", "vê");
    expect((await resolve(w, "letter", "v", "vê")).error).toBeNull();
    await rpcOk(w.teacher.client.rpc("teacher_withdraw_audio_consent", { p_reason: "rút đồng ý" }));
    expect(err(await resolve(w, "letter", "v", "vê"))).toBe("AUDIO_NOT_AVAILABLE");
  });

  it("thiết bị: lạ / chưa liên kết / hồ sơ của bạn khác → FORBIDDEN; học sinh chưa đồng ý learning_data → CONSENT_REQUIRED", async () => {
    const r = await room();
    await record(r, "letter", "n", "en-nờ");
    const stranger = await newDevice();
    expect(err(await resolve(r, "letter", "n", "en-nờ", "", stranger.id))).toBe("FORBIDDEN");
    const other = await room();
    expect(err(await resolve(r, "letter", "n", "en-nờ", "", other.device.id))).toBe("FORBIDDEN");
    expect(err(await resolve(r, "letter", "n", "en-nờ", "", undefined, other.studentId))).toBe("FORBIDDEN");
    const noConsent = await room({ consent: false });
    await record(noConsent, "letter", "n", "en-nờ");
    expect(err(await resolve(noConsent, "letter", "n", "en-nờ"))).toBe("CONSENT_REQUIRED");
  });

  it("đầu vào xấu → INVALID_INPUT: loại lạ (rime/word), chữ dài/ký tự lạ, nhãn rỗng", async () => {
    const r = await room();
    for (const [kind, unit] of [
      ["word", "ba"],
      ["rime", "an"],
      ["letter", "bbbbbbb"],
      ["letter", "b1"],
      ["letter", ""],
    ] as const) {
      expect(err(await resolve(r, kind, unit, "bê")), `${kind}:${unit}`).toBe("INVALID_INPUT");
    }
    const noLabel = await admin.rpc("gateway_resolve_learning_audio", {
      p_auth_user_id: r.device.id,
      p_student_id: r.studentId,
      p_unit_kind: "letter",
      p_unit_text: "b",
      p_fallback_unit_text: "",
      p_expected_label: null as unknown as string,
    });
    expect(err(noLabel)).toBe("INVALID_INPUT");
  });

  it("danh sách: chỉ gồm chữ/âm phát được ngay (kèm định dạng); đơn vị chưa đủ điều kiện vắng mặt, không lộ lý do; tối đa 200", async () => {
    const r = await room();
    await record(r, "letter", "b", "bê");
    await record(r, "phoneme", "b", "bờ", { stage: "pending" });
    await record(r, "letter", "c", "xê", { confirm: "xê khác" }).catch(() => undefined);
    const result = await list(r, [
      { kind: "letter", text: "b", fallback: "", label: "bê" },
      { kind: "phoneme", text: "b", fallback: "", label: "bờ" },
      { kind: "letter", text: "c", fallback: "", label: "xê" },
      { kind: "letter", text: "x", fallback: "", label: "ích-xì" },
    ]);
    expect(result.error).toBeNull();
    expect(result.data).toEqual([{ kind: "letter", text: "b", mimeType: "audio/wav" }]);
    const tooMany = await list(
      r,
      Array.from({ length: 201 }, () => ({ kind: "letter", text: "b", fallback: "", label: "bê" })),
    );
    expect(err(tooMany)).toBe("INVALID_INPUT");
    const stranger = await newDevice();
    expect(err(await list(r, [], stranger.id))).toBe("FORBIDDEN");
  });
});

describe("dịch vụ máy chủ: trạng thái và phát tệp", () => {
  it("trạng thái: học sinh tắt âm thanh → muted, không hỏi CSDL; hồ sơ lạ → FORBIDDEN", async () => {
    const r = await room();
    await record(r, "letter", "b", "bê");
    expect(await learningAudioStatus(ctxFor(r, "off"), r.studentId)).toEqual({
      ok: true,
      data: { muted: true, units: [] },
    });
    const stranger = await room();
    expect(await learningAudioStatus(ctxFor(r), stranger.studentId)).toEqual({ ok: false, code: "FORBIDDEN" });
  });

  it("trạng thái: chỉ trả những đơn vị của trang học đã được duyệt; không có khóa lưu trữ/mã tài nguyên", async () => {
    const r = await room();
    await record(r, "letter", "b", "bê");
    await record(r, "phoneme", "b", "bờ");
    const status = await learningAudioStatus(ctxFor(r), r.studentId);
    expect(status.ok).toBe(true);
    if (!status.ok) return;
    expect(status.data.units).toEqual(
      expect.arrayContaining([
        { kind: "letter", text: "b", mimeType: "audio/wav" },
        { kind: "phoneme", text: "b", mimeType: "audio/wav" },
      ]),
    );
    const serialized = JSON.stringify(status.data);
    expect(serialized).not.toMatch(/storage|versionId|assetId|[0-9a-f]{8}-[0-9a-f]{4}-/u);
  });

  storage("phát: đúng byte đã duyệt (kích thước + SHA-256), đúng loại tệp", async () => {
    const r = await room();
    await record(r, "letter", "b", "bê");
    const played = await loadLearningAudio(ctxFor(r), r.studentId, "letter", "b");
    expect(played.ok).toBe(true);
    if (played.ok) {
      expect(played.data.mimeType).toBe("audio/wav");
      expect(sha(played.data.bytes)).toBe(sha(SOUND));
    }
  });

  storage(
    "phát: loại/chữ ngoài danh mục → NOT_FOUND; tắt âm → AUDIO_NOT_PERMITTED; chưa có → AUDIO_NOT_AVAILABLE",
    async () => {
      const r = await room();
      await record(r, "letter", "b", "bê");
      expect(await loadLearningAudio(ctxFor(r), r.studentId, "word", "ba")).toEqual({ ok: false, code: "NOT_FOUND" });
      expect(await loadLearningAudio(ctxFor(r), r.studentId, "letter", "zz")).toEqual({ ok: false, code: "NOT_FOUND" });
      expect(await loadLearningAudio(ctxFor(r, "off"), r.studentId, "letter", "b")).toEqual({
        ok: false,
        code: "AUDIO_NOT_PERMITTED",
      });
      expect(await loadLearningAudio(ctxFor(r), r.studentId, "phoneme", "b")).toEqual({
        ok: false,
        code: "AUDIO_NOT_AVAILABLE",
      });
    },
  );

  storage("phát: tệp bị thay/mất trong Storage → AUDIO_NOT_AVAILABLE, không phát tệp sai", async () => {
    const r = await room();
    const rec = await record(r, "letter", "b", "bê");
    const swapped = wav(2);
    const up = await admin.storage
      .from("teacher-audio")
      .upload(rec.key, swapped, { contentType: "audio/wav", upsert: true });
    expect(up.error).toBeNull();
    expect(await loadLearningAudio(ctxFor(r), r.studentId, "letter", "b")).toEqual({
      ok: false,
      code: "AUDIO_NOT_AVAILABLE",
    });
    await admin.storage.from("teacher-audio").remove([rec.key]);
    expect(await loadLearningAudio(ctxFor(r), r.studentId, "letter", "b")).toEqual({
      ok: false,
      code: "AUDIO_NOT_AVAILABLE",
    });
  });

  it("thiết bị bị thu hồi / học sinh khác không phát được chữ của hồ sơ này", async () => {
    const r = await room();
    await record(r, "letter", "b", "bê");
    const stranger = await newDevice();
    const result = await loadLearningAudio(ctxFor(r, "on", stranger.id), r.studentId, "letter", "b");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(["FORBIDDEN", "AUDIO_NOT_AVAILABLE"]).toContain(result.code);
  });
});
