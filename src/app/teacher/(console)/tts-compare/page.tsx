import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { LoadingState } from "@/components/ui/loading-state";
import { requireTeacher } from "@/server/auth/teacher";
import { defaultPocDir, readPocManifest } from "@/server/tts/poc/store";
import { vi } from "@/strings/vi";
import { TtsCompareView } from "./tts-compare-view";

export const metadata: Metadata = {
  title: vi.ttsCompare.meta.title,
  description: vi.ttsCompare.meta.description,
  robots: { index: false, follow: false },
};

/**
 * /teacher/tts-compare — nghe A/B giọng AI tiếng Việt (R10.3b2-P0). CHỈ DÀNH CHO GIÁO VIÊN, chỉ đọc. Tệp lấy từ thư mục cục
 * bộ `.tts-poc/` (không có trên Vercel → trang hiện trạng thái rỗng). Không gọi nhà cung cấp, không ghi gì, không duyệt.
 * Micro vẫn tắt ở đây.
 */
export default function TtsComparePage() {
  const t = vi.ttsCompare;
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
      <h1 className="text-3xl font-extrabold leading-tight text-ink sm:text-4xl">{t.title}</h1>
      <p className="mt-2 text-lg text-ink-soft">{t.intro}</p>
      <p className="mt-2">
        <Link href="/teacher/tts-script" className="font-semibold underline">
          {t.backToScript}
        </Link>
      </p>
      <Suspense fallback={<LoadingState className="mt-8" />}>
        <TtsCompareContent />
      </Suspense>
    </div>
  );
}

async function TtsCompareContent() {
  await requireTeacher();
  const { manifest, problem } = await readPocManifest(defaultPocDir());
  return <TtsCompareView samples={manifest.samples} problem={problem} />;
}
