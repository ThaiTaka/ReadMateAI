import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { bootstrapTeacher, DEV_CLASS_NAME, DEV_SCHOOL_YEAR } from "../../scripts/lib/teacher-bootstrap";
import { admin, newDevice, newSchool, publicClient, strongPassword, testEmail } from "./helpers";

/**
 * `npm run teacher:bootstrap` trên Supabase LOCAL thật: tạo tài khoản bằng Admin API, đăng nhập bằng mật khẩu, đọc hồ sơ và
 * lớp qua RLS bằng phiên của chính giáo viên. Mỗi kịch bản dùng TRƯỜNG RIÊNG (không đụng trường phát triển của máy dev) và
 * mật khẩu ngẫu nhiên sinh lúc chạy — không có mật khẩu thật nào trong kiểm thử.
 */

const noContent = async () => undefined;

async function bootstrap(
  email: string,
  password: string,
  options: { resetPassword?: boolean; schoolId?: string } = {},
) {
  return bootstrapTeacher(
    {
      email,
      displayName: "Giáo viên thử (hư cấu)",
      resetPassword: options.resetPassword ?? false,
      testContent: false,
      ...(options.schoolId
        ? { school: { id: options.schoolId, name: `Trường thử bootstrap ${options.schoolId.slice(0, 8)}` } }
        : {}),
    },
    { admin, readPassword: async () => password, installTestContent: noContent },
  );
}

describe("teacher:bootstrap trên Supabase local", () => {
  it("tạo tài khoản thật: đăng nhập được, thấy hồ sơ giáo viên và lớp của mình qua RLS, không thấy lớp trường khác", async () => {
    const email = testEmail("bootstrap");
    const password = strongPassword();
    const schoolId = randomUUID();
    const result = await bootstrap(email, password, { schoolId });
    expect(result).toMatchObject({ userCreated: true, passwordSet: true, profileCreated: true, classRole: "owner" });

    const teacher = publicClient();
    const signedIn = await teacher.auth.signInWithPassword({ email, password });
    expect(signedIn.error).toBeNull();
    expect(signedIn.data.user?.is_anonymous).toBeFalsy();

    const own = await teacher.from("staff_profiles").select("id, school_id, role, is_active").eq("id", result.userId);
    expect(own.data).toEqual([{ id: result.userId, school_id: schoolId, role: "teacher", is_active: true }]);
    const classes = await teacher.from("classes").select("id, name, school_year").order("name");
    expect(classes.data).toEqual([{ id: result.classId, name: DEV_CLASS_NAME, school_year: DEV_SCHOOL_YEAR }]);

    // Lớp của trường khác tồn tại nhưng giáo viên này KHÔNG thấy (RLS), kể cả khi biết mã lớp.
    const otherSchool = await newSchool();
    const other = await admin
      .from("classes")
      .insert({ school_id: otherSchool, name: `Lớp khác ${randomUUID().slice(0, 6)}`, school_year: "2026-2027" })
      .select("id")
      .single();
    expect(other.error).toBeNull();
    const peek = await teacher.from("classes").select("id").eq("id", other.data!.id);
    expect(peek.data).toEqual([]);

    // Mùa đầu tiên do trigger tạo cùng lớp; giáo viên đọc được qua RLS.
    const seasons = await teacher.from("seasons").select("seq_no, status").eq("class_id", result.classId);
    expect(seasons.data).toEqual([{ seq_no: 1, status: "active" }]);
  });

  it("chạy lại không tạo trùng và KHÔNG đổi mật khẩu; --reset-password mới đổi", async () => {
    const email = testEmail("bootstrap-lai");
    const password = strongPassword();
    const schoolId = randomUUID();
    const first = await bootstrap(email, password, { schoolId });

    const again = await bootstrapTeacher(
      { email, displayName: "Tên khác không được ghi đè", resetPassword: false, testContent: false },
      {
        admin,
        readPassword: async () => {
          throw new Error("không được hỏi mật khẩu khi tài khoản đã có");
        },
        installTestContent: noContent,
      },
    );
    expect(again).toMatchObject({ userCreated: false, passwordSet: false, profileCreated: false, classCreated: false });
    expect(again.userId).toBe(first.userId);
    expect(again.classId).toBe(first.classId);

    const profiles = await admin.from("staff_profiles").select("display_name").eq("id", first.userId);
    expect(profiles.data).toEqual([{ display_name: "Giáo viên thử (hư cấu)" }]);
    const rows = await admin.from("class_staff").select("staff_id, role").eq("class_id", first.classId);
    expect(rows.data).toEqual([{ staff_id: first.userId, role: "owner" }]);

    // Mật khẩu cũ vẫn dùng được sau lần chạy lại.
    expect((await publicClient().auth.signInWithPassword({ email, password })).error).toBeNull();

    // Đặt lại theo yêu cầu rõ ràng: mật khẩu cũ hết hiệu lực, mật khẩu mới dùng được.
    const replacement = strongPassword();
    const reset = await bootstrap(email, replacement, { resetPassword: true, schoolId });
    expect(reset).toMatchObject({ userCreated: false, passwordSet: true });
    expect((await publicClient().auth.signInWithPassword({ email, password })).error).not.toBeNull();
    expect((await publicClient().auth.signInWithPassword({ email, password: replacement })).error).toBeNull();
  });

  it("mật khẩu yếu bị từ chối: không có tài khoản nào được tạo", async () => {
    const email = testEmail("bootstrap-yeu");
    await expect(bootstrap(email, "ngan", { schoolId: randomUUID() })).rejects.toThrow(/PASSWORD_REJECTED/u);
    const users = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    expect(users.data.users.some((user) => user.email === email)).toBe(false);
  });

  it("học sinh (thiết bị ẩn danh) không đọc được hồ sơ giáo viên, lớp hay mùa của trường phát triển", async () => {
    const email = testEmail("bootstrap-hs");
    const result = await bootstrap(email, strongPassword(), { schoolId: randomUUID() });
    const device = await newDevice();
    for (const table of ["staff_profiles", "classes", "class_staff", "seasons", "schools"] as const) {
      const read = await device.client.from(table).select("*");
      expect(read.data ?? [], table).toEqual([]);
    }
    const byId = await device.client.from("classes").select("id").eq("id", result.classId);
    expect(byId.data).toEqual([]);
  });

  it("người dùng email không có hồ sơ giáo viên vẫn không vào được dữ liệu lớp (lớp kiểm tra thứ hai)", async () => {
    const email = testEmail("khong-ho-so");
    const password = strongPassword();
    const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    expect(created.error).toBeNull();
    const client = publicClient();
    expect((await client.auth.signInWithPassword({ email, password })).error).toBeNull();
    expect((await client.from("classes").select("id")).data).toEqual([]);
    expect((await client.from("staff_profiles").select("id")).data).toEqual([]);
  });
});
