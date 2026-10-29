import { expect, test, type Page, type Request, type Response, type TestInfo } from "@playwright/test";
import { type SupabaseClient } from "@supabase/supabase-js";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { installAudioFixtures } from "../../scripts/lib/audio-fixtures";
import { enableLocalTestFixtures, setLocalContestAudio } from "../../scripts/lib/test-fixtures";
import { buildContestCatalog, type ContestEntry } from "../../src/features/contest-audio/catalog";
import { CONTEST_BUCKET, CONTEST_VOICE } from "../../src/features/contest-audio/config";
import { LIBRARY_ENTRIES } from "../../src/server/tts-library/entries";
import { vi } from "../../src/strings/vi";
import { wav } from "../unit/audio-library/fixtures";
import { exec, freshTeacher, mustRow as must } from "./audio-fixtures";
import { admin, axeClean, link, newMember, noHorizontalScroll, type ClassRow } from "./class-fixtures";

/**
 * Chế độ TRÌNH DIỄN âm thanh (docs/CONTEST_AUDIO.md) trên Supabase local + Storage local. Tệp là SÓNG SIN TỔNG HỢP (không giọng của nhà cung
 * cấp nào); KHÔNG có yêu cầu nào tới dịch vụ giọng máy. Mỗi kịch bản dựng trường/giáo viên/lớp RIÊNG (dữ liệu hư cấu). Chế độ trình diễn chỉ
 * bật trong lúc chạy file này và trả về TẮT khi xong.
 */

const study = vi.studyAudio;
const audio = vi.practice.audio;
const contest = vi.contest;
const catalog = buildContestCatalog({
  letters: (JSON.parse(readFileSync("content/kb/letters.json", "utf8")) as { items: never[] }).items,
  phonemes: (JSON.parse(readFileSync("content/kb/phonemes.json", "utf8")) as { items: never[] }).items,
  library: LIBRARY_ENTRIES.map((entry) => ({ id: entry.id, text: entry.text, attention: entry.attention })),
});
const entry = (id: string): ContestEntry => catalog.byId.get(id)!;

type World = { cls: ClassRow; teacher: SupabaseClient; teacherId: string; schoolId: string };

async function world(withCurriculum: boolean): Promise<World> {
  const hex = randomBytes(4).toString("hex");
  const { teacher, teacherId, schoolId } = await freshTeacher("tr");
  let extra: Record<string, unknown> = {};
  if (withCurriculum) {
    enableLocalTestFixtures();
    const fx = await installAudioFixtures(admin, teacherId);
    extra = {
      curriculum_series_id: fx.seriesId,
      current_lesson_id: fx.lessonIds[2],
      curriculum_status: "confirmed",
      curriculum_confirmed_by: teacherId,
      curriculum_confirmed_at: new Date().toISOString(),
    };
  }
  const name = `Lớp trình diễn ${hex}`;
  const cls = await must(
    admin
      .from("classes")
      .insert({ school_id: schoolId, name, school_year: "2026-2027", created_by: teacherId, ...extra })
      .select("id")
      .single(),
  );
  await exec(
    admin.from("class_staff").insert({ class_id: cls.id, staff_id: teacherId, role: "owner", added_by: teacherId }),
  );
  return { cls: { id: cls.id, name, ownerId: teacherId }, teacher, teacherId, schoolId };
}

/** Đăng ký tệp trình diễn như công cụ `audio:contest` làm (khóa secret local): tải lên bucket riêng rồi gọi hàm CSDL. */
async function register(w: World, id: string): Promise<{ versionId: string; key: string }> {
  const e = entry(id);
  const bytes = Buffer.from(wav(0.6, 8000));
  const versionId = randomUUID();
  const key = `${w.schoolId}/${versionId}.wav`;
  const up = await admin.storage.from(CONTEST_BUCKET).upload(key, bytes, { contentType: "audio/wav", upsert: false });
  if (up.error) throw up.error;
  const result = await admin.rpc("gateway_register_contest_audio", {
    p_school_id: w.schoolId,
    p_version_id: versionId,
    p_entry_id: e.id,
    p_spoken_text: e.text,
    p_content_hash: e.contentHash,
    p_asset_key: e.assetKey,
    p_config_version: CONTEST_VOICE.configVersion,
    p_risk_class: e.riskClass,
    p_risk_reasons: e.riskReasons.join(","),
    p_storage_key: key,
    p_mime_type: "audio/wav",
    p_size_bytes: bytes.byteLength,
    p_duration_ms: 600,
    p_content_sha256: createHash("sha256").update(bytes).digest("hex"),
    p_peak_milli: 800,
    p_rms_milli: 100,
  });
  if (result.error) throw new Error(result.error.message);
  return { versionId, key };
}

const tile = (page: Page, letter: string) => page.locator(`[data-letter="${letter}"]`);
const nameButton = (page: Page, letter: string) =>
  tile(page, letter).getByRole("button", { name: new RegExp(study.nameAria.replace("{letter}", letter), "u") });
const soundButton = (page: Page, letter: string) =>
  tile(page, letter).getByRole("button", { name: new RegExp(study.soundAria.replace("{letter}", letter), "u") });
const fileCalls = (requests: Request[]) =>
  requests.filter((r) =>
    /\/api\/student\/(learning-audio\/[^/?]+\/[^/?]+|question-instances\/[^/]+\/audio\/)/u.test(r.url()),
  );

async function pressAndObserve(page: Page, testInfo: TestInfo, path: string, press: () => Promise<void>) {
  if (testInfo.project.name.startsWith("chromium")) {
    const seen = page.waitForResponse((r) => r.url().includes(path));
    await press();
    const response = await seen;
    return { status: response.status(), headers: response.headers() };
  }
  await press();
  const response = await page.request.get(path);
  return { status: response.status(), headers: response.headers() };
}

type Question = {
  id: string;
  view: { variant: string; content: { sample: string; options: Array<{ id: string; text: string }> } };
};
const isSessionPost = (r: Response) =>
  /\/api\/student\/practice-sessions$/u.test(r.url()) && r.request().method() === "POST";

async function openPractice(page: Page): Promise<Question> {
  const opened = page.waitForResponse(isSessionPost);
  await page.goto("/learn/me/practice");
  const body = (await (await opened).json()) as { ok: boolean; data: { current: Question } };
  expect(body.ok).toBe(true);
  expect(body.data.current.view.variant).toBe("listen_letter");
  return body.data.current;
}

async function choose(page: Page, question: Question, text: string) {
  const index = question.view.content.options.findIndex((option) => option.text === text);
  expect(index).toBeGreaterThanOrEqual(0);
  const tileButton = page.getByRole("group", { name: /chữ/iu }).getByRole("button").nth(index);
  await expect(tileButton).toHaveText(text);
  await tileButton.click();
}

async function check(page: Page) {
  const attempt = page.waitForResponse((r) => r.url().includes("/attempts") && r.request().method() === "POST");
  await page.getByRole("button", { name: "Kiểm tra" }).click();
  expect((await attempt).status()).toBe(200);
}

test.beforeAll(async () => {
  const buckets = await admin.storage.listBuckets();
  if (!buckets.data?.some((bucket) => bucket.name === CONTEST_BUCKET)) {
    const created = await admin.storage.createBucket(CONTEST_BUCKET, { public: false });
    if (created.error) throw created.error;
  }
  setLocalContestAudio({ enabled: true, gate: true });
});

test.afterAll(() => {
  setLocalContestAudio({ enabled: false, gate: false });
});

test.describe("Học tập — chạm chữ nghe giọng máy trình diễn", () => {
  test("nói thật nguồn: 'Chế độ trình diễn'; mục chờ kiểm chứng bị giữ; chạm mới tải tệp; chạm chữ khác dừng chữ trước; tắt tiếng khóa mọi nút", async ({
    page,
  }, testInfo) => {
    test.setTimeout(180_000);
    const w = await world(false);
    const member = await newMember(w.cls, "Nghe", "extending");
    await register(w, "letter:b");
    await register(w, "phoneme:b");
    await register(w, "phoneme:gh"); // rủi ro cách đọc → bị giữ
    await link(page, member.backup);
    const requests: Request[] = [];
    page.on("request", (r) => requests.push(r));
    await page.goto("/learn/me/study");

    // Trạng thái nói đúng sự thật: giọng máy trình diễn, KHÔNG phải bản ghi của cô giáo; mục chờ kiểm chứng được nêu.
    const status = page.getByTestId("learning-audio-status");
    await expect(status).toContainText(contest.chip, { timeout: 20_000 });
    await expect(status).toContainText("giọng máy tạo sẵn");
    await expect(status).toContainText("chờ kiểm chứng cách đọc");
    await expect(page.getByRole("main")).not.toContainText(/Sắp có|Đang phát triển|Chưa kết nối/u);

    await expect(nameButton(page, "b")).toBeEnabled();
    await expect(soundButton(page, "b")).toBeEnabled();
    expect((await nameButton(page, "b").boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(63);
    // Chữ ghép gh: có tệp nhưng bị giữ vì cách đọc chưa kiểm chứng → khóa, nói đúng lý do (không phải 'Chưa có âm thanh').
    await expect(soundButton(page, "gh")).toBeDisabled();
    await expect(soundButton(page, "gh")).toContainText(contest.held);
    // Chữ chưa có tệp nào → khóa 'Chưa có âm thanh'.
    await expect(nameButton(page, "c")).toBeDisabled();
    await expect(nameButton(page, "c")).toContainText(audio.unavailable);
    expect(fileCalls(requests)).toHaveLength(0); // chưa chạm → chưa tải tệp, không tự phát

    const played = await pressAndObserve(page, testInfo, "/api/student/learning-audio/letter/b", () =>
      nameButton(page, "b").click(),
    );
    expect([200, 206]).toContain(played.status);
    expect(played.headers["content-type"]).toBe("audio/wav");
    expect(played.headers["cache-control"]).toBe("private, no-store");
    expect(played.headers["x-content-type-options"]).toBe("nosniff");

    // Mục bị giữ không phát được kể cả khi gọi thẳng API.
    const direct = await page.request.get(`/api/student/learning-audio/phoneme/gh?student=${member.id}`);
    expect(direct.status()).toBe(404);
    expect(await direct.json()).toEqual({ ok: false, code: "AUDIO_NOT_AVAILABLE" });

    // Tắt tiếng ngay trong màn: mọi nút nghe khóa với lý do, và không có yêu cầu tệp mới.
    const before = fileCalls(requests).length;
    await page.getByTestId("sound-mute").click();
    await expect(page.getByTestId("sound-mute")).toHaveAttribute("aria-pressed", "true");
    await expect(nameButton(page, "b")).toBeDisabled();
    await expect(nameButton(page, "b")).toContainText(audio.muted);
    expect(fileCalls(requests).length).toBe(before);
    await page.getByTestId("sound-mute").click();
    await expect(nameButton(page, "b")).toBeEnabled();

    await noHorizontalScroll(page);
    await axeClean(page);
    expect(await page.content()).not.toMatch(/contest-audio|storage_key|storageKey|\/storage\/v1|createSignedUrl/u);
  });

  test("thu hồi: sau khi thu hồi toàn bộ, nút báo nhẹ nhàng và API từ chối; tắt chế độ → trang không còn nhãn trình diễn", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    const w = await world(false);
    const member = await newMember(w.cls, "Thu", "extending");
    await register(w, "letter:b");
    await link(page, member.backup);
    await page.goto("/learn/me/study");
    await expect(nameButton(page, "b")).toBeEnabled({ timeout: 20_000 });

    const revoked = await admin.rpc("gateway_revoke_contest_audio", {
      p_school_id: w.schoolId,
      p_reason: "revoked_by_e2e",
    });
    expect(revoked.error).toBeNull();
    const path = `/api/student/learning-audio/letter/b?student=${member.id}`;
    const denied = await page.request.get(path);
    expect(denied.status()).toBe(404);
    expect(await denied.json()).toEqual({ ok: false, code: "AUDIO_NOT_AVAILABLE" });

    await register(w, "letter:b"); // đăng ký lại sau thu hồi được (bản mới)
    setLocalContestAudio({ enabled: false, gate: false });
    try {
      await page.reload();
      await expect(page.getByTestId("learning-audio-status")).not.toContainText(contest.chip, { timeout: 20_000 });
      await expect(nameButton(page, "b")).toBeDisabled();
      expect((await page.request.get(path)).status()).toBe(404);
    } finally {
      setLocalContestAudio({ enabled: true, gate: true });
    }
  });
});

test.describe("Bài luyện — câu hướng dẫn và lời nhắn bằng giọng máy trình diễn", () => {
  test("câu lệnh ở H2 phát được (ghi chú 'Giọng máy trình diễn'); sai → lời nhắn đúng trạng thái; đúng → lời khen; tắt tiếng khóa", async ({
    page,
  }, testInfo) => {
    test.setTimeout(240_000);
    const w = await world(true);
    const member = await newMember(w.cls, "Luyen", "developing"); // Nhóm 2 → H2
    await register(w, "instruction:listen_letter");
    for (const line of catalog.entries.filter((e) => e.kind === "feedback")) await register(w, line.id);
    await link(page, member.backup);
    const requests: Request[] = [];
    page.on("request", (r) => requests.push(r));

    const statusSeen = page.waitForResponse((r) => /\/question-instances\/[0-9a-f-]+\/audio$/u.test(r.url()));
    const question = await openPractice(page);
    const statusText = await (await statusSeen).text();
    expect(JSON.parse(statusText)).toMatchObject({
      ok: true,
      data: { muted: false, slots: { instruction: { mimeType: "audio/wav" } }, preview: ["instruction"] },
    });
    expect(statusText).not.toMatch(
      /contest-audio|storage|\.wav|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\//u,
    );

    const instruction = page.getByRole("button", { name: new RegExp(`^${audio.instruction}`, "u") });
    await expect(instruction).toBeEnabled({ timeout: 20_000 });
    await expect(page.getByText(contest.voiceNote).first()).toBeVisible();
    expect(fileCalls(requests)).toHaveLength(0);
    const played = await pressAndObserve(
      page,
      testInfo,
      `/api/student/question-instances/${question.id}/audio/instruction`,
      () => instruction.click(),
    );
    expect([200, 206]).toContain(played.status);
    expect(played.headers["content-type"]).toBe("audio/wav");

    // Lời nhắn chưa trả lời: máy chủ từ chối (không xin được lời nhắn/lời khen khi trạng thái câu không khớp).
    for (const ref of ["retry.sound", "correct_title_1", "reveal_title"]) {
      const early = await page.request.get(`/api/student/question-instances/${question.id}/audio/feedback?line=${ref}`);
      expect(early.status(), ref).toBe(403);
      expect(await early.json()).toEqual({ ok: false, code: "AUDIO_NOT_PERMITTED" });
    }
    expect((await page.request.get(`/api/student/question-instances/${question.id}/audio/feedback`)).status()).toBe(
      404,
    );
    expect(
      (await page.request.get(`/api/student/question-instances/${question.id}/audio/feedback?line=../x`)).status(),
    ).toBe(400);

    // Trả lời SAI → khung phản hồi có nút lời nhắn; phát đúng dòng "retry".
    const options = question.view.content.options;
    const wrong = options.find((option) => option.text !== question.view.content.sample)!.text;
    await choose(page, question, wrong);
    await check(page);
    const feedbackButton = page.getByRole("button", { name: new RegExp(`^${contest.feedbackButton}`, "u") });
    await expect(feedbackButton).toBeEnabled({ timeout: 20_000 });
    const retried = await pressAndObserve(
      page,
      testInfo,
      `/api/student/question-instances/${question.id}/audio/feedback?line=retry.sound`,
      () => feedbackButton.click(),
    );
    expect([200, 206]).toContain(retried.status);
    // Lời nhắn của lượt sai không phải lời khen: xin lời khen khi câu chưa đúng bị từ chối.
    const premature = await page.request.get(
      `/api/student/question-instances/${question.id}/audio/feedback?line=correct_title_1`,
    );
    expect(premature.status()).toBe(403);

    // Trả lời ĐÚNG → lời khen.
    await choose(page, question, question.view.content.sample);
    await check(page);
    const praise = page.getByRole("button", { name: new RegExp(`^${contest.feedbackButton}`, "u") });
    await expect(praise).toBeEnabled({ timeout: 20_000 });
    const praised = await pressAndObserve(
      page,
      testInfo,
      `/api/student/question-instances/${question.id}/audio/feedback?line=correct_title_1`,
      () => praise.click(),
    );
    expect([200, 206]).toContain(praised.status);
    // Sau khi đúng, lời nhắc "thử lại" không còn hợp trạng thái.
    expect(
      (
        await page.request.get(`/api/student/question-instances/${question.id}/audio/feedback?line=retry.sound`)
      ).status(),
    ).toBe(403);

    // Tắt tiếng: nút câu hướng dẫn và lời nhắn đều khóa.
    await page.getByTestId("sound-mute").click();
    await expect(instruction).toBeDisabled();
    await expect(instruction).toContainText(audio.muted);
    await noHorizontalScroll(page);
    await axeClean(page);
  });

  test("chính sách AD-35 giữ nguyên: ở H1 câu lệnh vẫn bị giữ dù có tệp trình diễn; mục chưa đăng ký → khóa 'Chưa có âm thanh'", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    const w = await world(true);
    await register(w, "instruction:listen_letter");
    const high = await newMember(w.cls, "Cao", "extending"); // Nhóm 1 → H1: câu lệnh chỉ qua Trợ giúp (chưa có đường ghi nhận)
    await link(page, high.backup);
    const statusSeen = page.waitForResponse((r) => /\/question-instances\/[0-9a-f-]+\/audio$/u.test(r.url()));
    const question = await openPractice(page);
    const status = JSON.parse(await (await statusSeen).text()) as {
      data: { slots: object; withheld?: string[]; preview?: string[] };
    };
    expect(status.data.slots).toEqual({});
    expect(status.data.withheld).toEqual(["instruction"]);
    expect(status.data.preview).toBeUndefined();
    const direct = await page.request.get(`/api/student/question-instances/${question.id}/audio/instruction`);
    expect(direct.status()).toBe(403);
    expect(await direct.json()).toEqual({ ok: false, code: "AUDIO_NOT_PERMITTED" });

    // Trường khác chưa đăng ký tệp → nút khóa ghi 'Chưa có âm thanh' (nói thật).
    const other = await world(true);
    const member = await newMember(other.cls, "Troi", "developing");
    const context = await page.context().browser()!.newContext({ locale: "vi-VN" });
    const second = await context.newPage();
    await link(second, member.backup);
    await openPractice(second);
    const button = second.getByRole("button", { name: new RegExp(`^${audio.instruction}`, "u") });
    await expect(button).toBeDisabled();
    await expect(button).toContainText(audio.unavailable);
    await context.close();
  });
});
