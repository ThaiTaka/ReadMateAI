/**
 * npm run audio:local-flags -- status | on | off [--yes]
 *
 * Bật/tắt các cờ âm thanh CHỈ trên Supabase LOCAL của máy dev, để bạn tự thử ghi âm, duyệt và nghe thử trên máy:
 *   teacher_audio_recording_approved         giáo viên lưu bản ghi giọng của mình (/teacher/audio)
 *   student_teacher_audio_playback_approved  học sinh nghe bản ghi giáo viên đã duyệt
 *   tts_library_approved                     giáo viên duyệt lời đọc / tạo / duyệt âm thanh giọng máy (/teacher/tts-script)
 *   student_tts_playback_approved            học sinh nghe giọng máy đã duyệt (câu lệnh)
 *
 * AN TOÀN: `supabase db query --local` chỉ nói chuyện với CSDL Docker trên máy này — không có đường tới Supabase Cloud; production luôn để TẮT cả
 * bốn cờ (đổi bằng migration sau khi đạt điều kiện mở, không bằng lệnh này). Danh sách cờ cố định trong mã, không nhận tên cờ từ dòng lệnh.
 * Cờ chỉ ảnh hưởng máy bạn; khi `npm run db:reset` thì tự về TẮT.
 */
import { execSync } from "node:child_process";
import { exit, stderr, stdout } from "node:process";
import { parseArgs } from "node:util";
import { askLine, InputError } from "./lib/hidden-input.ts";
import { isLocalUrl, scriptEnv } from "./lib/local-supabase.ts";

const FLAGS = [
  ["teacher_audio_recording_approved", "Giáo viên lưu bản ghi giọng (/teacher/audio)"],
  ["student_teacher_audio_playback_approved", "Học sinh nghe bản ghi giáo viên đã duyệt"],
  ["tts_library_approved", "Giáo viên duyệt/tạo giọng máy (/teacher/tts-script)"],
  ["student_tts_playback_approved", "Học sinh nghe giọng máy đã duyệt (câu lệnh)"],
] as const;

const out = (line = "") => stdout.write(`${line}\n`);
const err = (line = "") => stderr.write(`${line}\n`);

function query(sql: string): string {
  // SQL do mã này dựng từ danh sách cờ cố định (không nhận chữ từ dòng lệnh) và chỉ có nháy đơn → an toàn khi bọc trong nháy kép.
  return execSync(`npx supabase db query --local -o json "${sql}"`, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function readFlags(): Map<string, boolean> {
  const keys = FLAGS.map(([key]) => `'${key}'`).join(", ");
  const raw = query(`select key, enabled from private.feature_flags where key in (${keys}) order by key`);
  const json = JSON.parse(raw.slice(raw.indexOf("{"))) as { rows?: Array<{ key: string; enabled: boolean }> };
  return new Map((json.rows ?? []).map((row) => [row.key, row.enabled]));
}

function show(prefix: string) {
  const flags = readFlags();
  out(prefix);
  for (const [key, label] of FLAGS) {
    const state = flags.get(key);
    out(`  ${state === undefined ? "?  " : state ? "BẬT" : "TẮT"}  ${key}  — ${label}`);
  }
}

async function main(): Promise<number> {
  const { values, positionals } = parseArgs({
    options: { yes: { type: "boolean", default: false }, help: { type: "boolean", default: false } },
    allowPositionals: true,
  });
  const command = positionals[0] ?? "status";
  if (values.help || !["status", "on", "off"].includes(command)) {
    out("Dùng: npm run audio:local-flags -- status | on | off [--yes]");
    return values.help ? 0 : 2;
  }

  let apiUrl: string;
  try {
    apiUrl = scriptEnv().apiUrl;
  } catch {
    err("Chưa kết nối được Supabase local. Chạy `npm run db:start` rồi `npm run db:env`.");
    return 3;
  }
  if (!isLocalUrl(apiUrl)) {
    err("Từ chối: lệnh này chỉ chạy với Supabase local (127.0.0.1/localhost).");
    return 3;
  }

  if (command === "status") {
    show("Cờ âm thanh trên Supabase LOCAL:");
    return 0;
  }

  const enable = command === "on";
  out(`${enable ? "BẬT" : "TẮT"} bốn cờ âm thanh trên Supabase local (${apiUrl}) — chỉ ảnh hưởng máy này.`);
  if (enable) {
    out("Bật nghĩa là học sinh (trên máy này) nghe được bản ghi/giọng máy ĐÃ DUYỆT; vẫn cần giáo viên duyệt từng tệp.");
  }
  if (!values.yes) {
    const answer = await askLine("Tiếp tục? Gõ y để đồng ý: ");
    if (!/^(y|yes|có|co)$/iu.test(answer)) {
      err("Đã hủy, chưa thay đổi gì.");
      return 3;
    }
  }
  const keys = FLAGS.map(([key]) => `'${key}'`).join(", ");
  query(
    `update private.feature_flags set enabled = ${enable ? "true" : "false"}, updated_at = now() where key in (${keys})`,
  );
  show("Sau khi đổi:");
  return 0;
}

main()
  .then((code) => exit(code))
  .catch((error: unknown) => {
    if (error instanceof InputError) {
      err("Cần terminal tương tác hoặc --yes.");
      exit(2);
    }
    err(`Lỗi: ${error instanceof Error ? error.message.split("\n")[0] : "không rõ"}`);
    exit(4);
  });
