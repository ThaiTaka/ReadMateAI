import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { vi } from "../../src/strings/vi";
import { wav } from "../unit/audio-library/fixtures";
import { approvedRecording, freshTeacher, mustRow, rpc, type TeacherWorld } from "./audio-fixtures";
import { admin, API_URL } from "./class-fixtures";

/**
 * R10.2 — /teacher/audio trên Supabase local + Storage local: ghi âm/tải tệp → bản nháp → gửi duyệt → nghe → duyệt /
 * yêu cầu ghi lại; quyền micro chỉ ở trang này; chặn người chưa đăng nhập. Tệp âm thanh là SÓNG SIN TỔNG HỢP (không giọng
 * người thật), cờ hệ thống ghi âm bật chỉ trên local trong lúc chạy (global-setup/teardown). Chỉ chạy qua GitHub Actions
 * hoặc máy đủ RAM (cần Docker + Storage: `npm run db:start`).
 *
 * Cách ly dữ liệu: MỖI kịch bản dùng một trường + giáo viên hư cấu RIÊNG và chỉ đọc/ghi asset của trường đó, theo đúng
 * `asset_id`/`version_id` mà kịch bản tạo ra. Asset trùng `unit_text` ở trường khác (do student-audio.spec hay lần chạy
 * trước để lại, đã duyệt hoặc đã thu hồi) không bao giờ được coi là "bản mới nhất" — kịch bản chính còn gieo sẵn các bản
 * như vậy ở trường khác để chứng minh điều đó.
 */

const t = vi.audioStudio;

// Cùng đơn vị ở mọi project: an toàn vì mỗi kịch bản có trường riêng.
const APPROVE_UNIT = "b";
const REJECT_UNIT = "g";
const LABELS: Record<string, string> = { b: "bờ", g: "gờ" };

async function login(page: Page, world: TeacherWorld) {
  await admin.from("rate_limit_buckets").delete().neq("key_hash", "");
  await page.goto("/login");
  await page.getByLabel("Email").fill(world.email);
  await page.getByLabel("Mật khẩu").fill(world.password);
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  await page.waitForURL(/\/teacher$/u);
}

/** Sóng sin riêng cho mỗi lần chạy (độ dài khác nhau → hash khác, không đụng DUPLICATE_AUDIO khi chạy lại). */
const uniqueWav = () => Buffer.from(wav(0.5 + Math.random() * 0.4, 8000));

const VERSION_COLUMNS = "id, asset_id, status, version_no, storage_key, review_listened, reviewed_by, review_note";

type VersionRow = {
  id: string;
  asset_id: string;
  status: string;
  version_no: number;
  storage_key: string;
  review_listened: boolean;
  reviewed_by: string | null;
  review_note: string | null;
};

/** Asset của ĐÚNG trường + đơn vị (ràng buộc unique (school_id, unit_kind, unit_text)); chưa có thì null. */
async function assetIdOf(schoolId: string, unit: string): Promise<string | null> {
  const found = await admin
    .from("audio_assets")
    .select("id")
    .eq("school_id", schoolId)
    .eq("unit_kind", "phoneme")
    .eq("unit_text", unit)
    .maybeSingle();
  if (found.error) throw new Error(JSON.stringify(found.error));
  return found.data?.id ?? null;
}

/** Mọi phiên bản của đơn vị trong ĐÚNG trường, theo version_no. Trường khác không bao giờ lọt vào. */
async function versionsOf(schoolId: string, unit: string): Promise<VersionRow[]> {
  const assetId = await assetIdOf(schoolId, unit);
  if (!assetId) return [];
  const rows = await admin
    .from("audio_asset_versions")
    .select(VERSION_COLUMNS)
    .eq("asset_id", assetId)
    .order("version_no");
  if (rows.error) throw new Error(JSON.stringify(rows.error));
  return rows.data ?? [];
}

const rowOf = async (versionId: string): Promise<VersionRow> =>
  mustRow(admin.from("audio_asset_versions").select(VERSION_COLUMNS).eq("id", versionId).single());
const statusOf = async (versionId: string) => (await rowOf(versionId)).status;

/** Phiên bản vừa tải lên: đợi đúng `count` bản của CHÍNH asset trong trường này rồi lấy bản cuối. */
async function newestAfterUpload(schoolId: string, unit: string, count: number): Promise<VersionRow> {
  await expect.poll(async () => (await versionsOf(schoolId, unit)).length, { timeout: 15_000 }).toBe(count);
  return (await versionsOf(schoolId, unit)).at(-1)!;
}

/**
 * Gieo "dữ liệu độc": trường khác cũng có bản ghi của `units` — một trường đã duyệt (còn dùng), một trường đã duyệt rồi
 * thu hồi. Đúng tình huống từng làm kịch bản chọn nhầm bản của trường khác (nhận "approved"/"revoked" thay vì "draft").
 */
async function seedOtherSchools(units: string[]) {
  const seeded: Array<{ versionId: string; expected: string }> = [];
  const active = await freshTeacher("khac-duyet");
  await rpc(active.teacher, "teacher_grant_audio_consent", { p_notice_version: "v1" });
  const revoked = await freshTeacher("khac-thuhoi");
  await rpc(revoked.teacher, "teacher_grant_audio_consent", { p_notice_version: "v1" });
  for (const [index, unit] of units.entries()) {
    seeded.push({ versionId: await approvedRecording(active, unit, LABELS[unit]!, index), expected: "approved" });
    const gone = await approvedRecording(revoked, unit, LABELS[unit]!, index);
    await rpc(revoked.teacher, "teacher_revoke_audio_version", { p_version_id: gone, p_reason: "Gieo dữ liệu độc" });
    seeded.push({ versionId: gone, expected: "revoked" });
  }
  return seeded;
}

async function openUnit(page: Page, unit: string) {
  // exact: tên "g" không được khớp lẫn "gh", "gi".
  await page.getByRole("button", { name: t.unit.openLabel.replace("{unit}", unit), exact: true }).click();
}

/** Đợi giao diện nhận tệp đã chọn (React xử lý onChange) rồi mới bấm lưu — tránh bấm khi nút chưa được dựng/bật (WebKit mobile). */
async function clickUploadSave(page: Page) {
  await expect(page.getByText("Đã chọn tệp (")).toBeVisible({ timeout: 15_000 });
  const save = page.getByRole("button", { name: t.upload.save, exact: true });
  await save.scrollIntoViewIfNeeded();
  await expect(save).toBeEnabled();
  await save.click();
}

async function uploadFile(page: Page) {
  await page
    .locator('input[type="file"]')
    .setInputFiles({ name: "thu.wav", mimeType: "audio/wav", buffer: uniqueWav() });
  await clickUploadSave(page);
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
  test("danh sách P0, micro chỉ ở trang này, ghi âm → duyệt, yêu cầu ghi lại, bất biến, cách ly trường, trợ năng", async ({
    page,
    request,
  }) => {
    test.setTimeout(180_000);
    const approve = APPROVE_UNIT;
    const reject = REJECT_UNIT;
    // Trường khác đã có bản `b`/`g` (đã duyệt, đã thu hồi) TRƯỚC khi kịch bản bắt đầu.
    const others = await seedOtherSchools([approve, reject]);
    const world = await freshTeacher("ghiam");
    const school = world.schoolId;
    await login(page, world);

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

    // Trường mới: chưa có bản nào của `b`/`g` dù trường khác đã có.
    expect(await versionsOf(school, approve)).toEqual([]);
    expect(await versionsOf(school, reject)).toEqual([]);

    // Đồng ý dùng giọng (ô không chọn sẵn).
    const consentBox = page.getByRole("checkbox", { name: t.consent.checkbox });
    await expect(consentBox).toBeVisible();
    await expect(consentBox).not.toBeChecked();
    await consentBox.check();
    await page.getByRole("button", { name: t.consent.grant }).click();
    await expect(page.getByText(t.consent.active).first()).toBeVisible({ timeout: 20_000 });

    // --- Luồng duyệt ---
    await openUnit(page, approve);
    await page.getByRole("button", { name: t.pronunciation.confirm }).click();
    await expect(page.getByText(t.pronunciation.saved)).toBeVisible({ timeout: 20_000 });
    await uploadFile(page);
    const draft = await newestAfterUpload(school, approve, 1);
    expect(draft.status).toBe("draft");
    expect(draft.version_no).toBe(1);
    const approveAsset = draft.asset_id;
    expect(approveAsset).toBe(await assetIdOf(school, approve));

    await page.getByRole("button", { name: t.versions.submit }).click();
    await expect.poll(() => statusOf(draft.id), { timeout: 15_000 }).toBe("pending_review");

    // Bản đã gửi duyệt: không còn nút gửi/bỏ; chưa nghe thì chưa tích "đã nghe" được; chưa nghe không duyệt được.
    const approveButton = page.getByRole("button", { name: t.review.approve, exact: true });
    await expect(approveButton).toBeDisabled();
    const listened = page.getByRole("checkbox", { name: t.review.listenedCheck });
    await expect(listened).toBeDisabled();

    // Tệp nghe lại qua proxy (có Range cho Safari), riêng tư.
    const row = await rowOf(draft.id);
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
    const publicUrl = `${API_URL}/storage/v1/object/public/teacher-audio/${row.storage_key}`;
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
    await expect.poll(() => statusOf(draft.id), { timeout: 15_000 }).toBe("approved");
    const approved = await rowOf(draft.id);
    expect(approved.review_listened).toBe(true);
    expect(approved.reviewed_by).not.toBeNull();
    // Bất biến: không đổi được tệp của bản đã duyệt, kể cả bằng khóa dịch vụ.
    const tamper = await admin
      .from("audio_asset_versions")
      .update({ storage_key: `${approved.storage_key}.x` })
      .eq("id", approved.id);
    expect(tamper.error?.message).toContain("AUDIO_VERSION_IMMUTABLE");

    // Bản MỚI sau bản đã duyệt: thành nháp, KHÔNG thay bản đang dùng, bản đã duyệt giữ nguyên.
    const next = await page.request.post("/api/teacher/audio/versions", {
      multipart: {
        unitKind: "phoneme",
        unitText: approve,
        file: { name: "moi.wav", mimeType: "audio/wav", buffer: uniqueWav() },
      },
    });
    expect(next.status(), await next.text()).toBeLessThan(300);
    const second = await newestAfterUpload(school, approve, 2);
    expect(second.id).not.toBe(approved.id);
    expect(second.asset_id).toBe(approveAsset);
    expect(second.status).toBe("draft");
    expect(second.version_no).toBe(approved.version_no + 1);
    expect(await statusOf(approved.id)).toBe("approved");

    // --- Luồng yêu cầu ghi lại ---
    await page.getByRole("button", { name: t.unit.openLabel.replace("{unit}", approve), exact: true }).click(); // đóng
    await openUnit(page, reject);
    await page.getByRole("button", { name: t.pronunciation.confirm }).click();
    await expect(page.getByText(t.pronunciation.saved)).toBeVisible({ timeout: 20_000 });
    await uploadFile(page);
    const rejectFirst = await newestAfterUpload(school, reject, 1);
    expect(rejectFirst.status).toBe("draft");
    await page.getByRole("button", { name: t.versions.submit }).click();
    await expect.poll(() => statusOf(rejectFirst.id), { timeout: 15_000 }).toBe("pending_review");
    await page.getByLabel(t.review.note).fill("Có tiếng ồn, hãy ghi lại");
    await page.getByRole("button", { name: t.review.reject }).click();
    await expect.poll(() => statusOf(rejectFirst.id), { timeout: 15_000 }).toBe("rejected");
    const rejected = await rowOf(rejectFirst.id);
    expect(rejected.review_note).toBe("Có tiếng ồn, hãy ghi lại");
    await expect(page.getByText(t.state.rerecord).first()).toBeVisible();

    // Ghi lại → phiên bản mới; bản cũ giữ nguyên.
    await uploadFile(page);
    const rerecorded = await newestAfterUpload(school, reject, 2);
    expect(rerecorded.id).not.toBe(rejected.id);
    expect(rerecorded.asset_id).toBe(rejected.asset_id);
    expect(await statusOf(rejected.id)).toBe("rejected");
    expect(rerecorded.status).toBe("draft");
    expect(rerecorded.version_no).toBe(rejected.version_no + 1);

    // Bản đã duyệt vẫn là bản đang dùng của đơn vị đầu (bản nháp mới không thay); đơn vị bị từ chối chưa có bản dùng.
    const asset = await mustRow(admin.from("audio_assets").select("active_version_id").eq("id", approveAsset).single());
    expect(asset.active_version_id).toBe(approved.id);
    const rejectAsset = await mustRow(
      admin.from("audio_assets").select("active_version_id").eq("id", rejected.asset_id).single(),
    );
    expect(rejectAsset.active_version_id).toBeNull();

    // Bản của trường khác không bị chạm: đúng trạng thái đã gieo, và không phải bản của kịch bản này.
    const ours = new Set([draft.id, second.id, rejectFirst.id, rerecorded.id]);
    for (const other of others) {
      expect(ours.has(other.versionId)).toBe(false);
      expect(await statusOf(other.versionId)).toBe(other.expected);
    }

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

  test("tệp giả MIME bị từ chối, không tạo bản ghi (API) và hiện câu chữ dễ hiểu (giao diện, Chromium)", async ({
    page,
    browserName,
  }) => {
    test.setTimeout(120_000);
    // Trường khác đã có bản ghi trùng đơn vị: không được tính vào "trước/sau" của trường này.
    await seedOtherSchools([REJECT_UNIT]);
    const world = await freshTeacher("tepgia");
    const unit = REJECT_UNIT;
    // Điều kiện để máy chủ nhận tệp: đồng ý dùng giọng + đã xác nhận cách đọc (qua đúng hàm teacher_*, JWT của GV này).
    await rpc(world.teacher, "teacher_grant_audio_consent", { p_notice_version: "v1" });
    const assetId = (await rpc(world.teacher, "teacher_ensure_audio_asset", {
      p_unit_kind: "phoneme",
      p_unit_text: unit,
      p_proposed_label: LABELS[unit],
    })) as string;
    await rpc(world.teacher, "teacher_confirm_audio_pronunciation", { p_asset_id: assetId, p_label: LABELS[unit] });
    await login(page, world);
    const before = (await versionsOf(world.schoolId, unit)).length;
    expect(before).toBe(0);
    const fake = Buffer.from("<html><body>không phải âm thanh</body></html>");

    // Tầng API (cùng cookie phiên GV): máy chủ kiểm tra theo nội dung, bỏ qua loại tệp khai báo.
    const response = await page.request.post("/api/teacher/audio/versions", {
      multipart: {
        unitKind: "phoneme",
        unitText: unit,
        file: { name: "gia.mp3", mimeType: "audio/mpeg", buffer: fake },
      },
    });
    expect(response.status()).toBe(415);
    expect(await response.json()).toEqual({ ok: false, code: "AUDIO_UNSUPPORTED" });
    expect((await versionsOf(world.schoolId, unit)).length).toBe(before);

    // Giao diện (WebKit mobile không đáng tin khi nạp tệp tự động; tầng API ở trên đã kiểm chứng cho mọi project).
    test.skip(browserName !== "chromium", "Phần giao diện chạy ở Chromium.");
    await page.goto("/teacher/audio");
    await openUnit(page, unit);
    await page.locator('input[type="file"]').setInputFiles({ name: "gia.mp3", mimeType: "audio/mpeg", buffer: fake });
    await clickUploadSave(page);
    await expect(page.getByRole("alert").filter({ hasText: vi.errors.AUDIO_UNSUPPORTED })).toBeVisible({
      timeout: 20_000,
    });
    expect((await versionsOf(world.schoolId, unit)).length).toBe(before);
  });
});
