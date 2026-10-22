import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Kiểm thử tích hợp CSDL (R03): chạy trên Supabase LOCAL thật (Docker) qua API (PostgREST + Auth) bằng JWT thật
 * của giáo viên/thiết bị — chứng minh RLS và hàm CSDL, không dùng mock. Cần `npm run db:start` trước.
 * Chạy: npm run test:db
 */
export default defineConfig({
  // Mã dùng chung với ứng dụng (vd. ranking, DTO) có thể dùng alias "@/" như trong Next.js.
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    environment: "node",
    include: ["tests/db/**/*.test.ts"],
    globalSetup: ["./tests/db/global-setup.ts"],
    // Các tệp dùng chung Supabase local và giới hạn tần suất của Auth → chạy tuần tự cho ổn định.
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 120_000,
  },
});
