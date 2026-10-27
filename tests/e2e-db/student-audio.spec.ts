import { createHash, randomBytes, randomUUID } from "node:crypto";
import { expect, test, type Page, type Request, type Response } from "@playwright/test";
import { installAudioFixtures } from "../../scripts/lib/audio-fixtures";
import { enableLocalTestFixtures, setLocalStudentAudioPlayback } from "../../scripts/lib/test-fixtures";
import { vi } from "../../src/strings/vi";
import { wav } from "../unit/audio-library/fixtures";
import {
  admin,
  API_URL,
  axeClean,
  link,
  newMember,
  noHorizontalScroll,
  PUBLISHABLE_KEY,
  type ClassRow,
} from "./class-fixtures";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * R10.3a — học sinh nghe BẢN GHI GIÁO VIÊN ĐÃ DUYỆT trong buổi luyện, trên Supabase local + Storage local. Bản ghi là SÓNG
 * SIN TỔNG HỢP (không giọng người thật). Mỗi kịch bản dựng trường/giáo viên/lớp/học sinh RIÊNG (dữ liệu hư cấu). Cờ phát
 * âm thanh cho học sinh chỉ bật trên local trong lúc chạy (global-setup bật, global-teardown trả về TẮT).
 * Chỉ chạy qua GitHub Actions hoặc máy đủ RAM (cần Docker + Storage: `npm run db:start`).
 */

const t = vi.practice.audio;

/** `must` của class-fixtures trả cả null; ở đây hàng luôn tồn tại (vừa chèn/đọc theo khóa). */
async function must<T>(promise: PromiseLike<{ data: T; error: unknown }>): Promise<NonNullable<T>> {
  const { data, error } = await promise;
  if (error || data === null || data === undefined) throw new Error(JSON.stringify(error ?? "không có dữ liệu"));
  return data as NonNullable<T>;
}
const UNITS: Array<[string, string]> = [
  ["b", "bờ"],
  ["c", "cờ"],
  ["d", "dờ"],
  ["i", "i"],
  ["k", "ca"],
];

type World = {
  cls: ClassRow;
  teacher: SupabaseClient;
  schoolId: string;
  versions: Record<string, string>;
};

/** Chèn không trả hàng (không `.select()`): chỉ cần biết có lỗi hay không. */
async function exec(promise: PromiseLike<{ error: unknown }>): Promise<void> {
  const { error } = await promise;
  if (error) throw new Error(JSON.stringify(error));
}

async function audioWorld(): Promise<World> {
  const hex = randomBytes(4).toString("hex");
  const schoolId = (
    await must(
      admin
        .from("schools")
        .insert({ name: `Trường nghe ${hex}` })
        .select("id")
        .single(),
    )
  ).id;
  const email = [`gv-nghe-${hex}`, ["readmate", "test"].join(".")].join("@");
  const password = `Rm${randomBytes(12).toString("base64url")}7x`;
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error || !created.data.user) throw created.error ?? new Error("createUser");
  const teacherId = created.data.user.id;
  await exec(
    admin.from("staff_profiles").insert({ id: teacherId, school_id: schoolId, display_name: `GV nghe ${hex}` }),
  );
  const teacher = createClient(API_URL, PUBLISHABLE_KEY, { auth: { persistSession: false } });
  const signIn = await teacher.auth.signInWithPassword({ email, password });
  if (signIn.error) throw signIn.error;

  enableLocalTestFixtures();
  const fx = await installAudioFixtures(admin, teacherId);
  const now = new Date().toISOString();
  const name = `Lớp nghe ${hex}`;
  const cls = await must(
    admin
      .from("classes")
      .insert({
        school_id: schoolId,
        name,
        school_year: "2026-2027",
        created_by: teacherId,
        curriculum_series_id: fx.seriesId,
        current_lesson_id: fx.lessonIds[2],
        curriculum_status: "confirmed",
        curriculum_confirmed_by: teacherId,
        curriculum_confirmed_at: now,
      })
      .select("id")
      .single(),
  );
  await exec(
    admin.from("class_staff").insert({ class_id: cls.id, staff_id: teacherId, role: "owner", added_by: teacherId }),
  );
  const world: World = { cls: { id: cls.id, name, ownerId: teacherId }, teacher, schoolId, versions: {} };
  await rpc(teacher, "teacher_grant_audio_consent", { p_notice_version: "v1" });
  for (const [index, [unit, label]] of UNITS.entries()) {
    world.versions[unit] = await approvedRecording(world, unit, label, index);
  }
  return world;
}

async function rpc(client: SupabaseClient, fn: string, args: Record<string, unknown>) {
  const { data, error } = await client.rpc(fn, args);
  if (error) throw new Error(`${fn}: ${JSON.stringify(error)}`);
  return data;
}

/** Bản ghi TỔNG HỢP đã duyệt qua đúng hàm teacher_* (JWT giáo viên) + tệp thật trong Storage riêng tư. */
async function approvedRecording(world: World, unit: string, label: string, index: number): Promise<string> {
  const bytes = Buffer.from(wav(0.5 + index * 0.1, 8000));
  const assetId = (await rpc(world.teacher, "teacher_ensure_audio_asset", {
    p_unit_kind: "phoneme",
    p_unit_text: unit,
    p_proposed_label: label,
  })) as string;
  await rpc(world.teacher, "teacher_confirm_audio_pronunciation", { p_asset_id: assetId, p_label: label });
  const versionId = randomUUID();
  const key = `${world.schoolId}/${assetId}/${versionId}.wav`;
  const up = await admin.storage.from("teacher-audio").upload(key, bytes, { contentType: "audio/wav", upsert: false });
  if (up.error) throw up.error;
  await rpc(world.teacher, "teacher_create_audio_version", {
    p_asset_id: assetId,
    p_version_id: versionId,
    p_storage_key: key,
    p_content_hash: createHash("sha256").update(bytes).digest("hex"),
    p_mime_type: "audio/wav",
    p_size_bytes: bytes.byteLength,
    p_duration_ms: 1000,
  });
  await rpc(world.teacher, "teacher_submit_audio_version", { p_version_id: versionId });
  await rpc(world.teacher, "teacher_review_audio_version", {
    p_version_id: versionId,
    p_decision: "approve",
    p_note: "",
    p_listened: true,
  });
  return versionId;
}

type Option = { id: string; text: string };
type Question = { id: string; view: { variant: string; content: { options: Option[] } } };

const isSessionPost = (r: Response) =>
  /\/api\/student\/practice-sessions$/u.test(r.url()) && r.request().method() === "POST";

/** Mở buổi luyện của học sinh vừa liên kết; trả về câu hiện tại (không có đáp án). */
async function openPractice(page: Page): Promise<Question> {
  const opened = page.waitForResponse(isSessionPost);
  await page.goto("/learn/me/practice");
  const body = (await (await opened).json()) as { ok: boolean; data: { current: Question } };
  expect(body.ok).toBe(true);
  expect(body.data.current.view.variant).toBe("listen_letter");
  return body.data.current;
}

const stimulusButton = (page: Page) => page.getByRole("button", { name: t.stimulus, exact: true });
const audioCalls = (requests: Request[]) => requests.filter((r) => /\/audio\/(stimulus|model)$/u.test(r.url()));

async function answerOf(questionId: string): Promise<string> {
  const q = await must(admin.from("question_instances").select("exercise_item_id").eq("id", questionId).single());
  const item = await must(admin.from("exercise_items").select("answer").eq("id", q.exercise_item_id).single());
  return (item.answer as { optionId: string }).optionId;
}

test.beforeEach(async ({ page }) => {
  // Bảo vệ: mọi dùng Web Speech API đều bị đếm (kỳ vọng 0).
  await page.addInitScript(() => {
    const w = window as unknown as { __speech: number; speechSynthesis?: { speak: () => void } };
    w.__speech = 0;
    if (w.speechSynthesis) w.speechSynthesis.speak = () => void (w.__speech += 1);
  });
});

test.describe("R10.3a — nghe bản ghi giáo viên đã duyệt trong buổi luyện", () => {
  test("nút Nghe ≥ 64 px; chưa tải tệp trước khi chạm; chạm → tệp riêng tư; không lộ khóa lưu trữ; không TTS", async ({
    page,
  }, testInfo) => {
    test.setTimeout(180_000);
    const world = await audioWorld();
    const member = await newMember(world.cls, "Nghe");
    await link(page, member.backup);
    const requests: Request[] = [];
    page.on("request", (r) => requests.push(r));
    const statusSeen = page.waitForResponse((r) => /\/question-instances\/[0-9a-f-]+\/audio$/u.test(r.url()));
    const question = await openPractice(page);

    const statusText = await (await statusSeen).text();
    expect(statusText).not.toMatch(
      /teacher-audio|storage|\.wav|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/|bờ|cờ/u,
    );
    expect(JSON.parse(statusText)).toEqual({
      ok: true,
      data: { muted: false, slots: { stimulus: { mimeType: "audio/wav" } } },
    });

    const button = stimulusButton(page);
    await expect(button).toBeEnabled({ timeout: 20_000 });
    const box = await button.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(63);
    expect(audioCalls(requests)).toHaveLength(0); // chưa chạm → chưa tải tệp

    const played = page.waitForResponse((r) => r.url().endsWith(`/question-instances/${question.id}/audio/stimulus`));
    await button.click();
    const response = await played;
    expect([200, 206]).toContain(response.status());
    const headers = response.headers();
    expect(headers["content-type"]).toBe("audio/wav");
    expect(headers["cache-control"]).toBe("private, no-store");
    expect(headers["x-content-type-options"]).toBe("nosniff");

    // HTML + toàn bộ phản hồi JSON của học sinh không chứa khóa lưu trữ hay URL công khai.
    expect(await page.content()).not.toMatch(/teacher-audio|storage_key|storageKey|\/storage\/v1|createSignedUrl/u);
    expect(requests.filter((r) => /\/storage\/v1\//u.test(r.url()))).toHaveLength(0);
    expect(requests.filter((r) => /tts|synthes|texttospeech/iu.test(r.url()))).toHaveLength(0);
    expect(await page.evaluate(() => (window as unknown as { __speech: number }).__speech)).toBe(0);

    if (testInfo.project.name.startsWith("chromium")) {
      // Chromium giải mã WAV: phát hết rồi cho nghe lại.
      await expect(page.getByRole("button", { name: new RegExp(`^${t.replay}`, "u") })).toBeVisible({
        timeout: 15_000,
      });
    }
    await noHorizontalScroll(page);
    await axeClean(page);
  });

  test("đọc mẫu chỉ sau khi chấm: trước đó API từ chối, sau đó nghe được", async ({ page }) => {
    test.setTimeout(180_000);
    const world = await audioWorld();
    const member = await newMember(world.cls, "Mau");
    await link(page, member.backup);
    const question = await openPractice(page);
    await expect(stimulusButton(page)).toBeEnabled({ timeout: 20_000 });

    const early = await page.request.get(`/api/student/question-instances/${question.id}/audio/model`);
    expect(early.status()).toBe(403);
    expect(await early.json()).toEqual({ ok: false, code: "AUDIO_NOT_PERMITTED" });
    await expect(page.getByRole("button", { name: t.model })).toHaveCount(0);

    const correct = await answerOf(question.id);
    const index = question.view.content.options.findIndex((option) => option.id === correct);
    await page.getByRole("group", { name: /chữ/iu }).getByRole("button").nth(index).click();
    const attempt = page.waitForResponse((r) => r.url().includes("/attempts") && r.request().method() === "POST");
    await page.getByRole("button", { name: "Kiểm tra" }).click();
    expect((await attempt).status()).toBe(200);
    await expect(page.getByLabel("Cộng 10 điểm")).toBeVisible(); // quy tắc điểm giữ nguyên

    const model = page.getByRole("button", { name: t.model, exact: true });
    await expect(model).toBeEnabled({ timeout: 20_000 });
    const played = page.waitForResponse((r) => r.url().endsWith(`/question-instances/${question.id}/audio/model`));
    await model.click();
    expect([200, 206]).toContain((await played).status());
  });

  test("giáo viên thu hồi khi trang đang mở: lần nghe MỚI bị từ chối và nút báo lỗi nhẹ nhàng", async ({ page }) => {
    test.setTimeout(180_000);
    const world = await audioWorld();
    const member = await newMember(world.cls, "Thu");
    await link(page, member.backup);
    const question = await openPractice(page);
    await expect(stimulusButton(page)).toBeEnabled({ timeout: 20_000 });
    const letter = (
      await must(
        admin
          .from("exercise_items")
          .select("item_key")
          .eq(
            "id",
            (await must(admin.from("question_instances").select("exercise_item_id").eq("id", question.id).single()))
              .exercise_item_id,
          )
          .single(),
      )
    ).item_key
      .split(".")
      .at(-1)!;
    const target = letter === "y" ? "i" : letter;
    await rpc(world.teacher, "teacher_revoke_audio_version", {
      p_version_id: world.versions[target],
      p_reason: "Thu hồi khi đang học",
    });

    const refused = page.waitForResponse((r) => r.url().endsWith(`/question-instances/${question.id}/audio/stimulus`));
    await stimulusButton(page).click();
    const response = await refused;
    expect(response.status()).toBe(404);
    expect(await response.json()).toEqual({ ok: false, code: "AUDIO_NOT_AVAILABLE" });
    await expect(page.getByText(t.error)).toBeVisible();
    expect(await page.evaluate(() => (window as unknown as { __speech: number }).__speech)).toBe(0);
  });

  test("cờ TẮT: nút khóa 'Chưa có âm thanh', KHÔNG gọi API phát tệp; câu bắt buộc nghe không tính điểm", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    const world = await audioWorld();
    const member = await newMember(world.cls, "Tat");
    await link(page, member.backup);
    setLocalStudentAudioPlayback(false);
    try {
      const requests: Request[] = [];
      page.on("request", (r) => requests.push(r));
      const question = await openPractice(page);
      await expect(page.getByRole("button", { name: new RegExp(t.unavailable, "u") }).first()).toBeDisabled();
      await expect(stimulusButton(page)).toHaveCount(0);
      expect(audioCalls(requests)).toHaveLength(0);

      const correct = await answerOf(question.id);
      const index = question.view.content.options.findIndex((option) => option.id === correct);
      await page.getByRole("group", { name: /chữ/iu }).getByRole("button").nth(index).click();
      const attempt = page.waitForResponse((r) => r.url().includes("/attempts") && r.request().method() === "POST");
      await page.getByRole("button", { name: "Kiểm tra" }).click();
      const response = await attempt;
      expect(response.status()).toBe(404);
      expect(await response.json()).toEqual({ ok: false, code: "AUDIO_NOT_AVAILABLE" });
      await expect(page.getByText(vi.errors.AUDIO_NOT_AVAILABLE)).toBeVisible();
      await expect(page.getByLabel("Cộng 10 điểm")).toHaveCount(0);
      const attempts = await must(admin.from("item_attempts").select("id").eq("question_instance_id", question.id));
      expect(attempts).toHaveLength(0);
    } finally {
      setLocalStudentAudioPlayback(true);
    }
  });

  test("màn hình hẹp 360 px + giảm chuyển động + bàn phím: nút nghe dùng được, không tràn ngang, axe sạch", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 360, height: 740 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    const world = await audioWorld();
    const member = await newMember(world.cls, "Hep");
    await link(page, member.backup);
    const question = await openPractice(page);
    const button = stimulusButton(page);
    await expect(button).toBeEnabled({ timeout: 20_000 });
    await noHorizontalScroll(page);
    await axeClean(page);

    const box = await button.boundingBox();
    expect(box!.width).toBeLessThanOrEqual(360);
    expect(box!.height).toBeGreaterThanOrEqual(63);
    await button.focus();
    await expect(button).toBeFocused();
    const played = page.waitForResponse((r) => r.url().endsWith(`/question-instances/${question.id}/audio/stimulus`));
    await page.keyboard.press("Enter");
    expect([200, 206]).toContain((await played).status());
  });
});
