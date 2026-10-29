import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const srcDir = fileURLToPath(new URL("./src/", import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    // Khớp alias "@/*" trong tsconfig.json (chỉ đường dẫn bắt đầu bằng "@/").
    alias: [
      { find: /^@\//, replacement: srcDir },
      // "server-only" chỉ import được trong lớp React Server Components; trong jsdom dùng module rỗng của chính gói.
      {
        find: /^server-only$/,
        replacement: fileURLToPath(new URL("./node_modules/server-only/empty.js", import.meta.url)),
      },
    ],
  },
  test: {
    environment: "jsdom",
    include: ["tests/unit/**/*.test.{ts,tsx}"],
    setupFiles: ["./tests/unit/setup.ts"],
  },
});
