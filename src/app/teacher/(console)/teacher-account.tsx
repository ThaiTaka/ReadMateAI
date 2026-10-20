import { LogOut, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { requireTeacher } from "@/server/auth/teacher";
import { signOutTeacher } from "@/server/auth/actions";
import { vi } from "@/strings/vi";

/**
 * Tên GV + đăng xuất. Đọc phiên (cookie) → luôn đặt trong <Suspense> (cacheComponents). `requireTeacher` chuyển
 * về /login nếu phiên không hợp lệ — lớp kiểm tra thứ hai sau proxy.
 */
export async function TeacherAccount() {
  const teacher = await requireTeacher();
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-surface-muted p-3 lg:flex-col lg:items-stretch">
      <p className="flex min-w-0 items-center gap-2 text-sm font-semibold text-ink">
        <UserRound aria-hidden="true" className="size-5 shrink-0 text-brand-700" />
        <span className="truncate">{vi.teacher.welcome.replace("{name}", teacher.displayName)}</span>
      </p>
      <form action={signOutTeacher} className="ml-auto lg:ml-0">
        <Button type="submit" variant="outline" size="sm" className="w-full">
          <LogOut aria-hidden="true" className="size-4" />
          {vi.teacher.signOut}
        </Button>
      </form>
    </div>
  );
}
