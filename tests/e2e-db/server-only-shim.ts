/**
 * Chỉ cho kiểm thử E2E: `server-only` cố ý ném lỗi khi bị nhập ngoài gói máy chủ của Next.js. Tiến trình Playwright là Node thuần (không
 * phải gói trình duyệt) và cần dựng lại đúng bản băm/khóa tệp của thư viện giọng máy từ chính mã nguồn máy chủ, nên thay mô-đun này bằng
 * mô-đun rỗng TRƯỚC khi nhập mã máy chủ — cùng cách `vi.mock("server-only")` ở tests/db. Phải là câu `import` ĐẦU TIÊN của tệp dùng nó.
 */
const resolved = require.resolve("server-only");
require.cache[resolved] = { id: resolved, filename: resolved, loaded: true, exports: {} } as unknown as NodeJS.Module;

export {};
