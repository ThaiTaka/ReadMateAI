"use client";

import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { vi } from "@/strings/vi";

type ErrorPageProps = {
  error: Error & { digest?: string };
  /** Next.js 16.4: tải lại dữ liệu và dựng lại phân đoạn bị lỗi (khuyến nghị thay cho reset()). */
  retry: () => void;
};

/**
 * Ranh giới lỗi chung: thông báo thân thiện, không hiển thị chi tiết kỹ thuật cho người dùng
 * và không ghi log nội dung lỗi ở client (log phía server dùng error.digest).
 */
export default function ErrorPage({ retry }: ErrorPageProps) {
  return (
    <div role="alert" className="flex flex-1 items-center justify-center px-4 py-20">
      <div className="max-w-md text-center">
        <h1 className="text-3xl font-extrabold text-ink">{vi.error.title}</h1>
        <p className="mt-3 text-lg leading-relaxed text-ink-soft">{vi.error.text}</p>
        <Button onClick={() => retry()} className="mt-8">
          <RotateCcw aria-hidden="true" className="size-5" />
          {vi.error.action}
        </Button>
      </div>
    </div>
  );
}
