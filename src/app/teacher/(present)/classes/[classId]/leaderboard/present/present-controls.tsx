"use client";

import Link from "next/link";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { LogOut, Maximize, Minimize, RefreshCw } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { MotionToggle } from "@/components/adventure/motion";
import { vi } from "@/strings/vi";

const t = vi.leaderboard.presentation;
const control =
  "inline-flex min-h-12 items-center gap-2 rounded-full border-2 border-white/40 bg-white/10 px-5 font-bold text-white hover:bg-white/20";

/** Nút của màn trình chiếu: toàn màn hình (Fullscreen API nếu có), cập nhật dữ liệu, giảm chuyển động, thoát. */
export function PresentControls({ exitHref }: { exitHref: string }) {
  const router = useRouter();
  const [full, setFull] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const sync = () => setFull(document.fullscreenElement !== null);
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen?.().catch(() => undefined);
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <MotionToggle tone="dark" />
      <button
        type="button"
        className={control}
        onClick={() => startTransition(() => router.refresh())}
        disabled={pending}
      >
        <RefreshCw aria-hidden="true" className={pending ? "size-5 animate-spin" : "size-5"} />
        {t.refresh}
      </button>
      <button type="button" className={control} onClick={toggleFullscreen} aria-pressed={full}>
        {full ? <Minimize aria-hidden="true" className="size-5" /> : <Maximize aria-hidden="true" className="size-5" />}
        {full ? t.exitFullscreen : t.fullscreen}
      </button>
      <Link href={exitHref as Route} className={control}>
        <LogOut aria-hidden="true" className="size-5" />
        {t.exit}
      </Link>
    </div>
  );
}
