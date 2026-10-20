import { execSync } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { expect, test, type APIRequestContext } from "@playwright/test";
import { generateLoginCode, hmacLoginCode, toPgBytea } from "../../src/features/login-codes/codes";

/**
 * ĐO HIỆU NĂNG chấm bài qua máy chủ (R04, REDESIGN_ARCHITECTURE §10: mục tiêu p95 ≤ 400 ms). Chỉ chạy khi PERF=1:
 *   PERF=1 npx playwright test --config playwright.db.config.ts tests/e2e-db/perf.spec.ts --project chromium-desktop
 * Đo thời gian khứ hồi THẬT của POST /api/student/question-instances/{id}/attempts (xác thực phiên → giới hạn tần suất →
 * đọc câu → chấm bằng runtime GĐ4 → hàm CSDL ghi lượt + điểm trong một giao dịch → đọc lại trạng thái) trên bản build
 * production + Supabase local. Bộ đếm giới hạn tần suất của máy dev được xóa giữa các lượt (chỉ Supabase local).
 */

test.skip(process.env.PERF !== "1", "Chỉ chạy khi PERF=1");

process.loadEnvFile?.(".env.local");
const PEPPER = process.env.LOGIN_CODE_PEPPER ?? "";
const CLASS_C = "5eed0000-0000-4000-8000-0000000000c1";
const status = JSON.parse(
  (() => {
    const raw = execSync("npx supabase status -o json", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    return raw.slice(raw.indexOf("{"));
  })(),
) as Record<string, string>;
const admin = createClient(status.API_URL!, status.SECRET_KEY!, { auth: { persistSession: false } });

type Option = { id: string; text: string };
type Current = { id: string; view: { content: { sample: string; options: Option[] } } } | null;

async function freshStudent(): Promise<string> {
  const { data: owner } = await admin
    .from("class_staff")
    .select("staff_id")
    .eq("class_id", CLASS_C)
    .eq("role", "owner")
    .single();
  const name = `Đo ${[...randomBytes(6)].map((b) => String.fromCharCode(97 + (b % 26))).join("")}`;
  const { data: student } = await admin
    .from("students")
    .insert({ class_id: CLASS_C, display_name: name, avatar_key: "may", created_by: owner!.staff_id })
    .select("id")
    .single();
  await admin
    .from("student_band_assignments")
    .insert({ student_id: student!.id, class_id: CLASS_C, band: "developing", set_by: owner!.staff_id });
  await admin.from("guardian_consents").insert({
    student_id: student!.id,
    class_id: CLASS_C,
    scope: "learning_data",
    notice_version: "kiem-thu-hieu-nang",
    method: "paper_form",
    recorded_by: owner!.staff_id,
  });
  const code = generateLoginCode();
  await admin.from("student_login_codes").insert({
    student_id: student!.id,
    class_id: CLASS_C,
    token_hmac: toPgBytea(hmacLoginCode(PEPPER, "token", code.token)),
    backup_code_hmac: toPgBytea(hmacLoginCode(PEPPER, "backup", code.backupCode)),
    expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
    created_by: owner!.staff_id,
  });
  return code.backupCode;
}

const percentile = (sorted: number[], p: number) =>
  sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)]!;

async function attempt(request: APIRequestContext, questionId: string, optionId: string, timings: number[]) {
  const started = performance.now();
  const response = await request.post(`/api/student/question-instances/${questionId}/attempts`, {
    data: { clientAttemptId: randomUUID(), response: { kind: "choice", optionId } },
  });
  timings.push(performance.now() - started);
  expect(response.status()).toBe(200);
  return (await response.json()) as { data: { question: { status: string } } };
}

test("p95 thời gian chấm bài qua máy chủ", async ({ browser }, testInfo) => {
  test.setTimeout(600_000);
  const timings: number[] = [];
  const startTimings: number[] = [];
  const students = Number(process.env.PERF_STUDENTS ?? 9);
  for (let index = 0; index < students; index += 1) {
    await admin.from("rate_limit_buckets").delete().neq("key_hash", "");
    const backup = await freshStudent();
    const context = await browser.newContext({ locale: "vi-VN" });
    const page = await context.newPage();
    await page.goto("/join");
    await page.getByLabel("Mã dự phòng trên thẻ học").fill(backup);
    await page.getByRole("button", { name: "Liên kết thiết bị" }).click();
    await expect(page).toHaveURL(/\/learn\/me$/u, { timeout: 30_000 });
    const t0 = performance.now();
    let session = await context.request.post("/api/student/practice-sessions", { data: {} });
    startTimings.push(performance.now() - t0);
    let body = (await session.json()) as { data: { id: string; current: Current } };
    while (body.data.current) {
      const current = body.data.current;
      const options = current.view.content.options;
      const correct = options.find((option) => option.text === current.view.content.sample)!;
      // Mỗi câu: sai, sai, đúng (3 lượt — mức H2) để có nhiều mẫu, gồm cả lượt bị trừ điểm.
      for (const option of [...options.filter((entry) => entry.id !== correct.id), correct]) {
        const result = await attempt(context.request, current.id, option.id, timings);
        if (result.data.question.status !== "open") break;
      }
      session = await context.request.get(`/api/student/practice-sessions/${body.data.id}`);
      body = (await session.json()) as { data: { id: string; current: Current } };
    }
    await context.close();
  }
  const sorted = [...timings].sort((a, b) => a - b);
  const summary = {
    requests: sorted.length,
    medianMs: Math.round(percentile(sorted, 50)),
    p95Ms: Math.round(percentile(sorted, 95)),
    p99Ms: Math.round(percentile(sorted, 99)),
    maxMs: Math.round(sorted.at(-1)!),
    minMs: Math.round(sorted[0]!),
    slowest: sorted.slice(-5).map(Math.round),
    startSession: {
      samples: startTimings.length,
      medianMs: Math.round(
        percentile(
          [...startTimings].sort((a, b) => a - b),
          50,
        ),
      ),
    },
  };
  console.log(`HIỆU NĂNG CHẤM BÀI: ${JSON.stringify(summary)}`);
  writeFileSync(testInfo.outputPath("perf-scoring.json"), JSON.stringify({ summary, timings: sorted }, null, 2));
  expect(sorted.length).toBeGreaterThanOrEqual(100);
});
