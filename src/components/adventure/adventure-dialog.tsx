"use client";

import { X } from "lucide-react";
import { useId, useRef, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { vi } from "@/strings/vi";
import { adventureClasses, type AdventureSize, type AdventureTone } from "./adventure-button";

type AdventureDialogProps = {
  /** Chữ trên nút mở (luôn có chữ). */
  triggerLabel: ReactNode;
  /** Tên đầy đủ của nút mở cho trình đọc màn hình (khi chữ trên nút ngắn, vd. "Xem chi tiết"). */
  triggerAriaLabel?: string;
  triggerTone?: AdventureTone;
  triggerSize?: AdventureSize;
  triggerClassName?: string;
  title: string;
  /** Nội dung bảng thông tin — có thể là Server Component (truyền qua children, không vào bundle JS). */
  children: ReactNode;
};

/**
 * Bảng thông tin dùng phần tử <dialog> gốc của trình duyệt (showModal): khóa focus trong bảng, Esc để đóng,
 * focus trở lại nút mở khi đóng, nền phía sau không thao tác được. Bấm ra ngoài bảng cũng đóng.
 */
export function AdventureDialog({
  triggerLabel,
  triggerAriaLabel,
  triggerTone = "plain",
  triggerSize = "kid",
  triggerClassName,
  title,
  children,
}: AdventureDialogProps) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const titleId = useId();

  const open = () => {
    const dialog = dialogRef.current;
    if (!dialog || dialog.open) return;
    // jsdom (unit test) chưa có showModal → mở dạng không modal để vẫn kiểm tra được nội dung.
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
  };
  const close = () => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (typeof dialog.close === "function") dialog.close();
    else dialog.removeAttribute("open");
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={open}
        aria-haspopup="dialog"
        {...(triggerAriaLabel ? { "aria-label": triggerAriaLabel } : {})}
        className={adventureClasses(triggerTone, triggerSize, triggerClassName)}
      >
        {triggerLabel}
      </button>
      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        // Safari không tự trả focus về nút mở khi đóng <dialog> — trả thủ công cho mọi trình duyệt.
        onClose={() => triggerRef.current?.focus()}
        onClick={(event) => {
          if (event.target === event.currentTarget) close();
        }}
        className={cn(
          "m-auto w-[calc(100%-2rem)] max-w-lg overflow-hidden rounded-world border-0 bg-surface p-0 text-ink shadow-world",
          "max-h-[calc(100dvh-2rem)] backdrop:bg-deep-900/55 open:animate-pop-in",
        )}
      >
        <div className="flex max-h-[calc(100dvh-2rem)] flex-col">
          <div className="flex items-start justify-between gap-3 border-b border-line px-5 pt-5 pb-3">
            <h2 id={titleId} className="text-2xl font-extrabold leading-tight text-ink">
              {title}
            </h2>
            <button
              type="button"
              onClick={close}
              className="inline-flex min-h-12 shrink-0 items-center gap-1.5 rounded-full bg-surface-muted px-4 font-bold text-ink hover:bg-line"
            >
              <X aria-hidden="true" className="size-5" />
              {vi.adventure.dialog.close}
            </button>
          </div>
          {/* Vùng cuộn nhận focus để người dùng bàn phím cuộn được nội dung dài (WCAG 2.1.1). */}
          <div tabIndex={0} role="region" aria-labelledby={titleId} className="overflow-y-auto px-5 pt-4 pb-6">
            {children}
          </div>
        </div>
      </dialog>
    </>
  );
}
