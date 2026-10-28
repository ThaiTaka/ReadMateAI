import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { LoadingState } from "@/components/ui/loading-state";
import { buildDemoPracticeData } from "@/features/demo/practice-data";
import { moduleOf } from "@/features/exercises/registry";
import type { ExerciseItem } from "@/features/exercises/items";
import { KNOWLEDGE_BASE } from "@/features/knowledge/default-kb";
import { deriveLineState } from "@/features/tts-library/state";
import { Notice } from "@/components/ui/notice";
import { requireTeacher } from "@/server/auth/teacher";
import { buildTtsScriptCatalog, type CatalogItem } from "@/server/tts/catalog";
import { LIBRARY_ENTRIES } from "@/server/tts-library/entries";
import { loadTtsLibrary } from "@/server/tts-library/queries";
import { LIBRARY_BULK_LIMIT } from "@/server/tts-library/voice";
import { vi } from "@/strings/vi";
import { TtsLibrary, type LibraryLine } from "./tts-library";
import { TtsScriptList } from "./tts-script-list";

export const metadata: Metadata = {
  title: vi.ttsScript.meta.title,
  description: vi.ttsScript.meta.description,
  robots: { index: false, follow: false },
};

/**
 * /teacher/tts-script — thư viện giọng máy cho lời hướng dẫn và lời phản hồi cố định (R10.5): duyệt lời đọc → tạo âm thanh → NGHE →
 * duyệt/thu hồi tệp. Không dữ liệu học sinh. Chỉ khi giáo viên bấm "Tạo âm thanh" mới có yêu cầu tới nhà cung cấp, và chỉ cho lời đọc đã
 * duyệt. Bên dưới là phần xem trước CHỈ ĐỌC các lời đọc của câu bài tập (chưa dùng). Trang tự xác thực giáo viên như mọi trang khu GV.
 * Micro vẫn tắt ở đây (chỉ /teacher/audio được mở micro).
 */
export default function TtsScriptPage() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
      <h1 className="text-3xl font-extrabold leading-tight text-ink sm:text-4xl">{vi.ttsLibrary.title}</h1>
      <p className="mt-2 text-lg text-ink-soft">{vi.ttsLibrary.intro}</p>
      <p className="mt-2 flex flex-wrap gap-x-6 gap-y-2">
        <Link href="/teacher/tts-compare" className="font-semibold underline">
          {vi.ttsCompare.title}
        </Link>
        <Link href="/teacher/audio-coverage" className="font-semibold underline">
          {vi.audioCoverage.links.coverage}
        </Link>
      </p>
      <Suspense fallback={<LoadingState className="mt-8" />}>
        <TtsScriptContent />
      </Suspense>
    </div>
  );
}

async function TtsScriptContent() {
  const teacher = await requireTeacher();
  const library = await loadTtsLibrary(teacher);
  const demo = buildDemoPracticeData();
  const items: ExerciseItem[] = demo.paths.flatMap((path) => path.activities.flatMap((activity) => activity.items));
  const catalog = buildTtsScriptCatalog({
    items,
    exposureOf: (item: CatalogItem) => {
      const full = item as ExerciseItem;
      return moduleOf(full).audioExposure(full, KNOWLEDGE_BASE);
    },
  });
  const lines: LibraryLine[] = library.ok
    ? LIBRARY_ENTRIES.map((entry) => ({
        id: entry.id,
        text: entry.text,
        purpose: entry.purpose === "feedback" ? "feedback" : "instruction",
        usedBy: entry.usageNote,
        attention: [...entry.attention],
        state: deriveLineState(entry, library.data.reviews, library.data.versions),
      }))
    : [];
  return (
    <>
      {library.ok ? (
        <TtsLibrary
          lines={lines}
          libraryEnabled={library.data.libraryEnabled}
          providerReady={library.data.providerReady}
          bulkLimit={LIBRARY_BULK_LIMIT}
        />
      ) : (
        <Notice tone="progress" title={vi.status.inDevelopment} className="mt-6">
          {vi.errors[library.code]}
        </Notice>
      )}
      <section aria-labelledby="tts-preview-title" className="mt-12">
        <h2 id="tts-preview-title" className="text-2xl font-extrabold text-ink">
          {vi.ttsLibrary.previewTitle}
        </h2>
        <p className="mt-2 text-ink-soft">{vi.ttsLibrary.previewText}</p>
        <TtsScriptList
          entries={catalog.entries.filter((entry) => entry.source.kind === "exercise_item")}
          excluded={catalog.excluded}
        />
      </section>
    </>
  );
}
