import { MAIN_CONTENT_ID } from "@/components/layout/skip-link";
import { TeacherSidebar } from "@/components/layout/teacher-sidebar";

/**
 * Khung khu vực giáo viên. CHƯA có xác thực (dự kiến GĐ5): không hiển thị tên, ảnh hay nút đăng xuất
 * để không tạo cảm giác đây là khu vực đã được bảo vệ.
 */
export default function TeacherLayout({ children }: LayoutProps<"/teacher">) {
  return (
    <div className="flex flex-1 flex-col lg:flex-row">
      <TeacherSidebar />
      <main id={MAIN_CONTENT_ID} tabIndex={-1} className="min-w-0 flex-1 outline-none">
        {children}
      </main>
    </div>
  );
}
