"use client";

import { Check, Sparkles } from "lucide-react";
import { useState, type ReactNode } from "react";
import type { MapTileKey } from "@/features/game-world/catalog";
import { MAP_GRID } from "@/features/game-world/map";
import type { MapStateDto, RevealTileDto } from "../types";
import { cn } from "@/lib/cn";
import type { ErrorCode } from "@/server/result";
import { vi } from "@/strings/vi";

type MapExplorerProps = {
  studentId: string;
  initial: MapStateDto;
  names: Readonly<Record<MapTileKey, string>>;
  /** Hình của từng thẻ, dựng ở Server Component (SVG không vào bundle JS). */
  art: Readonly<Record<MapTileKey, ReactNode>>;
  fog: ReactNode;
  station: ReactNode;
};

type ApiResult = { ok: true; data: RevealTileDto } | { ok: false; code: ErrorCode };

/**
 * Bản đồ khám phá 3 × 3 (R04): học sinh tự chạm một ô sương mù KỀ vùng đã mở khi còn lượt khám phá. Máy chủ kiểm
 * tra số lượt (30 điểm tích lũy / lượt) và tính kề nhau, ghi vào CSDL — tải lại trang vẫn giữ. Không tiêu điểm.
 * Mây tan bằng hoạt cảnh CSS; giảm chuyển động → sương biến mất ngay (trạng thái gốc của lớp sương là trong suốt).
 */
export function MapExplorer({ studentId, initial, names, art, fog, station }: MapExplorerProps) {
  const t = vi.learnMe.map;
  const [map, setMap] = useState(initial);
  const [pending, setPending] = useState<MapTileKey | null>(null);
  const [justRevealed, setJustRevealed] = useState<MapTileKey | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState<ErrorCode | null>(null);
  const revealed = new Set<string>(map.revealedTiles);
  const frontier = new Set<string>(map.frontier);

  async function explore(tileKey: MapTileKey) {
    if (pending) return;
    setPending(tileKey);
    setError(null);
    setMessage(t.opening);
    try {
      const response = await fetch("/api/student/map-tiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId, tileKey }),
        cache: "no-store",
      });
      const result = (await response.json()) as ApiResult;
      if (result.ok) {
        setMap(result.data.map);
        setJustRevealed(tileKey);
        setMessage(t.opened.replace("{name}", names[tileKey]));
      } else {
        setError(result.code);
        setMessage("");
      }
    } catch {
      setError("UNKNOWN");
      setMessage("");
    } finally {
      setPending(null);
    }
  }

  const status =
    map.revealed >= map.total ? t.done : map.available > 0 ? t.available.replace("{n}", String(map.available)) : t.none;

  return (
    <div className="flex flex-col gap-4">
      <p className="flex flex-wrap items-center gap-2 font-bold text-ink">
        <span className="rounded-full bg-jade-100 px-3 py-1 text-sm text-jade-800">
          {t.progress.replace("{revealed}", String(map.revealed)).replace("{total}", String(map.total))}
        </span>
        <span>{status}</span>
      </p>
      <ul aria-label={t.gridLabel} className="mx-auto grid w-full max-w-md grid-cols-3 gap-2 sm:gap-3">
        {MAP_GRID.map((cell) => {
          const label = { row: String(cell.row + 1), col: String(cell.col + 1) };
          if (cell.key === "station") {
            return (
              <li
                key="station"
                className="relative aspect-square overflow-hidden rounded-2xl border-2 border-sun-300 bg-sun-50 shadow-soft"
              >
                <div className="absolute inset-0">{station}</div>
                <span className="absolute inset-x-1 bottom-1 rounded-full bg-surface/90 px-1 py-0.5 text-center text-[0.7rem] font-extrabold leading-tight text-ink sm:text-xs">
                  {t.station}
                </span>
              </li>
            );
          }
          const key = cell.key;
          if (revealed.has(key)) {
            return (
              <li
                key={key}
                aria-label={t.revealed.replace("{name}", names[key])}
                className="relative aspect-square overflow-hidden rounded-2xl border-2 border-jade-300 bg-surface shadow-soft"
              >
                <div className={cn("absolute inset-0", justRevealed === key ? "animate-pop-in" : "")}>{art[key]}</div>
                {justRevealed === key ? (
                  // Lớp sương tan dần; trạng thái gốc trong suốt nên khi tắt hoạt cảnh không còn che hình.
                  <div aria-hidden="true" className="absolute inset-0 animate-fog-clear opacity-0">
                    {fog}
                  </div>
                ) : null}
                <span
                  aria-hidden="true"
                  className="absolute top-1 right-1 flex size-6 items-center justify-center rounded-full bg-jade-600 text-white shadow-soft"
                >
                  <Check className="size-3.5" strokeWidth={3} />
                </span>
                <span
                  aria-hidden="true"
                  className="absolute inset-x-1 bottom-1 truncate rounded-full bg-surface/90 px-1 py-0.5 text-center text-[0.7rem] font-extrabold leading-tight text-ink sm:text-xs"
                >
                  {names[key]}
                </span>
              </li>
            );
          }
          const canExplore = frontier.has(key) && map.available > 0;
          return (
            <li key={key} className="relative aspect-square">
              {canExplore ? (
                <button
                  type="button"
                  onClick={() => explore(key)}
                  disabled={pending !== null}
                  aria-label={t.exploreAt.replace("{row}", label.row).replace("{col}", label.col)}
                  className="group relative block size-full min-h-touch-kid overflow-hidden rounded-2xl border-4 border-sun-400 bg-surface shadow-glow-sun outline-offset-4 focus-visible:outline-3 focus-visible:outline-brand-600 disabled:opacity-70"
                >
                  <span aria-hidden="true" className="absolute inset-0">
                    {fog}
                  </span>
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-1 bottom-1 flex items-center justify-center gap-1 rounded-full bg-sun-400 px-1 py-0.5 text-[0.7rem] font-extrabold leading-tight text-ink sm:text-xs"
                  >
                    <Sparkles className="size-3.5" />
                    {pending === key ? t.opening : t.explore}
                  </span>
                </button>
              ) : (
                <div
                  role="img"
                  aria-label={t.fog.replace("{row}", label.row).replace("{col}", label.col)}
                  className="relative size-full overflow-hidden rounded-2xl border-2 border-line bg-surface-muted"
                >
                  <span aria-hidden="true" className="absolute inset-0 opacity-80">
                    {fog}
                  </span>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <p role="status" aria-live="polite" className="min-h-6 text-center font-bold text-jade-800">
        {message}
      </p>
      {error ? (
        <p
          role="alert"
          className="rounded-2xl border-2 border-sun-300 bg-sun-50 p-3 text-center font-semibold text-ink"
        >
          {vi.errors[error]}
        </p>
      ) : null}
    </div>
  );
}
