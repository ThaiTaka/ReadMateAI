# E2E trên GitHub Actions

## Vì sao
Máy phát triển nhiều lần hết RAM khi chạy build + Next + Playwright (Chromium/WebKit) + Supabase Docker cùng lúc. Kiểm thử nặng chuyển lên runner GitHub; máy cục bộ chỉ chạy kiểm tra nhẹ hoặc một spec nhỏ (một project, `--workers=1`).

## Workflow
`.github/workflows/e2e.yml` (`permissions: contents: read`, không secret, không Supabase Cloud). Mỗi project là một job riêng, chỉ cài đúng một trình duyệt, `--workers=1`, `fail-fast: false`:

| Job | Project | Cấu hình |
|---|---|---|
| `e2e` | chromium-desktop, chromium-mobile, webkit-desktop, webkit-mobile, webkit-tablet | `playwright.config.ts` (build + `next start` cổng 3100) |
| `e2e-db` | chromium-desktop, chromium-mobile, webkit-mobile, webkit-ipad | `playwright.db.config.ts` (cổng 3200) sau `db:start`, `db:env`, `db:seed` |

`e2e-db` luôn `supabase stop --no-backup` ở bước cuối (`if: always()`). Khóa là khóa mặc định của Supabase local do CLI sinh trên runner; dữ liệu hoàn toàn hư cấu. Chỉ khi lỗi mới upload `test-results` (giữ 3 ngày). `ci.yml` giữ nguyên `verify` và `database`.

## Chạy tay một project
```
npx playwright test --project=webkit-mobile --workers=1
npx playwright test --config playwright.db.config.ts --project=webkit-ipad --workers=1
```

## Kết quả (commit `83b34a7`)
CI [run 39514016955](https://github.com/ThaiTaka/ReadMateAI/actions/runs/39514016955) và E2E [run 39514016837](https://github.com/ThaiTaka/ReadMateAI/actions/runs/39514016837) đều xanh; số test từng job ở [REDESIGN_TASKS R05](../REDESIGN_TASKS.md).

## Giới hạn
- Chỉ Linux; chưa thử thiết bị thật.
- webkit-mobile database mất ~6,6 phút; kịch bản điểm R04 có giới hạn riêng 180 giây.
- Mỗi push chạy 9 job (tốn phút Actions); `concurrency` hủy lượt cũ của cùng nhánh.
