/**
 * Nhập liệu ở terminal cho các lệnh quản trị (chạy bằng Node 24 trực tiếp).
 *
 * Mật khẩu: nhập ẨN (không hiện ký tự, không vào lịch sử lệnh, không qua tham số dòng lệnh hay biến môi trường). Khi không có
 * terminal tương tác (CI, ống dẫn), chỉ nhận mật khẩu qua đầu vào chuẩn (`--password-stdin`) — vẫn không bao giờ ghi ra ngoài.
 */
import { stderr, stdin } from "node:process";

export class InputError extends Error {
  readonly code: "NO_TTY" | "CANCELLED" | "EMPTY";
  constructor(code: InputError["code"]) {
    super(code);
    this.code = code;
  }
}

/** Đọc một dòng ở chế độ ẩn (raw mode). Backspace xóa, Enter xong, Ctrl+C hủy. */
export function readHiddenLine(prompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!stdin.isTTY || typeof stdin.setRawMode !== "function") {
      reject(new InputError("NO_TTY"));
      return;
    }
    stderr.write(prompt);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    let value = "";
    const finish = (outcome: () => void) => {
      stdin.removeListener("data", onData);
      stdin.setRawMode(false);
      stdin.pause();
      stderr.write("\n");
      outcome();
    };
    const onData = (chunk: string) => {
      for (const char of chunk) {
        if (char === "\r" || char === "\n") return finish(() => resolve(value));
        if (char === "\u0003") return finish(() => reject(new InputError("CANCELLED")));
        if (char === "\u007f" || char === "\b") {
          value = value.slice(0, -1);
          continue;
        }
        if (char >= " ") value += char;
      }
    };
    stdin.on("data", onData);
  });
}

/** Đọc dòng đầu tiên của đầu vào chuẩn (cho `--password-stdin`); bỏ ký tự xuống dòng ở cuối, giữ nguyên khoảng trắng khác. */
export async function readFirstStdinLine(): Promise<string> {
  let text = "";
  stdin.setEncoding("utf8");
  for await (const chunk of stdin) {
    text += chunk;
    if (text.includes("\n")) break;
  }
  const line = text.split("\n")[0]?.replace(/\r$/u, "") ?? "";
  if (line.length === 0) throw new InputError("EMPTY");
  return line;
}

/** Hỏi một dòng có hiển thị (email, tên hiển thị, xác nhận). Cần terminal tương tác. */
export async function askLine(prompt: string): Promise<string> {
  if (!stdin.isTTY) throw new InputError("NO_TTY");
  const { createInterface } = await import("node:readline/promises");
  const rl = createInterface({ input: stdin, output: stderr });
  try {
    return (await rl.question(prompt)).trim();
  } finally {
    rl.close();
  }
}
