import type { Metadata } from "next";
import { Suspense } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { AUDIO_UNITS } from "@/features/audio-library/p0-catalog";
import { loadAudioStudio } from "@/server/audio-library/queries";
import { requireTeacher } from "@/server/auth/teacher";
import { vi } from "@/strings/vi";
import { AudioStudio } from "./audio-studio";

export const metadata: Metadata = {
  title: vi.audioStudio.meta.title,
  description: vi.audioStudio.meta.description,
  robots: { index: false, follow: false },
};

/**
 * /teacher/audio — thư viện bản ghi giọng giáo viên (R10.2). Proxy chỉ chuyển hướng thô; trang tự xác thực GV
 * (`requireTeacher`), dữ liệu đọc bằng JWT của GV nên RLS giới hạn trong trường và bản nháp của chính mình.
 * Đây là trang DUY NHẤT được mở micro (header Permissions-Policy riêng ở next.config.ts).
 */
export default function AudioPage() {
  const t = vi.audioStudio;
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
      <h1 className="text-3xl font-extrabold leading-tight text-ink sm:text-4xl">{t.title}</h1>
      <p className="mt-2 text-lg text-ink-soft">{t.intro}</p>
      <Suspense fallback={<LoadingState className="mt-8" />}>
        <AudioContent />
      </Suspense>
    </div>
  );
}

async function AudioContent() {
  const teacher = await requireTeacher();
  const data = await loadAudioStudio(teacher);
  if (!data.ok) {
    return <EmptyState className="mt-8" icon={null} title={vi.errors[data.code]} description="" />;
  }
  return (
    <AudioStudio
      units={AUDIO_UNITS}
      assets={data.data.assets}
      context={{
        userId: data.data.userId,
        isAdmin: data.data.isAdmin,
        recordingEnabled: data.data.recordingEnabled,
        consentActive: data.data.consentActive,
      }}
    />
  );
}
