import { Suspense } from "react";
import { MAIN_CONTENT_ID } from "@/components/layout/skip-link";
import { TeacherSidebar } from "@/components/layout/teacher-sidebar";
import { Skeleton } from "@/components/ui/loading-state";
import { TeacherAccount } from "./teacher-account";

/**
 * Khung khu vực giáo viên (R03: có xác thực). Ba lớp bảo vệ: proxy chuyển hướng thô khi chưa đăng nhập →
 * mỗi trang/Server Action gọi `requireTeacher()` → CSDL kiểm tra lại bằng RLS và hàm `teacher_*`.
 * Phần đọc phiên nằm trong <Suspense> để khung trang vẫn được prerender (cacheComponents).
 */
export default function TeacherLayout({ children }: LayoutProps<"/teacher">) {
  return (
    <div className="flex flex-1 flex-col lg:flex-row">
      <TeacherSidebar
        account={
          <Suspense fallback={<Skeleton className="h-12 w-full" />}>
            <TeacherAccount />
          </Suspense>
        }
      />
      <main id={MAIN_CONTENT_ID} tabIndex={-1} className="min-w-0 flex-1 outline-none">
        {children}
      </main>
    </div>
  );
}
