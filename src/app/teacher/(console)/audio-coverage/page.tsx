import type { Metadata } from "next";
import { Suspense } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { buildAudioCoverage } from "@/features/audio-coverage/build";
import { RIME_TOTAL, WIRED_PURPOSES } from "@/features/audio-coverage/catalog";
import { AUDIO_UNITS } from "@/features/audio-library/p0-catalog";
import { STUDY_UNITS } from "@/features/audio-playback/study-catalog";
import { requireTeacher } from "@/server/auth/teacher";
import { loadAudioStudio } from "@/server/audio-library/queries";
import { LIBRARY_ENTRIES } from "@/server/tts-library/entries";
import { loadTtsLibrary } from "@/server/tts-library/queries";
import { vi } from "@/strings/vi";
import { CoverageView } from "./coverage-view";

export const metadata: Metadata = {
  title: vi.audioCoverage.meta.title,
  description: vi.audioCoverage.meta.description,
  robots: { index: false, follow: false },
};

/**
 * /teacher/audio-coverage — báo cáo độ phủ âm thanh (R10.5): chữ, âm và lời hướng dẫn nào đã có tệp ĐÃ DUYỆT, còn thiếu gì, trạng thái duyệt từng
 * mục. Chỉ đọc; dữ liệu đọc bằng JWT của giáo viên nên RLS giới hạn trong trường. Không micro, không gọi nhà cung cấp giọng máy.
 */
export default function AudioCoveragePage() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
      <h1 className="text-3xl font-extrabold leading-tight text-ink sm:text-4xl">{vi.audioCoverage.title}</h1>
      <p className="mt-2 text-lg text-ink-soft">{vi.audioCoverage.intro}</p>
      <Suspense fallback={<LoadingState className="mt-8" />}>
        <CoverageContent />
      </Suspense>
    </div>
  );
}

async function CoverageContent() {
  const teacher = await requireTeacher();
  const [studio, library] = await Promise.all([loadAudioStudio(teacher), loadTtsLibrary(teacher)]);
  if (!studio.ok || !library.ok) {
    const code = !studio.ok ? studio.code : !library.ok ? library.code : "UNKNOWN";
    return <EmptyState className="mt-8" icon={null} title={vi.errors[code]} description="" />;
  }
  const coverage = buildAudioCoverage({
    units: AUDIO_UNITS,
    assets: studio.data.assets,
    userId: studio.data.userId,
    lines: LIBRARY_ENTRIES.map((entry) => ({
      id: entry.id,
      contentHash: entry.contentHash,
      assetKey: entry.assetKey,
      text: entry.text,
      purpose: entry.purpose === "feedback" ? "feedback" : "instruction",
    })),
    reviews: library.data.reviews,
    versions: library.data.versions,
    studyUnits: STUDY_UNITS,
    rimeTotal: RIME_TOTAL,
    wiredPurposes: WIRED_PURPOSES,
  });
  return <CoverageView coverage={coverage} />;
}
