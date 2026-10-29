import type { Response } from "./primitives.ts";

/**
 * Khóa chuẩn của một câu trả lời — hai câu trả lời "giống nhau về nghĩa" có cùng khóa (chọn nhiều không phụ thuộc
 * thứ tự chọn, nối cặp không phụ thuộc thứ tự cặp). Máy chủ dùng khóa này để từ chối gửi lại đúng câu trả lời cũ
 * (`DUPLICATE_RESPONSE` — không tốn lượt, không bị trừ điểm; GAMIFICATION_SPEC §4.1.4) và làm phần của khóa ý định
 * khi gửi lại cùng `clientAttemptId`. Hàm thuần, chạy được ở trình duyệt và máy chủ.
 */
export function responseKey(response: Response): string {
  switch (response.kind) {
    case "choice":
      return `choice:${response.optionId}`;
    case "multi":
      return `multi:${[...new Set(response.optionIds)].sort().join(",")}`;
    case "build":
      return `build:${response.onset ?? "-"}|${response.rime ?? "-"}|${response.tone ?? "-"}`;
    case "match":
      return `match:${Object.entries(response.pairs)
        .map(([left, right]) => `${left}=${right}`)
        .sort()
        .join(",")}`;
    case "order":
      return `order:${response.tokenIds.join(",")}`;
  }
}

/** Mọi mã phương án/thẻ mà câu trả lời nhắc tới (để máy chủ kiểm tra chúng có thật trong câu). */
export function responseIds(response: Response): string[] {
  switch (response.kind) {
    case "choice":
      return [response.optionId];
    case "multi":
      return [...response.optionIds];
    case "build":
      return [response.onset, response.rime, response.tone].filter((id): id is string => id !== null);
    case "match":
      return Object.entries(response.pairs).flat();
    case "order":
      return [...response.tokenIds];
  }
}
