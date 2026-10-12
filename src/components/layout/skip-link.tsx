import { vi } from "@/strings/vi";

export const MAIN_CONTENT_ID = "noi-dung-chinh";

/** Liên kết bỏ qua điều hướng — chỉ hiện khi nhận focus bằng bàn phím. */
export function SkipLink() {
  return (
    <a
      href={`#${MAIN_CONTENT_ID}`}
      className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-ink focus:px-5 focus:py-3 focus:font-semibold focus:text-white"
    >
      {vi.a11y.skipToContent}
    </a>
  );
}
