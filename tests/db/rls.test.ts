import { beforeAll, describe, expect, it } from "vitest";
import {
  admin,
  buildWorld,
  issueCode,
  newDevice,
  newTeacher,
  publicClient,
  redeem,
  rpcOk,
  type Db,
  type World,
} from "./helpers";

/**
 * Ma trận phân quyền (REDESIGN_ARCHITECTURE §8, DATA_MODEL §7) — chạy qua PostgREST bằng JWT THẬT của từng vai trò
 * trên Supabase local. Hai lớp × hai GV × ba học sinh; thiết bị chưa liên kết / đã liên kết / đã thu hồi.
 */

const STUDENT_TABLES = [
  "students",
  "student_band_assignments",
  "student_devices",
  "guardian_consents",
  "seasons",
  "classes",
  "class_staff",
  "audit_logs",
  "staff_profiles",
  "schools",
  "kb_units",
  "curriculum_series",
] as const;

async function rows(client: Db, table: (typeof STUDENT_TABLES)[number]) {
  const { data, error } = await client.from(table).select("*");
  return { data: (data ?? []) as Array<Record<string, unknown>>, error };
}

let world: World;
beforeAll(async () => {
  world = await buildWorld();
});

describe("người chưa đăng nhập (khóa publishable, không phiên)", () => {
  it.each(STUDENT_TABLES)("không đọc được %s", async (table) => {
    const { data } = await rows(publicClient(), table);
    expect(data).toEqual([]);
  });

  it("không đọc được thẻ học, kể cả các cột được phép", async () => {
    const { data } = await publicClient().from("student_login_codes").select("id, student_id");
    expect(data ?? []).toEqual([]);
  });
});

describe("người dùng ẩn danh CHƯA liên kết", () => {
  it.each(STUDENT_TABLES)("không đọc được %s", async (table) => {
    const { data } = await rows(world.unlinkedDevice.client, table);
    // student_devices: policy tự đọc chỉ trả liên kết của chính thiết bị → rỗng.
    expect(data).toEqual([]);
  });
});

describe("thiết bị đã liên kết với học sinh A1", () => {
  it("chỉ thấy đúng hồ sơ A1 (không thấy bạn cùng lớp, không thấy lớp khác)", async () => {
    const { data } = await rows(world.deviceA1.client, "students");
    expect(data.map((row) => row.id)).toEqual([world.studentsA[0]]);
    const direct = await world.deviceA1.client.from("students").select("id").eq("id", world.studentsA[1]!);
    expect(direct.data).toEqual([]);
    const other = await world.deviceA1.client.from("students").select("id").eq("class_id", world.classB);
    expect(other.data).toEqual([]);
  });

  it("thấy lớp và mùa của mình, không thấy lớp B", async () => {
    expect((await rows(world.deviceA1.client, "classes")).data.map((row) => row.id)).toEqual([world.classA]);
    const seasons = (await rows(world.deviceA1.client, "seasons")).data;
    expect(seasons.map((row) => row.class_id)).toEqual([world.classA]);
  });

  it.each([
    "student_band_assignments",
    "guardian_consents",
    "audit_logs",
    "class_staff",
    "staff_profiles",
    "kb_units",
  ] as const)("không bao giờ đọc được %s (nhóm năng lực, đồng ý, nhật ký, GV, học liệu)", async (table) => {
    expect((await rows(world.deviceA1.client, table)).data).toEqual([]);
  });

  it("không đọc được thẻ học của chính mình", async () => {
    const { data } = await world.deviceA1.client.from("student_login_codes").select("id");
    expect(data).toEqual([]);
  });

  it("không ghi trực tiếp được vào bất kỳ bảng nào", async () => {
    const client = world.deviceA1.client;
    const attempts = [
      await client.from("students").update({ display_name: "Đổi tên" }).eq("id", world.studentsA[0]!).select(),
      await client.from("classes").update({ leaderboard_enabled: true }).eq("id", world.classA).select(),
      await client.from("seasons").update({ status: "closed" }).eq("class_id", world.classA).select(),
      await client
        .from("guardian_consents")
        .insert({
          student_id: world.studentsA[0]!,
          class_id: world.classA,
          scope: "leaderboard_display",
          notice_version: "nhap-2026-10",
          method: "paper_form",
          recorded_by: world.teacherA.id,
        })
        .select(),
      await client
        .from("staff_profiles")
        .insert({ id: world.deviceA1.id, school_id: world.schoolId, display_name: "Giả GV" })
        .select(),
      await client
        .from("class_staff")
        .insert({ class_id: world.classA, staff_id: world.deviceA1.id, role: "owner" })
        .select(),
      await client.from("audit_logs").insert({ actor_kind: "system", action: "fake.event", target_type: "x" }).select(),
    ];
    for (const attempt of attempts) {
      expect(attempt.error).not.toBeNull();
      expect(attempt.data ?? []).toEqual([]);
    }
    const unchanged = await admin.from("classes").select("leaderboard_enabled").eq("id", world.classA).single();
    expect(unchanged.data?.leaderboard_enabled).toBe(false);
  });

  it("không gọi được hàm của giáo viên (tạo lớp, ghi nhận đồng ý, đổi quyền) hay của gateway", async () => {
    const client = world.deviceA1.client;
    const createClass = await client.rpc("teacher_create_class", { p_name: "Lớp giả", p_school_year: "2026-2027" });
    expect(createClass.error?.message).toBe("FORBIDDEN");
    const consent = await client.rpc("teacher_record_consent", {
      p_student_id: world.studentsA[0]!,
      p_scope: "leaderboard_display",
      p_notice_version: "nhap-2026-10",
      p_method: "paper_form",
      p_note: "",
      p_attested: true,
    });
    expect(consent.error?.message).toBe("FORBIDDEN");
    const alias = await client.rpc("teacher_approve_leaderboard_alias", { p_student_id: world.studentsA[0]! });
    expect(alias.error?.message).toBe("FORBIDDEN");
    const gateway = await client.rpc("gateway_update_student_preferences", {
      p_auth_user_id: world.deviceA1.id,
      p_student_id: world.studentsA[0]!,
      p_avatar_key: "bin",
      p_motion: "reduce",
      p_sound: "off",
    });
    expect(gateway.error).not.toBeNull();
    const consents = await admin.from("guardian_consents").select("id").eq("student_id", world.studentsA[0]!);
    expect(consents.data).toEqual([]);
  });
});

describe("thiết bị đã bị thu hồi", () => {
  it("không còn thấy hồ sơ hay lớp", async () => {
    expect((await rows(world.revokedDevice.client, "students")).data).toEqual([]);
    expect((await rows(world.revokedDevice.client, "classes")).data).toEqual([]);
  });

  it("thu hồi có hiệu lực ngay ở truy vấn kế tiếp (cùng phiên, không cần đăng nhập lại)", async () => {
    const device = await newDevice();
    const code = await issueCode(world.teacherA.client, world.studentsA[2]!);
    const linked = await redeem("backup", code.backup, device.id);
    expect((await rows(device.client, "students")).data).toHaveLength(1);
    await rpcOk(world.teacherA.client.rpc("teacher_revoke_device", { p_device_id: linked.device_id! }));
    expect((await rows(device.client, "students")).data).toEqual([]);
  });

  it("tạm ngưng hồ sơ chặn thiết bị ngay; mở lại thì thiết bị vào lại được", async () => {
    const student = world.studentsB[0]!;
    await rpcOk(world.teacherB.client.rpc("teacher_set_student_status", { p_student_id: student, p_status: "paused" }));
    expect((await rows(world.deviceB1.client, "students")).data).toEqual([]);
    await rpcOk(world.teacherB.client.rpc("teacher_set_student_status", { p_student_id: student, p_status: "active" }));
    expect((await rows(world.deviceB1.client, "students")).data.map((row) => row.id)).toEqual([student]);
  });
});

describe("giáo viên lớp A", () => {
  it("chỉ thấy lớp A và học sinh lớp A", async () => {
    const classes = (await rows(world.teacherA.client, "classes")).data;
    expect(classes.map((row) => row.id)).toEqual([world.classA]);
    const students = (await rows(world.teacherA.client, "students")).data;
    expect(students.map((row) => row.id).sort()).toEqual([...world.studentsA].sort());
  });

  it("không đọc được bất kỳ dữ liệu nào của lớp B dù biết id", async () => {
    const client = world.teacherA.client;
    expect((await client.from("classes").select("id").eq("id", world.classB)).data).toEqual([]);
    expect((await client.from("students").select("id").eq("class_id", world.classB)).data).toEqual([]);
    expect((await client.from("seasons").select("id").eq("class_id", world.classB)).data).toEqual([]);
    expect((await client.from("student_devices").select("id").eq("class_id", world.classB)).data).toEqual([]);
    expect((await client.from("student_login_codes").select("id").eq("class_id", world.classB)).data).toEqual([]);
    expect((await client.from("audit_logs").select("id").eq("class_id", world.classB)).data).toEqual([]);
  });

  it("không thao tác được trên lớp B (thêm học sinh, cấp thẻ, thu hồi thiết bị, đồng ý, đổi tên lớp)", async () => {
    const client = world.teacherA.client;
    const studentB = world.studentsB[1]!;
    const results = [
      await client.rpc("teacher_create_student", {
        p_class_id: world.classB,
        p_display_name: "Lạ",
        p_student_number: 9,
        p_avatar_key: "may",
      }),
      await client.rpc("teacher_rename_class", { p_class_id: world.classB, p_name: "Đổi tên" }),
      await client.rpc("teacher_update_student", {
        p_student_id: studentB,
        p_display_name: "Đổi",
        p_student_number: 2,
        p_avatar_key: "na",
      }),
      await client.rpc("teacher_issue_login_code", {
        p_student_id: studentB,
        p_token_hmac: `\\x${"00".repeat(32)}`,
        p_backup_code_hmac: `\\x${"11".repeat(32)}`,
        p_expires_at: new Date(Date.now() + 86_400_000).toISOString(),
        p_max_devices: 1,
      }),
      await client.rpc("teacher_record_consent", {
        p_student_id: studentB,
        p_scope: "learning_data",
        p_notice_version: "nhap-2026-10",
        p_method: "paper_form",
        p_note: "",
        p_attested: true,
      }),
      await client.rpc("teacher_assign_band", { p_student_id: studentB, p_band: "foundation", p_reason: "" }),
    ];
    for (const result of results) expect(result.error?.message).toBe("FORBIDDEN");
    const deviceB = await admin.from("student_devices").select("id").eq("auth_user_id", world.deviceB1.id).single();
    const revoke = await client.rpc("teacher_revoke_device", { p_device_id: deviceB.data!.id });
    expect(revoke.error?.message).toBe("FORBIDDEN");
    const still = await admin.from("student_devices").select("revoked_at").eq("id", deviceB.data!.id).single();
    expect(still.data?.revoked_at).toBeNull();
  });

  it("không đọc được cột HMAC của thẻ học; đọc được các cột quản lý", async () => {
    const forbidden = await world.teacherA.client.from("student_login_codes").select("token_hmac");
    expect(forbidden.error).not.toBeNull();
    const allowed = await world.teacherA.client.from("student_login_codes").select("id, devices_linked, expires_at");
    expect(allowed.error).toBeNull();
    expect((allowed.data ?? []).length).toBeGreaterThan(0);
  });

  it("không ghi trực tiếp (bỏ qua hàm) — kể cả bật bảng xếp hạng hay sửa mùa của lớp mình", async () => {
    const client = world.teacherA.client;
    const update = await client.from("classes").update({ leaderboard_enabled: true }).eq("id", world.classA).select();
    expect(update.error).not.toBeNull();
    const season = await client.from("seasons").update({ status: "closed" }).eq("class_id", world.classA).select();
    expect(season.error).not.toBeNull();
    const insert = await client
      .from("students")
      .insert({ class_id: world.classA, display_name: "Lén", avatar_key: "may" })
      .select();
    expect(insert.error).not.toBeNull();
    const gateway = await client.rpc("gateway_check_login_code", {
      p_code_hmac: `\\x${"00".repeat(32)}`,
      p_kind: "token",
    });
    expect(gateway.error).not.toBeNull();
  });

  it("không tự cấp quyền chủ nhiệm lớp khác", async () => {
    const result = await world.teacherA.client
      .from("class_staff")
      .insert({ class_id: world.classB, staff_id: world.teacherA.id, role: "co_teacher" })
      .select();
    expect(result.error).not.toBeNull();
  });
});

describe("giáo viên cùng dạy (co_teacher) và tài khoản bị vô hiệu hóa", () => {
  it("GV cùng dạy xem được lớp nhưng không đổi tên lớp, không xem nhật ký", async () => {
    const coTeacher = await newTeacher(world.schoolId, "gv-co");
    await rpcOk(
      admin.from("class_staff").insert({ class_id: world.classA, staff_id: coTeacher.id, role: "co_teacher" }),
    );
    expect((await rows(coTeacher.client, "classes")).data.map((row) => row.id)).toEqual([world.classA]);
    const rename = await coTeacher.client.rpc("teacher_rename_class", {
      p_class_id: world.classA,
      p_name: "Không được",
    });
    expect(rename.error?.message).toBe("FORBIDDEN");
    expect((await rows(coTeacher.client, "audit_logs")).data).toEqual([]);
    expect((await rows(world.teacherA.client, "audit_logs")).data.length).toBeGreaterThan(0);
  });

  it("GV bị vô hiệu hóa (is_active = false) mất quyền ngay", async () => {
    const teacher = await newTeacher(world.schoolId, "gv-off");
    const classId = await rpcOk(
      teacher.client.rpc("teacher_create_class", { p_name: "Lớp Tạm", p_school_year: "2026-2027" }),
    );
    expect((await rows(teacher.client, "classes")).data).toHaveLength(1);
    await rpcOk(admin.from("staff_profiles").update({ is_active: false }).eq("id", teacher.id));
    expect((await rows(teacher.client, "classes")).data).toEqual([]);
    const create = await teacher.client.rpc("teacher_create_student", {
      p_class_id: classId,
      p_display_name: "Bé",
      p_student_number: 1,
      p_avatar_key: "may",
    });
    expect(create.error?.message).toBe("FORBIDDEN");
  });
});

describe("nhật ký kiểm toán", () => {
  it("ghi các thao tác quản trị và không chứa biệt danh hay mã thẻ", async () => {
    const { data } = await admin.from("audit_logs").select("action, metadata, actor_kind").eq("class_id", world.classA);
    const actions = new Set((data ?? []).map((row) => row.action));
    for (const action of ["class.create", "student.create", "login_code.issue", "device.link", "device.revoke"]) {
      expect(actions).toContain(action);
    }
    const serialized = JSON.stringify(data);
    for (const name of ["Bống", "Su Su", "Tí Nị"]) expect(serialized).not.toContain(name);
    expect((data ?? []).some((row) => row.actor_kind === "student_device")).toBe(true);
  });
});
