import { beforeAll, describe, expect, it } from "vitest";
import {
  admin,
  issueCode,
  local,
  newDevice,
  newSchool,
  newTeacher,
  publicClient,
  redeem,
  rpcOk,
  signJwt,
  strongPassword,
  testEmail,
  type Actor,
} from "./helpers";
import { SCORING_RULES_VERSION } from "../../src/features/gamification/rules";

/** Xác thực (Supabase Auth local), đồng ý hai phạm vi, mùa thi đua, tiến độ chương trình — trên CSDL thật. */

let schoolId: string;
let teacher: Actor & { email: string; password: string };
let classId: string;
let studentId: string;

beforeAll(async () => {
  schoolId = await newSchool();
  teacher = await newTeacher(schoolId, "gv-auth");
  classId = await rpcOk(
    teacher.client.rpc("teacher_create_class", { p_name: "Lớp Đồng Ý", p_school_year: "2026-2027" }),
  );
  studentId = await rpcOk(
    teacher.client.rpc("teacher_create_student", {
      p_class_id: classId,
      p_display_name: "Kem",
      p_student_number: 1,
      p_avatar_key: "ti",
    }),
  );
});

describe("đăng nhập giáo viên", () => {
  it("đúng mật khẩu → phiên hợp lệ, đọc được hồ sơ GV của mình", async () => {
    const client = publicClient();
    const { error } = await client.auth.signInWithPassword({ email: teacher.email, password: teacher.password });
    expect(error).toBeNull();
    const { data } = await client.from("staff_profiles").select("id").eq("id", teacher.id);
    expect(data).toHaveLength(1);
  });

  it("sai mật khẩu → bị từ chối", async () => {
    const { data, error } = await publicClient().auth.signInWithPassword({
      email: teacher.email,
      password: strongPassword(),
    });
    expect(error).not.toBeNull();
    expect(data.session).toBeNull();
  });

  it("không tự đăng ký được tài khoản bằng email (signup tắt)", async () => {
    const { data, error } = await publicClient().auth.signUp({
      email: testEmail("tu-dang-ky"),
      password: strongPassword(),
    });
    expect(error).not.toBeNull();
    expect(data.user).toBeNull();
  });

  it("đăng xuất → không làm mới được phiên cũ", async () => {
    const client = publicClient();
    await client.auth.signInWithPassword({ email: teacher.email, password: teacher.password });
    const refreshToken = (await client.auth.getSession()).data.session?.refresh_token;
    await client.auth.signOut();
    const reuse = await publicClient().auth.refreshSession({ refresh_token: refreshToken ?? "" });
    expect(reuse.error).not.toBeNull();
  });

  it.skipIf(!local.jwtSecret)("JWT hết hạn hoặc ký giả bị từ chối (không đọc được dữ liệu)", async () => {
    const now = Math.floor(Date.now() / 1000);
    const claims = { sub: teacher.id, role: "authenticated", aud: "authenticated", iat: now - 7200, exp: now - 3600 };
    const call = (token: string) =>
      fetch(`${local.url}/rest/v1/classes?select=id`, {
        headers: { apikey: local.publishableKey, Authorization: `Bearer ${token}` },
      });
    expect((await call(signJwt(claims, local.jwtSecret))).status).toBe(401);
    const forged = signJwt({ ...claims, exp: now + 3600 }, "khong-phai-khoa-that-cua-he-thong-0123456789");
    expect((await call(forged)).status).toBe(401);
    const verify = await publicClient().auth.getClaims(signJwt(claims, local.jwtSecret));
    expect(verify.data).toBeNull();
  });

  it("người dùng ẩn danh mang cờ is_anonymous và không phải GV", async () => {
    const device = await newDevice();
    const claims = (await device.client.auth.getClaims()).data?.claims;
    expect(claims?.is_anonymous).toBe(true);
    const profile = await device.client.from("staff_profiles").select("id");
    expect(profile.data).toEqual([]);
  });
});

describe("đồng ý hai phạm vi", () => {
  it("mặc định không có đồng ý nào", async () => {
    const { data } = await admin.from("guardian_consents").select("id").eq("student_id", studentId);
    expect(data).toEqual([]);
  });

  it("bắt buộc GV xác nhận đã nhận phiếu hợp lệ", async () => {
    const result = await teacher.client.rpc("teacher_record_consent", {
      p_student_id: studentId,
      p_scope: "learning_data",
      p_notice_version: "nhap-2026-10",
      p_method: "paper_form",
      p_note: "",
      p_attested: false,
    });
    expect(result.error?.message).toBe("ATTESTATION_REQUIRED");
  });

  it("hai phạm vi độc lập; ghi nhận trùng phạm vi bị chặn", async () => {
    const record = (scope: "learning_data" | "leaderboard_display") =>
      teacher.client.rpc("teacher_record_consent", {
        p_student_id: studentId,
        p_scope: scope,
        p_notice_version: "nhap-2026-10",
        p_method: "paper_form",
        p_note: "",
        p_attested: true,
      });
    expect((await record("learning_data")).error).toBeNull();
    expect((await record("learning_data")).error?.code).toBe("23505");
    const { data } = await admin.from("guardian_consents").select("scope, status").eq("student_id", studentId);
    expect(data).toEqual([{ scope: "learning_data", status: "granted" }]);
  });

  it("rút learning_data → thu hồi ngay mọi thiết bị và thẻ học; ghi nhận lại tạo bản ghi mới", async () => {
    const code = await issueCode(teacher.client, studentId);
    const device = await newDevice();
    await redeem("backup", code.backup, device.id);
    expect((await device.client.from("students").select("id")).data).toHaveLength(1);

    await rpcOk(teacher.client.rpc("teacher_withdraw_consent", { p_student_id: studentId, p_scope: "learning_data" }));
    expect((await device.client.from("students").select("id")).data).toEqual([]);
    const codeRow = await admin.from("student_login_codes").select("revoke_reason").eq("id", code.codeId).single();
    expect(codeRow.data?.revoke_reason).toBe("consent_withdrawn");

    const again = await teacher.client.rpc("teacher_withdraw_consent", {
      p_student_id: studentId,
      p_scope: "learning_data",
    });
    expect(again.error?.message).toBe("CONSENT_NOT_ACTIVE");
    await rpcOk(
      teacher.client.rpc("teacher_record_consent", {
        p_student_id: studentId,
        p_scope: "learning_data",
        p_notice_version: "nhap-2026-10",
        p_method: "paper_form",
        p_note: "",
        p_attested: true,
      }),
    );
    const history = await admin
      .from("guardian_consents")
      .select("status")
      .eq("student_id", studentId)
      .eq("scope", "learning_data");
    expect((history.data ?? []).map((row) => row.status).sort()).toEqual(["granted", "withdrawn"]);
  });
});

describe("mùa thi đua và cấu hình lớp", () => {
  it("lớp mới có mùa 1 đang diễn ra với phiên bản quy tắc khớp rules.ts", async () => {
    const { data } = await teacher.client
      .from("seasons")
      .select("seq_no, status, rules_version")
      .eq("class_id", classId);
    expect(data).toEqual([{ seq_no: 1, status: "active", rules_version: SCORING_RULES_VERSION }]);
  });

  it("bảng xếp hạng và vinh danh mặc định tắt", async () => {
    const { data } = await teacher.client
      .from("classes")
      .select("leaderboard_enabled, honors_enabled")
      .eq("id", classId)
      .single();
    expect(data).toEqual({ leaderboard_enabled: false, honors_enabled: false });
  });

  it("tiến độ chương trình mặc định chưa xác nhận; chuỗi minh họa không xác nhận được", async () => {
    // Chuỗi minh họa riêng của kiểm thử (không phụ thuộc việc đã chạy db:sync-content).
    const release = await rpcOk<{ id: string }>(
      admin
        .from("content_releases")
        .upsert({ dataset_version: "0.0.0", content_hash: "f".repeat(64) }, { onConflict: "content_hash" })
        .select("id")
        .single(),
    );
    const series = await rpcOk<{ id: string }>(
      admin
        .from("curriculum_series")
        .insert({
          key: `series:test-${classId.slice(0, 8)}`,
          series_kind: "illustrative",
          title: "Chuỗi thử",
          review_status: "pending_review",
          release_id: release.id,
        })
        .select("id")
        .single(),
    );
    const lesson = await rpcOk<{ id: string }>(
      admin
        .from("curriculum_lessons")
        .insert({ series_id: series.id, ordinal: 1, code: "T1", title: "Bài thử", lesson_type: "new_units" })
        .select("id")
        .single(),
    );
    await rpcOk(
      teacher.client.rpc("teacher_set_class_curriculum", {
        p_class_id: classId,
        p_series_id: series.id,
        p_lesson_id: lesson.id,
      }),
    );
    const confirm = await teacher.client.rpc("teacher_confirm_class_curriculum", { p_class_id: classId });
    expect(confirm.error?.message).toBe("CURRICULUM_NOT_CONFIRMABLE");
    const cls = await admin.from("classes").select("curriculum_status").eq("id", classId).single();
    expect(cls.data?.curriculum_status).toBe("unconfirmed");
  });

  it("tên hiển thị: trùng trong lớp bị chặn; đổi tên → mất trạng thái duyệt", async () => {
    const other = await rpcOk(
      teacher.client.rpc("teacher_create_student", {
        p_class_id: classId,
        p_display_name: "Kẹo",
        p_student_number: 2,
        p_avatar_key: "may",
      }),
    );
    await rpcOk(teacher.client.rpc("teacher_set_leaderboard_alias", { p_student_id: studentId, p_alias: "Sao Sáng" }));
    const duplicate = await teacher.client.rpc("teacher_set_leaderboard_alias", {
      p_student_id: other,
      p_alias: "sao sáng",
    });
    expect(duplicate.error?.code).toBe("23505");
    await rpcOk(teacher.client.rpc("teacher_approve_leaderboard_alias", { p_student_id: studentId }));
    expect(
      (await admin.from("students").select("leaderboard_alias_approved_at").eq("id", studentId).single()).data
        ?.leaderboard_alias_approved_at,
    ).not.toBeNull();
    await rpcOk(teacher.client.rpc("teacher_set_leaderboard_alias", { p_student_id: studentId, p_alias: "Sao Mai" }));
    expect(
      (await admin.from("students").select("leaderboard_alias_approved_at").eq("id", studentId).single()).data
        ?.leaderboard_alias_approved_at,
    ).toBeNull();
  });
});
