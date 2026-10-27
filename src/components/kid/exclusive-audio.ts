/**
 * Mỗi lúc chỉ MỘT âm thanh đang phát trong cả trang (R10.3a): bắt đầu cái mới thì dừng cái cũ, nên các nút nghe không bao
 * giờ phát chồng lên nhau. Trạng thái nằm trong module (một trang = một trình duyệt), không lưu ở đâu cả.
 */

let active: HTMLAudioElement | null = null;

/** Dừng hẳn một thẻ audio và nhả tài nguyên (đóng kết nối đang tải). */
export function releaseAudio(audio: HTMLAudioElement): void {
  audio.pause();
  audio.removeAttribute("src");
  audio.load();
  if (active === audio) active = null;
}

/** Đăng ký `audio` là âm đang phát; dừng âm đang phát trước đó (nếu có và khác). */
export function claimAudio(audio: HTMLAudioElement): void {
  if (active && active !== audio) {
    // Thẻ cũ phát sự kiện `pause` → nút của nó tự về trạng thái sẵn sàng.
    active.pause();
  }
  active = audio;
}

export function stopAllAudio(): void {
  if (active) releaseAudio(active);
}
