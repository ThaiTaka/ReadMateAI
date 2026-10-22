import type { Metadata, Route } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { HonorStage } from "@/components/honors/honor-stage";
import { ButtonLink } from "@/components/ui/button";
import { LoadingState } from "@/components/ui/loading-state";
import { requireTeacher } from "@/server/auth/teacher";
import { getHonorSnapshot, listHonorSnapshots } from "@/server/teacher/honor-queries";
import { vi } from "@/strings/vi";

const t = vi.honors.stage;

export const metadata: Metadata = { title: t.metaTitle, robots: { index: false, follow: false } };

export default function HonorPresentationPage({ params }: PageProps<"/teacher/classes/[classId]/honors/[snapshotId]">) {
  return (
    <Suspense fallback={<LoadingState className="p-8 text-white" />}>
      <Content params={params} />
    </Suspense>
  );
}

// CSDL từ chối đọc khi cờ hệ thống vinh danh tắt (HONORS_DISABLED); HONORS_NOT_APPROVED cũng được coi là khóa.
const isLocked = (code: string) => code === "HONORS_DISABLED" || code === "HONORS_NOT_APPROVED";

async function Content({ params }: Pick<PageProps<"/teacher/classes/[classId]/honors/[snapshotId]">, "params">) {
  const { classId, snapshotId } = await params;
  const teacher = await requireTeacher();
  const exitHref = `/teacher/classes/${classId}/leaderboard`;

  // Ảnh chụp phải thuộc đúng lớp trong đường dẫn (và GV phải thuộc lớp đó — hàm CSDL kiểm tra). Không phân biệt
  // "không tồn tại" với "không có quyền".
  const list = await listHonorSnapshots(teacher, classId);
  if (!list.ok && !isLocked(list.code)) notFound();
  if (list.ok && !list.data.some((item) => item.id === snapshotId)) notFound();

  const result = list.ok ? await getHonorSnapshot(teacher, snapshotId) : list;
  if (!result.ok && !isLocked(result.code)) notFound();

  if (!result.ok) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center gap-6 p-8 text-center text-white">
        <h1 className="text-3xl font-extrabold">{t.lockedTitle}</h1>
        <p className="text-xl">{t.lockedBody}</p>
        <ButtonLink href={exitHref as Route} size="lg">
          {t.exit}
        </ButtonLink>
      </div>
    );
  }

  return <HonorStage snapshot={result.data} exitHref={exitHref} />;
}
