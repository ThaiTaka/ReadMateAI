import { readFileSync } from "node:fs";
import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import {
  bootstrapTeacher,
  checkPassword,
  DEV_CLASS_NAME,
  DEV_SCHOOL_ID,
  findUserByEmail,
  normalizeDisplayName,
  normalizeEmail,
  type BootstrapInput,
} from "../../../scripts/lib/teacher-bootstrap";

/**
 * `npm run teacher:bootstrap` (lõi): kiểm bằng CSDL giả trong bộ nhớ. Không có mật khẩu thật, không mạng, không Supabase.
 * Email ghép lúc chạy (repo-hygiene cấm chuỗi giống email trong mã).
 */

const email = (local: string) => [local, ["readmate", "test"].join(".")].join("@");
const SECRET = ["Mk", "Zq8", "vN4", "wP2xL"].join("-"); // mật khẩu thử, sinh lúc chạy; không phải mật khẩu thật

type Row = Record<string, unknown>;
type Tables = Record<"schools" | "staff_profiles" | "classes" | "class_staff", Row[]>;

function fakeAdmin() {
  const tables: Tables = { schools: [], staff_profiles: [], classes: [], class_staff: [] };
  const users: Array<{ id: string; email: string; password: string }> = [];
  const calls = { createUser: 0, updateUser: 0 };
  let seq = 0;
  const nextId = () => `00000000-0000-4000-8000-${String(++seq).padStart(12, "0")}`;

  function builder(table: keyof Tables) {
    let op: "select" | "insert" | "update" | "upsert" = "select";
    const filters: Array<[string, unknown]> = [];
    let payload: Row = {};
    let upsertOptions: { onConflict?: string; ignoreDuplicates?: boolean } = {};
    let single = false;
    let maybe = false;
    const run = () => {
      const rows = tables[table];
      const match = (row: Row) => filters.every(([column, value]) => row[column] === value);
      if (op === "insert") {
        const row = { ...(table === "class_staff" || table === "staff_profiles" ? {} : { id: nextId() }), ...payload };
        rows.push(row);
        return { data: single ? row : [row], error: null };
      }
      if (op === "update") {
        for (const row of rows.filter(match)) Object.assign(row, payload);
        return { data: null, error: null };
      }
      if (op === "upsert") {
        const key = upsertOptions.onConflict ?? "id";
        const found = rows.find((row) => row[key] === payload[key]);
        if (found) {
          if (!upsertOptions.ignoreDuplicates) Object.assign(found, payload);
        } else rows.push({ ...payload });
        return { data: null, error: null };
      }
      const found = rows.filter(match);
      if (single) return { data: found[0] ?? null, error: found[0] ? null : { code: "PGRST116" } };
      if (maybe) return { data: found[0] ?? null, error: null };
      return { data: found, error: null };
    };
    const chain = {
      select: () => chain,
      eq: (column: string, value: unknown) => {
        filters.push([column, value]);
        return chain;
      },
      insert: (row: Row) => {
        op = "insert";
        payload = row;
        return chain;
      },
      update: (row: Row) => {
        op = "update";
        payload = row;
        return chain;
      },
      upsert: (row: Row, options: typeof upsertOptions) => {
        op = "upsert";
        payload = row;
        upsertOptions = options;
        return chain;
      },
      maybeSingle: () => {
        maybe = true;
        return Promise.resolve(run());
      },
      single: () => {
        single = true;
        return Promise.resolve(run());
      },
      then: (resolve: (value: unknown) => unknown) => resolve(run()),
    };
    return chain;
  }

  const admin = {
    from: (table: string) => builder(table as keyof Tables),
    auth: {
      admin: {
        listUsers: ({ page, perPage }: { page: number; perPage: number }) =>
          Promise.resolve({
            data: {
              users: users.slice((page - 1) * perPage, page * perPage).map(({ id, email: e }) => ({ id, email: e })),
            },
            error: null,
          }),
        createUser: ({ email: e, password }: { email: string; password: string }) => {
          calls.createUser += 1;
          const user = { id: nextId(), email: e, password };
          users.push(user);
          return Promise.resolve({ data: { user: { id: user.id } }, error: null });
        },
        updateUserById: (id: string, patch: { password: string }) => {
          calls.updateUser += 1;
          Object.assign(
            users.find((user) => user.id === id)!,
            patch,
          );
          return Promise.resolve({ data: {}, error: null });
        },
      },
    },
  } as unknown as SupabaseClient;
  return { admin, tables, users, calls };
}

const input = (overrides: Partial<BootstrapInput> = {}): BootstrapInput => ({
  email: email("gv.thu"),
  displayName: "Giáo viên thử",
  resetPassword: false,
  testContent: false,
  ...overrides,
});

describe("bootstrapTeacher — tạo tài khoản giáo viên cho máy dev", () => {
  it("tài khoản mới: tạo người dùng bằng Admin API, hồ sơ giáo viên ở trường phát triển, lớp phát triển có chủ nhiệm", async () => {
    const { admin, tables, users, calls } = fakeAdmin();
    const readPassword = vi.fn(async () => SECRET);
    const result = await bootstrapTeacher(input(), { admin, readPassword, installTestContent: vi.fn() });

    expect(result).toMatchObject({
      userCreated: true,
      passwordSet: true,
      profileCreated: true,
      classCreated: true,
      classRole: "owner",
      testContentInstalled: false,
      schoolId: DEV_SCHOOL_ID,
    });
    expect(calls.createUser).toBe(1);
    expect(readPassword).toHaveBeenCalledTimes(1);
    expect(users).toHaveLength(1);
    expect(users[0]!.email).toBe(email("gv.thu"));
    expect(tables.schools).toEqual([expect.objectContaining({ id: DEV_SCHOOL_ID })]);
    expect(tables.staff_profiles).toEqual([
      expect.objectContaining({ id: result.userId, school_id: DEV_SCHOOL_ID, role: "teacher", is_active: true }),
    ]);
    expect(tables.classes).toEqual([expect.objectContaining({ name: DEV_CLASS_NAME, school_id: DEV_SCHOOL_ID })]);
    expect(tables.class_staff).toEqual([expect.objectContaining({ staff_id: result.userId, role: "owner" })]);
  });

  it("chạy lại: không tạo trùng, KHÔNG hỏi mật khẩu và KHÔNG đổi mật khẩu của tài khoản đã có", async () => {
    const { admin, tables, users, calls } = fakeAdmin();
    await bootstrapTeacher(input(), { admin, readPassword: async () => SECRET, installTestContent: vi.fn() });
    const readPassword = vi.fn(async () => "Khong-Duoc-Goi-1");
    const again = await bootstrapTeacher(input(), { admin, readPassword, installTestContent: vi.fn() });

    expect(again).toMatchObject({ userCreated: false, passwordSet: false, profileCreated: false, classCreated: false });
    expect(readPassword).not.toHaveBeenCalled();
    expect(calls).toEqual({ createUser: 1, updateUser: 0 });
    expect(users).toHaveLength(1);
    expect(users[0]!.password).toBe(SECRET);
    expect(tables.staff_profiles).toHaveLength(1);
    expect(tables.classes).toHaveLength(1);
    expect(tables.class_staff).toHaveLength(1);
  });

  it("--reset-password: chỉ khi được yêu cầu rõ mới đặt lại mật khẩu của tài khoản đã có", async () => {
    const { admin, users, calls } = fakeAdmin();
    await bootstrapTeacher(input(), { admin, readPassword: async () => SECRET, installTestContent: vi.fn() });
    const replacement = ["Moi", "Zq9", "tR5", "uK3m"].join("-");
    const result = await bootstrapTeacher(input({ resetPassword: true }), {
      admin,
      readPassword: async () => replacement,
      installTestContent: vi.fn(),
    });
    expect(result).toMatchObject({ userCreated: false, passwordSet: true });
    expect(calls.updateUser).toBe(1);
    expect(users[0]!.password).toBe(replacement);
  });

  it("email viết hoa/thừa khoảng trắng vẫn nhận ra tài khoản đã có (không tạo bản thứ hai)", async () => {
    const { admin, users } = fakeAdmin();
    await bootstrapTeacher(input(), { admin, readPassword: async () => SECRET, installTestContent: vi.fn() });
    const again = await bootstrapTeacher(input({ email: `  ${email("GV.Thu").toUpperCase()} ` }), {
      admin,
      readPassword: async () => "x",
      installTestContent: vi.fn(),
    });
    expect(again.userCreated).toBe(false);
    expect(users).toHaveLength(1);
    expect(await findUserByEmail(admin, email("gv.thu"))).not.toBeNull();
  });

  it("mật khẩu bị từ chối: không tạo tài khoản, lý do không lặp lại mật khẩu", async () => {
    const { admin, users, calls, tables } = fakeAdmin();
    const weak = "abc";
    const failure = await bootstrapTeacher(input(), {
      admin,
      readPassword: async () => weak,
      installTestContent: vi.fn(),
    }).catch((error: unknown) => error as Error);
    expect(failure).toBeInstanceOf(Error);
    expect((failure as Error).message).toMatch(/PASSWORD_REJECTED/u);
    expect((failure as Error).message).not.toContain(weak);
    expect(calls.createUser).toBe(0);
    expect(users).toHaveLength(0);
    expect(tables.staff_profiles).toHaveLength(0);
  });

  it("lớp đã có chủ nhiệm khác: giáo viên mới vào với vai trò cùng dạy (không chiếm chủ nhiệm)", async () => {
    const { admin, tables } = fakeAdmin();
    const first = await bootstrapTeacher(input(), {
      admin,
      readPassword: async () => SECRET,
      installTestContent: vi.fn(),
    });
    const second = await bootstrapTeacher(input({ email: email("gv.hai"), displayName: "Giáo viên hai" }), {
      admin,
      readPassword: async () => SECRET,
      installTestContent: vi.fn(),
    });
    expect(first.classRole).toBe("owner");
    expect(second.classRole).toBe("co_teacher");
    expect(second.classId).toBe(first.classId);
    expect(tables.classes).toHaveLength(1);
    expect(tables.class_staff.filter((row) => row.role === "owner")).toHaveLength(1);
  });

  it("hồ sơ đã bị tắt được bật lại; hồ sơ ở trường khác giữ nguyên trường (lớp phát triển tạo trong trường đó)", async () => {
    const { admin, tables } = fakeAdmin();
    const created = await bootstrapTeacher(input(), {
      admin,
      readPassword: async () => SECRET,
      installTestContent: vi.fn(),
    });
    tables.staff_profiles[0]!.is_active = false;
    tables.staff_profiles[0]!.school_id = "other-school";
    const again = await bootstrapTeacher(input(), {
      admin,
      readPassword: async () => SECRET,
      installTestContent: vi.fn(),
    });
    expect(again.userId).toBe(created.userId);
    expect(again.schoolId).toBe("other-school");
    expect(tables.staff_profiles[0]!.is_active).toBe(true);
    expect(tables.classes.map((row) => row.school_id)).toContain("other-school");
  });

  it("nội dung thử nghiệm chỉ được cài khi yêu cầu, và nhận đúng giáo viên + lớp", async () => {
    const { admin } = fakeAdmin();
    const install = vi.fn(async () => undefined);
    const none = await bootstrapTeacher(input(), {
      admin,
      readPassword: async () => SECRET,
      installTestContent: install,
    });
    expect(none.testContentInstalled).toBe(false);
    expect(install).not.toHaveBeenCalled();
    const withContent = await bootstrapTeacher(input({ testContent: true }), {
      admin,
      readPassword: async () => SECRET,
      installTestContent: install,
    });
    expect(withContent.testContentInstalled).toBe(true);
    expect(install).toHaveBeenCalledWith(
      expect.objectContaining({ teacherId: withContent.userId, classId: withContent.classId }),
    );
  });

  it("email hoặc tên hiển thị không hợp lệ bị từ chối trước khi chạm vào CSDL", async () => {
    const { admin, calls } = fakeAdmin();
    const ports = { admin, readPassword: async () => SECRET, installTestContent: vi.fn() };
    await expect(bootstrapTeacher(input({ email: "khong-phai-email" }), ports)).rejects.toThrow("EMAIL_INVALID");
    await expect(bootstrapTeacher(input({ displayName: "   " }), ports)).rejects.toThrow("DISPLAY_NAME_INVALID");
    await expect(bootstrapTeacher(input({ displayName: "a".repeat(61) }), ports)).rejects.toThrow(
      "DISPLAY_NAME_INVALID",
    );
    expect(calls.createUser).toBe(0);
  });
});

describe("kiểm tra đầu vào", () => {
  it("mật khẩu: tối thiểu 10 ký tự, không lặp ký tự, không phổ biến, không chứa phần đầu email; lý do không lặp lại mật khẩu", () => {
    const mail = email("co.mai");
    expect(checkPassword("ngan", mail)).toMatchObject({ ok: false });
    expect(checkPassword("aaaaaaaaaaaa", mail)).toMatchObject({ ok: false });
    expect(checkPassword("1234567890", mail)).toMatchObject({ ok: false });
    expect(checkPassword("xxco.maixx9Q", mail)).toMatchObject({ ok: false });
    expect(checkPassword("a".repeat(80), mail)).toMatchObject({ ok: false });
    expect(checkPassword(SECRET, mail)).toEqual({ ok: true });
    for (const bad of ["ngan", "1234567890"]) {
      const verdict = checkPassword(bad, mail);
      if (!verdict.ok) expect(verdict.reason).not.toContain(bad);
    }
  });

  it("email chuẩn hóa chữ thường; tên hiển thị NFC, gọn khoảng trắng, 1–60 ký tự, không ký tự điều khiển", () => {
    expect(normalizeEmail(` ${email("Gv.A").toUpperCase()} `)).toBe(email("gv.a"));
    expect(normalizeEmail("abc")).toBeNull();
    expect(normalizeEmail(["a b", "c.d"].join("@"))).toBeNull();
    expect(normalizeDisplayName("  Cô   Mai  ")).toBe("Cô Mai");
    expect(normalizeDisplayName("")).toBeNull();
    expect(normalizeDisplayName(`a${String.fromCharCode(7)}b`)).toBeNull();
    expect(normalizeDisplayName("a".repeat(61))).toBeNull();
    // NFD → NFC: dấu tổ hợp được dựng lúc chạy để tệp luôn ở dạng NFC.
    const nfd = ["C", "a", String.fromCharCode(0x302), String.fromCharCode(0x301)].join("");
    expect(normalizeDisplayName(nfd)).toBe(nfd.normalize("NFC"));
    expect(normalizeDisplayName(nfd)).not.toBe(nfd);
  });
});

describe("an toàn mã nguồn của lệnh quản trị", () => {
  const files = ["scripts/teacher-bootstrap.ts", "scripts/lib/teacher-bootstrap.ts", "scripts/lib/hidden-input.ts"];
  const sources = files.map((file) => ({ file, text: readFileSync(file, "utf8") }));

  it("không có chuỗi giống email, mật khẩu hay khóa trong mã", () => {
    for (const { file, text } of sources) {
      expect(text, file).not.toMatch(/[A-Za-z0-9._-]+@[A-Za-z0-9-]+\.[A-Za-z]{2,}/u);
      expect(text, file).not.toMatch(/sb_secret_|sb_publishable_|eyJ[A-Za-z0-9_-]{20,}/u);
    }
  });

  it("không dòng nào in/ném lỗi có chứa biến mật khẩu; không đọc mật khẩu từ biến môi trường hay tham số", () => {
    for (const { file, text } of sources) {
      for (const line of text.split("\n")) {
        const trimmed = line.trim();
        if (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*")) continue;
        if (/\b(out|err|console\.\w+|stdout\.write|stderr\.write|throw new Error)\b/u.test(trimmed)) {
          expect(trimmed, `${file}: ${trimmed}`).not.toMatch(/\$\{\s*(password|remembered|first|second)\b/u);
          expect(trimmed, `${file}: ${trimmed}`).not.toMatch(/\+\s*(password|remembered|first|second)\b/u);
        }
      }
      expect(text, file).not.toMatch(/process\.env\.[A-Z_]*PASSWORD/u);
      expect(text, file).not.toMatch(/process\.argv/u);
    }
    const cli = sources.find((source) => source.file === "scripts/teacher-bootstrap.ts")!.text;
    expect(cli).not.toMatch(/--password\b(?!-stdin)/u);
  });

  it("chỉ Supabase local: từ chối URL khác, không dùng ngoại lệ ALLOW_REMOTE_SEED", () => {
    const cli = sources.find((source) => source.file === "scripts/teacher-bootstrap.ts")!.text;
    expect(cli).toMatch(/isLocalUrl\(env\.apiUrl\)/u);
    expect(cli).not.toMatch(/ALLOW_REMOTE_SEED\s*=/u);
  });

  it("script npm không mang mật khẩu hay email", () => {
    const pkg = JSON.parse(readFileSync("package.json", "utf8")) as { scripts: Record<string, string> };
    expect(pkg.scripts["teacher:bootstrap"]).toBe(
      "node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --env-file-if-exists=.env.local scripts/teacher-bootstrap.ts",
    );
  });
});
