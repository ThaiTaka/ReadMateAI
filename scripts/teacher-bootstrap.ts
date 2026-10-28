/**
 * npm run teacher:bootstrap — tạo tài khoản GIÁO VIÊN cho máy dev (Supabase LOCAL) bằng Admin API.
 *
 *   npm run teacher:bootstrap -- --email <email> [--name "Tên hiển thị"] [--reset-password] [--no-test-content] [--yes]
 *
 * - CHỈ Supabase local (127.0.0.1/localhost): từ chối mọi URL khác, kể cả khi đặt ALLOW_REMOTE_SEED. Không tạo Supabase Cloud,
 *   không tài khoản production.
 * - Mật khẩu nhập ẨN tại terminal (hoặc dòng đầu của đầu vào chuẩn với --password-stdin). KHÔNG có trong mã, tệp, tham số,
 *   biến môi trường, nhật ký hay Git; không bao giờ được in ra.
 * - Chạy lại không tạo trùng và không đổi mật khẩu tài khoản đã có (trừ khi --reset-password).
 * - Chạy trong terminal TƯƠNG TÁC của bạn (PowerShell), không phải qua công cụ không có terminal.
 */
import { readFileSync } from "node:fs";
import { exit, stderr, stdout } from "node:process";
import { parseArgs } from "node:util";
import { installGameFixtures } from "./lib/game-fixtures.ts";
import { askLine, InputError, readFirstStdinLine, readHiddenLine } from "./lib/hidden-input.ts";
import { adminClient, isLocalUrl, publicClient, scriptEnv } from "./lib/local-supabase.ts";
import { syncContent } from "./lib/content-sync.ts";
import {
  bootstrapTeacher,
  checkPassword,
  DEV_CLASS_NAME,
  DEV_SCHOOL_NAME,
  DEV_SCHOOL_YEAR,
  findUserByEmail,
  MIN_PASSWORD_LENGTH,
  normalizeDisplayName,
  normalizeEmail,
  type TestContentContext,
} from "./lib/teacher-bootstrap.ts";
import { enableLocalTestFixtures } from "./lib/test-fixtures.ts";

const out = (line = "") => stdout.write(`${line}\n`);
const err = (line = "") => stderr.write(`${line}\n`);

const USAGE = `Tạo tài khoản giáo viên cho máy dev (Supabase local).

Dùng:
  npm run teacher:bootstrap -- --email <email> [tùy chọn]

Tùy chọn:
  --email <email>        Email đăng nhập (không có thì được hỏi)
  --name "<tên>"         Tên hiển thị của giáo viên (mặc định "Giáo viên phát triển")
  --reset-password       Đặt lại mật khẩu của tài khoản ĐÃ CÓ (mặc định: giữ nguyên)
  --test-content         Cài nội dung THỬ NGHIỆM (hư cấu) cho lớp phát triển để chơi thử trên máy
  --no-test-content      Không cài nội dung thử nghiệm
  --password-stdin       Đọc mật khẩu từ dòng đầu của đầu vào chuẩn (khi không có terminal tương tác)
  --yes                  Bỏ qua câu hỏi xác nhận
  --help                 Hiện hướng dẫn này

Mật khẩu được nhập ẨN tại terminal; không bao giờ được in ra, ghi vào tệp hay Git.`;

class Refusal extends Error {}

function projectId(): string {
  try {
    const config = readFileSync("supabase/config.toml", "utf8");
    return /^project_id\s*=\s*"([^"]+)"/mu.exec(config)?.[1] ?? "(không rõ)";
  } catch {
    return "(không đọc được supabase/config.toml)";
  }
}

async function installTestContent({ admin, teacherId, classId }: TestContentContext): Promise<void> {
  // Cần bản phát hành kho tri thức (db:sync-content); chạy bù nếu chưa có.
  const release = await admin.from("content_releases").select("id").limit(1);
  if (release.error) throw new Error(`content_releases: ${release.error.code ?? "lỗi"}`);
  if ((release.data ?? []).length === 0) await syncContent(admin);
  enableLocalTestFixtures();
  const fixtures = await installGameFixtures(admin, teacherId);
  const update = await admin
    .from("classes")
    .update({
      curriculum_series_id: fixtures.seriesId,
      current_lesson_id: fixtures.lessonIds[2],
      curriculum_status: "confirmed",
      curriculum_confirmed_by: teacherId,
      curriculum_confirmed_at: new Date().toISOString(),
    })
    .eq("id", classId);
  if (update.error) throw new Error(`classes: ${update.error.code ?? "lỗi"}`);
}

async function main() {
  const { values } = parseArgs({
    options: {
      email: { type: "string" },
      name: { type: "string" },
      "reset-password": { type: "boolean", default: false },
      "test-content": { type: "boolean", default: false },
      "no-test-content": { type: "boolean", default: false },
      "password-stdin": { type: "boolean", default: false },
      yes: { type: "boolean", default: false },
      help: { type: "boolean", default: false },
    },
    allowPositionals: false,
  });
  if (values.help) {
    out(USAGE);
    return 0;
  }
  if (values["test-content"] && values["no-test-content"])
    throw new Refusal("Chọn một trong --test-content / --no-test-content.");

  // 1. CHỈ Supabase local — kiểm tra nghiêm hơn các script khác (không có ngoại lệ ALLOW_REMOTE_SEED).
  let env;
  try {
    env = scriptEnv();
  } catch {
    throw new Refusal("Chưa kết nối được Supabase local. Chạy `npm run db:start` rồi `npm run db:env`.");
  }
  if (!isLocalUrl(env.apiUrl)) {
    throw new Refusal("Từ chối: lệnh này chỉ chạy với Supabase local (127.0.0.1/localhost) trong giai đoạn này.");
  }
  const admin = adminClient(env);
  const ping = await admin.from("schools").select("id", { count: "exact", head: true });
  if (ping.error) throw new Refusal("CSDL local chưa có lược đồ ReadMate AI. Chạy `npm run db:reset` rồi thử lại.");

  // 2. Thông tin đầu vào.
  const interactive = Boolean(process.stdin.isTTY);
  let emailRaw = values.email ?? "";
  if (!emailRaw) {
    if (!interactive) throw new Refusal("Thiếu --email (không có terminal tương tác để hỏi).");
    emailRaw = await askLine("Email đăng nhập của giáo viên: ");
  }
  const email = normalizeEmail(emailRaw);
  if (!email) throw new Refusal("Email không hợp lệ.");
  let nameRaw = values.name ?? "";
  if (!nameRaw) nameRaw = interactive ? await askLine("Tên hiển thị [Giáo viên phát triển]: ") : "";
  const displayName = normalizeDisplayName(nameRaw || "Giáo viên phát triển");
  if (!displayName) throw new Refusal("Tên hiển thị không hợp lệ (1–60 ký tự, không ký tự điều khiển).");

  const existing = await findUserByEmail(admin, email);
  const resetPassword = values["reset-password"];
  if (!existing && resetPassword) {
    out("Lưu ý: tài khoản chưa có nên --reset-password không có tác dụng; mật khẩu sẽ được đặt khi tạo.");
  }

  // 3. Nội dung thử nghiệm: hỏi nếu không chỉ định và có terminal.
  let testContent = values["test-content"];
  if (!values["test-content"] && !values["no-test-content"] && interactive) {
    const answer = await askLine(
      "Cài nội dung THỬ NGHIỆM (hư cấu, chỉ trên máy này) cho lớp phát triển để chơi thử luyện tập và Mê cung? [Y/n] ",
    );
    testContent = !/^n/iu.test(answer);
  }

  // 4. Xác nhận dự án + môi trường trước khi làm gì.
  out("");
  out("ReadMate AI — tạo tài khoản giáo viên (CHỈ Supabase local)");
  out(`  Dự án Supabase : ${projectId()}`);
  out(`  API            : ${env.apiUrl}`);
  out(`  Email          : ${email}`);
  out(`  Tên hiển thị   : ${displayName}`);
  out(`  Trường / lớp   : ${DEV_SCHOOL_NAME} / ${DEV_CLASS_NAME} (${DEV_SCHOOL_YEAR}) — hư cấu, không phải lớp thật`);
  out(
    existing
      ? resetPassword
        ? "  Tài khoản      : ĐÃ CÓ — mật khẩu sẽ được ĐẶT LẠI theo yêu cầu của bạn"
        : "  Tài khoản      : ĐÃ CÓ — giữ nguyên mật khẩu, chỉ bảo đảm hồ sơ giáo viên và lớp"
      : "  Tài khoản      : CHƯA CÓ — sẽ được tạo (bạn sẽ đặt mật khẩu)",
  );
  out(
    testContent
      ? "  Nội dung       : sẽ cài nội dung THỬ NGHIỆM hư cấu (đánh dấu test_fixture) cho lớp phát triển"
      : "  Nội dung       : không cài nội dung thử nghiệm",
  );
  out("");
  if (!values.yes) {
    if (!interactive) throw new Refusal("Không có terminal tương tác để xác nhận. Thêm --yes nếu bạn chắc chắn.");
    const answer = await askLine("Tiếp tục? Gõ y để đồng ý: ");
    if (!/^(y|yes|có|co)$/iu.test(answer)) throw new Refusal("Đã hủy, chưa thay đổi gì.");
  }

  // 5. Mật khẩu: nhập ẩn (hoặc từ stdin); giữ trong bộ nhớ chỉ đủ để đăng nhập thử rồi xóa.
  let remembered: string | null = null;
  const readPassword = async (): Promise<string> => {
    if (values["password-stdin"]) {
      remembered = await readFirstStdinLine();
      return remembered;
    }
    if (!interactive) throw new Refusal("Cần terminal tương tác hoặc --password-stdin để nhập mật khẩu.");
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const first = await readHiddenLine(`Mật khẩu (ít nhất ${MIN_PASSWORD_LENGTH} ký tự, không hiện khi gõ): `);
      const verdict = checkPassword(first, email);
      if (!verdict.ok) {
        err(verdict.reason);
        continue;
      }
      const second = await readHiddenLine("Nhập lại mật khẩu: ");
      if (first !== second) {
        err("Hai lần nhập không khớp.");
        continue;
      }
      remembered = first;
      return first;
    }
    throw new Refusal("Đã nhập sai quá 3 lần, chưa thay đổi gì.");
  };

  const result = await bootstrapTeacher(
    { email, displayName, resetPassword, testContent },
    { admin, readPassword, installTestContent },
  );

  // 6. Đăng nhập thử bằng mật khẩu vừa đặt (chỉ trong bộ nhớ) và đọc hồ sơ/lớp qua RLS bằng phiên của chính giáo viên.
  let login = "bỏ qua (không đặt mật khẩu trong lần chạy này)";
  if (remembered !== null) {
    const client = publicClient(env);
    const signedIn = await client.auth.signInWithPassword({ email, password: remembered });
    remembered = null;
    if (signedIn.error) {
      login = `THẤT BẠI (${signedIn.error.code ?? signedIn.error.status ?? "lỗi"})`;
    } else {
      const own = await client.from("staff_profiles").select("display_name, role, is_active").maybeSingle();
      const classes = await client.from("classes").select("name").eq("name", DEV_CLASS_NAME);
      login =
        own.data && own.data.is_active && (classes.data ?? []).length > 0
          ? "thành công (đọc được hồ sơ giáo viên và lớp qua RLS)"
          : "đăng nhập được nhưng chưa thấy hồ sơ/lớp — kiểm tra lại";
      await client.auth.signOut();
    }
  }

  out("Xong.");
  out(
    `  Tài khoản      : ${result.userCreated ? "đã TẠO mới" : "đã có sẵn"}${result.passwordSet ? " · mật khẩu đã được đặt" : " · mật khẩu giữ nguyên"}`,
  );
  out(`  Hồ sơ giáo viên: ${result.profileCreated ? "đã tạo" : "đã có"} · ${DEV_SCHOOL_NAME}`);
  out(
    `  Lớp            : ${DEV_CLASS_NAME} ${result.classCreated ? "(đã tạo)" : "(đã có)"} · vai trò ${result.classRole === "owner" ? "chủ nhiệm" : "cùng dạy"}`,
  );
  out(`  Nội dung thử   : ${result.testContentInstalled ? "đã cài (hư cấu, chỉ local)" : "không cài"}`);
  out(`  Đăng nhập thử  : ${login}`);
  out("");
  out("Đăng nhập tại /login của ứng dụng (npm run dev → http://localhost:3000/login).");
  if (result.passwordSet) {
    out(
      "Nếu mật khẩu này từng được chia sẻ qua chat/ghi chú, hãy đổi sang mật khẩu mới (chạy lại với --reset-password).",
    );
  }
  return login.startsWith("THẤT BẠI") ? 4 : 0;
}

main()
  .then((code) => exit(code))
  .catch((error: unknown) => {
    if (error instanceof Refusal) {
      err(error.message);
      exit(3);
    }
    if (error instanceof InputError) {
      err(error.code === "CANCELLED" ? "Đã hủy." : "Cần terminal tương tác hoặc --password-stdin.");
      exit(error.code === "CANCELLED" ? 3 : 2);
    }
    // Chỉ thông điệp ngắn do mã của ta tạo (không bao giờ chứa mật khẩu); không in cả đối tượng lỗi.
    err(`Lỗi: ${error instanceof Error ? error.message.split("\n")[0] : "không rõ"}`);
    exit(4);
  });
