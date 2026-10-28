"use client";

import type { Route } from "next";
import Link from "next/link";
import { ArrowRight, ClipboardCheck, Lightbulb, Map as MapIcon, RotateCw, Sparkles, Trophy } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { StarMark } from "@/components/adventure/score-badge";
import { FeedbackBanner } from "@/components/kid/feedback-banner";
import { INSTRUCTION_ICONS } from "@/components/learning/visuals";
import { Badge } from "@/components/ui/badge";
import { Button, buttonClasses } from "@/components/ui/button";
import { variantHasRecording } from "@/features/audio-playback/roles";
import { hintText } from "@/features/exercises/core/feedback";
import type { Response } from "@/features/exercises/core/primitives";
import { responseKey } from "@/features/exercises/core/response-key";
import { VARIANTS } from "@/features/exercises/runtime-registry";
import { gameWorld, isPlayable } from "@/features/game-world/catalog";
import type { GameKey } from "@/features/gamification/rules";
import { cn } from "@/lib/cn";
import type { ErrorCode } from "@/server/result";
import { vi } from "@/strings/vi";
import type { AttemptDto, PracticeSessionDto, PublicQuestion, ScoreSummary } from "../types";
import { QuestionAudio } from "./question-audio";
import { emptyResponseFor, isCompleteFor, ViewPlayer } from "./view-player";

type ApiResult<T> = { ok: true; data: T } | { ok: false; code: ErrorCode };

type Pending = { questionId: string; clientAttemptId: string; response: Response };

type ScoredPracticeProps = {
  studentId: string;
  /** Trang của con (giữ `?student=` khi thiết bị có nhiều hồ sơ). */
  homeHref: string;
};

async function call<T>(url: string, init?: RequestInit): Promise<ApiResult<T> | "network"> {
  try {
    const response = await fetch(url, { cache: "no-store", ...init });
    return (await response.json()) as ApiResult<T>;
  } catch {
    return "network";
  }
}

const post = (body: unknown): RequestInit => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

function initialDraft(question: PublicQuestion | null): Response | null {
  if (!question) return null;
  return question.lastResponse ?? emptyResponseFor(question.view);
}

/**
 * Buổi luyện CÓ ĐIỂM (R04). Trình duyệt KHÔNG chấm và không tự cộng điểm: chỉ gửi câu trả lời kèm `clientAttemptId`
 * (tạo một lần cho mỗi lần bấm "Kiểm tra"; gửi lại khi mất mạng dùng ĐÚNG mã cũ → máy chủ trả kết quả cũ, không tính
 * hai lần). Trong lúc chờ hiện "Cô đang xem…"; điểm chỉ đổi khi máy chủ trả kết quả (không cập nhật lạc quan).
 * Sai: "−5" màu trung tính, lời nhắc tích cực, không âm thanh/hiệu ứng phạt; không đếm giờ.
 */
export function ScoredPractice({ studentId, homeHref }: ScoredPracticeProps) {
  const t = vi.scoredPractice;
  const [error, setError] = useState<ErrorCode | null>(null);
  const [session, setSession] = useState<PracticeSessionDto | null>(null);
  const [question, setQuestion] = useState<PublicQuestion | null>(null);
  const [score, setScore] = useState<ScoreSummary | null>(null);
  const [draft, setDraft] = useState<Response | null>(null);
  const [showMarks, setShowMarks] = useState(true);
  const [hintOpen, setHintOpen] = useState(false);
  const [checking, setChecking] = useState(false);
  const [pending, setPending] = useState<Pending | null>(null);
  const [networkError, setNetworkError] = useState(false);
  const [points, setPoints] = useState<AttemptDto["points"]>(null);
  const [tilesAvailable, setTilesAvailable] = useState(0);
  const [unlocked, setUnlocked] = useState<GameKey[]>([]);
  const [finished, setFinished] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement | null>(null);

  const showSession = useCallback((next: PracticeSessionDto) => {
    setSession(next);
    setScore(next.score);
    setQuestion(next.current);
    setDraft(initialDraft(next.current));
    setShowMarks(true);
    setHintOpen(false);
    setPoints(null);
    setPending(null);
    setNetworkError(false);
    setNotice(null);
    setFinished(next.current === null);
  }, []);

  const applyStart = useCallback(
    (result: ApiResult<PracticeSessionDto> | "network") => {
      if (result === "network") setError("UNKNOWN");
      else if (!result.ok) setError(result.code);
      else showSession(result.data);
    },
    [showSession],
  );

  const openSession = useCallback(
    () => call<PracticeSessionDto>("/api/student/practice-sessions", post({ studentId })),
    [studentId],
  );

  useEffect(() => {
    // Mở trang = mở/tiếp tục buổi luyện (POST từ trình duyệt — trang được tải trước không tạo dữ liệu). Gọi hai lần
    // (StrictMode) vẫn an toàn: máy chủ trả lại đúng buổi đang dở.
    let active = true;
    void openSession().then((result) => {
      if (active) applyStart(result);
    });
    return () => {
      active = false;
    };
  }, [applyStart, openSession]);

  function again() {
    setError(null);
    setSession(null);
    setUnlocked([]);
    void openSession().then(applyStart);
  }

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
  }, [question?.id, finished]);

  async function reloadSession() {
    if (!session) return;
    const result = await call<PracticeSessionDto>(`/api/student/practice-sessions/${session.id}`);
    if (result === "network") setNetworkError(true);
    else if (!result.ok) setError(result.code);
    else showSession(result.data);
  }

  async function submit(resend = false) {
    if (!question || checking) return;
    const attempt: Pending | null =
      resend && pending
        ? pending
        : draft
          ? { questionId: question.id, clientAttemptId: crypto.randomUUID(), response: draft }
          : null;
    if (!attempt) return;
    setPending(attempt);
    setChecking(true);
    setNetworkError(false);
    const result = await call<AttemptDto>(
      `/api/student/question-instances/${attempt.questionId}/attempts`,
      post({ clientAttemptId: attempt.clientAttemptId, response: attempt.response }),
    );
    setChecking(false);
    if (result === "network") {
      setNetworkError(true);
      return;
    }
    setPending(null);
    if (!result.ok) {
      if (result.code === "DUPLICATE_RESPONSE" || result.code === "AUDIO_NOT_AVAILABLE") {
        // Không phải lỗi buổi luyện: giữ nguyên câu hiện tại, không điểm, không lượt (R10.3a).
        setNotice(vi.errors[result.code]);
        return;
      }
      if (result.code === "QUESTION_CLOSED" || result.code === "NO_ATTEMPTS_LEFT") {
        await reloadSession();
        return;
      }
      setError(result.code);
      return;
    }
    const data = result.data;
    setNotice(null);
    setQuestion(data.question);
    setDraft(data.question.lastResponse);
    setShowMarks(true);
    setHintOpen(data.question.hintMode === "proactive");
    setPoints(data.points);
    setScore(data.score);
    setTilesAvailable(data.tilesAvailable);
    if (data.newlyUnlockedGames.length > 0) setUnlocked((list) => [...new Set([...list, ...data.newlyUnlockedGames])]);
    setSession((current) =>
      current
        ? {
            ...current,
            status: data.sessionStatus,
            questions: current.questions.map((entry) =>
              entry.id === data.question.id ? { ...entry, status: data.question.status } : entry,
            ),
          }
        : current,
    );
  }

  if (error) {
    return (
      <section aria-labelledby="scored-error" className="mx-auto flex max-w-xl flex-col gap-4 text-center">
        <h1 id="scored-error" className="text-3xl font-extrabold text-ink">
          {t.errorTitle}
        </h1>
        <p role="alert" className="text-lg text-ink-soft">
          {vi.errors[error]}
        </p>
        <div className="flex flex-col items-center gap-3">
          {error === "CONSENT_REQUIRED" ? (
            <Link href="/demo#luyen-tap" className={buttonClasses("primary", "kid")}>
              {vi.learnMe.practice.demo}
            </Link>
          ) : null}
          <Link href={homeHref as Route} className={buttonClasses("ghost", "lg")}>
            {t.back}
          </Link>
        </div>
      </section>
    );
  }

  if (!session || !score) {
    return (
      <p role="status" className="py-16 text-center text-xl font-bold text-ink-soft">
        {t.loading}
      </p>
    );
  }

  const scoreLine = (
    <p className="flex items-center gap-2 rounded-full bg-sun-50 px-4 py-2 font-extrabold text-ink ring-2 ring-sun-200">
      <StarMark className="size-7" />
      <span aria-live="polite">{t.score.replace("{n}", String(score.balance))}</span>
    </p>
  );

  if (finished || !question) {
    const closedSession = session.status !== "in_progress";
    return (
      <section
        aria-labelledby="scored-summary"
        className="mx-auto flex max-w-xl flex-col items-center gap-5 text-center"
      >
        <span className="flex size-20 items-center justify-center rounded-full bg-sun-100 text-sun-700">
          <Trophy aria-hidden="true" className="size-10" />
        </span>
        <h1 id="scored-summary" ref={headingRef} tabIndex={-1} className="text-3xl font-extrabold text-ink">
          {t.summary.title}
        </h1>
        <p className="text-xl font-bold text-ink">
          {t.summary.correct
            .replace("{correct}", String(session.summary.correct))
            .replace("{total}", String(session.summary.total))}
        </p>
        <p className="text-lg text-ink-soft">
          {t.summary.earned.replace("{n}", String(session.summary.earnedInSession))}
        </p>
        {scoreLine}
        <div className="flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
          {closedSession ? (
            <Button size="kid" onClick={again}>
              <RotateCw aria-hidden="true" className="size-6" />
              {t.again}
            </Button>
          ) : null}
          <Link href={homeHref as Route} className={buttonClasses("secondary", "kid")}>
            {t.back}
          </Link>
        </div>
      </section>
    );
  }

  const definition = VARIANTS[question.view.variant];
  const Icon = INSTRUCTION_ICONS[definition.instruction.icon];
  const open = question.status === "open";
  const lastKey = question.lastResponse ? responseKey(question.lastResponse) : null;
  const canCheck =
    open &&
    !checking &&
    !networkError &&
    isCompleteFor(question.view, draft) &&
    draft !== null &&
    // Vừa sai và chưa đổi lựa chọn: không gửi lại đúng câu trả lời cũ (không tốn lượt — như GĐ4).
    responseKey(draft) !== lastKey;
  const position = session.questions.findIndex((entry) => entry.id === question.id) + 1;
  const isLast = session.status !== "in_progress";

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ol aria-label={vi.practice.controls.progressLabel} className="flex flex-wrap items-center gap-1.5">
          {session.questions.map((entry, index) => (
            <li
              key={entry.id}
              aria-current={entry.id === question.id ? "step" : undefined}
              aria-label={`${vi.practice.controls.goToItem.replace("{n}", String(index + 1))}${
                entry.status !== "open" ? `, ${vi.practice.controls.itemDone}` : ""
              }`}
              className={cn(
                "flex size-8 items-center justify-center rounded-full border-2 text-xs font-bold",
                entry.id === question.id
                  ? "border-ink bg-surface text-ink ring-2 ring-ink ring-offset-1"
                  : entry.status !== "open"
                    ? "border-brand-600 bg-brand-600 text-white"
                    : "border-line bg-surface text-ink-faint",
              )}
            >
              {index + 1}
            </li>
          ))}
        </ol>
        {scoreLine}
      </div>

      <h1 ref={headingRef} tabIndex={-1} className="text-2xl font-extrabold text-ink outline-none">
        {t.title} — {t.progress.replace("{current}", String(position)).replace("{total}", String(question.total))}
      </h1>

      <div className="flex flex-wrap items-center gap-2">
        {!question.scorable ? <Badge tone="lagoon">{t.practiceOnly}</Badge> : null}
        {open ? (
          <Badge tone="neutral">
            {t.attemptsLeft.replace("{n}", String(question.maxAttempts - question.attemptsUsed))}
          </Badge>
        ) : null}
      </div>

      <div className="flex flex-col gap-6 rounded-card border border-line bg-canvas p-4 sm:p-6">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-ink text-white">
              <Icon aria-hidden="true" className="size-6" />
            </span>
            <p className="text-xl font-extrabold text-ink sm:text-2xl">{definition.instruction.text}</p>
          </div>
          {/* Giọng máy ĐÃ DUYỆT của câu lệnh; ở mức hỗ trợ mà chính sách không cho phát (H1/H0) thì không vẽ nút. */}
          <QuestionAudio questionId={question.id} role="instruction" label={vi.practice.audio.instruction} />
        </div>
        <ViewPlayer
          view={question.view}
          response={draft}
          onChange={(response) => {
            setDraft(response);
            // Chọn lại sau khi sai: xóa dấu đúng/sai cũ để trẻ thử lại trên màn hình sạch (như GĐ4).
            setShowMarks(false);
          }}
          locked={!open || checking}
          marks={showMarks ? question.marks : {}}
          hint={hintOpen && open ? question.hint : null}
          reveal={question.reveal}
          idPrefix={question.id}
          stimulusAudio={
            variantHasRecording(question.view.variant, "stimulus") ? (
              <QuestionAudio questionId={question.id} role="stimulus" label={vi.practice.audio.stimulus} />
            ) : undefined
          }
        />
        {!open && variantHasRecording(question.view.variant, "model") ? (
          <QuestionAudio questionId={question.id} role="model" label={vi.practice.audio.model} />
        ) : null}
      </div>

      {open && question.hint ? (
        hintOpen ? (
          <div
            role="status"
            aria-live="polite"
            className="flex gap-3 rounded-2xl border-2 border-sun-200 bg-sun-50 p-4"
          >
            <Lightbulb aria-hidden="true" className="mt-0.5 size-6 shrink-0 text-sun-700" />
            <p className="font-semibold text-ink">{hintText(question.hint)}</p>
          </div>
        ) : (
          <div>
            <Button size="kid" variant="outline" onClick={() => setHintOpen(true)}>
              <Lightbulb aria-hidden="true" className="size-6" />
              {t.showHint}
            </Button>
          </div>
        )
      ) : null}

      <div aria-live="polite" className="flex flex-col gap-3">
        {checking ? <p className="text-lg font-bold text-ink-soft">{t.checking}</p> : null}
        {notice ? <p className="font-semibold text-ink">{notice}</p> : null}
        {showMarks || !open ? <FeedbackBanner feedback={question.feedback} /> : null}
        {points && (showMarks || !open) ? <PointsChip points={points} /> : null}
      </div>

      {/* Chỉ báo trò chơi ĐÃ PHÁT HÀNH: không khoe khu vực chưa có bản chơi. */}
      {unlocked.some(isPlayable) ? (
        <div className="flex gap-3 rounded-2xl border-2 border-magic-200 bg-magic-50 p-4">
          <Sparkles aria-hidden="true" className="mt-0.5 size-6 shrink-0 animate-pop-in text-magic-700" />
          <div className="flex flex-col gap-2">
            {unlocked.filter(isPlayable).map((key) => (
              <p key={key} className="font-extrabold text-ink">
                {t.unlocked.replace("{name}", gameWorld(key).name)}
              </p>
            ))}
            <p className="text-sm text-ink-soft">{t.unlockedNote}</p>
            <Link
              href={`${homeHref}#thi-dau` as Route}
              className="inline-flex min-h-12 items-center self-start font-bold text-magic-800 underline"
            >
              {t.unlockedCta}
            </Link>
          </div>
        </div>
      ) : null}

      {tilesAvailable > 0 && !open ? (
        <Link
          href={`${homeHref}#ban-do` as Route}
          className="inline-flex min-h-touch-kid items-center gap-3 self-start rounded-full border-2 border-jade-300 bg-jade-50 px-5 font-bold text-jade-800 hover:border-jade-600"
        >
          <MapIcon aria-hidden="true" className="size-6" />
          {t.newTiles.replace("{n}", String(tilesAvailable))} {t.openMap}
        </Link>
      ) : null}

      {networkError ? (
        <div role="alert" className="flex flex-col gap-3 rounded-2xl border-2 border-sun-300 bg-sun-50 p-4">
          <p className="font-semibold text-ink">{t.networkError}</p>
          <div>
            <Button size="kid" onClick={() => void (pending ? submit(true) : reloadSession())}>
              <RotateCw aria-hidden="true" className="size-6" />
              {t.resend}
            </Button>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        {open ? (
          <Button size="kid" disabled={!canCheck} onClick={() => void submit()}>
            <ClipboardCheck aria-hidden="true" className="size-6" />
            {t.check}
          </Button>
        ) : isLast ? (
          <Button size="kid" onClick={() => void reloadSession()}>
            <Trophy aria-hidden="true" className="size-6" />
            {t.finish}
          </Button>
        ) : (
          <Button size="kid" onClick={() => void reloadSession()}>
            {t.next}
            <ArrowRight aria-hidden="true" className="size-6" />
          </Button>
        )}
        <Link href={homeHref as Route} className={cn(buttonClasses("ghost", "lg"), "sm:ml-auto")}>
          {t.back}
        </Link>
      </div>
    </div>
  );
}

/** "+10" (ngôi sao nhẹ) hoặc "−5" màu TRUNG TÍNH; sai ở 0 điểm → "Điểm giữ nguyên". Không nhấp nháy, không màu đỏ. */
export function PointsChip({ points }: { points: NonNullable<AttemptDto["points"]> }) {
  const t = vi.scoredPractice;
  if (points.appliedDelta > 0) {
    return (
      <p
        aria-label={t.plusLabel.replace("{n}", String(points.appliedDelta))}
        className="inline-flex animate-pop-in items-center gap-2 self-start rounded-full bg-jade-600 px-4 py-2 text-xl font-extrabold text-white shadow-soft"
      >
        <StarMark className="size-7" />
        {t.plus.replace("{n}", String(points.appliedDelta))}
      </p>
    );
  }
  if (points.appliedDelta < 0) {
    return (
      <p
        aria-label={t.minusLabel.replace("{n}", String(-points.appliedDelta))}
        className="inline-flex items-center self-start rounded-full bg-surface-muted px-3 py-1 text-base font-bold text-ink-soft ring-1 ring-line"
      >
        {t.minus.replace("{n}", String(-points.appliedDelta))}
      </p>
    );
  }
  return (
    <p className="inline-flex items-center self-start rounded-full bg-surface-muted px-3 py-1 text-base font-bold text-ink-soft ring-1 ring-line">
      {t.unchanged}
    </p>
  );
}
