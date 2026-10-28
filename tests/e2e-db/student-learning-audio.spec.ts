import { expect, test, type Page, type Request, type TestInfo } from "@playwright/test";
import { type SupabaseClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";
import { vi } from "../../src/strings/vi";
import { approvedRecording, exec, freshTeacher, mustRow as must, rpc } from "./audio-fixtures";
import { admin, axeClean, link, newMember, noHorizontalScroll, type ClassRow } from "./class-fixtures";

/**
 * R10.4 — "Chữ có thể nghe" ở khu vực HỌC TẬP, trên Supabase local + Storage local. Bản ghi là SÓNG SIN TỔNG HỢP (không giọng
 * người thật). Mỗi kịch bản dựng trường/giáo viên/lớp/học sinh RIÊNG (dữ liệu hư cấu). Cờ phát âm thanh cho học sinh chỉ bật
 * trên local trong lúc chạy (global-setup bật, global-teardown trả về TẮT). Chỉ chạy qua GitHub Actions hoặc máy đủ RAM.
 *
 * Giới hạn trung thực: WebKit của Playwright (Linux/Windows) không cho quan sát yêu cầu do thẻ <audio> gửi và có thể thiếu
 * codec; ở đó hợp đồng HTTP được kiểm bằng `page.request` (cùng cookie phiên). Phát ra tiếng thật chưa kiểm trên iPhone/Android thật.
 */

const t = vi.studyAudio;
const slot = vi.practice.audio;

type World = { cls: ClassRow; teacher: SupabaseClient; schoolId: string; member: { id: string; backup: string } };

async function studyWorld(
  recordings: Array<[kind: "letter" | "phoneme", unit: string, label: string]> = [],
): Promise<World> {
  const hex = randomBytes(4).toString("hex");
  const { teacher, teacherId, schoolId } = await freshTeacher("hoc");
  const name = `Lớp học chữ ${hex}`;
  const cls = await must(
    admin
      .from("classes")
      .insert({ school_id: schoolId, name, school_year: "2026-2027", created_by: teacherId })
      .select("id")
      .single(),
  );
  await exec(
    admin.from("class_staff").insert({ class_id: cls.id, staff_id: teacherId, role: "owner", added_by: teacherId }),
  );
  const row: ClassRow = { id: cls.id, name, ownerId: teacherId };
  const member = await newMember(row, "Mầm", "extending");
  if (recordings.length > 0) await rpc(teacher, "teacher_grant_audio_consent", { p_notice_version: "v1" });
  for (const [index, [kind, unit, label]] of recordings.entries()) {
    await approvedRecording({ teacher, schoolId }, unit, label, index, kind);
  }
  return { cls: row, teacher, schoolId, member };
}

const tile = (page: Page, letter: string) => page.locator(`[data-letter="${letter}"]`);
const nameButton = (page: Page, letter: string) =>
  tile(page, letter).getByRole("button", { name: new RegExp(t.nameAria.replace("{letter}", letter), "u") });
const soundButton = (page: Page, letter: string) =>
  tile(page, letter).getByRole("button", { name: new RegExp(t.soundAria.replace("{letter}", letter), "u") });
const fileCalls = (requests: Request[]) =>
  requests.filter((r) => /\/api\/student\/learning-audio\/[^/?]+\/[^/?]+/u.test(r.url()));

/** Chạm nút rồi trả mã + tiêu đề của tệp âm thanh (Chromium: yêu cầu thật của thẻ audio; WebKit: page.request cùng phiên). */
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

async function openStudy(page: Page) {
  await page.goto("/learn/me");
  await page.getByRole("link", { name: t.entry.cta }).first().click();
  await expect(page).toHaveURL(/\/learn\/me\/study/u);
  await expect(page.getByRole("heading", { level: 1, name: t.title })).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { __speech: number; speechSynthesis?: { speak: () => void } };
    w.__speech = 0;
    if (w.speechSynthesis) w.speechSynthesis.speak = () => void (w.__speech += 1);
  });
});

test.describe("R10.4 — nghe cách đọc chữ khi học", () => {
  test("từ trang của con vào khu Học tập → Nghe cách đọc chữ; chưa có bản ghi: nút khóa, nói thật, không tải tệp, không Web Speech", async ({
    page,
  }) => {
    const world = await studyWorld();
    await link(page, world.member.backup);
    const requests: Request[] = [];
    page.on("request", (request) => requests.push(request));
    // Khu vực Học tập có thẻ riêng dẫn tới trang nghe chữ; không còn chữ "Sắp có".
    await expect(page.locator('[data-zone="learn"]').getByTestId("study-entry")).toBeVisible();
    await openStudy(page);

    // 29 chữ cái + 11 chữ ghép; mỗi chữ cái có nút "Tên chữ" (q không có "Âm"), chữ ghép chỉ có "Âm".
    await expect(page.locator("[data-letter]")).toHaveCount(40);
    await expect(nameButton(page, "b")).toBeVisible();
    await expect(soundButton(page, "b")).toBeVisible();
    await expect(tile(page, "q").getByRole("button")).toHaveCount(1);
    await expect(tile(page, "ngh").getByRole("button")).toHaveCount(1);
    await expect(page.getByTestId("learning-audio-status")).toHaveText(t.status.none);
    for (const button of await page.locator("[data-letter] button").all()) {
      await expect(button).toBeDisabled();
      await expect(button).toContainText(slot.unavailable);
    }
    expect(fileCalls(requests)).toHaveLength(0);
    expect(await page.evaluate(() => (window as unknown as { __speech: number }).__speech)).toBe(0);
    await expect(page.getByText(/Sắp có|dự kiến|đang được xây dựng/iu)).toHaveCount(0);
  });

  test("có bản ghi đã duyệt: TÊN CHỮ và ÂM là hai nút khác nhau; chạm mới tải tệp; một âm tại một thời điểm; nghe lại; chữ chưa thu vẫn khóa", async ({
    page,
  }, testInfo) => {
    const world = await studyWorld([
      ["letter", "b", "bê"],
      ["phoneme", "b", "bờ"],
      ["letter", "c", "xê"],
    ]);
    await link(page, world.member.backup);
    const requests: Request[] = [];
    page.on("request", (request) => requests.push(request));
    await openStudy(page);

    await expect(page.getByTestId("learning-audio-status")).toHaveText(t.status.some.replace("{n}", "3"));
    await expect(nameButton(page, "b")).toBeEnabled();
    await expect(soundButton(page, "b")).toBeEnabled();
    await expect(nameButton(page, "c")).toBeEnabled();
    await expect(soundButton(page, "c")).toHaveCount(1); // c có nút Âm nhưng chưa có bản ghi âm
    await expect(soundButton(page, "c")).toBeDisabled();
    await expect(soundButton(page, "c")).toContainText(slot.unavailable);
    await expect(nameButton(page, "d")).toBeDisabled();
    // KHÔNG tự phát và chưa tải tệp nào trước khi chạm.
    expect(fileCalls(requests)).toHaveLength(0);
    expect((await nameButton(page, "b").boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(63.5);

    // Tên chữ: đúng đường dẫn của TÊN CHỮ, tệp riêng tư.
    const studentParam = `?student=${world.member.id}`;
    const named = await pressAndObserve(page, testInfo, `/api/student/learning-audio/letter/b${studentParam}`, () =>
      nameButton(page, "b").click(),
    );
    expect(named.status).toBeLessThan(300);
    expect(named.headers["cache-control"]).toBe("private, no-store");
    expect(named.headers["content-type"]).toContain("audio/wav");
    expect(named.headers["x-content-type-options"]).toBe("nosniff");

    // Âm của chữ: đường dẫn KHÁC (loại phoneme); chạm tiếp thì âm trước dừng — chỉ một nút ở trạng thái bận.
    const sound = await pressAndObserve(page, testInfo, `/api/student/learning-audio/phoneme/b${studentParam}`, () =>
      soundButton(page, "b").click(),
    );
    expect(sound.status).toBeLessThan(300);
    const busy = await page
      .locator("[data-letter] button[data-audio-state='loading'], [data-letter] button[data-audio-state='playing']")
      .count();
    expect(busy).toBeLessThanOrEqual(1);

    // Mỗi lần chạm là một yêu cầu mới tới máy chủ (không bộ nhớ đệm) và chỉ có yêu cầu của tên chữ + âm của b.
    const urls = fileCalls(requests).map((r) => new URL(r.url()).pathname);
    if (testInfo.project.name.startsWith("chromium")) {
      expect(urls).toEqual(
        expect.arrayContaining(["/api/student/learning-audio/letter/b", "/api/student/learning-audio/phoneme/b"]),
      );
    }
    expect(urls.every((url) => /\/(letter|phoneme)\/[^/]+$/u.test(url))).toBe(true);

    // Không nơi nào gửi mã tài nguyên, đường dẫn lưu trữ hay URL Storage cho trình duyệt.
    const html = await page.content();
    expect(html).not.toMatch(/teacher-audio|storage\/v1|storage_key|storageKey|createSignedUrl/u);
    expect(await page.evaluate(() => (window as unknown as { __speech: number }).__speech)).toBe(0);
  });

  test("giáo viên thu hồi khi trang đang mở: lần nghe MỚI bị từ chối, nút báo nhẹ nhàng; API trả AUDIO_NOT_AVAILABLE", async ({
    page,
  }, testInfo) => {
    test.skip(
      !testInfo.project.name.startsWith("chromium"),
      "Quan sát yêu cầu <audio> chỉ ở Chromium; WebKit kiểm hợp đồng HTTP ở kịch bản kế.",
    );
    const world = await studyWorld([["letter", "b", "bê"]]);
    await link(page, world.member.backup);
    await openStudy(page);
    await expect(nameButton(page, "b")).toBeEnabled();

    const versions = await must(
      admin.from("audio_asset_versions").select("id").eq("school_id", world.schoolId).eq("status", "approved"),
    );
    expect(versions).toHaveLength(1);
    await rpc(world.teacher, "teacher_revoke_audio_version", {
      p_version_id: versions[0]!.id,
      p_reason: "Ghi lại giúp cô",
    });

    const path = `/api/student/learning-audio/letter/b?student=${world.member.id}`;
    const denied = page.waitForResponse((r) => r.url().includes(path));
    await nameButton(page, "b").click();
    expect((await denied).status()).toBe(404);
    await expect(page.getByText(slot.error)).toBeVisible();
    // Thân phản hồi kiểm bằng page.request riêng (Chromium không giữ thân của yêu cầu media).
    const body = await (await page.request.get(path)).json();
    expect(body).toEqual({ ok: false, code: "AUDIO_NOT_AVAILABLE" });
  });

  test("hợp đồng HTTP: loại/chữ ngoài danh mục, hồ sơ lạ, khác nguồn đều bị từ chối; không lộ lý do hay khóa lưu trữ", async ({
    page,
  }) => {
    const world = await studyWorld([["letter", "b", "bê"]]);
    await link(page, world.member.backup);
    const base = "/api/student/learning-audio";
    const ok = await page.request.get(`${base}/letter/b?student=${world.member.id}`);
    expect(ok.status()).toBe(200);
    expect(ok.headers()["cache-control"]).toBe("private, no-store");
    const range = await page.request.get(`${base}/letter/b?student=${world.member.id}`, {
      headers: { range: "bytes=0-9" },
    });
    expect(range.status()).toBe(206);
    expect(range.headers()["content-range"]).toMatch(/^bytes 0-9\//u);

    // Loại không có trong thư viện giáo viên (tiếng/từ/vần), chữ lạ → NOT_FOUND.
    for (const path of ["word/ba", "syllable/ba", "rime/an", "letter/zz", "phoneme/b%00"]) {
      const response = await page.request.get(`${base}/${path}?student=${world.member.id}`);
      expect(response.status(), path).toBe(404);
    }
    // Hồ sơ không thuộc thiết bị này: FORBIDDEN, không phân biệt "có" hay "không có" bản ghi.
    const other = await studyWorld([["letter", "b", "bê"]]);
    const stranger = await page.request.get(`${base}/letter/b?student=${other.member.id}`);
    expect(stranger.status()).toBe(403);
    expect(await stranger.json()).toEqual({ ok: false, code: "FORBIDDEN" });
    expect((await page.request.get(`${base}?student=${other.member.id}`)).status()).toBe(403);
    expect((await page.request.get(`${base}/letter/b`)).status()).toBe(404);
    // Khác nguồn (nhúng từ trang web khác): từ chối.
    const cross = await page.request.get(`${base}/letter/b?student=${world.member.id}`, {
      headers: { "sec-fetch-site": "cross-site" },
    });
    expect(cross.status()).toBe(403);
    // Danh sách trạng thái không chứa khóa lưu trữ/mã tài nguyên.
    const status = await page.request.get(`${base}?student=${world.member.id}`);
    expect(await status.json()).toEqual({
      ok: true,
      data: { muted: false, units: [{ kind: "letter", text: "b", mimeType: "audio/wav" }] },
    });
  });

  test("học sinh tắt âm thanh trong cài đặt: nút khóa với lý do, không gọi API tệp; người lớn bật lại thì nghe được", async ({
    page,
  }) => {
    const world = await studyWorld([["letter", "b", "bê"]]);
    await exec(admin.from("students").update({ sound_preference: "off" }).eq("id", world.member.id));
    await link(page, world.member.backup);
    const requests: Request[] = [];
    page.on("request", (request) => requests.push(request));
    await openStudy(page);
    await expect(page.getByTestId("learning-audio-status")).toHaveText(t.status.muted);
    await expect(nameButton(page, "b")).toBeDisabled();
    await expect(nameButton(page, "b")).toContainText(slot.muted);
    expect(fileCalls(requests)).toHaveLength(0);
    expect((await page.request.get(`/api/student/learning-audio/letter/b?student=${world.member.id}`)).status()).toBe(
      403,
    );

    await exec(admin.from("students").update({ sound_preference: "on" }).eq("id", world.member.id));
    await page.reload();
    await expect(nameButton(page, "b")).toBeEnabled();
  });

  test("màn hình hẹp 360 px + giảm chuyển động + bàn phím: không tràn ngang, vùng chạm ≥ 64 px, axe sạch", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium-desktop", "Đo bố cục một lần (chromium-desktop).");
    const world = await studyWorld([
      ["letter", "b", "bê"],
      ["phoneme", "b", "bờ"],
    ]);
    await page.setViewportSize({ width: 360, height: 780 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await link(page, world.member.backup);
    await openStudy(page);
    await expect(nameButton(page, "b")).toBeEnabled();
    await noHorizontalScroll(page);
    for (const button of [nameButton(page, "b"), soundButton(page, "b"), nameButton(page, "c")]) {
      expect((await button.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(63.5);
    }
    // Bàn phím: Shift+Tab rồi Tab đưa tiêu điểm trở lại nút (chế độ focus-visible) — vòng focus phải thấy rõ.
    await nameButton(page, "b").focus();
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Tab");
    await expect(nameButton(page, "b")).toBeFocused();
    const outline = await nameButton(page, "b").evaluate((element) => getComputedStyle(element).outlineStyle);
    expect(outline).not.toBe("none");
    await axeClean(page);
  });
});
