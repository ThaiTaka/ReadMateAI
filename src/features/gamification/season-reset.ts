import { z } from "zod";

/**
 * Reset mùa (R06.3) — phần THUẦN: hợp đồng đầu vào và so khớp tên lớp. CSDL kiểm tra lại cả hai
 * (`private.reset_class_season`), nên đây chỉ là lớp chặn sớm cho Server Action và giao diện R06.4.
 */

export const resetSeasonInput = z.strictObject({
  classId: z.uuid(),
  requestId: z.uuid(),
  /** Mùa giáo viên đã thấy khi xác nhận — chống xác nhận cũ tạo thêm mùa mới. */
  expectedSeasonId: z.uuid(),
  confirmation: z.string().min(1).max(100),
});
export type ResetSeasonInput = z.infer<typeof resetSeasonInput>;

export const resetSeasonOutput = z.object({
  new_season_id: z.uuid(),
  seq_no: z.number().int().min(2),
  replayed: z.boolean(),
});

/** Cùng quy tắc với CSDL: NFC, bỏ khoảng trắng hai đầu, phân biệt hoa/thường (tên lớp là mã nhận diện, vd. 1A2). */
export const normalizeClassName = (name: string): string => name.normalize("NFC").trim();
export const confirmationMatches = (confirmation: string, className: string): boolean =>
  normalizeClassName(confirmation) === normalizeClassName(className) && normalizeClassName(className).length > 0;
