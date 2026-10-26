import { execSync } from "node:child_process";
import AxeBuilder from "@axe-core/playwright";
import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";
import { vi } from "../../src/strings/vi";
import { wav } from "../unit/audio-library/fixtures";

/**
 * R10.2 — /teacher/audio trên Supabase local + Storage local: ghi âm/tải tệp → bản nháp → gửi duyệt → nghe → duyệt /
 * yêu cầu ghi lại; quyền micro chỉ ở trang này; chặn người chưa đăng nhập. Tệp âm thanh là SÓNG SIN TỔNG HỢP (không giọng
 * người thật), cờ hệ thống ghi âm bật chỉ trên local trong lúc chạy (global-setup/teardown). Chỉ chạy qua GitHub Actions
 * hoặc máy đủ RAM (cần Docker + Storage: `npm run db:start`).
 */

process.loadEnvFile?.(".env.local");
const PASSWORD = process.env.SEED_TEACHER_PASSWORD ?? "";
const TEACHER = ["co.mai", ["readmate", "test"].join(".")].join("@");
const t = vi.audioStudio;

const status = JSON.parse(
  (() => {
    const raw = execSync("npx supabase status -o json", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    return raw.slice(raw.indexOf("{"));
  })(),
) as Record<string, string>;
const admin = createClient(status.API_URL!, status.SECRET_KEY!, { auth: { persistSession: false } });

// Mỗi project dùng đơn vị riêng để chạy lại trên cùng CSDL không đụng nhau.
const UNIT_BY_PROJECT: Record<string, { approve: string; reject: string }> = {
  "chromium-desktop": { approve: "b", reject: "g" },
  "chromium-mobile": { approve: "c", reject: "h" },
  "webkit-mobile": { approve: "d", reject: "k" },
};

async function login(page: Page) {
  await admin.from("rate_limit_buckets").delete().neq("key_hash", "");
  await page.goto("/login");
  await page.getByLabel("Email").fill(TEACHER);
  await page.getByLabel("Mật khẩu").fill(PASSWORD);
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  await page.waitForURL(/\/teacher$/u);
}

/** Sóng sin riêng cho mỗi lần chạy (độ dài khác nhau → hash khác, không đụng DUPLICATE_AUDIO khi chạy lại). */
const uniqueWav = () => Buffer.from(wav(0.5 + Math.random() * 0.4, 8000));

async function versionsOf(unit: string) {
  const asset = await admin.from("audio_assets").select("id").eq("unit_text", unit).eq("unit_kind", "phoneme");
  const ids = (asset.data ?? []).map((a) => a.id);
  const rows = await admin
    .from("audio_asset_versions")
    .select("id, status, version_no, storage_key, review_listened, reviewed_by, review_note")
    .in("asset_id", ids)
    .order("version_no");
  return rows.data ?? [];
}

async function openUnit(page: Page, unit: string) {
  await page.getByRole("button", { name: t.unit.openLabel.replace("{unit}", unit) }).click();
}

async function uploadFile(page: Page) {
  await page
    .locator('input[type="file"]')
    .setInputFiles({ name: "thu.wav", mimeType: "audio/wav", buffer: uniqueWav() });
  await page.getByRole("button", { name: t.upload.save }).click();
  await expect(page.getByText(t.upload.saved)).toBeVisible({ timeout: 20_000 });
}

test.describe("chưa đăng nhập", () => {
  test("/teacher/audio chuyển về đăng nhập; API tải lên/nghe trả 401, không lộ gì", async ({ page, request }) => {
    await page.goto("/teacher/audio");
    await expect(page).toHaveURL(/\/login/u);
    const upload = await request.post("/api/teacher/audio/versions", {
      multipart: {
        unitKind: "phoneme",
        unitText: "b",
        file: { name: "a.wav", mimeType: "audio/wav", buffer: uniqueWav() },
      },
    });
    expect(upload.status()).toBe(401);
    const listen = await request.get("/api/teacher/audio/versions/00000000-0000-4000-8000-000000000000/audio");
    expect(listen.status()).toBe(401);
  });
});

test.describe("giáo viên", () => {
  test("danh sách P0, micro chỉ ở trang này, ghi âm → duyệt, yêu cầu ghi lại, bất biến, trợ năng", async ({
    page,
    request,
  }, testInfo) => {
    const units = UNIT_BY_PROJECT[testInfo.project.name];
    test.skip(!units, "Kiểm tra luồng ghi âm chạy ở ba project trình duyệt chính.");
    const { approve, reject } = units!;
    await login(page);

    // Micro: chỉ /teacher/audio được microphone=(self); các trang khác vẫn tắt.
    const teacherHome = await page.request.get("/teacher");
    expect(teacherHome.headers()["permissions-policy"]).toContain("microphone=()");
    const response = await page.goto("/teacher/audio");
    expect(response?.headers()["permissions-policy"]).toContain("microphone=(self)");
    expect(response?.headers()["permissions-policy"]).toContain("camera=()");
    for (const path of ["/learn", "/demo", "/join", "/"]) {
      const other = await page.request.get(path);
      expect(other.headers()["permissions-policy"], path).toContain("microphone=()");
      expect(other.headers()["permissions-policy"], path).not.toContain("microphone=(self)");
    }

    await expect(page.getByRole("heading", { level: 1, name: t.title })).toBeVisible();
    await expect(page.locator("li[data-unit]")).toHaveCount(38);
    await expect(page.getByText(t.unit.awaitingConfirm).first()).toBeVisible();
    await expect(page.getByText(t.notice.trialTitle)).toBeVisible();

    // Đồng ý dùng giọng (ô không chọn sẵn).
    const consentBox = page.getByRole("checkbox", { name: t.consent.checkbox });
    if (await consentBox.isVisible()) {
      await expect(consentBox).not.toBeChecked();
      await consentBox.check();
      await page.getByRole("button", { name: t.consent.grant }).click();
      await expect(page.getByText(t.consent.active).first()).toBeVisible({ timeout: 20_000 });
    }

    // --- Luồng duyệt ---
    await openUnit(page, approve);
    await page.getByRole("button", { name: t.pronunciation.confirm }).click();
    await expect(page.getByText(t.pronunciation.saved)).toBeVisible({ timeout: 20_000 });
    await uploadFile(page);
    await expect.poll(async () => (await versionsOf(approve)).at(-1)?.status, { timeout: 15_000 }).toBe("draft");

    await page.getByRole("button", { name: t.versions.submit }).click();
    await expect
      .poll(async () => (await versionsOf(approve)).at(-1)?.status, { timeout: 15_000 })
      .toBe("pending_review");

    // Bản đã gửi duyệt: không còn nút gửi/bỏ; chưa nghe thì chưa tích "đã nghe" được; chưa nghe không duyệt được.
    const approveButton = page.getByRole("button", { name: t.review.approve, exact: true });
    await expect(approveButton).toBeDisabled();
    const listened = page.getByRole("checkbox", { name: t.review.listenedCheck });
    await expect(listened).toBeDisabled();

    // Tệp nghe lại qua proxy (có Range cho Safari), riêng tư.
    const row = (await versionsOf(approve)).at(-1)!;
    const stream = await page.request.get(`/api/teacher/audio/versions/${row.id}/audio`);
    expect(stream.status()).toBe(200);
    expect(stream.headers()["content-type"]).toBe("audio/wav");
    expect(stream.headers()["cache-control"]).toContain("no-store");
    expect(stream.headers()["x-content-type-options"]).toBe("nosniff");
    const ranged = await page.request.get(`/api/teacher/audio/versions/${row.id}/audio`, {
      headers: { Range: "bytes=0-9" },
    });
    expect(ranged.status()).toBe(206);
    expect((await ranged.body()).byteLength).toBe(10);
    expect((await request.get(`/api/teacher/audio/versions/${row.id}/audio`)).status()).toBe(401);
    const publicUrl = `${status.API_URL}/storage/v1/object/public/teacher-audio/${row.storage_key}`;
    expect((await fetch(publicUrl)).ok).toBe(false);

    // Nghe (sự kiện 'playing' của thẻ <audio>) → tích đã nghe → duyệt.
    await page
      .locator("li audio")
      .first()
      .evaluate((el) => el.dispatchEvent(new Event("playing")));
    await expect(listened).toBeEnabled();
    await listened.check();
    await expect(approveButton).toBeEnabled();
    await approveButton.click();
    await expect.poll(async () => (await versionsOf(approve)).at(-1)?.status, { timeout: 15_000 }).toBe("approved");
    const approved = (await versionsOf(approve)).at(-1)!;
    expect(approved.review_listened).toBe(true);
    expect(approved.reviewed_by).not.toBeNull();
    // Bất biến: không đổi được tệp của bản đã duyệt, kể cả bằng khóa dịch vụ.
    const tamper = await admin
      .from("audio_asset_versions")
      .update({ storage_key: `${approved.storage_key}.x` })
      .eq("id", approved.id);
    expect(tamper.error?.message).toContain("AUDIO_VERSION_IMMUTABLE");

    // --- Luồng yêu cầu ghi lại ---
    await page.getByRole("button", { name: t.unit.openLabel.replace("{unit}", approve) }).click(); // đóng
    await openUnit(page, reject);
    await page.getByRole("button", { name: t.pronunciation.confirm }).click();
    await expect(page.getByText(t.pronunciation.saved)).toBeVisible({ timeout: 20_000 });
    await uploadFile(page);
    await page.getByRole("button", { name: t.versions.submit }).click();
    await expect
      .poll(async () => (await versionsOf(reject)).at(-1)?.status, { timeout: 15_000 })
      .toBe("pending_review");
    await page.getByLabel(t.review.note).fill("Có tiếng ồn, hãy ghi lại");
    await page.getByRole("button", { name: t.review.reject }).click();
    await expect.poll(async () => (await versionsOf(reject)).at(-1)?.status, { timeout: 15_000 }).toBe("rejected");
    const rejected = (await versionsOf(reject)).at(-1)!;
    expect(rejected.review_note).toBe("Có tiếng ồn, hãy ghi lại");
    await expect(page.getByText(t.state.rerecord).first()).toBeVisible();

    // Ghi lại → phiên bản mới; bản cũ giữ nguyên.
    await uploadFile(page);
    await expect.poll(async () => (await versionsOf(reject)).length, { timeout: 15_000 }).toBeGreaterThanOrEqual(2);
    const after = await versionsOf(reject);
    expect(after.find((v) => v.id === rejected.id)?.status).toBe("rejected");
    expect(after.at(-1)?.status).toBe("draft");
    expect(after.at(-1)?.version_no).toBe(rejected.version_no + 1);

    // Bản đã duyệt vẫn là bản đang dùng của đơn vị đầu.
    const asset = await admin.from("audio_assets").select("active_version_id").eq("unit_text", approve).single();
    expect(asset.data?.active_version_id).toBe(approved.id);

    // Trợ năng và không tràn ngang.
    const axe = await new AxeBuilder({ page }).analyze();
    expect(
      axe.violations.filter((v) => v.impact === "critical" || v.impact === "serious").map((v) => `${v.id}: ${v.help}`),
    ).toEqual([]);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });

  test("tệp giả MIME bị từ chối với câu chữ dễ hiểu và không tạo bản ghi", async ({ page }, testInfo) => {
    const units = UNIT_BY_PROJECT[testInfo.project.name];
    test.skip(!units, "Chạy ở ba project trình duyệt chính.");
    await login(page);
    await page.goto("/teacher/audio");
    const unit = units!.reject;
    const before = (await versionsOf(unit)).length;
    await openUnit(page, unit);
    await page.locator('input[type="file"]').setInputFiles({
      name: "gia.mp3",
      mimeType: "audio/mpeg",
      buffer: Buffer.from("<html><body>không phải âm thanh</body></html>"),
    });
    await page.getByRole("button", { name: t.upload.save }).click();
    await expect(page.getByRole("alert").filter({ hasText: vi.errors.AUDIO_UNSUPPORTED })).toBeVisible({
      timeout: 20_000,
    });
    expect((await versionsOf(unit)).length).toBe(before);
  });
});
