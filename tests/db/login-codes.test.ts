import { beforeAll, describe, expect, it } from "vitest";
import { hmacHex, hmacLoginCode, toPgBytea } from "../../src/features/login-codes/codes";
import { admin, issueCode, newDevice, newSchool, newTeacher, PEPPER, redeem, rpcOk, type Actor } from "./helpers";

/** Thẻ học + liên kết thiết bị trên CSDL thật: vòng đời mã, chống dò, đồng thời, khôi phục (docs/STUDENT_ACCESS.md). */

let teacher: Actor;
let studentA: string;
let studentB: string;

beforeAll(async () => {
  const school = await newSchool();
  teacher = await newTeacher(school, "gv-code");
  const classId = await rpcOk(
    teacher.client.rpc("teacher_create_class", { p_name: "Lớp Mã", p_school_year: "2026-2027" }),
  );
  const create = (name: string, number: number) =>
    rpcOk(
      teacher.client.rpc("teacher_create_student", {
        p_class_id: classId,
        p_display_name: name,
        p_student_number: number,
        p_avatar_key: "na",
      }),
    );
  studentA = await create("Mít", 1);
  studentB = await create("Xoài", 2);
});

const visibleStudents = async (device: Actor) =>
  ((await device.client.from("students").select("id")).data ?? []).map((row) => row.id);

describe("mã hợp lệ", () => {
  it("mã dự phòng liên kết đúng học sinh; thiết bị chỉ thấy học sinh đó", async () => {
    const code = await issueCode(teacher.client, studentA);
    const device = await newDevice();
    const result = await redeem("backup", code.backup, device.id);
    expect(result.outcome).toBe("linked");
    expect(result.student_id).toBe(studentA);
    expect(await visibleStudents(device)).toEqual([studentA]);
  });

  it("mã QR (token) liên kết được; mã dự phòng và token tách miền HMAC (không dùng lẫn)", async () => {
    const code = await issueCode(teacher.client, studentA);
    const device = await newDevice();
    expect((await redeem("backup", code.token, device.id)).outcome).toBe("invalid");
    expect((await redeem("token", code.backup, device.id)).outcome).toBe("invalid");
    expect((await redeem("token", code.token, device.id)).outcome).toBe("linked");
  });

  it("CSDL chỉ lưu HMAC 32 byte, không lưu mã gốc", async () => {
    const code = await issueCode(teacher.client, studentA);
    const { data } = await admin
      .from("student_login_codes")
      .select("token_hmac, backup_code_hmac")
      .eq("id", code.codeId)
      .single();
    const stored = JSON.stringify(data);
    expect(stored).not.toContain(code.token);
    expect(stored).not.toContain(code.backup);
    expect(String(data?.token_hmac)).toBe(toPgBytea(hmacLoginCode(PEPPER, "token", code.token)));
  });

  it("kiểm tra trước (gateway_check_login_code) không làm thay đổi gì", async () => {
    const code = await issueCode(teacher.client, studentA);
    const check = await admin.rpc("gateway_check_login_code", {
      p_code_hmac: toPgBytea(hmacLoginCode(PEPPER, "backup", code.backup)),
      p_kind: "backup",
    });
    expect(check.data).toBe(code.codeId);
    const row = await admin.from("student_login_codes").select("devices_linked").eq("id", code.codeId).single();
    expect(row.data?.devices_linked).toBe(0);
  });
});

describe("mã không dùng được — cùng một kết quả 'invalid', không lộ lý do", () => {
  it("mã sai", async () => {
    const device = await newDevice();
    expect(await redeem("backup", "ZZZZ9999", device.id)).toMatchObject({ outcome: "invalid", student_id: null });
  });

  it("mã hết hạn", async () => {
    const code = await issueCode(teacher.client, studentB);
    const past = new Date(Date.now() - 3600_000).toISOString();
    await rpcOk(
      admin
        .from("student_login_codes")
        .update({ created_at: new Date(Date.now() - 7200_000).toISOString(), expires_at: past })
        .eq("id", code.codeId),
    );
    const device = await newDevice();
    expect((await redeem("backup", code.backup, device.id)).outcome).toBe("invalid");
  });

  it("mã bị GV thu hồi", async () => {
    const code = await issueCode(teacher.client, studentB);
    await rpcOk(teacher.client.rpc("teacher_revoke_login_code", { p_code_id: code.codeId }));
    const device = await newDevice();
    expect((await redeem("token", code.token, device.id)).outcome).toBe("invalid");
  });

  it("mã đã dùng hết số thiết bị cho phép (dùng lại sai quy tắc)", async () => {
    const code = await issueCode(teacher.client, studentB, { maxDevices: 2 });
    expect((await redeem("backup", code.backup, (await newDevice()).id)).outcome).toBe("linked");
    expect((await redeem("backup", code.backup, (await newDevice()).id)).outcome).toBe("linked");
    expect((await redeem("backup", code.backup, (await newDevice()).id)).outcome).toBe("invalid");
  });

  it("học sinh đã lưu trữ: mã không còn dùng được", async () => {
    const extra = await rpcOk(
      teacher.client.rpc("teacher_create_student", {
        p_class_id: (await admin.from("students").select("class_id").eq("id", studentA).single()).data!.class_id,
        p_display_name: "Lưu Trữ",
        p_student_number: 9,
        p_avatar_key: "bin",
      }),
    );
    const code = await issueCode(teacher.client, extra);
    await rpcOk(teacher.client.rpc("teacher_set_student_status", { p_student_id: extra, p_status: "archived" }));
    expect((await redeem("backup", code.backup, (await newDevice()).id)).outcome).toBe("invalid");
  });
});

describe("đồng thời và gửi lại", () => {
  it("nhiều thiết bị gửi cùng lúc với mã giới hạn 1 thiết bị → đúng 1 liên kết", async () => {
    const code = await issueCode(teacher.client, studentB, { maxDevices: 1 });
    const devices = await Promise.all(Array.from({ length: 6 }, () => newDevice()));
    const results = await Promise.all(devices.map((device) => redeem("backup", code.backup, device.id)));
    expect(results.filter((result) => result.outcome === "linked")).toHaveLength(1);
    const row = await admin.from("student_login_codes").select("devices_linked").eq("id", code.codeId).single();
    expect(row.data?.devices_linked).toBe(1);
  });

  it("cùng một thiết bị gửi lặp/đồng thời → một liên kết, không tính thêm lượt", async () => {
    const code = await issueCode(teacher.client, studentA, { maxDevices: 2 });
    const device = await newDevice();
    const results = await Promise.all([1, 2, 3].map(() => redeem("token", code.token, device.id)));
    expect(results.filter((result) => result.outcome === "linked")).toHaveLength(1);
    expect(results.filter((result) => result.outcome === "already_linked")).toHaveLength(2);
    const links = await admin.from("student_devices").select("id").eq("auth_user_id", device.id).is("revoked_at", null);
    expect(links.data).toHaveLength(1);
  });
});

describe("phạm vi và khôi phục", () => {
  it("mã của học sinh A không mở được hồ sơ học sinh B", async () => {
    const code = await issueCode(teacher.client, studentA);
    const device = await newDevice();
    await redeem("backup", code.backup, device.id);
    const forB = await device.client.from("students").select("id").eq("id", studentB);
    expect(forB.data).toEqual([]);
  });

  it("thiết bị thứ hai (bố/mẹ) liên kết cùng thẻ; một máy liên kết được hai anh chị em", async () => {
    const codeA = await issueCode(teacher.client, studentA, { maxDevices: 3 });
    const codeB = await issueCode(teacher.client, studentB, { maxDevices: 3 });
    const phoneMom = await newDevice();
    const phoneDad = await newDevice();
    expect((await redeem("backup", codeA.backup, phoneMom.id)).outcome).toBe("linked");
    expect((await redeem("backup", codeA.backup, phoneDad.id)).outcome).toBe("linked");
    expect((await redeem("backup", codeB.backup, phoneMom.id)).outcome).toBe("linked");
    expect((await visibleStudents(phoneMom)).sort()).toEqual([studentA, studentB].sort());
    expect(await visibleStudents(phoneDad)).toEqual([studentA]);
  });

  it("đổi điện thoại: GV cấp thẻ mới → thẻ cũ vô hiệu, máy mới liên kết được", async () => {
    const oldCode = await issueCode(teacher.client, studentB);
    const newCode = await issueCode(teacher.client, studentB);
    const old = await admin
      .from("student_login_codes")
      .select("revoked_at, revoke_reason")
      .eq("id", oldCode.codeId)
      .single();
    expect(old.data?.revoke_reason).toBe("reissued");
    const newPhone = await newDevice();
    expect((await redeem("backup", oldCode.backup, newPhone.id)).outcome).toBe("invalid");
    expect((await redeem("backup", newCode.backup, newPhone.id)).outcome).toBe("linked");
    expect(await visibleStudents(newPhone)).toEqual([studentB]);
  });

  it("thẻ học phải có hạn dùng trong khoảng cho phép (1 giờ – 90 ngày)", async () => {
    const result = await teacher.client.rpc("teacher_issue_login_code", {
      p_student_id: studentA,
      p_token_hmac: `\\x${"ab".repeat(32)}`,
      p_backup_code_hmac: `\\x${"cd".repeat(32)}`,
      p_expires_at: new Date(Date.now() + 365 * 86_400_000).toISOString(),
      p_max_devices: 1,
    });
    expect(result.error?.message).toBe("INVALID_INPUT");
  });
});

describe("chống dò mã", () => {
  it("giới hạn tần suất theo IP: 10 lần/15 phút, lần 11 bị chặn (khóa là HMAC, không lưu IP thô)", async () => {
    const key = hmacHex(PEPPER, "join.address", `198.51.100.${Math.floor(Math.random() * 250)}`);
    const outcomes: boolean[] = [];
    for (let attempt = 0; attempt < 11; attempt += 1) {
      outcomes.push(
        (await admin.rpc("gateway_consume_rate_limit", { p_key_hash: key, p_window_seconds: 900, p_limit: 10 }))
          .data === true,
      );
    }
    expect(outcomes.slice(0, 10).every(Boolean)).toBe(true);
    expect(outcomes[10]).toBe(false);
    const stored = await admin.from("rate_limit_buckets").select("key_hash").eq("key_hash", key);
    expect(stored.data?.[0]?.key_hash).toMatch(/^[0-9a-f]{64}$/u);
  });
});
