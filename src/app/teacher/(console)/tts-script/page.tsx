import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { LoadingState } from "@/components/ui/loading-state";
import { buildDemoPracticeData } from "@/features/demo/practice-data";
import { moduleOf } from "@/features/exercises/registry";
import type { ExerciseItem } from "@/features/exercises/items";
import { KNOWLEDGE_BASE } from "@/features/knowledge/default-kb";
import { requireTeacher } from "@/server/auth/teacher";
import { buildTtsScriptCatalog, type CatalogItem } from "@/server/tts/catalog";
import { vi } from "@/strings/vi";
import { TtsScriptList } from "./tts-script-list";

export const metadata: Metadata = {
  title: vi.ttsScript.meta.title,
  description: vi.ttsScript.meta.description,
  robots: { index: false, follow: false },
};

/**
 * /teacher/tts-script — xem trước lời đọc giọng máy (R10.3b1). CHỈ ĐỌC, dữ liệu minh họa: câu của bản chơi thử, không
 * dữ liệu học sinh; không gọi nhà cung cấp, không tạo hay phát âm thanh. Trang tự xác thực giáo viên như mọi trang khu GV.
 * Micro vẫn tắt ở đây (chỉ /teacher/audio được mở micro).
 */
export default function TtsScriptPage() {
  const t = vi.ttsScript;
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
      <h1 className="text-3xl font-extrabold leading-tight text-ink sm:text-4xl">{t.title}</h1>
      <p className="mt-2 text-lg text-ink-soft">{t.intro}</p>
      <p className="mt-2">
        <Link href="/teacher/tts-compare" className="font-semibold underline">
          {vi.ttsCompare.title}
        </Link>
      </p>
      <Suspense fallback={<LoadingState className="mt-8" />}>
        <TtsScriptContent />
      </Suspense>
    </div>
  );
}

async function TtsScriptContent() {
  await requireTeacher();
  const demo = buildDemoPracticeData();
  const items: ExerciseItem[] = demo.paths.flatMap((path) => path.activities.flatMap((activity) => activity.items));
  const catalog = buildTtsScriptCatalog({
    items,
    exposureOf: (item: CatalogItem) => {
      const full = item as ExerciseItem;
      return moduleOf(full).audioExposure(full, KNOWLEDGE_BASE);
    },
  });
  return <TtsScriptList entries={catalog.entries} excluded={catalog.excluded} />;
}
