/**
 * Khe âm thanh nào của biến thể nào dùng BẢN GHI GIÁO VIÊN (R10.3a). Thuần dữ liệu, không phụ thuộc → dùng được ở cả
 * trình duyệt (biết có nên hỏi máy chủ không) lẫn máy chủ (ràng buộc âm ↔ câu ở `bindings.ts`).
 *
 * Mọi khe khác (câu lệnh, tên tranh, từ, câu) thuộc TTS hoặc chưa làm (R10.3b+) nên không có ở đây → không phát gì.
 * Thêm biến thể mới ở đây (kèm test) chỉ sau khi GV đã duyệt chính sách âm thanh của biến thể đó.
 */

/**
 * `stimulus` / `model`: bản ghi GIÁO VIÊN. `instruction` / `feedback`: giọng MÁY của câu lệnh chuẩn và lời phản hồi cố định (thư viện TTS đã
 * duyệt R10.5, hoặc — chỉ ở máy local — tệp chế độ trình diễn cuộc thi): nguồn khác, miền dữ liệu khác, cùng đường phát và cùng chính
 * sách chống lộ đáp án. Khe `feedback` cần thêm mã dòng và chỉ phát khi trạng thái câu khớp (feedback-lines.ts).
 */
export const PLAYBACK_ROLES = ["stimulus", "model", "instruction", "feedback"] as const;
export type PlaybackRole = (typeof PLAYBACK_ROLES)[number];

export function isPlaybackRole(value: string): value is PlaybackRole {
  return (PLAYBACK_ROLES as readonly string[]).includes(value);
}

const BOUND_ROLES: Readonly<Record<string, readonly PlaybackRole[]>> = {
  listen_letter: ["stimulus", "model"],
};

/** Khe lấy từ giọng máy (không phải bản ghi giáo viên): câu lệnh và lời phản hồi cố định. */
export function isTtsRole(role: PlaybackRole): boolean {
  return role === "instruction" || role === "feedback";
}

/** Trình duyệt chỉ biết `variant` (không có đáp án): có nên hỏi máy chủ về âm thanh khe này không. */
export function variantHasRecording(variant: string, role: PlaybackRole): boolean {
  return BOUND_ROLES[variant]?.includes(role) === true;
}
