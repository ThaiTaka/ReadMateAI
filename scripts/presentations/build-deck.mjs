// Tạo docs/presentations/ReadMateAI_BaoCaoDuAn.pptx — báo cáo dự án ReadMate AI (tiến độ: xong R08.2).
// Chạy: cd scripts/presentations; npm install; node build-deck.mjs
// Ảnh nguồn nằm ở ./assets (chụp bằng capture*.mjs từ bản demo LOCAL, dữ liệu minh họa hư cấu).
import pptxgen from "pptxgenjs";
import sharp from "sharp";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdirSync } from "node:fs";

const here = dirname(fileURLToPath(import.meta.url));
const A = (f) => join(here, "assets", f);
const OUT = join(here, "..", "..", "docs", "presentations", "ReadMateAI_BaoCaoDuAn.pptx");
mkdirSync(dirname(OUT), { recursive: true });

// ---- Bảng màu: xanh navy + xanh ngọc + vàng champagne
const NAVY = "0F2447";
const NAVY2 = "1D3B6E";
const TEAL = "0E8A7D";
const TEAL_L = "DDF1EE";
const GOLD = "C9A24A";
const GOLD_L = "F5EBCF";
const IVORY = "FBF9F4";
const INK = "1F2A3C";
const MUTED = "566175";
const WHITE = "FFFFFF";
const ORANGE = "B8561F";
const SLATE = "5B6678";
const HEAD = "Cambria";
const BODY = "Calibri";

const pres = new pptxgen();
pres.layout = "LAYOUT_16x9"; // 10 x 5.625 in
pres.title = "ReadMate AI — Báo cáo dự án";
pres.author = "Nhóm dự án ReadMate AI";
pres.subject = "Học Tiếng Việt qua hành trình khám phá";
pres.theme = { headFontFace: HEAD, bodyFontFace: BODY };

pres.defineSlideMaster({
  title: "LIGHT",
  background: { color: IVORY },
  objects: [
    {
      text: {
        text: "ReadMate AI  ·  Học Tiếng Việt qua hành trình khám phá",
        options: { x: 0.6, y: 5.22, w: 6, h: 0.25, fontFace: BODY, fontSize: 10, color: MUTED, margin: 0 },
      },
    },
  ],
  slideNumber: { x: 9.0, y: 5.22, w: 0.4, h: 0.25, fontFace: BODY, fontSize: 10, color: MUTED, align: "right" },
});
pres.defineSlideMaster({ title: "DARK", background: { color: NAVY } });

// ---- Ảnh: cắt/bo góc bằng sharp để không méo tỉ lệ, nén nhẹ cho GitHub
const PPI = 170;
async function pic(file, w, h, { radius = 0.12, pos = "centre", fit = "cover", png = false, bg } = {}) {
  const W = Math.round(w * PPI);
  const H = Math.round(h * PPI);
  let img = sharp(A(file)).resize(W, H, { fit, position: pos, background: bg ?? { r: 0, g: 0, b: 0, alpha: 0 } });
  if (radius > 0) {
    const r = Math.round(radius * PPI);
    const mask = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="${W}" height="${H}" rx="${r}" ry="${r}" fill="#fff"/></svg>`,
    );
    img = img.composite([{ input: mask, blend: "dest-in" }]).png({ palette: true, quality: 82, effort: 8 });
    return "image/png;base64," + (await img.toBuffer()).toString("base64");
  }
  if (png) return "image/png;base64," + (await img.png({ palette: true, quality: 85 }).toBuffer()).toString("base64");
  return "image/jpeg;base64," + (await img.jpeg({ quality: 84, mozjpeg: true }).toBuffer()).toString("base64");
}
async function addPic(s, file, x, y, w, h, opts = {}) {
  s.addImage({ data: await pic(file, w, h, opts), x, y, w, h, altText: opts.alt ?? "" });
}
const shadow = () => ({ type: "outer", color: "1F2A3C", blur: 8, offset: 2, angle: 90, opacity: 0.14 });

// ---- Thành phần dùng lại
function header(s, eyebrow, title, { dark = false } = {}) {
  s.addText(eyebrow.toUpperCase(), {
    x: 0.6,
    y: 0.32,
    w: 8.8,
    h: 0.28,
    fontFace: BODY,
    fontSize: 12,
    bold: true,
    color: GOLD,
    charSpacing: 3,
    margin: 0,
    isTextBox: true,
  });
  s.addText(title, {
    x: 0.6,
    y: 0.6,
    w: 8.8,
    h: 0.62,
    fontFace: HEAD,
    fontSize: 30,
    bold: true,
    color: dark ? WHITE : NAVY,
    margin: 0,
    valign: "middle",
    isTextBox: true,
  });
}
const STATUS = {
  done: { t: "ĐÃ CÓ", c: TEAL },
  demo: { t: "BẢN CHƠI THỬ", c: "9A7416" },
  wip: { t: "ĐANG HOÀN THIỆN", c: ORANGE },
  plan: { t: "DỰ KIẾN", c: SLATE },
};
function chip(s, kind, x, y, label) {
  const st = STATUS[kind];
  const text = label ?? st.t;
  const w = 0.3 + text.length * 0.085;
  s.addShape(pres.ShapeType.roundRect, {
    x,
    y,
    w,
    h: 0.28,
    rectRadius: 0.14,
    fill: { color: WHITE },
    line: { color: st.c, width: 1.25 },
  });
  s.addText(text, {
    x,
    y,
    w,
    h: 0.28,
    fontFace: BODY,
    fontSize: 10,
    bold: true,
    color: st.c,
    align: "center",
    valign: "middle",
    margin: 0,
    isTextBox: true,
  });
  return w;
}
function card(s, x, y, w, h, fill = WHITE) {
  s.addShape(pres.ShapeType.roundRect, {
    x,
    y,
    w,
    h,
    rectRadius: 0.12,
    fill: { color: fill },
    line: { color: "E7E1D3", width: 0.75 },
    shadow: shadow(),
  });
}
function numDot(s, n, x, y, d = 0.38, fill = TEAL) {
  s.addShape(pres.ShapeType.ellipse, { x, y, w: d, h: d, fill: { color: fill } });
  s.addText(String(n), {
    x,
    y,
    w: d,
    h: d,
    fontFace: BODY,
    fontSize: d > 0.34 ? 14 : 11,
    bold: true,
    color: WHITE,
    align: "center",
    valign: "middle",
    margin: 0,
    isTextBox: true,
  });
}
function caption(s, text, x, y, w, align = "left") {
  s.addText(text, {
    x,
    y,
    w,
    h: 0.24,
    fontFace: BODY,
    fontSize: 10,
    italic: true,
    color: MUTED,
    align,
    margin: 0,
    isTextBox: true,
  });
}
// Khung điện thoại: ảnh màn hình tỉ lệ 1:2
async function phone(s, file, x, y, h, { pos = "top" } = {}) {
  const w = h * 0.5;
  const inset = 0.06;
  s.addShape(pres.ShapeType.roundRect, { x, y, w, h, rectRadius: 0.22, fill: { color: NAVY }, shadow: shadow() });
  await addPic(s, file, x + inset, y + inset, w - 2 * inset, h - 2 * inset, {
    radius: 0.17,
    pos,
    alt: "Màn hình bản chơi thử trên điện thoại",
  });
  return { sx: x + inset, sy: y + inset, sw: w - 2 * inset, sh: h - 2 * inset };
}
// Khung trình duyệt
async function browser(s, file, x, y, w, h, { pos = "top" } = {}) {
  s.addShape(pres.ShapeType.roundRect, { x, y, w, h, rectRadius: 0.12, fill: { color: "E9E4D8" }, shadow: shadow() });
  [0, 1, 2].forEach((i) =>
    s.addShape(pres.ShapeType.ellipse, {
      x: x + 0.15 + i * 0.17,
      y: y + 0.11,
      w: 0.1,
      h: 0.1,
      fill: { color: i === 0 ? "E07A6B" : i === 1 ? "E8C15A" : "7DC49B" },
    }),
  );
  await addPic(s, file, x + 0.06, y + 0.3, w - 0.12, h - 0.36, { radius: 0.06, pos, alt: "Ảnh chụp bản chơi thử" });
}
function bullets(s, items, x, y, w, { size = 16, gap = 8, color = INK } = {}) {
  const runs = items.map((t, i) => ({
    text: t,
    options: { bullet: { indent: 16 }, breakLine: i < items.length - 1, paraSpaceAfter: gap },
  }));
  s.addText(runs, {
    x,
    y,
    w,
    h: Math.min(0.5 * items.length + 0.4, 5.1 - y),
    fontFace: BODY,
    fontSize: size,
    color,
    valign: "top",
    margin: 0,
    isTextBox: true,
  });
}

// =========================================================================
// 1. Bìa
{
  const s = pres.addSlide({ masterName: "DARK" });
  s.addShape(pres.ShapeType.ellipse, { x: 5.3, y: -1.2, w: 6.5, h: 6.5, fill: { color: NAVY2, transparency: 40 } });
  s.addText("BÁO CÁO DỰ ÁN GIÁO DỤC", {
    x: 0.7,
    y: 0.9,
    w: 5,
    h: 0.3,
    fontFace: BODY,
    fontSize: 12,
    bold: true,
    color: GOLD,
    charSpacing: 4,
    margin: 0,
    isTextBox: true,
  });
  s.addText("READMATE AI", {
    x: 0.7,
    y: 1.3,
    w: 5.2,
    h: 1.0,
    fontFace: HEAD,
    fontSize: 50,
    bold: true,
    color: WHITE,
    margin: 0,
    isTextBox: true,
  });
  s.addText("HỌC TIẾNG VIỆT QUA HÀNH TRÌNH KHÁM PHÁ", {
    x: 0.7,
    y: 2.4,
    w: 4.9,
    h: 0.6,
    fontFace: BODY,
    fontSize: 14,
    bold: true,
    color: GOLD,
    charSpacing: 1,
    margin: 0,
    isTextBox: true,
  });
  s.addText("Học vui mỗi ngày — Tự tin đọc tốt hơn.", {
    x: 0.7,
    y: 3.2,
    w: 4.9,
    h: 0.4,
    fontFace: HEAD,
    fontSize: 18,
    italic: true,
    color: "DCE6F5",
    margin: 0,
    isTextBox: true,
  });
  s.addText("Nền tảng tự luyện Tiếng Việt tại nhà dành cho học sinh lớp 1", {
    x: 0.7,
    y: 4.5,
    w: 4.8,
    h: 0.5,
    fontFace: BODY,
    fontSize: 12,
    color: "AFC0DA",
    margin: 0,
    isTextBox: true,
  });
  await addPic(s, "crop-hero.jpg", 5.65, 0.95, 3.85, 3.7, {
    radius: 0.25,
    pos: "centre",
    alt: "Bạn nhỏ thám hiểm và Cú Bông trong thế giới phiêu lưu",
  });
  s.addText("Báo cáo tiến độ dự án  ·  Tháng 10/2026", {
    x: 0.7,
    y: 4.85,
    w: 4.8,
    h: 0.3,
    fontFace: BODY,
    fontSize: 11,
    color: "8FA3C4",
    margin: 0,
    isTextBox: true,
  });
}

// 2. Vì sao
{
  const s = pres.addSlide({ masterName: "LIGHT" });
  header(s, "Bối cảnh", "Vì sao có ReadMate AI?");
  const items = [
    ["Luyện tập đều đặn", "Học sinh lớp 1 cần luyện chữ, vần và đọc trơn thường xuyên."],
    ["Giữ được hứng thú", "Bài luyện đơn điệu dễ khiến các em mau chán."],
    ["Phụ huynh cần đồng hành", "Đơn giản, rõ ràng, không đòi hỏi chuyên môn."],
    ["Giáo viên cần theo dõi", "Để động viên đúng lúc, đúng người."],
  ];
  for (let i = 0; i < 4; i++) {
    const x = 0.6 + (i % 2) * 2.95;
    const y = 1.5 + Math.floor(i / 2) * 1.8;
    card(s, x, y, 2.75, 1.6);
    numDot(s, i + 1, x + 0.2, y + 0.2, 0.36, i % 2 ? GOLD : TEAL);
    s.addText(items[i][0], {
      x: x + 0.2,
      y: y + 0.62,
      w: 2.35,
      h: 0.34,
      fontFace: HEAD,
      fontSize: 14,
      bold: true,
      color: NAVY,
      margin: 0,
      isTextBox: true,
    });
    s.addText(items[i][1], {
      x: x + 0.2,
      y: y + 0.96,
      w: 2.4,
      h: 0.55,
      fontFace: BODY,
      fontSize: 12,
      color: MUTED,
      margin: 0,
      valign: "top",
      isTextBox: true,
    });
  }
  s.addShape(pres.ShapeType.roundRect, { x: 6.75, y: 1.5, w: 2.65, h: 3.4, rectRadius: 0.2, fill: { color: TEAL_L } });
  await addPic(s, "art-kid.png", 6.8, 1.75, 2.55, 2.55, {
    radius: 0,
    fit: "contain",
    png: true,
    alt: "Bạn nhỏ thám hiểm",
  });
  s.addText("Luyện đọc nên là một niềm vui", {
    x: 6.9,
    y: 4.25,
    w: 2.35,
    h: 0.5,
    fontFace: HEAD,
    fontSize: 14,
    bold: true,
    color: NAVY,
    align: "center",
    margin: 0,
    isTextBox: true,
  });
}

// 3. Ba giá trị
{
  const s = pres.addSlide({ masterName: "LIGHT" });
  header(s, "Giá trị cốt lõi", "ReadMate AI mang lại điều gì?");
  const cols = [
    ["ex-2-selected.jpg", "Học dễ hiểu", "Mỗi bài một nhiệm vụ, nút bấm lớn, câu lệnh ngắn gọn.", "top"],
    ["crop-board.jpg", "Luyện tập thú vị", "Trò chơi phiêu lưu và điểm thưởng giữ cho các em hào hứng.", "centre"],
    ["crop-worldmap.jpg", "Tiến bộ từng ngày", "Các mốc khám phá cho các em thấy hành trình của mình.", "centre"],
  ];
  for (let i = 0; i < 3; i++) {
    const x = 0.6 + i * 3.0;
    card(s, x, 1.45, 2.8, 3.5);
    await addPic(s, cols[i][0], x + 0.12, 1.57, 2.56, 1.75, { radius: 0.1, pos: cols[i][3], alt: cols[i][1] });
    s.addText(cols[i][1], {
      x: x + 0.2,
      y: 3.45,
      w: 2.4,
      h: 0.38,
      fontFace: HEAD,
      fontSize: 17,
      bold: true,
      color: NAVY,
      margin: 0,
      isTextBox: true,
    });
    s.addText(cols[i][2], {
      x: x + 0.2,
      y: 3.88,
      w: 2.4,
      h: 0.9,
      fontFace: BODY,
      fontSize: 13,
      color: MUTED,
      margin: 0,
      valign: "top",
      isTextBox: true,
    });
  }
}

// 4. Ai sử dụng
{
  const s = pres.addSlide({ masterName: "LIGHT" });
  header(s, "Người dùng", "Ai sử dụng ReadMate AI?");
  const who = [
    ["Học sinh lớp 1", "Luyện chữ, vần, đọc trơn qua trò chơi và phần thưởng — ngay tại nhà."],
    ["Giáo viên", "Quản lý lớp, chuẩn bị học liệu và động viên học sinh."],
    ["Phụ huynh", "Đồng hành, nhắc nhở và chia sẻ niềm vui tiến bộ cùng con."],
  ];
  for (let i = 0; i < 3; i++) {
    const x = 0.6 + i * 3.0;
    card(s, x, 1.45, 2.8, 3.5);
    s.addShape(pres.ShapeType.ellipse, {
      x: x + 0.7,
      y: 1.65,
      w: 1.4,
      h: 1.4,
      fill: { color: i === 0 ? TEAL_L : i === 1 ? GOLD_L : "E4EAF6" },
    });
    if (i === 0)
      await addPic(s, "art-kid.png", x + 0.72, 1.67, 1.36, 1.36, {
        radius: 0,
        fit: "contain",
        png: true,
        alt: "Học sinh",
      });
    if (i === 1) {
      // bảng của giáo viên: hình vẽ minh họa
      s.addShape(pres.ShapeType.roundRect, {
        x: x + 0.95,
        y: 2.0,
        w: 0.9,
        h: 0.65,
        rectRadius: 0.05,
        fill: { color: NAVY },
      });
      [0, 1, 2].forEach((k) =>
        s.addShape(pres.ShapeType.rect, {
          x: x + 1.05,
          y: 2.1 + k * 0.15,
          w: k === 2 ? 0.4 : 0.7,
          h: 0.05,
          fill: { color: WHITE },
        }),
      );
      s.addShape(pres.ShapeType.rect, { x: x + 1.35, y: 2.65, w: 0.1, h: 0.2, fill: { color: NAVY } });
    }
    if (i === 2) {
      s.addShape(pres.ShapeType.heart, { x: x + 0.95, y: 2.0, w: 0.9, h: 0.8, fill: { color: "D9694F" } });
    }
    s.addText(who[i][0], {
      x: x + 0.2,
      y: 3.2,
      w: 2.4,
      h: 0.4,
      fontFace: HEAD,
      fontSize: 18,
      bold: true,
      color: NAVY,
      align: "center",
      margin: 0,
      isTextBox: true,
    });
    s.addText(who[i][1], {
      x: x + 0.25,
      y: 3.65,
      w: 2.3,
      h: 1.1,
      fontFace: BODY,
      fontSize: 13,
      color: MUTED,
      align: "center",
      margin: 0,
      valign: "top",
      isTextBox: true,
    });
  }
}

// 5. Hành trình
{
  const s = pres.addSlide({ masterName: "LIGHT" });
  header(s, "Hành trình học tập", "Một lần luyện tập của học sinh");
  const steps = [
    "Mở thẻ học",
    "Vào trang của con",
    "Làm bài",
    "Nhận phản hồi",
    "Tích điểm",
    "Khám phá bản đồ",
    "Chơi Mê cung",
  ];
  const w = 1.137;
  const gap = 0.14;
  for (let i = 0; i < 7; i++) {
    const x = 0.6 + i * (w + gap);
    const last = i === 6;
    card(s, x, 1.4, w, 1.7, last ? GOLD_L : WHITE);
    numDot(s, i + 1, x + (w - 0.4) / 2, 1.52, 0.4, last ? GOLD : TEAL);
    s.addText(steps[i], {
      x: x + 0.05,
      y: 2.0,
      w: w - 0.1,
      h: 0.7,
      fontFace: HEAD,
      fontSize: 13,
      bold: true,
      color: NAVY,
      align: "center",
      valign: "middle",
      margin: 0,
      isTextBox: true,
    });
    s.addText(last ? "BẢN CHƠI THỬ" : "ĐÃ CÓ", {
      x: x + 0.03,
      y: 2.75,
      w: w - 0.06,
      h: 0.25,
      fontFace: BODY,
      fontSize: 10,
      bold: true,
      color: last ? "9A7416" : TEAL,
      align: "center",
      margin: 0,
      isTextBox: true,
    });
    if (i < 6)
      s.addShape(pres.ShapeType.triangle, {
        x: x + w + 0.02,
        y: 2.1,
        w: 0.1,
        h: 0.16,
        rotate: 90,
        fill: { color: GOLD },
      });
  }
  await addPic(s, "crop-worldmap.jpg", 0.6, 3.3, 3.0, 1.7, { radius: 0.1, alt: "Bản đồ thế giới phiêu lưu" });
  await addPic(s, "crop-milestones.jpg", 3.75, 3.3, 5.65, 0.93, {
    radius: 0.1,
    pos: "centre",
    alt: "Các mốc khám phá",
  });
  s.addShape(pres.ShapeType.roundRect, {
    x: 3.75,
    y: 4.38,
    w: 5.65,
    h: 0.62,
    rectRadius: 0.1,
    fill: { color: GOLD_L },
  });
  s.addText("Đã chạy thử với nội dung mẫu; học liệu thật chờ giáo viên duyệt.", {
    x: 3.95,
    y: 4.38,
    w: 5.3,
    h: 0.62,
    fontFace: BODY,
    fontSize: 13,
    color: INK,
    valign: "middle",
    margin: 0,
    isTextBox: true,
  });
}

// 6. Bước 1
{
  const s = pres.addSlide({ masterName: "LIGHT" });
  header(s, "Bước 1", "Học sinh bắt đầu như thế nào?");
  const st = [
    ["Mở thẻ học", "Quét mã QR (hoặc nhập mã dự phòng) trên thẻ học do giáo viên cấp."],
    ["Vào đúng trang của con", "Thiết bị liên kết với hồ sơ của con: tên, ảnh đại diện, điểm thưởng riêng."],
    ["Chạm vào khu vực học tập", "Chọn “Luyện bài” hoặc “Khám phá Game World”."],
  ];
  st.forEach((t, i) => {
    const y = 1.5 + i * 1.15;
    numDot(s, i + 1, 0.6, y, 0.46);
    s.addText(t[0], {
      x: 1.25,
      y: y - 0.02,
      w: 3.4,
      h: 0.34,
      fontFace: HEAD,
      fontSize: 16,
      bold: true,
      color: NAVY,
      margin: 0,
      isTextBox: true,
    });
    s.addText(t[1], {
      x: 1.25,
      y: y + 0.32,
      w: 3.4,
      h: 0.6,
      fontFace: BODY,
      fontSize: 13,
      color: MUTED,
      margin: 0,
      valign: "top",
      isTextBox: true,
    });
  });
  await browser(s, "learn.jpg", 4.95, 1.45, 4.55, 3.1);
  chip(s, "demo", 4.95, 4.7);
  caption(s, "Ảnh chụp trang của học sinh — tên và điểm là dữ liệu minh họa", 6.55, 4.74, 3);
}

// 7. Bước 2
{
  const s = pres.addSlide({ masterName: "LIGHT" });
  header(s, "Bước 2", "Chọn bài luyện Tiếng Việt");
  const t = [
    ["b", "Nhận biết chữ", "Làm quen chữ cái và âm."],
    ["ng + ang", "Ghép âm, ghép vần", "Ghép thành tiếng đúng."],
    ["vàng", "Nhận biết tiếng", "Tìm vần, âm, thanh của tiếng."],
    ["m _ o", "Điền chữ còn thiếu", "Hoàn thiện tiếng, từ."],
    ["từ + hình", "Kết hợp từ với tranh", "Chọn từ khớp với hình."],
    ["Bé đọc sách.", "Luyện đọc từ và câu", "Đọc trơn, hiểu nghĩa."],
  ];
  for (let i = 0; i < 6; i++) {
    const x = 0.6 + (i % 3) * 3.0;
    const y = 1.45 + Math.floor(i / 3) * 1.8;
    card(s, x, y, 2.8, 1.6);
    s.addShape(pres.ShapeType.roundRect, {
      x: x + 0.15,
      y: y + 0.15,
      w: 2.5,
      h: 0.75,
      rectRadius: 0.1,
      fill: { color: NAVY },
    });
    s.addText(t[i][0], {
      x: x + 0.15,
      y: y + 0.15,
      w: 2.5,
      h: 0.75,
      fontFace: HEAD,
      fontSize: t[i][0].length > 8 ? 18 : 26,
      bold: true,
      color: WHITE,
      align: "center",
      valign: "middle",
      margin: 0,
      isTextBox: true,
    });
    s.addText(t[i][1], {
      x: x + 0.18,
      y: y + 0.98,
      w: 2.45,
      h: 0.28,
      fontFace: HEAD,
      fontSize: 14,
      bold: true,
      color: NAVY,
      margin: 0,
      isTextBox: true,
    });
    s.addText(t[i][2], {
      x: x + 0.18,
      y: y + 1.26,
      w: 2.45,
      h: 0.26,
      fontFace: BODY,
      fontSize: 12,
      color: MUTED,
      margin: 0,
      isTextBox: true,
    });
  }
  chip(s, "demo", 0.6, 4.88);
  caption(s, "Ví dụ minh họa. Học liệu thật sẽ do giáo viên duyệt trước khi đến tay học sinh.", 2.4, 4.92, 6.9);
}

// 7. (bổ sung) Hỗ trợ giảm dần
{
  const s = pres.addSlide({ masterName: "LIGHT" });
  header(s, "Phương pháp", "Hỗ trợ giảm dần, từng bước tự lập");
  const lv = [
    ["Hỗ trợ đầy đủ", "Có bài mẫu; gợi ý hiện ngay khi sai", 0.95, TEAL_L, NAVY],
    ["Hỗ trợ một phần", "Gợi ý khi con bấm", 1.45, "9ED5CC", NAVY],
    ["Gợi ý tối thiểu", "Ít gợi ý, ít lượt thử", 1.95, TEAL, WHITE],
    ["Tự làm", "Con tự hoàn thành, không gợi ý", 2.45, NAVY, WHITE],
  ];
  const baseY = 4.1;
  lv.forEach((t, i) => {
    const x = 0.6 + i * 1.3;
    s.addShape(pres.ShapeType.roundRect, {
      x,
      y: baseY - t[2],
      w: 1.2,
      h: t[2],
      rectRadius: 0.08,
      fill: { color: t[3] },
    });
    s.addText(t[0], {
      x: x + 0.05,
      y: baseY - t[2] + 0.08,
      w: 1.1,
      h: 0.62,
      fontFace: HEAD,
      fontSize: 12,
      bold: true,
      color: t[4],
      align: "center",
      valign: "top",
      margin: 0,
      isTextBox: true,
    });
    s.addText(t[1], {
      x: x - 0.02,
      y: baseY + 0.08,
      w: 1.24,
      h: 0.8,
      fontFace: BODY,
      fontSize: 11,
      color: MUTED,
      align: "center",
      valign: "top",
      margin: 0,
      isTextBox: true,
    });
  });
  const pts = [
    ["Một buổi luyện có ba phần", "Ôn bài cũ, luyện tập, rồi thử thách tự làm."],
    ["Chỉ dùng chữ, âm, vần đã học", "Theo đúng vị trí bài học của lớp."],
    ["Không làm lộ đáp án", "Câu lệnh, hình ảnh và lời đọc không nói thay con."],
  ];
  pts.forEach((t, i) => {
    const y = 1.85 + i * 1.05;
    card(s, 6.05, y, 3.45, 0.9);
    s.addShape(pres.ShapeType.ellipse, { x: 6.2, y: y + 0.3, w: 0.28, h: 0.28, fill: { color: GOLD } });
    s.addText(t[0], {
      x: 6.6,
      y: y + 0.08,
      w: 2.8,
      h: 0.3,
      fontFace: HEAD,
      fontSize: 13,
      bold: true,
      color: NAVY,
      margin: 0,
      isTextBox: true,
    });
    s.addText(t[1], {
      x: 6.6,
      y: y + 0.4,
      w: 2.8,
      h: 0.45,
      fontFace: BODY,
      fontSize: 11,
      color: MUTED,
      margin: 0,
      valign: "top",
      isTextBox: true,
    });
  });
  chip(s, "demo", 6.05, 1.45);
  caption(s, "Hiện mức hỗ trợ do người lớn chọn; tự động tăng giảm mức là hướng phát triển.", 0.6, 4.98, 8.9);
}

// 8. Bước 3 — phone annotated
{
  const s = pres.addSlide({ masterName: "LIGHT" });
  header(s, "Bước 3", "Học sinh làm bài như thế nào?");
  const ph = 3.8;
  const py = 1.28;
  const A1 = await phone(s, "ex-2-selected.jpg", 3.05, py, ph);
  const B1 = await phone(s, "ex-3-correct.jpg", 5.3, py, ph, { pos: "top" });
  const k = A1.sh / 1560;
  const bx = (sx, fx) => sx + fx * A1.sw - 0.14;
  const by = (sy, py_) => sy + py_ * k - 0.14;
  numDot(s, 1, bx(A1.sx, 0.02), by(A1.sy, 330), 0.28, ORANGE);
  numDot(s, 2, bx(A1.sx, 0.52), by(A1.sy, 1190), 0.28, ORANGE);
  numDot(s, 3, bx(A1.sx, 0.56), by(A1.sy, 1450), 0.28, ORANGE);
  numDot(s, 4, bx(B1.sx, 0.07), by(B1.sy, 828), 0.28, ORANGE);
  const L = [
    [1, "Xem câu hỏi", "Một câu hỏi, một nhiệm vụ trên mỗi màn hình."],
    [2, "Chạm chọn đáp án", "Thẻ lớn, dễ chạm — không cần kéo thả."],
  ];
  L.forEach((t, i) => {
    const y = 1.6 + i * 1.5;
    numDot(s, t[0], 0.6, y, 0.34, ORANGE);
    s.addText(t[1], {
      x: 1.06,
      y: y - 0.02,
      w: 1.85,
      h: 0.3,
      fontFace: HEAD,
      fontSize: 14,
      bold: true,
      color: NAVY,
      margin: 0,
      isTextBox: true,
    });
    s.addText(t[2], {
      x: 1.06,
      y: y + 0.3,
      w: 1.85,
      h: 0.8,
      fontFace: BODY,
      fontSize: 12,
      color: MUTED,
      margin: 0,
      valign: "top",
      isTextBox: true,
    });
  });
  const R = [
    [3, "Bấm Kiểm tra", "Nút lớn ở cuối màn hình."],
    [4, "Xem kết quả và tiếp tục", "Lời khen, giải thích ngắn rồi sang câu kế tiếp."],
  ];
  R.forEach((t, i) => {
    const y = 1.6 + i * 1.5;
    numDot(s, t[0], 7.6, y, 0.34, ORANGE);
    s.addText(t[1], {
      x: 8.06,
      y: y - 0.02,
      w: 1.5,
      h: 0.56,
      fontFace: HEAD,
      fontSize: 14,
      bold: true,
      color: NAVY,
      margin: 0,
      isTextBox: true,
    });
    s.addText(t[2], {
      x: 8.06,
      y: y + 0.55,
      w: 1.5,
      h: 0.9,
      fontFace: BODY,
      fontSize: 12,
      color: MUTED,
      margin: 0,
      valign: "top",
      isTextBox: true,
    });
  });
}

// 9. Khi trả lời sai
{
  const s = pres.addSlide({ masterName: "LIGHT" });
  header(s, "Phản hồi", "Khi học sinh trả lời chưa đúng");
  await phone(s, "ex-4-wrong.jpg", 0.75, 1.3, 3.8, { pos: "top" });
  s.addText("Sai cũng là một cơ hội để học.", {
    x: 3.5,
    y: 1.35,
    w: 6,
    h: 0.6,
    fontFace: HEAD,
    fontSize: 24,
    italic: true,
    bold: true,
    color: TEAL,
    margin: 0,
    isTextBox: true,
  });
  const pts = [
    ["Phản hồi dễ hiểu", "“Chưa đúng rồi. Con xem lại vần rồi chọn lại nhé.”"],
    ["Gợi ý khi cần", "Nút Gợi ý giúp con tìm lại hướng đi."],
    ["Có cơ hội thử lại", "Con được chọn lại ngay trong cùng câu."],
    ["Không áp lực, không chê trách", "Màu sắc dịu, lời nói nhẹ nhàng, không đếm ngược thời gian."],
  ];
  pts.forEach((t, i) => {
    const y = 2.15 + i * 0.72;
    s.addShape(pres.ShapeType.ellipse, { x: 3.5, y: y + 0.07, w: 0.2, h: 0.2, fill: { color: GOLD } });
    s.addText(t[0], {
      x: 3.9,
      y,
      w: 5.5,
      h: 0.3,
      fontFace: HEAD,
      fontSize: 15,
      bold: true,
      color: NAVY,
      margin: 0,
      isTextBox: true,
    });
    s.addText(t[1], {
      x: 3.9,
      y: y + 0.3,
      w: 5.5,
      h: 0.3,
      fontFace: BODY,
      fontSize: 13,
      color: MUTED,
      margin: 0,
      isTextBox: true,
    });
  });
}

// 10. Điểm thưởng
{
  const s = pres.addSlide({ masterName: "LIGHT" });
  header(s, "Động lực", "Điểm thưởng tạo hứng thú luyện tập");
  const st = [
    ["+10", "Trả lời đúng được cộng điểm", TEAL],
    ["−5", "Trả lời sai trừ nhẹ, hiển thị trung tính", SLATE],
    ["0", "Số điểm không bao giờ xuống dưới 0", GOLD],
  ];
  st.forEach((t, i) => {
    const x = 0.6 + i * 1.5;
    card(s, x, 1.45, 1.35, 1.9);
    s.addText(t[0], {
      x,
      y: 1.55,
      w: 1.35,
      h: 0.8,
      fontFace: HEAD,
      fontSize: 38,
      bold: true,
      color: t[2],
      align: "center",
      valign: "middle",
      margin: 0,
      isTextBox: true,
    });
    s.addText(t[1], {
      x: x + 0.1,
      y: 2.4,
      w: 1.15,
      h: 0.9,
      fontFace: BODY,
      fontSize: 11,
      color: MUTED,
      align: "center",
      valign: "top",
      margin: 0,
      isTextBox: true,
    });
  });
  await addPic(s, "crop-points.jpg", 5.25, 1.55, 4.25, 1.69, { radius: 0.12, pos: "centre", alt: "Ô điểm thưởng" });
  caption(s, "Ô điểm thưởng — số điểm minh họa", 5.25, 3.38, 4.2);
  s.addShape(pres.ShapeType.roundRect, { x: 0.6, y: 3.7, w: 8.9, h: 1.25, rectRadius: 0.12, fill: { color: GOLD_L } });
  s.addText(
    [
      { text: "Đây là điểm khuyến khích, ", options: { bold: true, color: NAVY } },
      {
        text: "không phải điểm kiểm tra và không dùng để đánh giá năng lực học sinh. Điểm giúp mở dần các khu vực khám phá: cứ mỗi 30 điểm tích lũy, một mốc mới của bản đồ được mở.",
        options: { color: INK },
      },
    ],
    { x: 0.85, y: 3.78, w: 8.4, h: 1.1, fontFace: BODY, fontSize: 14, valign: "middle", margin: 0, isTextBox: true },
  );
}

// 11. Bản đồ
{
  const s = pres.addSlide({ masterName: "LIGHT" });
  header(s, "Khám phá", "Bản đồ thế giới kỳ diệu");
  await addPic(s, "crop-worldmap.jpg", 0.6, 1.4, 5.7, 3.46, { radius: 0.14, alt: "Bản đồ thế giới phiêu lưu" });
  chip(s, "done", 6.6, 1.45, "ĐÃ CÓ · DỮ LIỆU MINH HỌA");
  bullets(
    s,
    [
      "Bốn khu vực: Mê cung kho báu, Rừng chữ kỳ diệu, Đảo dấu thanh, Lâu đài ghép vần.",
      "Luyện tập giúp mở thêm những trải nghiệm mới.",
      "Hiện chỉ Mê cung đang được xây dựng.",
      "Trẻ nhìn thấy hành trình của mình qua hình ảnh, không chỉ qua con số.",
    ],
    6.6,
    1.95,
    2.9,
    { size: 14, gap: 10 },
  );
  caption(s, "Ảnh chụp bản chơi thử", 0.6, 4.9, 4);
}

// 12. Mê cung
{
  const s = pres.addSlide({ masterName: "LIGHT" });
  header(s, "Trò chơi", "Mê cung kho báu");
  await addPic(s, "crop-board.jpg", 0.6, 1.4, 3.8, 3.8, { radius: 0.16, alt: "Bàn Mê cung kho báu" });
  chip(s, "demo", 4.8, 1.45);
  const b = [
    ["Điều khiển nhân vật", "Bạn nhỏ thám hiểm đi từng ô trong mê cung."],
    ["Tìm đường và khám phá", "Ba màn chơi với độ khó tăng dần."],
    ["Gặp các điểm thử thách", "Mỗi màn có 7 điểm thử thách trên đường."],
    ["Hướng tới kho báu", "Rương kho báu nằm ở cuối màn."],
  ];
  b.forEach((t, i) => {
    const y = 1.95 + i * 0.78;
    numDot(s, i + 1, 4.8, y, 0.36, i === 3 ? GOLD : TEAL);
    s.addText(t[0], {
      x: 5.32,
      y: y - 0.04,
      w: 4.1,
      h: 0.3,
      fontFace: HEAD,
      fontSize: 15,
      bold: true,
      color: NAVY,
      margin: 0,
      isTextBox: true,
    });
    s.addText(t[1], {
      x: 5.32,
      y: y + 0.27,
      w: 4.1,
      h: 0.3,
      fontFace: BODY,
      fontSize: 13,
      color: MUTED,
      margin: 0,
      isTextBox: true,
    });
  });
  caption(s, "Ảnh chụp bản chơi thử: chưa có câu hỏi, chưa tính điểm.", 4.8, 5.0, 4.7);
}

// 13. Điều khiển
{
  const s = pres.addSlide({ masterName: "LIGHT" });
  header(s, "Hướng dẫn chơi", "Điều khiển Mê cung thật dễ");
  // cột 1: điện thoại
  await phone(s, "maze-mobile-pad.jpg", 0.75, 1.3, 3.75, { pos: "bottom" });
  s.addText("Trên điện thoại", {
    x: 2.95,
    y: 1.4,
    w: 2.2,
    h: 0.32,
    fontFace: HEAD,
    fontSize: 15,
    bold: true,
    color: NAVY,
    margin: 0,
    isTextBox: true,
  });
  s.addText("Chạm một lần để đi một ô; giữ nút để đi tiếp.", {
    x: 2.95,
    y: 1.75,
    w: 2.0,
    h: 0.9,
    fontFace: BODY,
    fontSize: 12,
    color: MUTED,
    margin: 0,
    valign: "top",
    isTextBox: true,
  });
  // cột 2: bàn phím vẽ
  s.addText("Trên máy tính", {
    x: 5.3,
    y: 1.4,
    w: 2.2,
    h: 0.32,
    fontFace: HEAD,
    fontSize: 15,
    bold: true,
    color: NAVY,
    margin: 0,
    isTextBox: true,
  });
  const key = (txt, x, y) => {
    s.addShape(pres.ShapeType.roundRect, {
      x,
      y,
      w: 0.55,
      h: 0.55,
      rectRadius: 0.1,
      fill: { color: WHITE },
      line: { color: "D9CDB2", width: 1.5 },
      shadow: shadow(),
    });
    s.addText(txt, {
      x,
      y,
      w: 0.55,
      h: 0.55,
      fontFace: BODY,
      fontSize: 18,
      bold: true,
      color: NAVY,
      align: "center",
      valign: "middle",
      margin: 0,
      isTextBox: true,
    });
  };
  key("↑", 5.95, 1.85);
  key("←", 5.35, 2.45);
  key("↓", 5.95, 2.45);
  key("→", 6.55, 2.45);
  s.addText("Phím mũi tên hoặc W A S D", {
    x: 5.3,
    y: 3.1,
    w: 2.2,
    h: 0.5,
    fontFace: BODY,
    fontSize: 12,
    color: MUTED,
    margin: 0,
    valign: "top",
    isTextBox: true,
  });
  // cột 3: tạm dừng / chơi tiếp
  s.addText("Tạm dừng và chơi tiếp", {
    x: 7.5,
    y: 1.4,
    w: 2.2,
    h: 0.32,
    fontFace: HEAD,
    fontSize: 15,
    bold: true,
    color: NAVY,
    margin: 0,
    isTextBox: true,
  });
  [
    ["Tạm dừng", 1.9, WHITE, NAVY],
    ["Chơi tiếp", 2.5, TEAL, WHITE],
  ].forEach(([t, y, f, c]) => {
    s.addShape(pres.ShapeType.roundRect, {
      x: 7.5,
      y,
      w: 1.9,
      h: 0.45,
      rectRadius: 0.22,
      fill: { color: f },
      line: { color: f === WHITE ? "D9CDB2" : TEAL, width: 1.5 },
    });
    s.addText(t, {
      x: 7.5,
      y,
      w: 1.9,
      h: 0.45,
      fontFace: BODY,
      fontSize: 14,
      bold: true,
      color: c,
      align: "center",
      valign: "middle",
      margin: 0,
      isTextBox: true,
    });
  });
  s.addText("Ở chế độ học của con, vị trí được tự lưu để tiếp tục hành trình lần sau.", {
    x: 7.5,
    y: 3.1,
    w: 1.95,
    h: 1.3,
    fontFace: BODY,
    fontSize: 12,
    color: MUTED,
    margin: 0,
    valign: "top",
    isTextBox: true,
  });
  s.addShape(pres.ShapeType.roundRect, { x: 5.3, y: 4.35, w: 4.1, h: 0.7, rectRadius: 0.1, fill: { color: GOLD_L } });
  s.addText("Màn chơi có thể phóng to theo bạn nhỏ trên điện thoại, nút lớn dễ chạm.", {
    x: 5.45,
    y: 4.35,
    w: 3.85,
    h: 0.7,
    fontFace: BODY,
    fontSize: 12,
    color: INK,
    valign: "middle",
    margin: 0,
    isTextBox: true,
  });
  chip(s, "demo", 3.0, 4.6);
}

// 14. Quái vật
{
  const s = pres.addSlide({ masterName: "LIGHT" });
  header(s, "Đang hoàn thiện", "Quái vật và thử thách Tiếng Việt");
  s.addShape(pres.ShapeType.ellipse, { x: 0.7, y: 1.4, w: 3.6, h: 3.6, fill: { color: "E9E2FA" } });
  await addPic(s, "art-monster.png", 0.8, 1.5, 3.4, 3.4, {
    radius: 0,
    fit: "contain",
    png: true,
    alt: "Bạn quái vật thân thiện",
  });
  chip(s, "wip", 4.8, 1.45);
  const n = [
    ["7", "bạn quái vật thân thiện mỗi màn"],
    ["3", "câu hỏi Tiếng Việt cho mỗi bạn"],
    ["21", "câu hỏi trong một màn chơi"],
  ];
  n.forEach((t, i) => {
    const x = 4.8 + i * 1.6;
    card(s, x, 1.95, 1.45, 1.35);
    s.addText(t[0], {
      x,
      y: 2.0,
      w: 1.45,
      h: 0.65,
      fontFace: HEAD,
      fontSize: 34,
      bold: true,
      color: i === 2 ? GOLD : TEAL,
      align: "center",
      valign: "middle",
      margin: 0,
      isTextBox: true,
    });
    s.addText(t[1], {
      x: x + 0.1,
      y: 2.65,
      w: 1.25,
      h: 0.6,
      fontFace: BODY,
      fontSize: 11,
      color: MUTED,
      align: "center",
      valign: "top",
      margin: 0,
      isTextBox: true,
    });
  });
  bullets(
    s,
    [
      "Học sinh trả lời để vượt qua thử thách của từng bạn.",
      "Sau các cuộc gặp gỡ, học sinh mở được rương kho báu.",
      "Đã chuẩn bị sẵn 7 chạm trán và 21 câu hỏi mỗi màn.",
    ],
    4.8,
    3.5,
    4.7,
    { size: 13, gap: 5 },
  );
  s.addShape(pres.ShapeType.roundRect, { x: 4.8, y: 4.5, w: 4.7, h: 0.5, rectRadius: 0.1, fill: { color: "FBE9DD" } });
  s.addText("Đang hoàn thiện phần tương tác và chấm điểm trong trò chơi.", {
    x: 4.9,
    y: 4.5,
    w: 4.5,
    h: 0.5,
    fontFace: BODY,
    fontSize: 12,
    bold: true,
    color: ORANGE,
    valign: "middle",
    margin: 0,
    isTextBox: true,
  });
}

// 15. Giáo viên
{
  const s = pres.addSlide({ masterName: "LIGHT" });
  header(s, "Giáo viên", "Giáo viên đồng hành ra sao?");
  await browser(s, "crop-t-students.jpg", 0.6, 1.4, 5.1, 2.95);
  chip(s, "demo", 0.6, 4.5, "ẢNH CHỤP · DỮ LIỆU GIẢ");
  caption(s, "Danh sách học sinh với biệt danh hư cấu; chỉ giáo viên xem được nhóm năng lực.", 0.6, 4.85, 5.1);
  const f = [
    ["Quản lý lớp, học sinh, thẻ học", "done", undefined],
    ["Bảng điểm lớp, chế độ trình chiếu", "done", "ĐÃ CÓ · MẶC ĐỊNH TẮT"],
    ["Vinh danh TOP 3, mùa thi đua", "wip", undefined],
    ["Duyệt học liệu, theo dõi tiến bộ", "plan", undefined],
  ];
  f.forEach((t, i) => {
    const y = 1.4 + i * 0.85;
    card(s, 5.95, y, 3.55, 0.72);
    s.addText(t[0], {
      x: 6.1,
      y: y + 0.04,
      w: 3.3,
      h: 0.3,
      fontFace: HEAD,
      fontSize: 12,
      bold: true,
      color: NAVY,
      margin: 0,
      isTextBox: true,
    });
    chip(s, t[1], 6.1, y + 0.38, t[2]);
  });
  caption(s, "Gồm cả ghi nhận đồng ý của phụ huynh.", 5.95, 4.85, 3.55);
}

// 16. Phụ huynh
{
  const s = pres.addSlide({ masterName: "LIGHT" });
  header(s, "Phụ huynh", "Phụ huynh đồng hành ra sao?");
  const it = [
    ["Giúp con vào đúng trang học", "Quét thẻ học một lần, con tự vào trang của mình."],
    ["Khuyến khích luyện tập vừa sức", "Mỗi ngày một chút, đều đặn, không ép buộc."],
    ["Quan tâm sự tiến bộ", "Nhìn vào hành trình của con thay vì chỉ nhìn điểm."],
    ["Đồng hành cùng giáo viên", "Cùng động viên để con tự tin hơn khi đọc."],
  ];
  for (let i = 0; i < 4; i++) {
    const x = 0.6 + (i % 2) * 3.2;
    const y = 1.45 + Math.floor(i / 2) * 1.75;
    card(s, x, y, 3.0, 1.55);
    s.addShape(pres.ShapeType.ellipse, {
      x: x + 0.18,
      y: y + 0.2,
      w: 0.5,
      h: 0.5,
      fill: { color: i % 2 ? GOLD_L : TEAL_L },
    });
    s.addShape(pres.ShapeType.heart, {
      x: x + 0.29,
      y: y + 0.33,
      w: 0.28,
      h: 0.25,
      fill: { color: i % 2 ? GOLD : TEAL },
    });
    s.addText(it[i][0], {
      x: x + 0.8,
      y: y + 0.16,
      w: 2.1,
      h: 0.62,
      fontFace: HEAD,
      fontSize: 14,
      bold: true,
      color: NAVY,
      margin: 0,
      valign: "middle",
      isTextBox: true,
    });
    s.addText(it[i][1], {
      x: x + 0.2,
      y: y + 0.88,
      w: 2.65,
      h: 0.6,
      fontFace: BODY,
      fontSize: 12,
      color: MUTED,
      margin: 0,
      valign: "top",
      isTextBox: true,
    });
  }
  s.addShape(pres.ShapeType.roundRect, { x: 7.05, y: 1.45, w: 2.45, h: 3.3, rectRadius: 0.2, fill: { color: TEAL_L } });
  await addPic(s, "art-owl.png", 7.1, 1.6, 2.35, 2.35, { radius: 0, fit: "contain", png: true, alt: "Cú Bông" });
  s.addText("Cú Bông đồng hành", {
    x: 7.2,
    y: 3.95,
    w: 2.15,
    h: 0.4,
    fontFace: HEAD,
    fontSize: 13,
    bold: true,
    color: NAVY,
    align: "center",
    margin: 0,
    isTextBox: true,
  });
  chip(s, "plan", 7.2, 4.35, "GÓC PHỤ HUYNH: DỰ KIẾN");
}

// 17. An toàn
{
  const s = pres.addSlide({ masterName: "LIGHT" });
  header(s, "An toàn", "An toàn và phù hợp với học sinh nhỏ tuổi");
  const it = [
    ["Giao diện thân thiện", "Nút bấm lớn, mỗi màn hình một nhiệm vụ, chữ to rõ."],
    ["Phản hồi tích cực", "Không gây sợ hãi. Không quảng cáo, không liên kết ra ngoài, không ô gõ tự do."],
    [
      "Tôn trọng thông tin của con",
      "Chỉ dùng biệt danh; không thu thập họ tên, ảnh thật, giọng nói. Học sinh không trò chuyện với AI.",
    ],
    ["Đồng ý và kiểm soát", "Chỉ ghi dữ liệu khi phụ huynh đồng ý. Bảng xếp hạng chỉ trong lớp, mặc định tắt."],
  ];
  const shp = [pres.ShapeType.roundRect, pres.ShapeType.star5, pres.ShapeType.heart, pres.ShapeType.hexagon];
  for (let i = 0; i < 4; i++) {
    const x = 0.6 + (i % 2) * 3.35;
    const y = 1.45 + Math.floor(i / 2) * 1.8;
    card(s, x, y, 3.15, 1.6);
    s.addShape(pres.ShapeType.ellipse, { x: x + 0.18, y: y + 0.18, w: 0.55, h: 0.55, fill: { color: NAVY } });
    s.addShape(shp[i], { x: x + 0.32, y: y + 0.33, w: 0.27, h: 0.25, fill: { color: GOLD } });
    s.addText(it[i][0], {
      x: x + 0.88,
      y: y + 0.18,
      w: 2.15,
      h: 0.55,
      fontFace: HEAD,
      fontSize: 14,
      bold: true,
      color: NAVY,
      margin: 0,
      valign: "middle",
      isTextBox: true,
    });
    s.addText(it[i][1], {
      x: x + 0.2,
      y: y + 0.85,
      w: 2.8,
      h: 0.7,
      fontFace: BODY,
      fontSize: 12,
      color: MUTED,
      margin: 0,
      valign: "top",
      isTextBox: true,
    });
  }
  s.addShape(pres.ShapeType.roundRect, { x: 7.4, y: 1.45, w: 2.1, h: 3.4, rectRadius: 0.2, fill: { color: GOLD_L } });
  await addPic(s, "art-kid.png", 7.4, 1.6, 2.1, 2.1, {
    radius: 0,
    fit: "contain",
    png: true,
    alt: "Bạn nhỏ thám hiểm",
  });
  s.addText("Trẻ em là ưu tiên số một", {
    x: 7.5,
    y: 3.8,
    w: 1.9,
    h: 0.8,
    fontFace: HEAD,
    fontSize: 14,
    bold: true,
    color: NAVY,
    align: "center",
    valign: "middle",
    margin: 0,
    isTextBox: true,
  });
}

// 18. Đã thực hiện
{
  const s = pres.addSlide({ masterName: "LIGHT" });
  header(s, "Kết quả", "Những gì dự án đã thực hiện");
  card(s, 0.6, 1.4, 5.0, 2.8);
  chip(s, "done", 0.8, 1.52);
  bullets(
    s,
    [
      "Bài luyện sáu dạng với hỗ trợ giảm dần",
      "Giao diện học sinh; khu giáo viên (lớp, học sinh, thẻ học)",
      "Điểm thưởng chấm trên máy chủ, bản đồ khám phá",
      "Bản chơi thử Mê cung: điều khiển, tạm dừng, lưu tiến độ",
      "Nền tảng 7 chạm trán và 21 câu hỏi mỗi màn",
      "Các đợt kiểm thử tự động chức năng và giao diện",
    ],
    0.85,
    1.92,
    4.6,
    { size: 13, gap: 4 },
  );
  card(s, 5.8, 1.4, 3.7, 2.8, "FDF6EC");
  chip(s, "wip", 6.0, 1.52, "ĐANG HOÀN THIỆN / CHỜ DUYỆT");
  bullets(
    s,
    [
      "Chạm trán học tập hoàn chỉnh trong Mê cung",
      "Học liệu thật chờ giáo viên duyệt",
      "Âm thanh đọc Tiếng Việt",
      "Bảng xếp hạng, vinh danh: chưa bật cho học sinh",
    ],
    6.05,
    1.92,
    3.3,
    { size: 13, gap: 6 },
  );
  s.addText(
    "Đang chạy thử trên máy phát triển với dữ liệu giả. Chưa triển khai chính thức, chưa thí điểm với học sinh.",
    {
      x: 0.6,
      y: 4.3,
      w: 8.9,
      h: 0.45,
      fontFace: BODY,
      fontSize: 14,
      bold: true,
      italic: true,
      color: NAVY,
      margin: 0,
      valign: "middle",
      isTextBox: true,
    },
  );
  s.addText("Cách đọc nhãn:", {
    x: 0.6,
    y: 4.85,
    w: 1.2,
    h: 0.28,
    fontFace: BODY,
    fontSize: 11,
    color: MUTED,
    valign: "middle",
    margin: 0,
    isTextBox: true,
  });
  let lx = 1.8;
  for (const k of ["done", "demo", "wip", "plan"]) lx += chip(s, k, lx, 4.85) + 0.15;
}

// 19. Hướng phát triển
{
  const s = pres.addSlide({ masterName: "LIGHT" });
  header(s, "Lộ trình", "Hướng phát triển tiếp theo");
  const steps = [
    ["Hoàn thiện Mê cung", "Chạm trán, chấm điểm, kho báu"],
    ["Âm thanh và học liệu", "Âm thanh, duyệt học liệu, góc phụ huynh"],
    ["Kiểm thử tổng thể", "Rà soát an toàn, giao diện, thiết bị"],
    ["Đưa vào sử dụng", "Theo kế hoạch, từng bước"],
  ];
  steps.forEach((t, i) => {
    const x = 0.6 + i * 2.28;
    card(s, x, 1.5, 2.08, 1.9, i === 0 ? TEAL_L : WHITE);
    numDot(s, i + 1, x + 0.17, 1.65, 0.4, i === 0 ? TEAL : NAVY2);
    s.addText(t[0], {
      x: x + 0.17,
      y: 2.15,
      w: 1.8,
      h: 0.55,
      fontFace: HEAD,
      fontSize: 14,
      bold: true,
      color: NAVY,
      margin: 0,
      valign: "top",
      isTextBox: true,
    });
    s.addText(t[1], {
      x: x + 0.17,
      y: 2.72,
      w: 1.8,
      h: 0.6,
      fontFace: BODY,
      fontSize: 11,
      color: MUTED,
      margin: 0,
      valign: "top",
      isTextBox: true,
    });
    if (i < 3)
      s.addShape(pres.ShapeType.triangle, { x: x + 2.1, y: 2.35, w: 0.14, h: 0.2, rotate: 90, fill: { color: GOLD } });
  });
  s.addText("Định hướng phát triển sau", {
    x: 0.6,
    y: 3.65,
    w: 5,
    h: 0.32,
    fontFace: HEAD,
    fontSize: 15,
    bold: true,
    color: NAVY,
    margin: 0,
    isTextBox: true,
  });
  ["Rừng chữ kỳ diệu", "Đảo dấu thanh", "Lâu đài ghép vần"].forEach((t, i) => {
    const x = 0.6 + i * 3.0;
    s.addShape(pres.ShapeType.roundRect, {
      x,
      y: 4.1,
      w: 2.8,
      h: 0.65,
      rectRadius: 0.12,
      fill: { color: "ECE8F6" },
      line: { color: "CFC6EA", width: 1 },
    });
    s.addText(t, {
      x,
      y: 4.1,
      w: 2.8,
      h: 0.65,
      fontFace: HEAD,
      fontSize: 14,
      bold: true,
      color: NAVY2,
      align: "center",
      valign: "middle",
      margin: 0,
      isTextBox: true,
    });
  });
  chip(s, "plan", 3.55, 3.69, "SAU KHI NỘP DỰ ÁN");
}

// 20. Kết luận
{
  const s = pres.addSlide({ masterName: "DARK" });
  s.addShape(pres.ShapeType.ellipse, { x: -1.5, y: 2.6, w: 6, h: 6, fill: { color: NAVY2, transparency: 45 } });
  s.addText("READMATE AI", {
    x: 0.7,
    y: 0.6,
    w: 8.6,
    h: 0.35,
    fontFace: BODY,
    fontSize: 14,
    bold: true,
    color: GOLD,
    charSpacing: 5,
    align: "center",
    margin: 0,
    isTextBox: true,
  });
  s.addText("Để mỗi ngày luyện đọc là một hành trình thú vị", {
    x: 1.2,
    y: 1.05,
    w: 7.6,
    h: 1.4,
    fontFace: HEAD,
    fontSize: 34,
    bold: true,
    color: WHITE,
    align: "center",
    valign: "middle",
    margin: 0,
    isTextBox: true,
  });
  await addPic(s, "art-kid.png", 1.9, 2.55, 1.9, 1.9, {
    radius: 0,
    fit: "contain",
    png: true,
    alt: "Bạn nhỏ thám hiểm",
  });
  await addPic(s, "art-owl.png", 4.05, 2.55, 1.9, 1.9, { radius: 0, fit: "contain", png: true, alt: "Cú Bông" });
  await addPic(s, "art-monster.png", 6.2, 2.55, 1.9, 1.9, {
    radius: 0,
    fit: "contain",
    png: true,
    alt: "Bạn quái vật",
  });
  s.addText("Xin trân trọng cảm ơn!", {
    x: 1.2,
    y: 4.5,
    w: 7.6,
    h: 0.6,
    fontFace: HEAD,
    fontSize: 24,
    italic: true,
    color: GOLD,
    align: "center",
    margin: 0,
    isTextBox: true,
  });
}

const { SPEECH } = await import("./speech.mjs");
if (pres.slides.length !== SPEECH.length)
  throw new Error(`Số slide ${pres.slides.length} != số lời dẫn ${SPEECH.length}`);
pres.slides.forEach((sl, i) => sl.addNotes(SPEECH[i].text));
await pres.writeFile({ fileName: OUT });
console.log("Đã ghi", OUT);
