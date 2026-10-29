/**
 * npm run db:sync-content — đồng bộ content/ vào CSDL (Supabase local mặc định). Chạy lặp lại không lỗi.
 */
import { syncContent } from "./lib/content-sync.ts";
import { adminClient, scriptEnv } from "./lib/local-supabase.ts";

const summary = await syncContent(adminClient(scriptEnv()));
console.log(
  `Kho tri thức ${summary.datasetVersion} (${summary.contentHash.slice(0, 12)}…): ` +
    `${summary.created ? "phiên bản MỚI" : "phiên bản đã có"} · ${summary.series} bộ bài · ${summary.lessons} bài · ` +
    `${summary.units} đơn vị · ${summary.retired} đơn vị chuyển retired. Trạng thái duyệt giữ nguyên theo tệp nguồn.`,
);
