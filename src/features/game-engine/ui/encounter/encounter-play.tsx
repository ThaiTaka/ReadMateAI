"use client";

import type { Route } from "next";
import Link from "next/link";
import { ArrowRight, ClipboardCheck, Lightbulb, Pause, Play, RotateCw, Trophy } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { HeartIndicator } from "@/components/adventure/heart-indicator";
import { StarMark } from "@/components/adventure/score-badge";
import { AudioSlot } from "@/components/kid/audio-slot";
import { FeedbackBanner } from "@/components/kid/feedback-banner";
import { INSTRUCTION_ICONS } from "@/components/learning/visuals";
import { Badge } from "@/components/ui/badge";
import { Button, buttonClasses } from "@/components/ui/button";
import { hintText } from "@/features/exercises/core/feedback";
import type { Response } from "@/features/exercises/core/primitives";
import { responseKey } from "@/features/exercises/core/response-key";
import { VARIANTS } from "@/features/exercises/runtime-registry";
import type { EncounterDto } from "@/features/game-runs/encounter-dto";
import { emptyResponseFor, isCompleteFor, ViewPlayer } from "@/features/scored-practice/ui/view-player";
import { PointsChip } from "@/features/scored-practice/ui/scored-practice";
import type { AttemptDto, PublicQuestion } from "@/features/scored-practice/types";
import { cn } from "@/lib/cn";
import type { ErrorCode } from "@/server/result";
import { vi } from "@/strings/vi";
import { fetchEncounterState, submitEncounterAttempt } from "./encounter-client.ts";
import { monsterName } from "./monster-catalog.ts";
import { MonsterView } from "./monster-view.tsx";

/*
 * Màn gặp quái vật (R08.4): ba câu theo thứ tự, qua đúng Player của sáu dạng bài GĐ4 (một dạng bài một khuôn). Trình duyệt
 * KHÔNG chấm, KHÔNG tự tính HP/điểm: mọi con số hiển thị là con số máy chủ vừa trả. Mỗi lần bấm "Kiểm tra" tạo một
 * `clientAttemptId`; mất mạng thì gửi lại ĐÚNG lượt đó (không tạo yêu cầu mới); nút khóa trong lúc gửi nên không gửi song song.
 */

type Progress = { resolved: number; total: number };
type Outcome = "defeated" | "undefeated";
type Pending = { questionId: string; clientAttemptId: string; response: Response };
export type StopKind = "closed" | "signed_out";

const t = vi.encounter;

function initialDraft(question: PublicQuestion | null): Response | null {
  if (!question) return null;
  return question.lastResponse ?? emptyResponseFor(question.view);
}

function stopKindOf(code: ErrorCode | "NETWORK"): StopKind | null {
  if (code === "SEASON_CLOSED" || code === "RUN_NOT_ACTIVE") return "closed";
  if (code === "UNAUTHENTICATED" || code === "FORBIDDEN") return "signed_out";
  return null;
}

export function EncounterPlay({
  initial,
  runId,
  balance,
  onScore,
  home,
  onFinished,
  onDismiss,
  onStopped,
}: {
  initial: EncounterDto;
  runId: string;
  /** Điểm hiện tại do máy chủ trả khi mở trang; sau mỗi lượt nộp được thay bằng số máy chủ trả về. */
  balance: number | null;
  /** Báo điểm MỚI NHẤT do máy chủ trả để chạm trán sau bắt đầu từ đúng số điểm hiện có. */
  onScore: (balance: number) => void;
  home: Route;
  /** Người chơi bấm "Về mê cung" sau hoạt cảnh kết thúc (kèm tiến độ máy chủ nếu lấy được). */
  onFinished: (progress: Progress | null) => void;
  /** Chạm trán đã kết thúc ở nơi khác (tab khác): bỏ màn này, máy chủ là nguồn sự thật. */
  onDismiss: () => void;
  onStopped: (kind: StopKind) => void;
}) {
  const [questions, setQuestions] = useState(initial.questions);
  const [question, setQuestion] = useState<PublicQuestion | null>(initial.current);
  const [hp, setHp] = useState(initial.hpRemaining);
  const [score, setScore] = useState<number | null>(balance);
  const [draft, setDraft] = useState<Response | null>(() => initialDraft(initial.current));
  const [showMarks, setShowMarks] = useState(true);
  const [hintOpen, setHintOpen] = useState(false);
  const [checking, setChecking] = useState(false);
  const [pending, setPending] = useState<Pending | null>(null);
  const [networkError, setNetworkError] = useState(false);
  const [points, setPoints] = useState<AttemptDto["points"]>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [ended, setEnded] = useState<Outcome | null>(null);
  const [stage, setStage] = useState<"question" | "result">("question");
  const [paused, setPaused] = useState(false);
  const [loadingNext, setLoadingNext] = useState(false);
  const [nextFailed, setNextFailed] = useState(false);
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const mounted = useRef(true);
  // Chặn nộp song song ngay cả khi hai lần bấm rơi vào cùng một lô cập nhật (state `checking` chưa kịp đóng nút).
  const sending = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const name = monsterName(initial.monsterKey);
  const questionId = question?.id;

  useEffect(() => {
    if (!paused && stage === "question") headingRef.current?.focus({ preventScroll: true });
  }, [questionId, paused, stage]);

  /** Nạp lại trạng thái chạm trán từ máy chủ (sang câu kế tiếp, hoặc khôi phục khi tab khác đã đi tiếp). */
  async function loadNext() {
    setLoadingNext(true);
    setNextFailed(false);
    const result = await fetchEncounterState(runId);
    if (!mounted.current) return;
    setLoadingNext(false);
    if (!result.ok) {
      const stop = stopKindOf(result.code);
      if (stop) onStopped(stop);
      else setNextFailed(true);
      return;
    }
    const encounter = result.data.encounter;
    if (!encounter) {
      onDismiss();
      return;
    }
    setQuestions(encounter.questions);
    setQuestion(encounter.current);
    setHp(encounter.hpRemaining);
    setDraft(initialDraft(encounter.current));
    setShowMarks(true);
    setHintOpen(false);
    setPoints(null);
    setPending(null);
    setNetworkError(false);
    setNotice(null);
  }

  async function submit(resend = false) {
    if (!question || checking || sending.current) return;
    const attempt: Pending | null =
      resend && pending
        ? pending
        : draft
          ? { questionId: question.id, clientAttemptId: crypto.randomUUID(), response: draft }
          : null;
    if (!attempt) return;
    sending.current = true;
    setPending(attempt);
    setChecking(true);
    setNetworkError(false);
    const result = await submitEncounterAttempt(attempt.questionId, attempt.clientAttemptId, attempt.response);
    sending.current = false;
    if (!mounted.current) return;
    setChecking(false);
    if (!result.ok && result.code === "NETWORK") {
      setNetworkError(true);
      return;
    }
    setPending(null);
    if (!result.ok) {
      if (result.code === "NETWORK") return;
      const stop = stopKindOf(result.code);
      if (stop) {
        onStopped(stop);
      } else if (result.code === "DUPLICATE_RESPONSE") {
        setNotice(vi.errors.DUPLICATE_RESPONSE);
      } else if (
        result.code === "QUESTION_CLOSED" ||
        result.code === "NO_ATTEMPTS_LEFT" ||
        result.code === "QUESTION_NOT_CURRENT" ||
        result.code === "ENCOUNTER_FINISHED"
      ) {
        await loadNext();
      } else {
        setNotice(vi.errors[result.code] ?? vi.errors.UNKNOWN);
      }
      return;
    }
    const data = result.data;
    setNotice(null);
    setQuestion(data.question);
    setDraft(data.question.lastResponse);
    setShowMarks(true);
    setHintOpen(data.question.hintMode === "proactive");
    setPoints(data.points);
    setScore(data.score.balance);
    onScore(data.score.balance);
    setQuestions((list) =>
      list.map((entry) => (entry.id === data.question.id ? { ...entry, status: data.question.status } : entry)),
    );
    if (data.encounter) {
      setHp(data.encounter.hpRemaining);
      if (data.encounter.status === "defeated" || data.encounter.status === "undefeated") {
        setEnded(data.encounter.status);
      }
    }
  }

  const heartsAndScore = (
    <div className="flex flex-col items-center gap-3">
      <div data-testid="encounter-hp" data-hp={hp}>
        <HeartIndicator remaining={hp} total={3} label={t.hearts} />
      </div>
      {score !== null ? (
        <p className="flex items-center gap-2 rounded-full bg-sun-50 px-4 py-2 font-extrabold text-ink ring-2 ring-sun-200">
          <StarMark className="size-7" />
          <span aria-live="polite" data-testid="encounter-score" data-score={score}>
            {t.score.replace("{n}", String(score))}
          </span>
        </p>
      ) : null}
    </div>
  );

  if (stage === "result" && ended) {
    return (
      <EncounterResult
        monsterKey={initial.monsterKey}
        outcome={ended}
        runId={runId}
        onFinished={onFinished}
        extra={heartsAndScore}
      />
    );
  }

  if (paused) {
    return (
      <section
        aria-labelledby="encounter-pause-title"
        data-testid="encounter-pause"
        className="mx-auto mt-10 flex max-w-sm flex-col gap-4 rounded-3xl border-2 border-line bg-surface p-6 text-center"
      >
        <h2 id="encounter-pause-title" className="text-2xl font-extrabold text-ink">
          {t.pauseTitle}
        </h2>
        <p className="text-lg font-semibold text-ink-soft">{t.pauseText}</p>
        <Button autoFocus size="kid" onClick={() => setPaused(false)}>
          <Play aria-hidden="true" className="size-6" />
          {t.resume}
        </Button>
        <Link href={home} className={buttonClasses("ghost", "kid")}>
          {t.toHome}
        </Link>
      </section>
    );
  }

  if (!question) {
    return (
      <div className="flex flex-col items-center gap-4 py-10 text-center">
        <p role="status" className="text-lg font-bold text-ink-soft">
          {loadingNext ? t.loadingNext : nextFailed ? t.nextFailed : t.loadingNext}
        </p>
        <Button size="kid" onClick={() => void loadNext()} disabled={loadingNext}>
          <RotateCw aria-hidden="true" className="size-6" />
          {t.retry}
        </Button>
      </div>
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
    // Vừa sai và chưa đổi lựa chọn: không gửi lại đúng câu trả lời cũ.
    responseKey(draft) !== lastKey;
  const number = Math.max(1, questions.findIndex((entry) => entry.id === question.id) + 1);

  return (
    <div className="flex flex-col gap-4" data-testid="encounter-question" data-question-id={question.id}>
      <div className="flex items-center justify-between gap-3">
        <Button size="kid" variant="outline" disabled={checking} onClick={() => setPaused(true)}>
          <Pause aria-hidden="true" className="size-6" />
          {t.pause}
        </Button>
      </div>

      <MonsterView monsterKey={initial.monsterKey} entrance={number === 1 && hp === 3} key={hp} />
      <p className="text-center text-xl font-extrabold text-ink">{name}</p>
      {heartsAndScore}

      <h2
        ref={headingRef}
        tabIndex={-1}
        data-testid="encounter-step"
        className="text-center text-2xl font-extrabold text-ink outline-none"
      >
        {t.question.replace("{n}", String(number)).replace("{total}", String(questions.length))}
      </h2>

      {open ? (
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Badge tone="neutral">
            {t.attemptsLeft.replace("{n}", String(question.maxAttempts - question.attemptsUsed))}
          </Badge>
        </div>
      ) : null}

      <div className="flex flex-col gap-6 rounded-card border border-line bg-canvas p-4 sm:p-6">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-ink text-white">
              <Icon aria-hidden="true" className="size-6" />
            </span>
            <p className="text-xl font-extrabold text-ink sm:text-2xl">{definition.instruction.text}</p>
          </div>
          <AudioSlot label={vi.practice.audio.instruction} note={vi.scoredPractice.instructionAudioNote} />
        </div>
        <ViewPlayer
          view={question.view}
          response={draft}
          onChange={(response) => {
            setDraft(response);
            setShowMarks(false);
          }}
          locked={!open || checking}
          marks={showMarks ? question.marks : {}}
          hint={hintOpen && open ? question.hint : null}
          reveal={question.reveal}
          idPrefix={question.id}
        />
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

      {networkError ? (
        <div role="alert" className="flex flex-col gap-3 rounded-2xl border-2 border-sun-300 bg-sun-50 p-4">
          <p className="font-semibold text-ink">{t.networkError}</p>
          <div>
            <Button size="kid" disabled={checking} onClick={() => void submit(true)}>
              <RotateCw aria-hidden="true" className="size-6" />
              {t.resend}
            </Button>
          </div>
        </div>
      ) : null}

      {nextFailed ? (
        <p role="alert" className="font-semibold text-ink">
          {t.nextFailed}
        </p>
      ) : null}

      <div className={cn("flex flex-wrap items-center gap-3")}>
        {open ? (
          <Button size="kid" disabled={!canCheck} onClick={() => void submit()}>
            <ClipboardCheck aria-hidden="true" className="size-6" />
            {t.check}
          </Button>
        ) : ended ? (
          <Button size="kid" onClick={() => setStage("result")}>
            <Trophy aria-hidden="true" className="size-6" />
            {t.seeResult}
          </Button>
        ) : (
          <Button size="kid" disabled={loadingNext} onClick={() => void loadNext()}>
            {nextFailed ? t.retry : t.next}
            <ArrowRight aria-hidden="true" className="size-6" />
          </Button>
        )}
      </div>
    </div>
  );
}

/** Hoạt cảnh kết thúc + tiến độ lấy từ máy chủ ("Con đã gặp n/7 bạn quái vật!"), không đoán ở trình duyệt. */
function EncounterResult({
  monsterKey,
  outcome,
  runId,
  onFinished,
  extra,
}: {
  monsterKey: string;
  outcome: Outcome;
  runId: string;
  onFinished: (progress: Progress | null) => void;
  extra: ReactNode;
}) {
  const [progress, setProgress] = useState<Progress | null>(null);
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
    let active = true;
    void fetchEncounterState(runId).then((result) => {
      if (active && result.ok) setProgress(result.data.progress);
    });
    return () => {
      active = false;
    };
  }, [runId]);
  const copy = outcome === "defeated" ? t.defeated : t.undefeated;
  return (
    <section
      aria-labelledby="encounter-result-title"
      data-testid="encounter-result"
      data-outcome={outcome}
      className="mx-auto flex max-w-xl flex-col items-center gap-4 text-center"
    >
      <MonsterView monsterKey={monsterKey} mood={outcome} />
      <h2
        id="encounter-result-title"
        ref={headingRef}
        tabIndex={-1}
        className="text-3xl font-extrabold text-ink outline-none"
      >
        {copy.title}
      </h2>
      <p className="text-lg font-semibold text-ink-soft">{copy.text}</p>
      {extra}
      <p data-testid="encounter-progress" aria-live="polite" className="min-h-7 text-xl font-bold text-ink">
        {progress
          ? t.encountered.replace("{n}", String(progress.resolved)).replace("{total}", String(progress.total))
          : ""}
      </p>
      <Button size="kid" onClick={() => onFinished(progress)}>
        {t.backToMaze}
        <ArrowRight aria-hidden="true" className="size-6" />
      </Button>
    </section>
  );
}
