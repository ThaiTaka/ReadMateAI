import rimes from "../../../content/kb/rimes.json";
import { isPlaybackRole } from "../audio-playback/roles.ts";
import type { LineRow } from "./build.ts";

/** Số vần trong kho tri thức — báo cáo chỉ NÊU số này, chưa theo dõi bản ghi vần (chưa có công cụ ghi vần cho học sinh nghe). */
export const RIME_TOTAL: number = (rimes as { items: readonly unknown[] }).items.length;

/**
 * Loại lời đọc đã được NỐI vào màn hình học sinh, suy từ danh sách khe phát thật (`PLAYBACK_ROLES`) — không khai báo tay, nên khi nối
 * thêm lời phản hồi vào màn hình học thì báo cáo tự đổi, và khi chưa nối thì báo cáo không hứa học sinh nghe được.
 */
export const WIRED_PURPOSES: readonly LineRow["purpose"][] = (["instruction", "feedback"] as const).filter(
  isPlaybackRole,
);
