import { expect, test, type Page, type Request, type Response, type TestInfo } from "@playwright/test";
import { type SupabaseClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";
import { installAudioFixtures } from "../../scripts/lib/audio-fixtures";
import { enableLocalTestFixtures } from "../../scripts/lib/test-fixtures";
import { vi } from "../../src/strings/vi";
import { exec, freshTeacher, mustRow as must, rpc, ttsLine } from "./audio-fixtures";
import { admin, axeClean, link, newMember, noHorizontalScroll, type ClassRow } from "./class-fixtures";

/**
 * R10.5 — học sinh nghe CÂU LỆNH bằng giọng máy ĐÃ DUYỆT trong buổi luyện, trên Supabase local + Storage local. Tệp là SÓNG SIN TỔNG HỢP
 * (không phải giọng của nhà cung cấp nào) đã đi qua đúng các hàm teacher_*; KHÔNG có yêu cầu nào tới dịch vụ giọng máy. Mỗi kịch bản dựng
 * trường/giáo viên/lớp RIÊNG (dữ liệu hư cấu). Cờ phát giọng máy chỉ bật trên local trong lúc chạy (global-setup bật, global-teardown trả TẮT).
 * Mức hỗ trợ theo nhóm: Nhóm 3 (`foundation`) → H3, Nhóm 2 (`developing`) → H2, Nhóm 1 (`extending`) → H1.
 */

const t = vi.practice.audio;
const INSTRUCTION = "instruction:listen_letter";

type World = { cls: ClassRow; teacher: SupabaseClient; teacherId: string; schoolId: string };

async function ttsWorld(): Promise<World> {
  const hex = randomBytes(4).toString("hex");
  const { teacher, teacherId, schoolId } = await freshTeacher("tts");
  enableLocalTestFixtures();
  const fx = await installAudioFixtures(admin, teacherId);
  const now = new Date().toISOString();
  const name = `Lớp giọng máy ${hex}`;
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
  return { cls: { id: cls.id, name, ownerId: teacherId }, teacher, teacherId, schoolId };
}

type Question = { id: string; view: { variant: string } };

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

const instructionButton = (page: Page) => page.getByRole("button", { name: new RegExp(`^${t.instruction}`, "u") });
const instructionCalls = (requests: Request[]) => requests.filter((r) => /\/audio\/instruction$/u.test(r.url()));

/** Chromium: yêu cầu thật của thẻ <audio>. WebKit của Playwright không cho quan sát yêu cầu media → kiểm hợp đồng HTTP bằng page.request cùng phiên. */
async function pressAndObserve(page: Page, testInfo: TestInfo, path: string, press: () => Promise<void>) {
  if (testInfo.project.name.startsWith("chromium")) {
    const seen = page.waitForResponse((r) => r.url().endsWith(path));
    await press();
    const response = await seen;
    return { status: response.status(), headers: response.headers() };
  }
  await press();
  const response = await page.request.get(path);
  return { status: response.status(), headers: response.headers() };
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { __speech: number; speechSynthesis?: { speak: () => void } };
    w.__speech = 0;
    if (w.speechSynthesis) w.speechSynthesis.speak = () => void (w.__speech += 1);
  });
});

test.describe("R10.5 — câu lệnh bằng giọng máy đã duyệt", () => {
  test("chưa có tệp đã duyệt: nút khóa 'Chưa có âm thanh' (không giả lập); có tệp đã duyệt: nút ≥ 64 px, không tự phát, chạm mới tải tệp riêng tư", async ({
    page,
  }, testInfo) => {
    test.setTimeout(180_000);
    const world = await ttsWorld();
    const member = await newMember(world.cls, "Lệnh", "developing"); // Nhóm 2 → H2: câu lệnh được phát khi trẻ chạm
    await link(page, member.backup);
    const requests: Request[] = [];
    page.on("request", (r) => requests.push(r));

    const question = await openPractice(page);
    // Chưa có tệp đã duyệt → nút khóa ghi rõ, nói thật; không yêu cầu tệp nào.
    await expect(instructionButton(page)).toBeDisabled();
    await expect(instructionButton(page)).toContainText(t.unavailable);
    expect(instructionCalls(requests)).toHaveLength(0);

    // Giáo viên duyệt lời đọc + nghe và duyệt tệp → mở lại trang: nút phát được.
    await ttsLine(world, INSTRUCTION);
    const statusSeen = page.waitForResponse((r) => /\/question-instances\/[0-9a-f-]+\/audio$/u.test(r.url()));
    await page.reload();
    const statusText = await (await statusSeen).text();
    expect(JSON.parse(statusText)).toMatchObject({
      ok: true,
      data: { muted: false, slots: { instruction: { mimeType: "audio/wav" } } },
    });
    expect(statusText).not.toMatch(
      /tts-audio|storage|\.wav|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\//u,
    );

    await expect(instructionButton(page)).toBeEnabled({ timeout: 20_000 });
    expect((await instructionButton(page).boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(63);
    expect(instructionCalls(requests)).toHaveLength(0); // chưa chạm → chưa tải tệp, không tự phát

    const played = await pressAndObserve(
      page,
      testInfo,
      `/api/student/question-instances/${question.id}/audio/instruction`,
      () => instructionButton(page).click(),
    );
    expect([200, 206]).toContain(played.status);
    expect(played.headers["content-type"]).toBe("audio/wav");
    expect(played.headers["cache-control"]).toBe("private, no-store");
    expect(played.headers["x-content-type-options"]).toBe("nosniff");

    // Không lộ khóa lưu trữ/URL công khai, không gọi dịch vụ giọng máy từ trình duyệt, không Web Speech.
    expect(await page.content()).not.toMatch(/tts-audio|storage_key|storageKey|\/storage\/v1|createSignedUrl/u);
    expect(
      requests.filter((r) => /viettel|texttospeech|speech_synthesis|\/storage\/v1\//iu.test(r.url())),
    ).toHaveLength(0);
    expect(await page.evaluate(() => (window as unknown as { __speech: number }).__speech)).toBe(0);
    await noHorizontalScroll(page);
    await axeClean(page);
  });

  test("câu lệnh ở H1/H0 bị chính sách giữ lại: không vẽ nút (không phải 'chưa có'); API trả AUDIO_NOT_PERMITTED; trạng thái ghi withheld", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    const world = await ttsWorld();
    await ttsLine(world, INSTRUCTION);
    const member = await newMember(world.cls, "Cao", "extending"); // Nhóm 1 → H1: câu lệnh chỉ qua Trợ giúp (chưa có đường ghi nhận)
    await link(page, member.backup);
    const requests: Request[] = [];
    page.on("request", (r) => requests.push(r));
    const statusSeen = page.waitForResponse((r) => /\/question-instances\/[0-9a-f-]+\/audio$/u.test(r.url()));
    const question = await openPractice(page);
    const status = JSON.parse(await (await statusSeen).text()) as {
      ok: boolean;
      data: { slots: object; withheld?: string[] };
    };
    expect(status.data.slots).toEqual({});
    expect(status.data.withheld).toEqual(["instruction"]);
    await expect(page.getByText(t.instruction)).toHaveCount(0);
    expect(instructionCalls(requests)).toHaveLength(0);

    const direct = await page.request.get(`/api/student/question-instances/${question.id}/audio/instruction`);
    expect(direct.status()).toBe(403);
    expect(await direct.json()).toEqual({ ok: false, code: "AUDIO_NOT_PERMITTED" });
  });

  test("chữ/giọng đã đổi (tệp lỗi thời), giáo viên rút duyệt lời đọc, giáo viên thu hồi tệp, trường khác: đều KHÔNG phát", async ({
    page,
    browser,
  }, testInfo) => {
    test.skip(
      !testInfo.project.name.startsWith("chromium"),
      "Quan sát yêu cầu <audio> chỉ ở Chromium; hợp đồng HTTP kiểm ở kịch bản khác.",
    );
    test.setTimeout(240_000);
    // (a) tệp lỗi thời: duyệt được nhưng khóa tệp không khớp cấu hình hiện hành.
    const stale = await ttsWorld();
    await ttsLine(stale, INSTRUCTION, { assetKey: "a".repeat(64) });
    const staleMember = await newMember(stale.cls, "Cu", "developing");
    await link(page, staleMember.backup);
    await openPractice(page);
    await expect(instructionButton(page)).toBeDisabled();
    await expect(instructionButton(page)).toContainText(t.unavailable);

    // (b) trường khác có tệp đã duyệt nhưng học sinh này ở trường không có → không phát.
    const other = await ttsWorld();
    await ttsLine(other, INSTRUCTION);
    await page.reload();
    await expect(instructionButton(page)).toBeDisabled();

    // (c) rút duyệt / thu hồi khi trang đang mở: lần nghe MỚI bị từ chối, nút báo nhẹ nhàng.
    const live = await ttsWorld();
    const line = await ttsLine(live, INSTRUCTION);
    const member = await newMember(live.cls, "Moi", "developing");
    const context = await browser.newContext({ locale: "vi-VN" });
    const second = await context.newPage();
    await link(second, member.backup);
    const question = await openPractice(second);
    await expect(instructionButton(second)).toBeEnabled({ timeout: 20_000 });
    await rpc(live.teacher, "teacher_revoke_tts_version", {
      p_version_id: line.versionId,
      p_reason: "Phát âm chưa đúng",
    });
    const path = `/api/student/question-instances/${question.id}/audio/instruction`;
    const denied = second.waitForResponse((r) => r.url().endsWith(path));
    await instructionButton(second).click();
    expect((await denied).status()).toBe(404);
    await expect(second.getByText(t.error)).toBeVisible();
    expect(await (await second.request.get(path)).json()).toEqual({ ok: false, code: "AUDIO_NOT_AVAILABLE" });
    await context.close();
  });

  test("học sinh tắt âm thanh: trạng thái muted, nút khóa với lý do, không gọi tệp", async ({ page }) => {
    test.setTimeout(180_000);
    const world = await ttsWorld();
    await ttsLine(world, INSTRUCTION);
    const member = await newMember(world.cls, "Tat", "developing");
    await exec(admin.from("students").update({ sound_preference: "off" }).eq("id", member.id));
    await link(page, member.backup);
    const requests: Request[] = [];
    page.on("request", (r) => requests.push(r));
    await openPractice(page);
    await expect(instructionButton(page)).toBeDisabled();
    await expect(instructionButton(page)).toContainText(t.muted);
    expect(instructionCalls(requests)).toHaveLength(0);
  });
});
