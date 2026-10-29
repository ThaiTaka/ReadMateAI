"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { UnitRef } from "@/features/audio-playback/study-catalog";
import { vi } from "@/strings/vi";
import { AudioSlot, type AudioSource } from "./audio-slot";
import { useSoundMuted } from "./sound-mute";

/**
 * "Chữ có thể nghe" (R10.4): chạm nút để nghe cô giáo đọc TÊN chữ cái hoặc ÂM của chữ khi học (không có câu hỏi, không điểm).
 *
 *  - Hai loại âm thanh khác nhau, hai nút khác nhau: tên chữ cái (b → "bê") và âm của chữ (b → "bờ"). Không nút nào thay cho nút kia.
 *  - Máy chủ báo chữ/âm nào nghe được NGAY BÂY GIỜ (một lần khi mở trang); tệp chỉ tải khi trẻ chạm nút (trong `AudioSlot`).
 *    Chưa có bản ghi đã duyệt / cờ tắt / đã tắt âm → nút khóa, ghi rõ "Chưa có âm thanh" (không giả lập, không giọng trình duyệt).
 *  - Không tự phát; một âm tại một thời điểm (chạm chữ khác thì dừng chữ cũ); chạm lại để nghe lại.
 *  - Trình duyệt chỉ gửi mã học sinh (do trang đã chọn) + loại + chữ; không bao giờ gửi mã tài nguyên, đường dẫn hay cách đọc.
 */

type Availability =
  | { phase: "pending" }
  | {
      phase: "done";
      muted: boolean;
      mimeByUnit: ReadonlyMap<string, string>;
      /** Chữ/âm đang phát bằng tệp CHẾ ĐỘ TRÌNH DIỄN (giọng máy tạo sẵn, chưa giáo viên duyệt). */
      previewUnits: ReadonlySet<string>;
      /** Trong số đó, mục có rủi ro cách đọc đã được chủ dự án cho phép phát: luôn ghi chú rõ. */
      unverifiedUnits: ReadonlySet<string>;
      /** Có tệp trình diễn nhưng bị giữ lại vì cách đọc chưa kiểm chứng. */
      heldUnits: ReadonlySet<string>;
    };

const EMPTY: ReadonlySet<string> = new Set();

type Context = { studentId: string; availability: Availability };
const LearningAudioContext = createContext<Context | null>(null);

const unitKey = (unit: UnitRef) => `${unit.kind}:${unit.text}`;

export function LearningAudioProvider({ studentId, children }: { studentId: string; children: ReactNode }) {
  // Gắn kết quả với đúng học sinh đã hỏi: đổi hồ sơ thì không dùng lại kết quả cũ.
  const [found, setFound] = useState<{ studentId: string; value: Availability } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      let value: Availability = {
        phase: "done",
        muted: false,
        mimeByUnit: new Map(),
        previewUnits: EMPTY,
        unverifiedUnits: EMPTY,
        heldUnits: EMPTY,
      };
      try {
        const response = await fetch(`/api/student/learning-audio?student=${encodeURIComponent(studentId)}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const body = (await response.json()) as {
          ok?: boolean;
          data?: {
            muted?: boolean;
            units?: Array<{
              kind?: unknown;
              text?: unknown;
              mimeType?: unknown;
              source?: unknown;
              unverified?: unknown;
            }>;
            held?: Array<{ kind?: unknown; text?: unknown }>;
          };
        };
        if (body.ok === true && body.data) {
          const entries = (body.data.units ?? []).flatMap((unit) =>
            (unit.kind === "letter" || unit.kind === "phoneme") &&
            typeof unit.text === "string" &&
            typeof unit.mimeType === "string"
              ? [[`${unit.kind}:${unit.text}`, unit.mimeType] as const]
              : [],
          );
          const units = body.data.units ?? [];
          const keyOf = (unit: { kind?: unknown; text?: unknown }) => `${String(unit.kind)}:${String(unit.text)}`;
          value = {
            phase: "done",
            muted: body.data.muted === true,
            mimeByUnit: new Map(entries),
            previewUnits: new Set(units.filter((unit) => unit.source === "contest_preview").map(keyOf)),
            unverifiedUnits: new Set(units.filter((unit) => unit.unverified === true).map(keyOf)),
            heldUnits: new Set((body.data.held ?? []).map(keyOf)),
          };
        }
      } catch {
        if (controller.signal.aborted) return;
      }
      setFound({ studentId, value });
    })();
    return () => controller.abort();
  }, [studentId]);

  const value = useMemo<Context>(
    () => ({
      studentId,
      availability: found?.studentId === studentId ? found.value : { phase: "pending" },
    }),
    [studentId, found],
  );
  return <LearningAudioContext.Provider value={value}>{children}</LearningAudioContext.Provider>;
}

/** Dòng tình trạng cho người lớn: đang hỏi / có bao nhiêu chữ/âm nghe được / chưa có gì. */
export function LearningAudioStatus() {
  const context = useContext(LearningAudioContext);
  const t = vi.studyAudio.status;
  if (!context) return null;
  const { availability } = context;
  let text: string;
  if (availability.phase === "pending") text = t.pending;
  else if (availability.muted) text = t.muted;
  else if (availability.mimeByUnit.size === 0 && availability.heldUnits.size === 0) text = t.none;
  else if (availability.mimeByUnit.size === 0) {
    text = `${vi.contest.chip}: ${t.previewHeld.replace("{n}", String(availability.heldUnits.size))}`;
  } else if (availability.previewUnits.size > 0) {
    // Nói thật nguồn: giọng máy tạo sẵn cho trình diễn, KHÔNG phải bản ghi của cô giáo.
    text = t.preview.replace("{n}", String(availability.mimeByUnit.size));
    if (availability.heldUnits.size > 0)
      text += ` ${t.previewHeld.replace("{n}", String(availability.heldUnits.size))}`;
  } else text = t.some.replace("{n}", String(availability.mimeByUnit.size));
  return (
    <p aria-live="polite" data-testid="learning-audio-status" className="text-sm font-semibold text-ink-soft">
      {text}
    </p>
  );
}

/** Một nút nghe một chữ/âm. Dùng lại ở mọi bài học có chữ cần nghe (nhận `unit` + nhãn). */
export function ListenButton({ unit, label, ariaLabel }: { unit: UnitRef; label: string; ariaLabel: string }) {
  const context = useContext(LearningAudioContext);
  const soundOff = useSoundMuted();
  const key = unitKey(unit);
  const availability = context?.availability ?? ({ phase: "pending" } as const);
  const mimeType = availability.phase === "done" ? (availability.mimeByUnit.get(key) ?? null) : null;
  const held = availability.phase === "done" && availability.heldUnits.has(key);
  const unverified = availability.phase === "done" && availability.unverifiedUnits.has(key);
  const source: AudioSource | null =
    context && mimeType
      ? {
          url: `/api/student/learning-audio/${unit.kind}/${encodeURIComponent(unit.text)}?student=${encodeURIComponent(context.studentId)}`,
          mimeType,
        }
      : null;
  return (
    <AudioSlot
      key={key}
      label={label}
      ariaLabel={ariaLabel}
      fill
      pending={availability.phase === "pending"}
      muted={soundOff || (availability.phase === "done" && availability.muted)}
      source={source}
      {...(held ? { unavailableReason: vi.contest.held } : {})}
      {...(unverified ? { note: vi.contest.unverifiedNote } : {})}
    />
  );
}

/**
 * Ô một chữ: chữ lớn + nút "Tên chữ" + nút "Âm" (nút nào không có loại tương ứng thì không vẽ — ví dụ q chỉ có tên chữ).
 * `upper` là chữ hoa kèm theo (chỉ chữ cái).
 */
export function ListenableLetter({
  display,
  upper,
  name,
  sound,
}: {
  display: string;
  upper: string | null;
  name: UnitRef | null;
  sound: UnitRef | null;
}) {
  const t = vi.studyAudio;
  const shown = upper ? `${upper} ${display}` : display;
  return (
    <div
      data-letter={display}
      className="flex h-full flex-col items-center gap-3 rounded-3xl border-2 border-line bg-surface p-3"
    >
      <p className="text-5xl font-extrabold leading-snug text-ink">{shown}</p>
      <div className="flex w-full flex-col gap-2">
        {name ? (
          <ListenButton unit={name} label={t.nameButton} ariaLabel={t.nameAria.replace("{letter}", display)} />
        ) : null}
        {sound ? (
          <ListenButton unit={sound} label={t.soundButton} ariaLabel={t.soundAria.replace("{letter}", display)} />
        ) : null}
      </div>
    </div>
  );
}
