/**
 * Lõi của `npm run teacher:bootstrap`: tạo (hoặc cập nhật) tài khoản giáo viên cho máy dev bằng Supabase Admin API.
 * Tách khỏi phần dòng lệnh để kiểm thử được bằng đối tượng giả; chạy bằng Node 24 trực tiếp (không alias `@/`, không enum).
 *
 * Nguyên tắc an toàn (docs/AUTHENTICATION.md §Tài khoản giáo viên đầu tiên):
 * - MẬT KHẨU không có trong mã, tệp, tham số dòng lệnh, biến môi trường, nhật ký hay thông báo lỗi: nó chỉ đi qua `readPassword()`
 *   rồi thẳng vào Admin API. Không hàm nào ở đây in hay ném lỗi có chứa mật khẩu.
 * - Chạy lại không tạo trùng (tìm theo email, lớp theo trường/tên/năm học) và KHÔNG đổi mật khẩu tài khoản đã có,
 *   trừ khi người vận hành yêu cầu rõ (`resetPassword`).
 * - Chỉ Supabase local: lớp gọi (CLI) đã từ chối URL không phải 127.0.0.1/localhost.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

/** Trường/lớp phát triển của dự án (dữ liệu hư cấu; không phải trường/lớp thật). UUID cố định → chạy lại không nhân bản trường. */
export const DEV_SCHOOL_ID = "de700000-0000-4000-8000-000000000001";
export const DEV_SCHOOL_NAME = "Trường phát triển ReadMate AI";
export const DEV_CLASS_NAME = "Lớp phát triển";
export const DEV_SCHOOL_YEAR = "2026-2027";

export const MIN_PASSWORD_LENGTH = 10;
/** GoTrue băm bằng bcrypt: chỉ 72 byte đầu có nghĩa; từ chối dài hơn để không âm thầm cắt mật khẩu. */
export const MAX_PASSWORD_BYTES = 72;

export type BootstrapInput = {
  email: string;
  displayName: string;
  /** Đặt lại mật khẩu của tài khoản ĐÃ CÓ. Mặc định false: tài khoản đã có thì giữ nguyên mật khẩu. */
  resetPassword: boolean;
  /** Cài nội dung THỬ NGHIỆM (hư cấu, chỉ local) cho lớp phát triển để chơi thử luyện tập và Mê cung trên máy. */
  testContent: boolean;
  /** Trường dùng khi giáo viên CHƯA có hồ sơ (mặc định: trường phát triển). Kiểm thử dùng trường riêng để không lẫn vào máy dev. */
  school?: { id: string; name: string };
};

export type TestContentContext = { admin: SupabaseClient; teacherId: string; classId: string };

export type BootstrapPorts = {
  admin: SupabaseClient;
  /** Chỉ được gọi khi thật sự cần đặt mật khẩu (tạo mới hoặc đặt lại). */
  readPassword: () => Promise<string>;
  /** Cài nội dung thử nghiệm cho lớp (cần Supabase CLI local) — truyền vào để kiểm thử không phụ thuộc CLI. */
  installTestContent: (context: TestContentContext) => Promise<void>;
};

export type BootstrapResult = {
  userId: string;
  userCreated: boolean;
  /** true khi mật khẩu vừa được đặt (tạo mới hoặc đặt lại). */
  passwordSet: boolean;
  schoolId: string;
  profileCreated: boolean;
  classId: string;
  classCreated: boolean;
  classRole: "owner" | "co_teacher";
  testContentInstalled: boolean;
};

export type PasswordCheck = { ok: true } | { ok: false; reason: string };

const COMMON = new Set(["password", "12345678", "123456789", "1234567890", "qwertyuiop", "matkhau123", "iloveyou12"]);

/** Kiểm tra mật khẩu mà KHÔNG lặp lại nội dung nó trong lý do. */
export function checkPassword(password: string, email: string): PasswordCheck {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { ok: false, reason: `Mật khẩu cần ít nhất ${MIN_PASSWORD_LENGTH} ký tự.` };
  }
  if (new TextEncoder().encode(password).length > MAX_PASSWORD_BYTES) {
    return { ok: false, reason: `Mật khẩu dài tối đa ${MAX_PASSWORD_BYTES} byte.` };
  }
  if (new Set(password).size < 4) return { ok: false, reason: "Mật khẩu quá đơn giản (lặp lại vài ký tự)." };
  if (COMMON.has(password.toLowerCase())) return { ok: false, reason: "Mật khẩu này quá phổ biến." };
  const local = email.split("@")[0]?.toLowerCase() ?? "";
  if (local.length >= 4 && password.toLowerCase().includes(local)) {
    return { ok: false, reason: "Mật khẩu không nên chứa phần đầu của email." };
  }
  return { ok: true };
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;

export function normalizeEmail(raw: string): string | null {
  const email = raw.trim().toLowerCase();
  return EMAIL_PATTERN.test(email) && email.length <= 254 ? email : null;
}

/** Tên hiển thị khớp ràng buộc CSDL `is_clean_text(1..60)`: không ký tự điều khiển, không khoảng trắng thừa. */
export function normalizeDisplayName(raw: string): string | null {
  const name = raw.normalize("NFC").replace(/\s+/gu, " ").trim();
  if (name.length < 1 || name.length > 60 || /[\u0000-\u001f\u007f]/u.test(name)) return null;
  return name;
}

function must<R extends { data: unknown; error: unknown }>(result: R, step: string): NonNullable<R["data"]> {
  if (result.error) {
    // Chỉ mã/khối lượng ngắn, không in cả đối tượng lỗi (phòng khi nó chứa dữ liệu đầu vào).
    const error = result.error as { code?: string; status?: number; message?: string };
    throw new Error(`${step}: ${error.code ?? error.status ?? "lỗi"}`);
  }
  return result.data as NonNullable<R["data"]>;
}

/** Tìm người dùng theo email (không phân biệt hoa thường) bằng cách duyệt danh sách Admin API. */
export async function findUserByEmail(admin: SupabaseClient, email: string): Promise<{ id: string } | null> {
  const perPage = 200;
  for (let page = 1; page <= 50; page += 1) {
    const list = must(await admin.auth.admin.listUsers({ page, perPage }), "listUsers");
    const found = list.users.find((user) => user.email?.toLowerCase() === email);
    if (found) return { id: found.id };
    if (list.users.length < perPage) return null;
  }
  return null;
}

export async function bootstrapTeacher(input: BootstrapInput, ports: BootstrapPorts): Promise<BootstrapResult> {
  const email = normalizeEmail(input.email);
  if (!email) throw new Error("EMAIL_INVALID");
  const displayName = normalizeDisplayName(input.displayName);
  if (!displayName) throw new Error("DISPLAY_NAME_INVALID");
  const { admin } = ports;

  // 1. Tài khoản đăng nhập. Mật khẩu chỉ được hỏi khi thật sự cần đặt.
  const existing = await findUserByEmail(admin, email);
  let userId: string;
  let userCreated = false;
  let passwordSet = false;
  if (!existing) {
    const password = await ports.readPassword();
    const check = checkPassword(password, email);
    if (!check.ok) throw new Error(`PASSWORD_REJECTED: ${check.reason}`);
    const created = must(await admin.auth.admin.createUser({ email, password, email_confirm: true }), "createUser");
    if (!created.user) throw new Error("createUser: không trả người dùng");
    userId = created.user.id;
    userCreated = true;
    passwordSet = true;
  } else {
    userId = existing.id;
    if (input.resetPassword) {
      const password = await ports.readPassword();
      const check = checkPassword(password, email);
      if (!check.ok) throw new Error(`PASSWORD_REJECTED: ${check.reason}`);
      must(await admin.auth.admin.updateUserById(userId, { password }), "updateUser");
      passwordSet = true;
    }
  }

  // 2. Hồ sơ giáo viên (staff_profiles). Hồ sơ đã có giữ nguyên trường, vai trò và tên; chỉ bật lại nếu đang bị tắt.
  const profile = must(
    await admin.from("staff_profiles").select("id, school_id, is_active").eq("id", userId).maybeSingle(),
    "staff_profiles read",
  ) as { id: string; school_id: string; is_active: boolean } | null;
  let schoolId: string;
  let profileCreated = false;
  if (profile) {
    schoolId = profile.school_id;
    if (!profile.is_active) {
      must(
        await admin.from("staff_profiles").update({ is_active: true }).eq("id", userId),
        "staff_profiles reactivate",
      );
    }
  } else {
    // Trường phát triển: UUID cố định, không ghi đè tên nếu đã tồn tại.
    const school = input.school ?? { id: DEV_SCHOOL_ID, name: DEV_SCHOOL_NAME };
    must(
      await admin
        .from("schools")
        .upsert({ id: school.id, name: school.name }, { onConflict: "id", ignoreDuplicates: true }),
      "school",
    );
    schoolId = school.id;
    must(
      await admin
        .from("staff_profiles")
        .insert({ id: userId, school_id: schoolId, display_name: displayName, role: "teacher", is_active: true }),
      "staff_profiles",
    );
    profileCreated = true;
  }

  // 3. Lớp phát triển trong trường của giáo viên (mùa 1 do trigger tạo cùng lớp).
  let classRow = must(
    await admin
      .from("classes")
      .select("id")
      .eq("school_id", schoolId)
      .eq("name", DEV_CLASS_NAME)
      .eq("school_year", DEV_SCHOOL_YEAR)
      .maybeSingle(),
    "class read",
  ) as { id: string } | null;
  let classCreated = false;
  if (!classRow) {
    classRow = must(
      await admin
        .from("classes")
        .insert({ school_id: schoolId, name: DEV_CLASS_NAME, school_year: DEV_SCHOOL_YEAR, created_by: userId })
        .select("id")
        .single(),
      "class",
    ) as { id: string };
    classCreated = true;
  }
  const classId = classRow.id;

  // 4. Quyền trên lớp: chủ nhiệm nếu lớp chưa có chủ nhiệm đang hoạt động, ngược lại là giáo viên cùng dạy.
  const staffRows = must(
    await admin.from("class_staff").select("staff_id, role, removed_at").eq("class_id", classId),
    "class_staff read",
  ) as Array<{ staff_id: string; role: "owner" | "co_teacher"; removed_at: string | null }>;
  const mine = staffRows.find((row) => row.staff_id === userId);
  let classRole: "owner" | "co_teacher";
  if (mine) {
    classRole = mine.role;
    if (mine.removed_at) {
      must(
        await admin.from("class_staff").update({ removed_at: null }).eq("class_id", classId).eq("staff_id", userId),
        "class_staff restore",
      );
    }
  } else {
    const hasOwner = staffRows.some((row) => row.role === "owner" && !row.removed_at);
    classRole = hasOwner ? "co_teacher" : "owner";
    must(
      await admin
        .from("class_staff")
        .insert({ class_id: classId, staff_id: userId, role: classRole, added_by: userId }),
      "class_staff",
    );
  }

  // 5. Nội dung thử nghiệm (hư cấu) — chỉ khi được yêu cầu.
  let testContentInstalled = false;
  if (input.testContent) {
    await ports.installTestContent({ admin, teacherId: userId, classId });
    testContentInstalled = true;
  }

  return {
    userId,
    userCreated,
    passwordSet,
    schoolId,
    profileCreated,
    classId,
    classCreated,
    classRole,
    testContentInstalled,
  };
}
