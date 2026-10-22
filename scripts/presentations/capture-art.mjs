// Xuất nhân vật SVG của dự án thành PNG nền trong suốt (cần một trang tạm hiển thị chúng — xem tài liệu README trong thư mục).
import { chromium } from "playwright";
const base = `http://localhost:${process.argv[2] ?? "3200"}`;
const out = new URL("./assets/", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: 1900, height: 700 } })).newPage();
await p.goto(base + "/tmp-art", { waitUntil: "networkidle" });
await p.addStyleTag({ content: "html,body{background:transparent!important}" });
for (const id of ["kid", "owl", "monster"])
  await p.locator("#" + id).screenshot({ path: out + "art-" + id + ".png", omitBackground: true });
await b.close();
