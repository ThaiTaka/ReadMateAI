import { createHash, randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { setLocalTeacherAudioApproval } from "../../scripts/lib/test-fixtures";
import { admin, local, newDevice, newSchool, newTeacher, publicClient, suffix, type Actor, type Db } from "./helpers";

/**
 * R10.2 — thư viện bản ghi giáo viên trên Supabase LOCAL thật (JWT thật, hàm CSDL thật, Storage thật nếu có):
 * phạm vi trường, bản nháp riêng, bất biến, duyệt, đồng ý dùng giọng, quyền thực thi, Storage riêng tư.
 * Không dùng giọng người thật: nội dung tệp là byte giả. Cờ hệ thống chỉ bật trên local trong lúc chạy và trả về TẮT khi xong.
 */

type Teacher = Actor & { email: string };
let schoolA: string;
let schoolB: string;
let t1: Teacher;
let t2: Teacher;
let outsider: Teacher;
let device: Actor;

const hash = (s: string) => createHash("sha256").update(s).digest("hex");
const keyOf = (school: string, asset: string, version: string, ext = "wav") => `${school}/${asset}/${version}.${ext}`;
const err = (r: { error: { message?: string } | null }) => r.error?.message ?? null;

async function ensureAsset(who: Db, text = "b", label = "bờ") {
  return who.rpc("teacher_ensure_audio_asset", { p_unit_kind: "phoneme", p_unit_text: text, p_proposed_label: label });
}
async function assetId(who: Db, text = "b", label = "bờ"): Promise<string> {
  const r = await ensureAsset(who, text, label);
  if (r.error) throw new Error(JSON.stringify(r.error));
  return r.data as string;
}
async function createVersion(who: Db, school: string, asset: string, seed: string, version = randomUUID()) {
  const r = await who.rpc("teacher_create_audio_version", {
    p_asset_id: asset,
    p_version_id: version,
    p_storage_key: keyOf(school, asset, version),
    p_content_hash: hash(seed),
    p_mime_type: "audio/wav",
    p_size_bytes: 1000,
    p_duration_ms: 1000,
  });
  return { ...r, version };
}
const review = (who: Db, version: string, decision: "approve" | "reject", note = "", listened = true) =>
  who.rpc("teacher_review_audio_version", {
    p_version_id: version,
    p_decision: decision,
    p_note: note,
    p_listened: listened,
  });
const versionRow = async (id: string) =>
  (await admin.from("audio_asset_versions").select("*").eq("id", id).single()).data;

beforeAll(async () => {
  setLocalTeacherAudioApproval(true);
  schoolA = await newSchool();
  schoolB = await newSchool();
  t1 = await newTeacher(schoolA, "au1");
  t2 = await newTeacher(schoolA, "au2");
  outsider = await newTeacher(schoolB, "au3");
  device = await newDevice();
});

afterAll(() => setLocalTeacherAudioApproval(false));

describe("cờ hệ thống và đồng ý dùng giọng", () => {
  it("cờ tắt: thao tác ghi bị từ chối, trạng thái vẫn đọc được; bật: ghi được", async () => {
    setLocalTeacherAudioApproval(false);
    try {
      expect(err(await ensureAsset(t1.client))).toBe("AUDIO_RECORDING_DISABLED");
      expect(err(await t1.client.rpc("teacher_grant_audio_consent", { p_notice_version: "v1" }))).toBe(
        "AUDIO_RECORDING_DISABLED",
      );
      const status = await t1.client.rpc("teacher_audio_status");
      expect((status.data as { recording_enabled: boolean }).recording_enabled).toBe(false);
    } finally {
      setLocalTeacherAudioApproval(true);
    }
    expect((await ensureAsset(t1.client)).error).toBeNull();
  });

  it("chưa đồng ý dùng giọng thì không tạo được bản ghi", async () => {
    const asset = await assetId(t2.client, "c", "cờ");
    expect(err((await createVersion(t2.client, schoolA, asset, "x")) as never)).toBe("VOICE_CONSENT_REQUIRED");
    expect(await admin.from("audio_asset_versions").select("id").eq("asset_id", asset)).toMatchObject({ data: [] });
  });

  it("đồng ý chỉ có hiệu lực cho chính GV và idempotent; rút đồng ý thu hồi bản ghi của GV đó", async () => {
    const teacher = await newTeacher(schoolA, "au-consent");
    const a = await teacher.client.rpc("teacher_grant_audio_consent", { p_notice_version: "v1" });
    const b = await teacher.client.rpc("teacher_grant_audio_consent", { p_notice_version: "v1" });
    expect(a.error).toBeNull();
    expect(b.data).toBe(a.data);
    const asset = await assetId(teacher.client, "d", "dờ");
    const draft = await createVersion(teacher.client, schoolA, asset, "w1");
    expect(draft.error).toBeNull();
    const other = await createVersion(teacher.client, schoolA, asset, "w2");
    expect(other.error).toBeNull(); // bản nháp cũ bị bỏ, bản mới là nháp
    expect((await versionRow(draft.version))?.status).toBe("discarded");

    const withdrawn = await teacher.client.rpc("teacher_withdraw_audio_consent", { p_reason: "Không còn muốn dùng" });
    expect(withdrawn.data).toBe(1);
    expect((await versionRow(other.version))?.status).toBe("revoked");
    expect(err((await createVersion(teacher.client, schoolA, asset, "w3")) as never)).toBe("VOICE_CONSENT_REQUIRED");
    const status = await teacher.client.rpc("teacher_audio_status");
    expect((status.data as { consent_active: boolean }).consent_active).toBe(false);
    // Chứng từ không sửa/xóa được kể cả bằng quyền cao.
    const tamper = await admin.from("audio_voice_consents").update({ notice_version: "v9" }).eq("staff_id", teacher.id);
    expect(tamper.error?.message).toContain("AUDIO_CONSENT_IMMUTABLE");
  });
});

describe("phạm vi trường, bản nháp riêng, quyền", () => {
  let asset: string;
  let draft: string;

  beforeAll(async () => {
    await t1.client.rpc("teacher_grant_audio_consent", { p_notice_version: "v1" });
    asset = await assetId(t1.client, "g", "gờ");
    const created = await createVersion(t1.client, schoolA, asset, "scope-1");
    expect(created.error).toBeNull();
    draft = created.version;
  });

  it("khóa đối tượng phải đúng dạng {trường}/{tài nguyên}/{phiên bản}: khóa lạ, trường khác, đường dẫn tùy ý đều bị từ chối", async () => {
    const id = randomUUID();
    for (const key of [
      keyOf(schoolB, asset, id),
      keyOf(schoolA, asset, randomUUID()),
      `../../x/${id}.wav`,
      `${schoolA}/${asset}/${id}.exe`,
    ]) {
      const r = await t1.client.rpc("teacher_create_audio_version", {
        p_asset_id: asset,
        p_version_id: id,
        p_storage_key: key,
        p_content_hash: hash(key),
        p_mime_type: "audio/wav",
        p_size_bytes: 1000,
        p_duration_ms: 1000,
      });
      expect(r.error, key).not.toBeNull();
    }
  });

  it("đồng nghiệp cùng trường thấy tài nguyên nhưng KHÔNG thấy bản nháp; quản trị trường thì thấy", async () => {
    expect(((await t2.client.from("audio_assets").select("id").eq("id", asset)).data ?? []).length).toBe(1);
    expect((await t2.client.from("audio_asset_versions").select("id").eq("id", draft)).data).toEqual([]);
    expect(((await t1.client.from("audio_asset_versions").select("id").eq("id", draft)).data ?? []).length).toBe(1);
  });

  it("trường khác, thiết bị học sinh và người chưa đăng nhập không đọc được gì (UUID không cấp quyền)", async () => {
    for (const client of [outsider.client, device.client, publicClient()]) {
      expect((await client.from("audio_assets").select("id")).data ?? []).toEqual([]);
      expect((await client.from("audio_asset_versions").select("id").eq("id", draft)).data ?? []).toEqual([]);
      expect((await client.from("audio_voice_consents").select("id")).data ?? []).toEqual([]);
    }
  });

  it("thao tác lên bản của người khác/trường khác bị từ chối", async () => {
    expect(err(await t2.client.rpc("teacher_submit_audio_version", { p_version_id: draft }))).toBe("NOT_FOUND");
    expect(err(await outsider.client.rpc("teacher_submit_audio_version", { p_version_id: draft }))).toBe("NOT_FOUND");
    expect(
      err(await outsider.client.rpc("teacher_confirm_audio_pronunciation", { p_asset_id: asset, p_label: "gờ" })),
    ).toBe("NOT_FOUND");
    expect(
      err(await outsider.client.rpc("teacher_revoke_audio_version", { p_version_id: draft, p_reason: "thử xem" })),
    ).toBe("NOT_FOUND");
    expect(err(await t2.client.rpc("teacher_discard_audio_version", { p_version_id: draft }))).toBe("NOT_FOUND");
  });

  it("thiết bị học sinh và anon không gọi được hàm quản lý âm thanh", async () => {
    const calls = [
      (c: Db) => c.rpc("teacher_audio_status"),
      (c: Db) => c.rpc("teacher_grant_audio_consent", { p_notice_version: "v1" }),
      (c: Db) => ensureAsset(c),
      (c: Db) => c.rpc("teacher_submit_audio_version", { p_version_id: draft }),
      (c: Db) => review(c, draft, "approve"),
    ];
    for (const call of calls) {
      expect((await call(device.client)).error?.message).toBe("FORBIDDEN");
      expect((await call(publicClient())).error).not.toBeNull();
    }
  });

  it("không ghi trực tiếp vào bảng bằng API (không có quyền INSERT/UPDATE/DELETE)", async () => {
    for (const table of ["audio_assets", "audio_asset_versions", "audio_voice_consents"] as const) {
      const ins = await t1.client.from(table).insert({} as never);
      expect(ins.error, `${table} insert`).not.toBeNull();
      const upd = await t1.client
        .from(table)
        .update({ id: randomUUID() } as never)
        .eq("id", draft);
      expect(upd.error, `${table} update`).not.toBeNull();
      expect((await t1.client.from(table).delete().eq("id", draft)).error, `${table} delete`).not.toBeNull();
    }
    const forged = await t1.client.from("audio_asset_versions").update({ status: "approved" }).eq("id", draft);
    expect(forged.error).not.toBeNull();
    expect((await versionRow(draft))?.status).toBe("draft");
  });

  it("trigger chặn sửa nội dung/trạng thái trái quy tắc kể cả bằng khóa dịch vụ", async () => {
    const swap = await admin
      .from("audio_asset_versions")
      .update({ storage_key: keyOf(schoolA, asset, randomUUID()) })
      .eq("id", draft);
    expect(swap.error?.message).toContain("AUDIO_VERSION_IMMUTABLE");
    const skip = await admin.from("audio_asset_versions").update({ status: "approved" }).eq("id", draft);
    expect(skip.error?.message).toContain("AUDIO_INVALID_TRANSITION");
    const del = await admin.from("audio_asset_versions").delete().eq("id", draft);
    expect(del.error?.message).toContain("AUDIO_RECORD_NO_DELETE");
    const id = randomUUID();
    const forged = await admin.from("audio_asset_versions").insert({
      id,
      asset_id: asset,
      school_id: schoolA,
      version_no: 99,
      status: "approved",
      spoken_label: "gờ",
      storage_key: keyOf(schoolA, asset, id),
      content_hash: hash("forged"),
      mime_type: "audio/wav",
      size_bytes: 10,
      duration_ms: 1000,
      consent_id: (await admin.from("audio_voice_consents").select("id").eq("staff_id", t1.id).single()).data!.id,
      created_by: t1.id,
    });
    expect(forged.error?.message).toContain("AUDIO_VERSION_MUST_START_DRAFT");
  });

  it("audit_logs chỉ chứa UUID/mã, không có khóa lưu trữ hay nhãn", async () => {
    const logs = await admin.from("audit_logs").select("action, metadata").like("action", "audio.%");
    expect(logs.data?.length).toBeGreaterThan(0);
    const text = JSON.stringify(logs.data);
    expect(text).not.toMatch(/storage_key|\.wav|spoken|bờ|gờ/u);
  });
});

describe("quy trình duyệt và phiên bản", () => {
  let asset: string;
  beforeAll(async () => {
    await t1.client.rpc("teacher_grant_audio_consent", { p_notice_version: "v1" });
    asset = await assetId(t1.client, "h", "hờ");
  });

  it("đi đủ chuỗi: nháp → gửi duyệt (bất biến) → điều kiện duyệt → duyệt; bản mới thay bản cũ chỉ khi được duyệt", async () => {
    const v1 = await createVersion(t1.client, schoolA, asset, "flow-1");
    expect(v1.error).toBeNull();
    // Chưa gửi duyệt → không duyệt được.
    expect(err(await review(t2.client, v1.version, "approve"))).toBe("NOT_FOUND");
    expect((await t1.client.rpc("teacher_submit_audio_version", { p_version_id: v1.version })).error).toBeNull();
    expect(err(await t1.client.rpc("teacher_submit_audio_version", { p_version_id: v1.version }))).toBe(
      "STATE_CONFLICT",
    );
    // Bản đã gửi duyệt bất biến.
    expect(
      (await admin.from("audio_asset_versions").update({ duration_ms: 2000 }).eq("id", v1.version)).error?.message,
    ).toContain("AUDIO_VERSION_IMMUTABLE");
    // Thiếu điều kiện: chưa nghe, chưa xác nhận cách đọc, sai cách đọc.
    expect(err(await review(t2.client, v1.version, "approve", "", false))).toBe("LISTEN_REQUIRED");
    expect(err(await review(t2.client, v1.version, "approve"))).toBe("PRONUNCIATION_UNCONFIRMED");
    // Không đổi được cách đọc khi đang có bản chờ duyệt khác nhãn đã xác nhận: xác nhận nhãn khác hẳn nhãn bản ghi thì khóa.
    expect(
      (await t2.client.rpc("teacher_confirm_audio_pronunciation", { p_asset_id: asset, p_label: "hờ" })).error,
    ).toBeNull();
    // Nhãn đã xác nhận khớp → duyệt được, và asset trỏ tới bản này.
    expect((await review(t2.client, v1.version, "approve", "Rõ, đúng cách đọc")).error).toBeNull();
    expect((await versionRow(v1.version))?.status).toBe("approved");
    expect(
      (await admin.from("audio_assets").select("active_version_id").eq("id", asset).single()).data?.active_version_id,
    ).toBe(v1.version);
    expect(err(await review(t2.client, v1.version, "approve"))).toBe("STATE_CONFLICT");
    // Đang có bản đã duyệt → không đổi cách đọc.
    expect(err(await t2.client.rpc("teacher_confirm_audio_pronunciation", { p_asset_id: asset, p_label: "hợ" }))).toBe(
      "PRONUNCIATION_LOCKED",
    );

    // Bản mới KHÔNG làm thay đổi bản đã duyệt cho tới khi được duyệt.
    const v2 = await createVersion(t1.client, schoolA, asset, "flow-2");
    expect((await t1.client.rpc("teacher_submit_audio_version", { p_version_id: v2.version })).error).toBeNull();
    expect(
      (await admin.from("audio_assets").select("active_version_id").eq("id", asset).single()).data?.active_version_id,
    ).toBe(v1.version);
    expect((await versionRow(v1.version))?.status).toBe("approved");
    expect((await review(t2.client, v2.version, "approve")).error).toBeNull();
    expect((await versionRow(v1.version))?.status).toBe("superseded");
    expect((await versionRow(v1.version))?.storage_key).toBe(keyOf(schoolA, asset, v1.version));
    expect(
      (await admin.from("audio_assets").select("active_version_id").eq("id", asset).single()).data?.active_version_id,
    ).toBe(v2.version);
    const first = await versionRow(v1.version);
    expect(first?.reviewed_by).toBe(t2.id);
    expect(first?.review_listened).toBe(true);
  });

  it("từ chối cần ghi chú, bản bị từ chối không duyệt lại được; ghi lại tạo phiên bản mới", async () => {
    const asset2 = await assetId(t1.client, "k", "ca");
    const v = await createVersion(t1.client, schoolA, asset2, "rej-1");
    await t1.client.rpc("teacher_submit_audio_version", { p_version_id: v.version });
    expect(err(await review(t2.client, v.version, "reject", ""))).toBe("NOTE_REQUIRED");
    expect((await review(t2.client, v.version, "reject", "Có tiếng ồn, hãy ghi lại")).error).toBeNull();
    const row = await versionRow(v.version);
    expect(row).toMatchObject({ status: "rejected", review_note: "Có tiếng ồn, hãy ghi lại" });
    expect(err(await review(t2.client, v.version, "approve"))).toBe("STATE_CONFLICT");
    const again = await createVersion(t1.client, schoolA, asset2, "rej-2");
    expect(again.error).toBeNull();
    expect((again.data as { version_no: number }).version_no).toBe(2);
    expect((await versionRow(v.version))?.status).toBe("rejected");
  });

  it("cách đọc xác nhận khác bản ghi → LABEL_MISMATCH; người ghi rút đồng ý → không duyệt được", async () => {
    const asset3 = await assetId(t1.client, "l", "lờ");
    const v = await createVersion(t1.client, schoolA, asset3, "mm-1");
    await t1.client.rpc("teacher_submit_audio_version", { p_version_id: v.version });
    // Xác nhận lần đầu một cách đọc KHÁC cách đọc ghi trên bản này → không duyệt được.
    expect(
      (await t2.client.rpc("teacher_confirm_audio_pronunciation", { p_asset_id: asset3, p_label: "lê" })).error,
    ).toBeNull();
    expect(err(await review(t2.client, v.version, "approve"))).toBe("LABEL_MISMATCH");

    const guest = await newTeacher(schoolA, "au-guest");
    await guest.client.rpc("teacher_grant_audio_consent", { p_notice_version: "v1" });
    const asset4 = await assetId(guest.client, "m", "mờ");
    await t2.client.rpc("teacher_confirm_audio_pronunciation", { p_asset_id: asset4, p_label: "mờ" });
    const gv = await createVersion(guest.client, schoolA, asset4, "mm-2");
    await guest.client.rpc("teacher_submit_audio_version", { p_version_id: gv.version });
    await guest.client.rpc("teacher_withdraw_audio_consent", { p_reason: "Đổi ý trước khi duyệt" });
    expect((await versionRow(gv.version))?.status).toBe("revoked");
    expect(err(await review(t2.client, gv.version, "approve"))).toBe("STATE_CONFLICT");
  });

  it("thu hồi: người tạo hoặc quản trị; bản đang dùng bị thu hồi thì asset không còn trỏ tới", async () => {
    const asset5 = await assetId(t1.client, "n", "nờ");
    await t2.client.rpc("teacher_confirm_audio_pronunciation", { p_asset_id: asset5, p_label: "nờ" });
    const v = await createVersion(t1.client, schoolA, asset5, "rv-1");
    await t1.client.rpc("teacher_submit_audio_version", { p_version_id: v.version });
    await review(t2.client, v.version, "approve");
    expect(
      err(
        await t2.client.rpc("teacher_revoke_audio_version", {
          p_version_id: v.version,
          p_reason: "Không phải người ghi",
        }),
      ),
    ).toBe("FORBIDDEN");
    expect(
      (await t1.client.rpc("teacher_revoke_audio_version", { p_version_id: v.version, p_reason: "Ghi sai âm" })).error,
    ).toBeNull();
    expect((await versionRow(v.version))?.status).toBe("revoked");
    expect(
      (await admin.from("audio_assets").select("active_version_id").eq("id", asset5).single()).data?.active_version_id,
    ).toBeNull();
    // Thu hồi vẫn được dù cờ tắt (an toàn).
  });

  it("hai yêu cầu tạo bản ghi đồng thời không trùng số phiên bản (khóa dòng tài nguyên)", async () => {
    const asset6 = await assetId(t1.client, "p", "pờ");
    const results = await Promise.all(
      ["c-1", "c-2", "c-3", "c-4"].map((seed) => createVersion(t1.client, schoolA, asset6, seed)),
    );
    for (const r of results) expect(r.error, JSON.stringify(r.error)).toBeNull();
    const nos =
      (await admin.from("audio_asset_versions").select("version_no").eq("asset_id", asset6)).data?.map(
        (r) => r.version_no,
      ) ?? [];
    expect(new Set(nos).size).toBe(4);
    // Chỉ một bản nháp còn mở của người ghi.
    const open =
      (await admin.from("audio_asset_versions").select("id").eq("asset_id", asset6).eq("status", "draft")).data ?? [];
    expect(open.length).toBe(1);
  });

  it("gửi lại cùng một bản ghi (retry) bị chặn bằng hash, không sinh bản trùng", async () => {
    const asset7 = await assetId(t1.client, "q", "quờ");
    expect((await createVersion(t1.client, schoolA, asset7, "dup")).error).toBeNull();
    expect(err((await createVersion(t1.client, schoolA, asset7, "dup")) as never)).toBe("DUPLICATE_AUDIO");
  });
});

describe("Storage riêng tư teacher-audio", () => {
  let storageUp = false;
  beforeAll(async () => {
    const buckets = await admin.storage.listBuckets();
    storageUp = !buckets.error;
    if (!storageUp && process.env.REQUIRE_STORAGE === "1") {
      throw new Error(
        "REQUIRE_STORAGE=1 nhưng Storage local không chạy — dùng `npm run db:start` (không phải db:start:lite).",
      );
    }
    if (!storageUp) console.warn("BỎ QUA kiểm thử Storage: dịch vụ chưa chạy (db:start:lite).");
  });
  const when = (name: string, fn: () => Promise<void>) =>
    it(name, async (ctx) => {
      if (!storageUp) return ctx.skip();
      await fn();
    });

  when("bucket tồn tại, riêng tư, giới hạn 2 MiB và định dạng âm thanh", async () => {
    const bucket = await admin.storage.getBucket("teacher-audio");
    expect(bucket.error).toBeNull();
    expect(bucket.data?.public).toBe(false);
    expect(bucket.data?.file_size_limit).toBe(2 * 1024 * 1024);
    expect(bucket.data?.allowed_mime_types).toEqual([
      "audio/webm",
      "audio/ogg",
      "audio/mp4",
      "audio/mpeg",
      "audio/wav",
    ]);
  });

  when(
    "khóa dịch vụ tải lên được; liên kết công khai, anon, GV và thiết bị học sinh đều không đọc/ghi/liệt kê được",
    async () => {
      const key = `${schoolA}/${randomUUID()}/${randomUUID()}.wav`;
      const body = new Uint8Array([1, 2, 3, 4, 5]);
      const up = await admin.storage
        .from("teacher-audio")
        .upload(key, body, { contentType: "audio/wav", upsert: false });
      expect(up.error).toBeNull();
      // Không ghi đè.
      const again = await admin.storage
        .from("teacher-audio")
        .upload(key, body, { contentType: "audio/wav", upsert: false });
      expect(again.error).not.toBeNull();
      // Định dạng lạ bị bucket từ chối.
      const bad = await admin.storage
        .from("teacher-audio")
        .upload(`${key}.exe`, body, { contentType: "application/x-msdownload" });
      expect(bad.error).not.toBeNull();

      const publicUrl = `${local.url}/storage/v1/object/public/teacher-audio/${key}`;
      expect((await fetch(publicUrl)).ok).toBe(false);
      for (const client of [publicClient(), t1.client, outsider.client, device.client]) {
        const dl = await client.storage.from("teacher-audio").download(key);
        expect(dl.error).not.toBeNull();
        const list = await client.storage.from("teacher-audio").list(schoolA);
        expect(list.data ?? []).toEqual([]);
        const write = await client.storage
          .from("teacher-audio")
          .upload(`${schoolA}/x/${suffix()}.wav`, body, { contentType: "audio/wav" });
        expect(write.error).not.toBeNull();
        expect((await client.storage.from("teacher-audio").remove([key])).data ?? []).toEqual([]);
      }
      const stillThere = await admin.storage.from("teacher-audio").download(key);
      expect(stillThere.error).toBeNull();
      await admin.storage.from("teacher-audio").remove([key]);
    },
  );

  when("quá 2 MiB bị bucket từ chối", async () => {
    const big = new Uint8Array(2 * 1024 * 1024 + 1);
    const r = await admin.storage
      .from("teacher-audio")
      .upload(`${schoolA}/${randomUUID()}/${randomUUID()}.wav`, big, { contentType: "audio/wav" });
    expect(r.error).not.toBeNull();
  });
});
