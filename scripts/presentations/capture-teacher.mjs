// Chụp khu giáo viên bằng tài khoản GIẢ trên Supabase LOCAL (sau `npm run db:seed`). Mật khẩu đọc từ .env.local, không in ra.
// Chạy: node scripts/presentations/capture-teacher.mjs [cổng]
import { chromium } from "playwright";
import { readFileSync } from "node:fs";

const base = `http://localhost:${process.argv[2] ?? "3200"}`;
const out = new URL("./assets/", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const env = readFileSync(new URL("../../.env.local", import.meta.url), "utf8");
const password = env
  .match(/^SEED_TEACHER_PASSWORD=(.*)$/m)?.[1]
  ?.trim()
  .replace(/^["']|["']$/g, "");
if (!password) throw new Error("Thiếu SEED_TEACHER_PASSWORD");

const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: 1440, height: 810 } })).newPage();
await p.goto(base + "/login", { waitUntil: "networkidle" });
// Ghép lúc chạy (như tests/e2e-db) để mã nguồn không chứa địa chỉ email; có thể ghi đè bằng CAPTURE_TEACHER_EMAIL.
const email = process.env.CAPTURE_TEACHER_EMAIL ?? ["co.mai", "readmate.test"].join("@");
await p.getByLabel(/email/i).fill(email);
await p.getByLabel(/mật khẩu/i).fill(password);
await p.getByRole("button", { name: /đăng nhập/i }).click();
await p.waitForURL(/\/teacher/, { timeout: 30000 });
await p.addStyleTag({ content: "nextjs-portal{display:none!important}" });

async function shot(path, name) {
  await p.goto(base + path, { waitUntil: "networkidle" });
  await p.addStyleTag({ content: "nextjs-portal{display:none!important}" });
  await p.waitForTimeout(800);
  await p.screenshot({ path: out + name + ".jpg", type: "jpeg", quality: 82 });
  console.log(name, p.url().replace(base, ""));
}
await shot("/teacher", "t-overview");
await shot("/teacher/classes", "t-classes");
const link = await p
  .goto(base + "/teacher/classes", { waitUntil: "networkidle" })
  .then(() => p.locator('a[href^="/teacher/classes/"]').first().getAttribute("href"));
console.log("class link", link?.replace(/[0-9a-f-]{36}/, "<id>"));
if (link) {
  await shot(link, "t-class");
  await shot(link + "/students", "t-students");
  await shot(link + "/leaderboard", "t-leaderboard");
  const s = await p
    .locator('a[href*="/students/"]')
    .first()
    .getAttribute("href")
    .catch(() => null);
  if (s) await shot(s, "t-student");
}
await b.close();
