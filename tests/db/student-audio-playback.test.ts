import { createHash, randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", async () => {
  const { admin } = await import("./helpers");
  return { createSupabaseAdminClient: () => admin };
});

import { installAudioFixtures } from "../../scripts/lib/audio-fixtures";
import {
  enableLocalTestFixtures,
  setLocalStudentAudioPlayback,
  setLocalTeacherAudioApproval,
} from "../../scripts/lib/test-fixtures";
import { AUDIO_FIXTURE_EXERCISES } from "../../scripts/fixtures/audio-items";
import { wav } from "../unit/audio-library/fixtures";
import { audioStatus, loadPlayableAudio } from "@/server/audio-playback/service";
import { submitAttempt } from "@/server/question-instances/service";
import type { StudentContext } from "@/server/student-gateway/context";
import { admin, newDevice, newSchool, newTeacher, rpcOk, type Actor } from "./helpers";
import { linkedStudent, planItems, sessionQuestions, startSession, submit } from "./scoring-helpers";

/**
 * R10.3a — phát bản ghi giáo viên ĐÃ DUYỆT cho học sinh, trên Supabase LOCAL thật: hàm CSDL `gateway_resolve_teacher_audio`
 * (điều kiện đủ/thiếu), dịch vụ phát (chính sách chống lộ đáp án, toàn vẹn tệp, mất tệp) và bảo vệ chấm điểm. Bản ghi là SÓNG
 * TỔNG HỢP của bộ kiểm thử — không giọng người thật. Cờ hệ thống chỉ bật trên local trong lúc chạy và trả về TẮT khi xong.
 */

type Room = {
  schoolId: string;
  teacher: Actor;
  classId: string;
  studentId: string;
  device: Actor;
  /** chữ → mã câu của buổi luyện (6 câu nghe âm: b c d i y k). */
  questions: Record<string, string>;
};

let storageUp = false;
let seriesId: string;
let lessonIds: Record<1 | 2 | 3, string>;
let itemIdByLetter: Record<string, string> = {};

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

async function room(): Promise<Room> {
  const schoolId = await newSchool();
  const teacher = await newTeacher(schoolId, "au-play");
  const classId = await rpcOk(
    teacher.client.rpc("teacher_create_class", {
      p_name: `AP ${randomUUID().slice(0, 6)}`,
      p_school_year: "2026-2027",
    }),
  );
  await rpcOk(
    teacher.client.rpc("teacher_set_class_curriculum", {
      p_class_id: classId,
      p_series_id: seriesId,
      p_lesson_id: lessonIds[2],
    }),
  );
  await rpcOk(teacher.client.rpc("teacher_confirm_class_curriculum", { p_class_id: classId }));
  const { studentId, device } = await linkedStudent(teacher.client, classId);
  const ids = Object.values(itemIdByLetter);
  const started = await startSession(device, studentId, planItems(ids));
  const sessionId = (started.data as { sessionId: string }).sessionId;
  const rows = await sessionQuestions(sessionId);
  const letterByItem = Object.fromEntries(Object.entries(itemIdByLetter).map(([letter, id]) => [id, letter]));
  const questions = Object.fromEntries(rows.map((row) => [letterByItem[row.exercise_item_id]!, row.id]));
  return { schoolId, teacher, classId, studentId, device, questions };
}

type Stage = "draft" | "pending" | "approved" | "rejected";
type Recording = { assetId: string; versionId: string; key: string };

async function record(
  r: Room,
  unit: string,
  label: string,
  options: { stage?: Stage; confirm?: string | null; bytes?: Uint8Array } = {},
): Promise<Recording> {
  const stage = options.stage ?? "approved";
  const bytes = options.bytes ?? SOUND;
  const t = r.teacher.client;
  await rpcOk(t.rpc("teacher_grant_audio_consent", { p_notice_version: "v1" }));
  const assetId = await rpcOk(
    t.rpc("teacher_ensure_audio_asset", { p_unit_kind: "phoneme", p_unit_text: unit, p_proposed_label: label }),
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
  if (stage === "approved" || stage === "rejected") {
    await rpcOk(
      t.rpc("teacher_review_audio_version", {
        p_version_id: versionId,
        p_decision: stage === "approved" ? "approve" : "reject",
        p_note: stage === "rejected" ? "Ghi lại giúp cô" : "",
        p_listened: true,
      }),
    );
  }
  return { assetId, versionId, key };
}

/** Gọi thẳng hàm CSDL như student gateway (khóa dịch vụ). */
const resolve = (r: Room, letter: string, unit: string, fallback = "", label = "bờ", auth?: string) =>
  admin.rpc("gateway_resolve_teacher_audio", {
    p_auth_user_id: auth ?? r.device.id,
    p_question_instance_id: r.questions[letter]!,
    p_unit_text: unit,
    p_fallback_unit_text: fallback,
    p_expected_label: label,
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
  const reviewerSchool = await newSchool();
  const reviewer = await newTeacher(reviewerSchool, "gv-duyet-nghe");
  const installed = await installAudioFixtures(admin, reviewer.id);
  seriesId = installed.seriesId;
  lessonIds = installed.lessonIds;
  const letters = AUDIO_FIXTURE_EXERCISES.flatMap((exercise) => exercise.items.map((item) => item.id));
  const rows = await admin.from("exercise_items").select("id, item_key").in("item_key", letters);
  itemIdByLetter = Object.fromEntries((rows.data ?? []).map((row) => [row.item_key.split(".").at(-1)!, row.id]));
  expect(Object.keys(itemIdByLetter).sort()).toEqual(["b", "c", "d", "i", "k", "y"]);
}, 240_000);

afterAll(() => {
  setLocalStudentAudioPlayback(false);
  setLocalTeacherAudioApproval(false);
});

const storage = (name: string, fn: () => Promise<void>) =>
  it(name, async (ctx) => {
    if (!storageUp) return ctx.skip();
    await fn();
  });

describe("cờ phát âm thanh cho học sinh", () => {
  it("mặc định TẮT sau migration: cờ có trong CSDL và kiểm thử trả về TẮT khi xong", async () => {
    setLocalStudentAudioPlayback(false);
    try {
      const r = await room();
      await record(r, "b", "bờ");
      expect(err(await resolve(r, "b", "b"))).toBe("AUDIO_PLAYBACK_DISABLED");
      // Dịch vụ: trạng thái không lỗi, không khe nào phát được; phát trực tiếp bị từ chối.
      expect(await audioStatus(ctxFor(r), r.questions.b!)).toEqual({ ok: true, data: { muted: false, slots: {} } });
      expect(await loadPlayableAudio(ctxFor(r), r.questions.b!, "stimulus")).toEqual({
        ok: false,
        code: "AUDIO_PLAYBACK_DISABLED",
      });
    } finally {
      setLocalStudentAudioPlayback(true);
    }
  }, 120_000);
});

describe("bản ghi đã duyệt và đang dùng", () => {
  let r: Room;
  let rec: Recording;
  beforeAll(async () => {
    r = await room();
    rec = await record(r, "b", "bờ");
  }, 120_000);

  it("hàm CSDL trả đúng bản đang dùng với các trường tối thiểu", async () => {
    const res = await resolve(r, "b", "b");
    expect(res.error).toBeNull();
    expect(res.data).toMatchObject({ versionId: rec.versionId, mimeType: "audio/wav", durationMs: 1000 });
  });

  storage(
    "trạng thái và phát: nghe âm trước khi chấm, đọc mẫu chỉ SAU khi chấm; phản hồi không lộ khóa lưu trữ",
    async () => {
      const status = await audioStatus(ctxFor(r), r.questions.b!);
      expect(status).toEqual({ ok: true, data: { muted: false, slots: { stimulus: { mimeType: "audio/wav" } } } });
      const text = JSON.stringify(status);
      expect(text).not.toMatch(/storage|teacher-audio|\.wav|bờ|[0-9a-f]{8}-[0-9a-f]{4}/u);

      const stimulus = await loadPlayableAudio(ctxFor(r), r.questions.b!, "stimulus");
      expect(stimulus.ok && Buffer.from(stimulus.data.bytes).equals(Buffer.from(SOUND))).toBe(true);
      // Đọc mẫu trước khi chấm: không.
      expect(await loadPlayableAudio(ctxFor(r), r.questions.b!, "model")).toEqual({
        ok: false,
        code: "AUDIO_NOT_PERMITTED",
      });
      // Chấm (đúng) rồi mới nghe được đọc mẫu.
      expect((await submit(r.device, r.questions.b!, "correct")).error).toBeNull();
      const after = await audioStatus(ctxFor(r), r.questions.b!);
      expect(after.ok && Object.keys(after.data.slots).sort()).toEqual(["model", "stimulus"]);
      const model = await loadPlayableAudio(ctxFor(r), r.questions.b!, "model");
      expect(model.ok).toBe(true);
    },
  );

  it("học sinh tắt âm thanh trong cài đặt: báo muted và không phát", async () => {
    expect(await audioStatus(ctxFor(r, "off"), r.questions.b!)).toEqual({ ok: true, data: { muted: true, slots: {} } });
    expect(await loadPlayableAudio(ctxFor(r, "off"), r.questions.b!, "stimulus")).toEqual({
      ok: false,
      code: "AUDIO_NOT_PERMITTED",
    });
  });

  it("chỉ nhận mã câu thuộc thiết bị: thiết bị khác / câu không tồn tại → không phát", async () => {
    const stranger = await newDevice();
    expect(err(await resolve(r, "b", "b", "", "bờ", stranger.id))).toBe("FORBIDDEN");
    expect(await loadPlayableAudio(ctxFor(r, "on", stranger.id), randomUUID(), "stimulus")).toEqual({
      ok: false,
      code: "NOT_FOUND",
    });
    // Danh sách hồ sơ giả ở tầng ứng dụng: CSDL vẫn từ chối vì thiết bị lạ không liên kết với em đó.
    const spoof = await loadPlayableAudio(ctxFor(r, "on", stranger.id), r.questions.b!, "stimulus");
    expect(spoof.ok).toBe(false);
  });
});

describe("trạng thái khác approved không bao giờ phát", () => {
  let r: Room;
  const rec: Record<string, Recording> = {};
  beforeAll(async () => {
    r = await room();
    rec.draft = await record(r, "c", "cờ", { stage: "draft" });
    rec.pending = await record(r, "d", "dờ", { stage: "pending" });
    rec.rejected = await record(r, "k", "ca", { stage: "rejected" });
    // b: v1 duyệt rồi bị v2 thay thế → chỉ v2 phát.
    rec.v1 = await record(r, "b", "bờ", { bytes: wav(1) });
    rec.v2 = await record(r, "b", "bờ", { bytes: wav(2) });
  }, 180_000);

  it.each([
    ["c", "c", "cờ"],
    ["d", "d", "dờ"],
    ["k", "k", "ca"],
  ])("chữ %s (đơn vị %s) chưa duyệt không phát", async (letter, unit, label) => {
    expect(err(await resolve(r, letter, unit, "", label))).toBe("AUDIO_NOT_AVAILABLE");
    expect(await audioStatus(ctxFor(r), r.questions[letter]!)).toEqual({ ok: true, data: { muted: false, slots: {} } });
  });

  it("bản bị thay thế (superseded) không phát; bản mới đang dùng thì phát", async () => {
    const res = await resolve(r, "b", "b");
    expect((res.data as { versionId: string }).versionId).toBe(rec.v2!.versionId);
    const old = await admin.from("audio_asset_versions").select("status").eq("id", rec.v1!.versionId).single();
    expect(old.data?.status).toBe("superseded");
  });

  it("thu hồi bản đang dùng → yêu cầu phát MỚI bị chặn", async () => {
    expect((await resolve(r, "b", "b")).error).toBeNull();
    await rpcOk(
      r.teacher.client.rpc("teacher_revoke_audio_version", {
        p_version_id: rec.v2!.versionId,
        p_reason: "Thu hồi thử",
      }),
    );
    expect(err(await resolve(r, "b", "b"))).toBe("AUDIO_NOT_AVAILABLE");
  });
});

describe("đồng ý dùng giọng và cách đọc", () => {
  it("giáo viên rút đồng ý → bản đã duyệt bị thu hồi, phát mới bị chặn", async () => {
    const r = await room();
    await record(r, "b", "bờ");
    expect((await resolve(r, "b", "b")).error).toBeNull();
    await rpcOk(r.teacher.client.rpc("teacher_withdraw_audio_consent", { p_reason: "Không muốn dùng nữa" }));
    expect(err(await resolve(r, "b", "b"))).toBe("AUDIO_NOT_AVAILABLE");
  }, 120_000);

  it("chứng từ đồng ý bị rút nhưng bản ghi còn approved (trạng thái bất thường) → vẫn chặn", async () => {
    const r = await room();
    await record(r, "b", "bờ");
    const consent = await admin
      .from("audio_voice_consents")
      .update({ status: "withdrawn", withdrawn_at: new Date().toISOString(), withdraw_reason: "Kiểm thử bất thường" })
      .eq("staff_id", r.teacher.id)
      .eq("status", "granted");
    expect(consent.error).toBeNull();
    expect(err(await resolve(r, "b", "b"))).toBe("VOICE_CONSENT_REQUIRED");
  }, 120_000);

  it("cách đọc GV xác nhận khác cách đọc câu khai báo → chặn (LABEL_MISMATCH)", async () => {
    const r = await room();
    await record(r, "b", "bờ", { confirm: "bờ ơ" });
    expect(err(await resolve(r, "b", "b", "", "bờ"))).toBe("LABEL_MISMATCH");
    expect((await resolve(r, "b", "b", "", "bờ ơ")).error).toBeNull();
  }, 120_000);

  it("cách đọc đổi sau khi duyệt (không khớp bản ghi) hoặc bị gỡ xác nhận → chặn", async () => {
    const r = await room();
    const rec = await record(r, "b", "bờ");
    const changed = await admin.from("audio_assets").update({ confirmed_label: "bê" }).eq("id", rec.assetId);
    expect(changed.error).toBeNull();
    expect(err(await resolve(r, "b", "b"))).toBe("LABEL_MISMATCH");
    const cleared = await admin
      .from("audio_assets")
      .update({ confirmed_label: null, pronunciation_confirmed_by: null, pronunciation_confirmed_at: null })
      .eq("id", rec.assetId);
    expect(cleared.error).toBeNull();
    expect(err(await resolve(r, "b", "b"))).toBe("PRONUNCIATION_UNCONFIRMED");
  }, 120_000);
});

describe("i / y dùng chung bản ghi", () => {
  it("y chưa tách → dùng bản ghi của i; GV đã tạo tài nguyên riêng cho y → chỉ xét tài nguyên đó (không lấy nhầm i)", async () => {
    const r = await room();
    const i = await record(r, "i", "i");
    const shared = await resolve(r, "y", "y", "i", "i");
    expect((shared.data as { versionId: string }).versionId).toBe(i.versionId);
    await record(r, "y", "i dài", { stage: "pending" });
    expect(err(await resolve(r, "y", "y", "i", "i dài"))).toBe("AUDIO_NOT_AVAILABLE");
  }, 120_000);
});

describe("phạm vi trường, liên kết thiết bị, đồng ý học sinh", () => {
  it("bản ghi của trường khác không phát cho học sinh trường này", async () => {
    const owner = await room();
    await record(owner, "b", "bờ");
    const other = await room();
    expect(err(await resolve(other, "b", "b"))).toBe("AUDIO_NOT_AVAILABLE");
  }, 180_000);

  it("thiết bị bị thu hồi quyền → FORBIDDEN", async () => {
    const r = await room();
    await record(r, "b", "bờ");
    const link = await admin
      .from("student_devices")
      .select("id")
      .eq("auth_user_id", r.device.id)
      .is("revoked_at", null);
    await rpcOk(r.teacher.client.rpc("teacher_revoke_device", { p_device_id: link.data![0]!.id }));
    expect(err(await resolve(r, "b", "b"))).toBe("FORBIDDEN");
  }, 120_000);

  it("phụ huynh rút đồng ý learning_data: thiết bị bị ngắt liên kết (FORBIDDEN); đồng ý hết hiệu lực dù còn liên kết → CONSENT_REQUIRED", async () => {
    const r = await room();
    await record(r, "b", "bờ");
    expect((await resolve(r, "b", "b")).error).toBeNull();
    // Đường nghiệp vụ: rút đồng ý ngắt liên kết thiết bị (R03) nên phát bị chặn ngay.
    await rpcOk(
      r.teacher.client.rpc("teacher_withdraw_consent", { p_student_id: r.studentId, p_scope: "learning_data" }),
    );
    expect(err(await resolve(r, "b", "b"))).toBe("FORBIDDEN");
    // Phòng thủ nhiều lớp: nếu chứng từ hết hiệu lực mà liên kết còn (trạng thái bất thường), hàm vẫn tự chặn.
    const r2 = await room();
    await record(r2, "b", "bờ");
    const withdrawn = await admin
      .from("guardian_consents")
      .update({ status: "withdrawn", withdrawn_at: new Date().toISOString(), withdrawn_by: r2.teacher.id })
      .eq("student_id", r2.studentId)
      .eq("scope", "learning_data");
    expect(withdrawn.error).toBeNull();
    expect(err(await resolve(r2, "b", "b"))).toBe("CONSENT_REQUIRED");
  }, 120_000);
});

describe("tệp lưu trữ", () => {
  storage("tệp bị thay nội dung (băm không khớp) hoặc mất → không phát", async () => {
    const r = await room();
    const rec = await record(r, "b", "bờ");
    expect((await loadPlayableAudio(ctxFor(r), r.questions.b!, "stimulus")).ok).toBe(true);
    const swapped = await admin.storage.from("teacher-audio").update(rec.key, wav(2), { contentType: "audio/wav" });
    expect(swapped.error).toBeNull();
    expect(await loadPlayableAudio(ctxFor(r), r.questions.b!, "stimulus")).toEqual({
      ok: false,
      code: "AUDIO_NOT_AVAILABLE",
    });
    await admin.storage.from("teacher-audio").remove([rec.key]);
    expect(await loadPlayableAudio(ctxFor(r), r.questions.b!, "stimulus")).toEqual({
      ok: false,
      code: "AUDIO_NOT_AVAILABLE",
    });
  });
});

describe("quyền: không mở bảng âm thanh hay hàm gateway cho thiết bị học sinh", () => {
  it("thiết bị và giáo viên không gọi được hàm gateway; thiết bị không đọc được bảng audio_*", async () => {
    const r = await room();
    await record(r, "b", "bờ");
    const args = {
      p_auth_user_id: r.device.id,
      p_question_instance_id: r.questions.b!,
      p_unit_text: "b",
      p_fallback_unit_text: "",
      p_expected_label: "bờ",
    };
    for (const client of [r.device.client, r.teacher.client]) {
      const call = await client.rpc("gateway_resolve_teacher_audio", args);
      expect(call.error).not.toBeNull();
      expect(call.data).toBeNull();
    }
    for (const table of ["audio_assets", "audio_asset_versions", "audio_voice_consents"] as const) {
      const read = await r.device.client.from(table).select("id");
      expect(read.data ?? []).toEqual([]);
    }
  }, 120_000);
});

describe("chấm điểm: câu bắt buộc nghe mà chưa có âm thanh đã duyệt thì không tính điểm", () => {
  const response = (optionId: string) => ({ kind: "choice" as const, optionId });
  const attempt = (r: Room, letter: string) =>
    submitAttempt(ctxFor(r), r.questions[letter]!, { clientAttemptId: randomUUID(), response: response("o1") });
  const scoreOf = async (studentId: string) =>
    (await admin.from("season_scores").select("balance").eq("student_id", studentId)).data?.[0]?.balance ?? 0;
  const attemptsOf = async (questionId: string) =>
    (await admin.from("item_attempts").select("id").eq("question_instance_id", questionId)).data?.length ?? 0;

  it("không có bản ghi → AUDIO_NOT_AVAILABLE, không lượt, không điểm", async () => {
    const r = await room();
    const result = await attempt(r, "c");
    expect(result).toEqual({ ok: false, code: "AUDIO_NOT_AVAILABLE" });
    expect(await attemptsOf(r.questions.c!)).toBe(0);
    expect(await scoreOf(r.studentId)).toBe(0);
  }, 120_000);

  it("cờ tắt → cũng không tính điểm (không điểm giả)", async () => {
    const r = await room();
    await record(r, "b", "bờ");
    setLocalStudentAudioPlayback(false);
    try {
      expect(await attempt(r, "b")).toEqual({ ok: false, code: "AUDIO_NOT_AVAILABLE" });
      expect(await attemptsOf(r.questions.b!)).toBe(0);
    } finally {
      setLocalStudentAudioPlayback(true);
    }
  }, 120_000);

  it("có bản ghi đã duyệt → chấm bình thường, quy tắc điểm giữ nguyên (+10 đúng); gửi lại cùng mã vẫn trả kết quả cũ", async () => {
    const r = await room();
    await record(r, "b", "bờ");
    const clientAttemptId = randomUUID();
    const first = await submitAttempt(ctxFor(r), r.questions.b!, { clientAttemptId, response: response("o1") });
    expect(first.ok).toBe(true);
    expect(first.ok && first.data.points).toEqual({ nominalDelta: 10, appliedDelta: 10 });
    expect(await scoreOf(r.studentId)).toBe(10);
    // Thu hồi rồi gửi lại ĐÚNG lượt cũ (mất mạng): vẫn trả kết quả đã ghi, không chặn, không điểm thứ hai.
    await rpcOk(r.teacher.client.rpc("teacher_withdraw_audio_consent", { p_reason: "Rút sau khi nộp" }));
    const resend = await submitAttempt(ctxFor(r), r.questions.b!, { clientAttemptId, response: response("o1") });
    expect(resend.ok && resend.data.replayed).toBe(true);
    expect(await scoreOf(r.studentId)).toBe(10);
  }, 180_000);
});
