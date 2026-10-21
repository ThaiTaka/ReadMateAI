import { execSync } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { createClient } from "@supabase/supabase-js";
import { expect, type APIRequestContext, type Page } from "@playwright/test";
import { generateLoginCode, hmacLoginCode, toPgBytea } from "../../src/features/login-codes/codes";

/**
 * Dữ liệu giả + thao tác dùng chung cho E2E có CSDL của Mê cung (R07.5b2): lớp/học sinh giả riêng từng kịch bản,
 * điểm đến từ API chấm bài thật, liên kết thiết bị bằng mã dự phòng. CHỈ chạy trên Supabase local.
 */

process.loadEnvFile?.(".env.local");
export const PASSWORD = process.env.SEED_TEACHER_PASSWORD ?? "";
export const PEPPER = process.env.LOGIN_CODE_PEPPER ?? "";
const DOMAIN = ["readmate", "test"].join(".");
export const TEACHER_A = ["co.mai", DOMAIN].join("@");
const CLASS_C = "5eed0000-0000-4000-8000-0000000000c1";

const status = JSON.parse(
  (() => {
    const raw = execSync("npx supabase status -o json", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    return raw.slice(raw.indexOf("{"));
  })(),
) as Record<string, string>;
export const API_URL = status.API_URL!;
export const PUBLISHABLE_KEY = status.PUBLISHABLE_KEY!;
export const admin = createClient(API_URL, status.SECRET_KEY!, { auth: { persistSession: false } });

export async function must<T>(promise: PromiseLike<{ data: T; error: unknown }>): Promise<T> {
  const { data, error } = await promise;
  if (error) throw new Error(JSON.stringify(error));
  return data;
}

export const resetRateLimits = () => admin.from("rate_limit_buckets").delete().neq("key_hash", "");

export type ClassRow = { id: string; name: string; ownerId: string };
export type Member = { id: string; backup: string; classId: string };

export async function freshClass(label: string): Promise<ClassRow> {
  const reference = (await must(
    admin
      .from("classes")
      .select("school_id, curriculum_series_id, current_lesson_id, created_by")
      .eq("id", CLASS_C)
      .single(),
  )) as { school_id: string; curriculum_series_id: string; current_lesson_id: string; created_by: string };
  const name = `${label} ${randomBytes(3).toString("hex")}`;
  const created = (await must(
    admin
      .from("classes")
      .insert({
        school_id: reference.school_id,
        name,
        school_year: "2026-2027",
        created_by: reference.created_by,
        curriculum_series_id: reference.curriculum_series_id,
        current_lesson_id: reference.current_lesson_id,
        curriculum_status: "confirmed",
        curriculum_confirmed_by: reference.created_by,
        curriculum_confirmed_at: new Date().toISOString(),
      })
      .select("id")
      .single(),
  )) as { id: string };
  await must(
    admin
      .from("class_staff")
      .insert({ class_id: created.id, staff_id: reference.created_by, role: "owner", added_by: reference.created_by }),
  );
  return { id: created.id, name, ownerId: reference.created_by };
}

export async function newMember(cls: ClassRow, alias: string): Promise<Member> {
  const name = `${alias} ${[...randomBytes(5)].map((byte) => String.fromCharCode(97 + (byte % 26))).join("")}`;
  const now = new Date().toISOString();
  const student = (await must(
    admin
      .from("students")
      .insert({
        class_id: cls.id,
        display_name: name,
        avatar_key: "may",
        leaderboard_alias: alias,
        leaderboard_alias_approved_by: cls.ownerId,
        leaderboard_alias_approved_at: now,
        created_by: cls.ownerId,
      })
      .select("id")
      .single(),
  )) as { id: string };
  await must(
    admin
      .from("student_band_assignments")
      .insert({ student_id: student.id, class_id: cls.id, band: "developing", set_by: cls.ownerId }),
  );
  for (const scope of ["learning_data", "leaderboard_display"] as const) {
    await must(
      admin.from("guardian_consents").insert({
        student_id: student.id,
        class_id: cls.id,
        scope,
        notice_version: "kiem-thu-e2e",
        method: "paper_form",
        note: "Dữ liệu giả cho kiểm thử E2E",
        recorded_by: cls.ownerId,
      }),
    );
  }
  const code = generateLoginCode();
  await must(
    admin.from("student_login_codes").insert({
      student_id: student.id,
      class_id: cls.id,
      token_hmac: toPgBytea(hmacLoginCode(PEPPER, "token", code.token)),
      backup_code_hmac: toPgBytea(hmacLoginCode(PEPPER, "backup", code.backupCode)),
      expires_at: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
      created_by: cls.ownerId,
    }),
  );
  return { id: student.id, backup: code.backupCode, classId: cls.id };
}

export async function link(page: Page, backup: string) {
  await resetRateLimits();
  await page.goto("/join");
  await page.getByLabel("Mã dự phòng trên thẻ học").fill(backup);
  await page.getByRole("button", { name: "Liên kết thiết bị" }).click();
  await expect(page).toHaveURL(/\/learn\/me$/u, { timeout: 30_000 });
}

type Option = { id: string; text: string };
type Question = { id: string; view: { content: { sample: string; options: Option[] } } };

/** Trả lời đúng `count` câu bằng API chấm bài thật (mỗi câu +10 điểm). */
export async function earnCorrect(request: APIRequestContext, count: number) {
  const opened = await request.post("/api/student/practice-sessions", { data: {} });
  expect(opened.status()).toBe(200);
  const session = (await opened.json()).data as { id: string; current: Question };
  let question: Question | null = session.current;
  for (let index = 0; index < count; index += 1) {
    expect(question, "hết câu trong buổi").not.toBeNull();
    const { sample, options } = question!.view.content;
    const attempt = await request.post(`/api/student/question-instances/${question!.id}/attempts`, {
      data: {
        clientAttemptId: randomUUID(),
        response: { kind: "choice", optionId: options.find((option) => option.text === sample)!.id },
      },
    });
    expect(attempt.status()).toBe(200);
    const next = await request.get(`/api/student/practice-sessions/${session.id}`);
    question = ((await next.json()).data as { current: Question | null }).current;
  }
}

export async function axeClean(page: Page) {
  await page.mouse.move(0, 0);
  await page.waitForTimeout(400);
  const results = await new AxeBuilder({ page }).analyze();
  const serious = results.violations.filter((v) => v.impact === "critical" || v.impact === "serious");
  expect(
    serious.map((v) => `${v.id}: ${v.help} @ ${v.nodes.map((node) => node.target.join(" ")).join(" | ")}`),
  ).toEqual([]);
}

export async function noHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
}

export type RunRow = {
  id: string;
  position: { row: number; col: number };
  state_version: number;
  status: string;
  scored: boolean;
};

export async function runsOf(studentId: string): Promise<RunRow[]> {
  return (await must(
    admin.from("game_runs").select("id, position, state_version, status, scored").eq("student_id", studentId),
  )) as RunRow[];
}

export async function balanceOf(studentId: string): Promise<number> {
  const rows = (await must(admin.from("season_scores").select("balance").eq("student_id", studentId))) as Array<{
    balance: number;
  }>;
  return rows.reduce((sum, row) => sum + row.balance, 0);
}
