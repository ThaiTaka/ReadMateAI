/*
 * Lược đồ zod cho tệp màn Mê cung kho báu (R07.3). Chỉ kiểm hình dạng dữ liệu; luật bản đồ
 * (kích thước, ký tự, trigger, liên thông) do `validateLevel` của lõi R07.2 quyết định — không có bộ kiểm thứ hai.
 * Tệp màn KHÔNG phải cơ chế bảo mật: server R08 phải tự xác thực mọi sự kiện kích hoạt.
 */
import { z } from "zod";
import type { Level } from "../core/types.ts";

const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const id = z.string().min(1).max(64).regex(ID_PATTERN, "Mã chỉ gồm chữ thường, số và dấu gạch ngang.");
const coordinate = z.number().int().min(0);

const triggerSchema = z.strictObject({ id, row: coordinate, col: coordinate });

export const levelFileSchema = z.strictObject({
  id,
  name: z.string().min(1).max(80),
  rows: z.array(z.string()),
  triggers: z.array(triggerSchema),
});

export type LevelFile = z.infer<typeof levelFileSchema>;

/** Tương thích `Level` của lõi (trường `name` chỉ để hiển thị). */
export function toLevel(file: LevelFile): Level {
  return { id: file.id, rows: file.rows, triggers: file.triggers };
}
