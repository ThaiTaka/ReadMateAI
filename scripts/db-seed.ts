/**
 * npm run db:seed — nạp DỮ LIỆU GIẢ cho máy dev (Supabase local). Chạy lặp lại không sinh dữ liệu trùng.
 *
 * Toàn bộ là hư cấu (CLAUDE.md §6.10): trường, giáo viên, lớp, biệt danh học sinh đều tự đặt, không liên quan
 * học sinh thật của lớp 1A2. Email GV dùng tên miền dành riêng `.test` (RFC 6761), ghép lúc chạy (§9.2.6).
 * Bản ghi đồng ý dưới đây là dữ liệu GIẢ để thử giao diện — không đại diện cho phiếu đồng ý thật nào.
 *
 * Gồm: 1 trường · 2 GV (mỗi GV chủ nhiệm 1 lớp) · 2 lớp × 3 học sinh · mùa 1 của mỗi lớp (trigger) · đồng ý ở các
 * trạng thái khác nhau · lộ trình (có em chưa xếp) · tên hiển thị (đã duyệt / chờ duyệt) · thiết bị (đang liên kết,
 * đã thu hồi, chưa có) · lớp 1 dùng chuỗi bài MINH HỌA ở trạng thái chưa xác nhận.
 * R04: bật môi trường kiểm thử LOCAL + nội dung fixture hư cấu (scripts/fixtures/scoring-items.ts) và lớp thứ ba
 * "Lớp Thử Điểm" có tiến độ đã xác nhận trên CHUỖI BÀI KIỂM THỬ (không phải sách thật) để thử luồng tính điểm.
 * Mật khẩu GV: SEED_TEACHER_PASSWORD trong .env.local (npm run db:env sinh ngẫu nhiên) — không in ra màn hình.
 */
import { generateLoginCode, hmacLoginCode, isUsablePepper, toPgBytea } from "../src/features/login-codes/codes.ts";
import { syncContent } from "./lib/content-sync.ts";
import { installScoringFixtures } from "./lib/scoring-fixtures.ts";
import { enableLocalTestFixtures } from "./lib/test-fixtures.ts";
import { adminClient, publicClient, scriptEnv } from "./lib/local-supabase.ts";

const env = scriptEnv();
const admin = adminClient(env);
const password = process.env.SEED_TEACHER_PASSWORD;
const pepper = process.env.LOGIN_CODE_PEPPER;
if (!password || password.length < 10) throw new Error("Thiếu SEED_TEACHER_PASSWORD — chạy `npm run db:env` trước.");
if (!isUsablePepper(pepper)) throw new Error("Thiếu LOGIN_CODE_PEPPER — chạy `npm run db:env` trước.");

const SEED_DOMAIN = ["readmate", "test"].join(".");
const seedEmail = (local: string) => [local, SEED_DOMAIN].join("@");

// UUID cố định → upsert theo id, chạy lại không nhân bản.
const ID = {
  school: "5eed0000-0000-4000-8000-000000000001",
  classA: "5eed0000-0000-4000-8000-0000000000a1",
  classB: "5eed0000-0000-4000-8000-0000000000b1",
  classC: "5eed0000-0000-4000-8000-0000000000c1",
} as const;

type SeedTeacher = { key: "a" | "b"; email: string; displayName: string };
const TEACHERS: SeedTeacher[] = [
  { key: "a", email: seedEmail("co.mai"), displayName: "Cô Mai (hư cấu)" },
  { key: "b", email: seedEmail("thay.binh"), displayName: "Thầy Bình (hư cấu)" },
];

type SeedStudent = {
  id: string;
  classKey: "a" | "b" | "c";
  number: number;
  name: string;
  avatar: string;
  band: "foundation" | "developing" | "extending" | null;
  alias: { text: string; approved: boolean } | null;
  consents: Array<{ scope: "learning_data" | "leaderboard_display"; withdrawn: boolean }>;
  device: "active" | "revoked" | "none";
};

const STUDENTS: SeedStudent[] = [
  {
    id: "5eed0000-0000-4000-8000-00000000a001",
    classKey: "a",
    number: 1,
    name: "Bống",
    avatar: "bong",
    band: "developing",
    alias: { text: "Bống Bang", approved: true },
    consents: [
      { scope: "learning_data", withdrawn: false },
      { scope: "leaderboard_display", withdrawn: false },
    ],
    device: "active",
  },
  {
    id: "5eed0000-0000-4000-8000-00000000a002",
    classKey: "a",
    number: 2,
    name: "Su Su",
    avatar: "may",
    band: "foundation",
    alias: { text: "Su Su", approved: false },
    consents: [{ scope: "learning_data", withdrawn: false }],
    device: "revoked",
  },
  {
    id: "5eed0000-0000-4000-8000-00000000a003",
    classKey: "a",
    number: 3,
    name: "Tí Nị",
    avatar: "ti",
    band: null,
    alias: null,
    consents: [],
    device: "none",
  },
  {
    id: "5eed0000-0000-4000-8000-00000000b001",
    classKey: "b",
    number: 1,
    name: "Bin",
    avatar: "bin",
    band: "extending",
    alias: null,
    consents: [{ scope: "learning_data", withdrawn: false }],
    device: "active",
  },
  {
    id: "5eed0000-0000-4000-8000-00000000b002",
    classKey: "b",
    number: 2,
    name: "Na Na",
    avatar: "na",
    band: "developing",
    alias: null,
    consents: [{ scope: "learning_data", withdrawn: true }],
    device: "none",
  },
  {
    id: "5eed0000-0000-4000-8000-00000000b003",
    classKey: "b",
    number: 3,
    name: "Cốm",
    avatar: "may",
    band: null,
    alias: null,
    consents: [],
    device: "none",
  },
  // Lớp Thử Điểm (R04): học sinh hư cấu để thử luồng tính điểm trên nội dung fixture.
  {
    id: "5eed0000-0000-4000-8000-00000000c001",
    classKey: "c",
    number: 1,
    name: "Mít",
    avatar: "bin",
    band: "developing",
    alias: null,
    consents: [{ scope: "learning_data", withdrawn: false }],
    device: "none",
  },
  {
    id: "5eed0000-0000-4000-8000-00000000c002",
    classKey: "c",
    number: 2,
    name: "Khoai",
    avatar: "ti",
    band: "foundation",
    alias: null,
    consents: [{ scope: "learning_data", withdrawn: false }],
    device: "none",
  },
  {
    id: "5eed0000-0000-4000-8000-00000000c003",
    classKey: "c",
    number: 3,
    name: "Đậu",
    avatar: "na",
    band: "developing",
    alias: null,
    consents: [],
    device: "none",
  },
];

function must<R extends { data: unknown; error: unknown }>(result: R, step: string): NonNullable<R["data"]> {
  if (result.error) throw new Error(`${step}: ${JSON.stringify(result.error)}`);
  return result.data as NonNullable<R["data"]>;
}

async function ensureTeacher(teacher: SeedTeacher): Promise<string> {
  const list = must(await admin.auth.admin.listUsers({ page: 1, perPage: 200 }), "listUsers");
  const found = list.users.find((user) => user.email === teacher.email);
  if (found) {
    must(await admin.auth.admin.updateUserById(found.id, { password }), "updateUser");
    return found.id;
  }
  const created = must(
    await admin.auth.admin.createUser({ email: teacher.email, password, email_confirm: true }),
    "createUser",
  );
  if (!created.user) throw new Error("createUser không trả người dùng");
  return created.user.id;
}

const content = await syncContent(admin);

must(await admin.from("schools").upsert({ id: ID.school, name: "Trường Tiểu học Ánh Dương (hư cấu)" }), "school");

const teacherIds = { a: "", b: "" };
for (const teacher of TEACHERS) {
  const id = await ensureTeacher(teacher);
  teacherIds[teacher.key] = id;
  must(
    await admin
      .from("staff_profiles")
      .upsert({ id, school_id: ID.school, display_name: teacher.displayName, role: "teacher", is_active: true }),
    "staff_profiles",
  );
}

const illustrative = must(
  await admin
    .from("curriculum_series")
    .select("id, curriculum_lessons(id, ordinal)")
    .eq("series_kind", "illustrative")
    .limit(1)
    .maybeSingle(),
  "series",
) as { id: string; curriculum_lessons: Array<{ id: string; ordinal: number }> } | null;
const lesson3 = illustrative?.curriculum_lessons.find((lesson) => lesson.ordinal === 3) ?? null;

const CLASSES = [
  {
    key: "a" as const,
    id: ID.classA,
    name: "Lớp Mây Hồng",
    series: illustrative?.id ?? null,
    lesson: lesson3?.id ?? null,
  },
  { key: "b" as const, id: ID.classB, name: "Lớp Nắng Vàng", series: null, lesson: null },
];
for (const cls of CLASSES) {
  must(
    await admin.from("classes").upsert({
      id: cls.id,
      school_id: ID.school,
      name: cls.name,
      school_year: "2026-2027",
      created_by: teacherIds[cls.key],
      curriculum_series_id: cls.series,
      current_lesson_id: cls.lesson,
      curriculum_status: "unconfirmed",
    }),
    "classes",
  );
  must(
    await admin
      .from("class_staff")
      .upsert({ class_id: cls.id, staff_id: teacherIds[cls.key], role: "owner", added_by: teacherIds[cls.key] }),
    "class_staff",
  );
}

// R04: nội dung fixture + Lớp Thử Điểm (do GV A chủ nhiệm), tiến độ ĐÃ XÁC NHẬN ở bài 2 của chuỗi bài kiểm thử.
enableLocalTestFixtures();
const fixtures = await installScoringFixtures(admin, teacherIds.a);
must(
  await admin.from("classes").upsert({
    id: ID.classC,
    school_id: ID.school,
    name: "Thử Điểm",
    school_year: "2026-2027",
    created_by: teacherIds.a,
    curriculum_series_id: fixtures.seriesId,
    current_lesson_id: fixtures.lessonIds[2],
    curriculum_status: "confirmed",
    curriculum_confirmed_by: teacherIds.a,
    curriculum_confirmed_at: new Date().toISOString(),
  }),
  "class C",
);
must(
  await admin
    .from("class_staff")
    .upsert({ class_id: ID.classC, staff_id: teacherIds.a, role: "owner", added_by: teacherIds.a }),
  "class_staff C",
);

const classIdOf = (key: "a" | "b" | "c") => (key === "a" ? ID.classA : key === "b" ? ID.classB : ID.classC);

for (const student of STUDENTS) {
  const classId = classIdOf(student.classKey);
  const teacherId = teacherIds[student.classKey === "b" ? "b" : "a"];
  must(
    await admin.from("students").upsert({
      id: student.id,
      class_id: classId,
      student_number: student.number,
      display_name: student.name,
      avatar_key: student.avatar,
      leaderboard_alias: student.alias?.text ?? null,
      leaderboard_alias_approved_by: student.alias?.approved ? teacherId : null,
      leaderboard_alias_approved_at: student.alias?.approved ? new Date().toISOString() : null,
      created_by: teacherId,
    }),
    "students",
  );

  // Lộ trình: chỉ tạo khi chưa có lộ trình hiện tại.
  const band = must(
    await admin.from("student_band_assignments").select("id").eq("student_id", student.id).is("valid_to", null),
    "band read",
  );
  if (student.band && band.length === 0) {
    must(
      await admin
        .from("student_band_assignments")
        .insert({ student_id: student.id, class_id: classId, band: student.band, set_by: teacherId }),
      "band",
    );
  }

  // Đồng ý (GIẢ): chỉ tạo khi học sinh chưa có bản ghi nào cho phạm vi đó.
  for (const consent of student.consents) {
    const existing = must(
      await admin.from("guardian_consents").select("id").eq("student_id", student.id).eq("scope", consent.scope),
      "consent read",
    );
    if (existing.length > 0) continue;
    const inserted = must(
      await admin
        .from("guardian_consents")
        .insert({
          student_id: student.id,
          class_id: classId,
          scope: consent.scope,
          notice_version: "nhap-2026-10",
          method: "paper_form",
          note: "Dữ liệu giả cho môi trường phát triển",
          recorded_by: teacherId,
        })
        .select("id")
        .single(),
      "consent",
    ) as { id: string };
    if (consent.withdrawn) {
      must(
        await admin
          .from("guardian_consents")
          .update({ status: "withdrawn", withdrawn_at: new Date().toISOString(), withdrawn_by: teacherId })
          .eq("id", inserted.id),
        "consent withdraw",
      );
    }
  }

  // Thiết bị: người dùng ẩn danh thật của Supabase local + thẻ học giả (mã gốc không in, không lưu).
  if (student.device === "none") continue;
  const devices = must(await admin.from("student_devices").select("id").eq("student_id", student.id), "devices read");
  if (devices.length > 0) continue;
  const generated = generateLoginCode();
  const code = must(
    await admin
      .from("student_login_codes")
      .insert({
        student_id: student.id,
        class_id: classId,
        token_hmac: toPgBytea(hmacLoginCode(pepper, "token", generated.token)),
        backup_code_hmac: toPgBytea(hmacLoginCode(pepper, "backup", generated.backupCode)),
        expires_at: new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString(),
        devices_linked: 1,
        created_by: teacherId,
      })
      .select("id")
      .single(),
    "login code",
  ) as { id: string };
  const anon = must(
    await publicClient(env).auth.signInAnonymously({ options: { data: { readmate_seed: "dev" } } }),
    "anonymous",
  );
  if (!anon.user) throw new Error("signInAnonymously không trả người dùng");
  must(
    await admin.from("student_devices").insert({
      auth_user_id: anon.user.id,
      student_id: student.id,
      class_id: classId,
      login_code_id: code.id,
      ...(student.device === "revoked"
        ? { revoked_at: new Date().toISOString(), revoked_by: teacherId, revoke_reason: "teacher" }
        : {}),
    }),
    "device",
  );
}

console.log(
  `Đã nạp dữ liệu giả: 1 trường · ${TEACHERS.length} GV (${TEACHERS.map((t) => t.email).join(", ")}) · ` +
    `${CLASSES.length + 1} lớp (gồm lớp \"Thử Điểm\" trên nội dung fixture) · ${STUDENTS.length} học sinh · kho tri thức ${content.datasetVersion}. ` +
    "Mật khẩu GV = SEED_TEACHER_PASSWORD trong .env.local.",
);
