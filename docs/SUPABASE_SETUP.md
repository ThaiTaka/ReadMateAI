# ReadMate AI — Thiết lập Supabase

> **Trạng thái (R03, 2026-10-20):** Supabase **LOCAL** (Docker) đã chạy và được kiểm thử thật. Dự án **Supabase Cloud chưa được tạo** — cần người điều phối xác nhận tài khoản, tổ chức, region Singapore và điều kiện chi phí (xem [§5](#5-supabase-cloud-chưa-tạo--cần-xác-nhận)). Chưa có dữ liệu học sinh thật ở bất kỳ đâu.
> **Liên quan:** [AUTHENTICATION.md](AUTHENTICATION.md) · [STUDENT_ACCESS.md](STUDENT_ACCESS.md) · [RLS_SECURITY.md](RLS_SECURITY.md) · [DATA_MODEL.md](DATA_MODEL.md) · [REDESIGN_ARCHITECTURE.md](REDESIGN_ARCHITECTURE.md)

## 1. Phiên bản đã xác minh (2026-10-20, `npm view`)

| Thành phần | Phiên bản | Ghi chú |
|---|---|---|
| `@supabase/supabase-js` | 2.118.0 (ghim) | `engines.node >= 22`; peer `@opentelemetry/api` tùy chọn |
| `@supabase/ssr` | 0.12.7 (ghim) | peer `@supabase/supabase-js ^2.114.0`; dùng `getAll`/`setAll` |
| Supabase CLI (`supabase`, devDependency) | 2.121.0 (ghim) | chạy bằng `npx supabase …`; tải binary khi `npm ci` |
| Postgres (image local) | 17 (`supabase/postgres:17.11.0.004`) | `major_version = 17` trong `config.toml` |
| Docker Desktop | 29.5.3 | Windows 11, WSL 2 |

Không dùng `--force`/`--legacy-peer-deps`. Cảnh báo `npm audit` duy nhất (`braces`, mức cao) nằm trong `eslint-config-next` (chỉ công cụ dev) và **đã có trước R03**; `npm audit --omit=dev` = 0 lỗ hổng.

## 2. Chạy Supabase local

Điều kiện: Docker Desktop đang chạy (`docker info` trả phiên bản máy chủ).

```bash
npm ci
npm run db:start          # supabase start (có Storage cho bản ghi giáo viên R10.2); bỏ studio, realtime, edge…
npm run db:start:lite     # như trên NHƯNG không có storage-api — cho máy ít RAM (kiểm thử Storage sẽ tự bỏ qua; CI luôn dùng db:start và đặt REQUIRE_STORAGE=1)
npm run db:env            # tạo/cập nhật .env.local từ `supabase status` (KHÔNG in giá trị; .env.local bị gitignore)
npm run db:seed           # dữ liệu GIẢ: 1 trường, 2 GV, 2 lớp × 3 HS, đồng ý/thiết bị ở nhiều trạng thái (chạy lặp lại được)
npm run dev               # http://127.0.0.1:3000 — đăng nhập GV ở /login
```

- Tài khoản GV giả: `co.mai` và `thay.binh` @ tên miền dành riêng `readmate.test`; mật khẩu = `SEED_TEACHER_PASSWORD` trong `.env.local` (do `db:env` sinh ngẫu nhiên). Không có tài khoản nào được ghi cứng trong mã.
- `npm run db:reset` dựng lại CSDL **từ đầu** bằng toàn bộ migration (chứng minh migration chạy lại được); sau đó chạy lại `db:seed`.
- `npm run db:sync-content` chỉ đồng bộ kho tri thức `content/` (seed đã gọi sẵn).
- Studio (giao diện quản trị): `npx supabase start` (không `-x studio`) → http://127.0.0.1:54323.
- Dừng: `npm run db:stop`.

Mọi script ghi dữ liệu **từ chối chạy** khi URL không phải `127.0.0.1`/`localhost` (trừ khi đặt tường minh `ALLOW_REMOTE_SEED=dev-only` cho dự án dev trên Cloud).

## 3. Cấu hình `supabase/config.toml` — quyết định quan trọng

| Mục | Giá trị | Lý do |
|---|---|---|
| `[api] auto_expose_new_tables` | `false` | Bảng/hàm mới không tự lộ ra `anon`/`authenticated`; mọi GRANT viết tường minh trong migration |
| `[auth] enable_signup` | `true` | **Bắt buộc**: tắt sẽ chặn luôn người dùng ẩn danh (thiết bị học sinh) — đã kiểm chứng |
| `[auth.email] enable_signup` | `true` | **Bắt buộc**: ở bản Auth hiện hành mục này = `GOTRUE_EXTERNAL_EMAIL_ENABLED`; tắt sẽ tắt luôn **đăng nhập** email của GV (đã kiểm chứng: "Email logins are disabled") |
| `[auth.hook.before_user_created]` | `pg-functions://postgres/private/hook_before_user_created` | Chặn **mọi** đăng ký công khai không ẩn danh (403). Tài khoản GV chỉ tạo bằng Admin API (không đi qua hook — đã kiểm chứng) |
| `enable_anonymous_sign_ins` | `true` | Thiết bị học sinh (AD-05) |
| `minimum_password_length` / `password_requirements` | 10 / `lower_upper_letters_digits` | Mật khẩu GV |
| `[auth.rate_limit] anonymous_users`, `sign_in_sign_ups` | 300 / 300 (chỉ máy dev) | Bộ kiểm thử tạo nhiều thiết bị; **Cloud giữ mặc định** (30/giờ, 30/5 phút) + CAPTCHA |
| `[db.seed] enabled` | `false` | Seed bằng `npm run db:seed` (cần Admin API để tạo GV) |
| storage | **bật từ R10.2** (bucket riêng tư `teacher-audio` tạo từ `config.toml`; thêm ~1 container) — `db:start:lite` để tắt | Bản ghi giáo viên |
| realtime, edge_runtime, analytics | tắt | Chưa dùng |

## 4. Biến môi trường

| Biến | Phạm vi | R03 dùng ở |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | công khai (chỉ khóa `sb_publishable_…`) | máy chủ (`src/lib/supabase/server.ts`, `proxy.ts`) — **không có client Supabase ở trình duyệt** |
| `SUPABASE_SECRET_KEY` | **chỉ máy chủ** (`sb_secret_…`) | `src/lib/supabase/admin.ts` (`server-only`): student gateway, giới hạn tần suất |
| `LOGIN_CODE_PEPPER` | **chỉ máy chủ**, ≥ 32 ký tự | HMAC thẻ học và khóa giới hạn tần suất. Đổi pepper = mọi thẻ cũ mất hiệu lực |
| `NEXT_PUBLIC_SITE_URL` | công khai | liên kết QR; `http://127.0.0.1…`/`localhost` → cookie không `Secure` (Safari bỏ cookie Secure trên http) |
| `SEED_TEACHER_PASSWORD` | chỉ máy dev | mật khẩu GV giả của `db:seed` |

Khóa JWT `anon`/`service_role` cũ **bị từ chối** (`readSupabasePublicEnv`, `createSupabaseAdminClient`). Thiếu cấu hình → trang công khai và `/demo` vẫn chạy; `/login`, `/join` báo "chưa cấu hình máy chủ dữ liệu".

## 5. Supabase Cloud (chưa tạo — cần xác nhận)

Không tạo dự án khi chưa có xác nhận của người điều phối (CLAUDE.md §2.3). Khi được phép, cần quyết định: tài khoản/tổ chức sở hữu, **region Singapore (`ap-southeast-1`)**, gói (Free cho dev; Pro khi thí điểm — R11), người được quyền quản trị. Danh mục cấu hình phải sao chép từ `config.toml` sang Dashboard:

- [ ] Auth → Sign In / Providers: bật Email (đăng nhập), bật Anonymous sign-ins, giữ "Allow new users to sign up" bật.
- [ ] Auth → Hooks: Before User Created → Postgres function `private.hook_before_user_created`.
- [ ] Auth → Attack Protection: bật CAPTCHA (Cloudflare Turnstile) — cần hiện thực Turnstile ở `/join` trước (chưa làm ở R03).
- [ ] Auth → URL Configuration: Site URL + Redirect URLs theo tên miền thật; Password policy như `config.toml`.
- [ ] API → Exposed schemas: chỉ `public`, `graphql_public` (KHÔNG thêm `private`).
- [ ] API Keys: dùng `sb_publishable_…` / `sb_secret_…`; tắt khóa legacy.
- [ ] Áp dụng migration: `npx supabase link` + `npx supabase db push` (cần token và quyền — không làm khi chưa được phép).
- [ ] Không chạy `db:seed` lên Cloud production; dev Cloud chỉ dữ liệu giả.

## 6. Kiểm thử CSDL

| Lệnh | Nội dung | Kết quả R03 |
|---|---|---|
| `npm run db:lint` | `supabase db lint` (bảo mật, hiệu năng) | 0 vấn đề |
| `npm run db:test` | pgTAP `supabase/tests/database/*.test.sql` — RLS mọi bảng, quyền theo catalog, ràng buộc, bất biến | 36/36 |
| `npm run test:db` | Vitest tích hợp `tests/db/` — JWT thật của GV/thiết bị qua PostgREST + Auth | 78/78 |
| `npm run test:e2e:db` | Playwright `tests/e2e-db/` — luồng thật trên trình duyệt (Chromium, Android, iPhone) | 30 đạt, 12 bỏ qua theo thiết kế |

CI (`.github/workflows/ci.yml`, job `database`) chạy `db:start` → `db:lint` → `db:test` → `db:env` + `db:seed` ×2 → `test:db` trên runner Ubuntu, **không dùng secret nào** (khóa local do CLI tự sinh).

## 7. Sự cố đã gặp

| Hiện tượng | Nguyên nhân | Cách xử lý |
|---|---|---|
| `AuthApiError: Email logins are disabled` | `[auth.email] enable_signup = false` tắt cả đăng nhập email | Bật lại; chặn đăng ký bằng hook |
| WebKit/iPhone không giữ phiên sau đăng nhập (local) | Cookie `Secure` trên `http://127.0.0.1` bị Safari bỏ | `cookie-options.ts`: chỉ bỏ `Secure` khi site là http localhost |
| `Next.js encountered the unstable value Date.now() while prerendering` | `getClaims()` kiểm tra hạn token bằng `Date.now()` trong lúc Partial Prefetching dựng trước | `await connection()` đầu DAL phiên (`teacher.ts`, `session.ts`) |
| Ký tự U+00AD, U+200B… bị ghi thành ký tự thật trong SQL | Công cụ ghi tệp giải mã chuỗi thoát | Script thay bằng `String.fromCharCode(92)` + quét byte (CLAUDE.md §9.6) |

## Storage (R10.2)

- Bucket `teacher-audio`: `public = false`, 2 MiB, chỉ `audio/webm|ogg|mp4|mpeg|wav`, khai báo trong `supabase/config.toml` (tạo khi `supabase start`). **Supabase Cloud chưa tạo**: khi có dự án, tạo bucket tương đương (private) trước khi bật cờ `teacher_audio_recording_approved`.
- Đã có Docker đang chạy mà trước đó dùng `db:start` cũ (không Storage): chạy `npx supabase stop` rồi `npm run db:start` để bật Storage — **không** cần `db:reset`, dữ liệu giữ nguyên (migration mới áp dụng khi khởi động lại).
- Ảnh hưởng: thêm 1 container (`storage-api`, ~150–300 MB RAM) cho E2E/DB test; các test cũ không dùng Storage nên không đổi.
