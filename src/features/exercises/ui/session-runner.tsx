"use client";

import { ArrowLeft, ArrowRight, CircleHelp, ClipboardCheck, Lightbulb, LogOut, RotateCcw, Trophy } from "lucide-react";
import { useEffect, useReducer, useRef, type ReactNode, type RefObject } from "react";
import { AudioSlot } from "@/components/kid/audio-slot";
import { FeedbackBanner } from "@/components/kid/feedback-banner";
import { ProgressDots, type DotState } from "@/components/kid/progress-dots";
import { INSTRUCTION_ICONS } from "@/components/learning/visuals";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { decideBeforeGrading } from "@/features/exercises/core/audio";
import { hintText } from "@/features/exercises/core/feedback";
import { SUPPORT_POLICIES } from "@/features/exercises/core/support";
import type { VariantId } from "@/features/exercises/core/module";
import type { ExerciseItem } from "@/features/exercises/items";
import { runtimeOf, VARIANTS } from "@/features/exercises/runtime-registry";
import {
  activeHints,
  canHint,
  canSubmit,
  createSession,
  hasHelpButton,
  hintSteps,
  isDone,
  isSettled,
  needsIntro,
  sessionReducer,
  type SessionEntry,
} from "@/features/exercises/session/session";
import { cn } from "@/lib/cn";
import { vi } from "@/strings/vi";
import type { SupportLevel } from "@/types/learning";
import { ItemPlayer } from "./item-player";
import { ResultsPanel } from "./results-panel";

export type RunnerBlock = {
  id: string;
  title: string;
  variant: VariantId;
  supportLevel: SupportLevel;
  items: readonly ExerciseItem[];
  example: ExerciseItem | null;
  previewOnly: boolean;
  classroomLike?: boolean;
};

type SessionRunnerProps = {
  heading: string;
  blocks: readonly RunnerBlock[];
  onExit: () => void;
  /** Nội dung thêm ở màn kết quả (ví dụ phiếu ở lớp tương đương). */
  resultsExtra?: ReactNode;
};

const now = () => Date.now();

function toEntries(blocks: readonly RunnerBlock[]): SessionEntry[] {
  return blocks.flatMap((block) =>
    block.items.map((item) => ({
      item,
      supportLevel: block.supportLevel,
      blockId: block.id,
      previewOnly: block.previewOnly,
    })),
  );
}

function LevelChip({ level }: { level: SupportLevel }) {
  const policy = SUPPORT_POLICIES[level];
  return (
    <Badge tone={level === 0 ? "coral" : "lagoon"}>
      {vi.practice.runner.supportLabel}: {policy.code} – {policy.name}
    </Badge>
  );
}

/**
 * Biểu tượng + câu lệnh chuẩn của dạng bài, kèm các khe âm thanh mà chính sách cho phép ở mức hỗ trợ này
 * (câu lệnh; nếu `withStimulus` thì cả khe kích thích như tên tranh, tiếng cần phân tích).
 */
function BlockInstruction({
  block,
  level,
  withStimulus = false,
}: {
  block: RunnerBlock;
  level: SupportLevel;
  withStimulus?: boolean;
}) {
  const definition = VARIANTS[block.variant];
  const Icon = INSTRUCTION_ICONS[definition.instruction.icon];
  const instruction = decideBeforeGrading(definition.audioPolicy, "instruction", level);
  const stimulus = decideBeforeGrading(definition.audioPolicy, "stimulus", level);
  const showStimulus = withStimulus && stimulus.permitted && definition.audioPolicy.stimulusContent !== "none";
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-ink text-white">
          <Icon aria-hidden="true" className="size-6" />
        </span>
        <p className="text-xl font-extrabold text-ink sm:text-2xl">{definition.instruction.text}</p>
      </div>
      {(instruction.permitted && !instruction.countsAsHint) || showStimulus ? (
        <div className="flex flex-wrap items-start gap-2">
          {instruction.permitted && !instruction.countsAsHint ? (
            <AudioSlot
              label={vi.practice.audio.instruction}
              {...(instruction.autoPlay ? { note: vi.practice.runner.autoPlayNote } : {})}
            />
          ) : null}
          {showStimulus ? (
            <AudioSlot
              label={vi.practice.runner.stimulusLabels[definition.audioPolicy.stimulusContent]}
              {...(stimulus.countsAsHint
                ? { note: vi.practice.runner.countsAsHintNote }
                : stimulus.autoPlay
                  ? { note: vi.practice.runner.autoPlayNote }
                  : {})}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/** Màn hướng dẫn trước mỗi dạng bài: biểu tượng + câu lệnh, mức hỗ trợ, và "Cô làm mẫu" ở H3. */
function IntroScreen({
  block,
  blockIndex,
  blockCount,
  onStart,
  headingRef,
}: {
  block: RunnerBlock;
  blockIndex: number;
  blockCount: number;
  onStart: () => void;
  headingRef: RefObject<HTMLHeadingElement | null>;
}) {
  const policy = SUPPORT_POLICIES[block.supportLevel];
  const example = policy.showWorkedExample ? block.example : null;
  const exampleModule = example ? runtimeOf(example) : null;
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-2">
        {blockCount > 1 ? (
          <Badge tone="neutral">
            {vi.practice.runner.blockOf
              .replace("{current}", String(blockIndex + 1))
              .replace("{total}", String(blockCount))}
          </Badge>
        ) : null}
        <LevelChip level={block.supportLevel} />
        {block.classroomLike ? <Badge tone="coral">{vi.practice.runner.classroomLike}</Badge> : null}
      </div>
      <h3 ref={headingRef} tabIndex={-1} className="text-2xl font-extrabold text-ink">
        {block.title}
      </h3>
      <BlockInstruction block={block} level={block.supportLevel} />
      <p className="text-ink-soft">{vi.practice.runner.levelNotes[block.supportLevel]}</p>
      {block.previewOnly ? (
        <p role="note" className="rounded-2xl border-2 border-dashed border-sun-300 bg-sun-50 p-4 text-ink">
          <strong>{vi.practice.runner.previewOnlyTitle}: </strong>
          {vi.practice.audio.requiredMissing}
        </p>
      ) : null}
      {example && exampleModule ? (
        <section
          aria-label={vi.practice.example.title}
          className="rounded-card border-2 border-dashed border-brand-300 bg-brand-50 p-4 sm:p-6"
        >
          <p className="text-lg font-extrabold text-brand-800">{vi.practice.example.title}</p>
          <p className="mb-4 text-ink-soft">{vi.practice.example.note}</p>
          <ItemPlayer
            item={example}
            response={exampleModule.correctResponse(example)}
            onChange={() => undefined}
            locked
            marks={{}}
            hint={null}
            reveal={exampleModule.reveal(example)}
            paperLike={false}
            idPrefix={`example-${block.id}`}
          />
          {exampleModule.reveal(example).explanation ? (
            <p className="mt-4 font-semibold text-ink">{exampleModule.reveal(example).explanation}</p>
          ) : null}
        </section>
      ) : null}
      <div>
        <Button size="kid" onClick={onStart}>
          {vi.practice.controls.start}
          <ArrowRight aria-hidden="true" className="size-6" />
        </Button>
      </div>
    </div>
  );
}

/**
 * Bộ chạy buổi luyện (client): dùng reducer thuần `sessionReducer`, không lưu gì ra ngoài bộ nhớ trang
 * (không localStorage, không gửi server). Một câu trên một màn hình; nút lớn; có thể dùng bàn phím.
 */
export function SessionRunner({ heading, blocks, onExit, resultsExtra }: SessionRunnerProps) {
  const [state, dispatch] = useReducer(sessionReducer, blocks, (initial) => createSession(toEntries(initial)));
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const feedbackRef = useRef<HTMLDivElement | null>(null);
  const hiddenSince = useRef<number | null>(null);

  // Thời gian làm bài không tính lúc trang bị ẩn (chuyển tab/ứng dụng khác).
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        hiddenSince.current = now();
      } else if (hiddenSince.current !== null) {
        dispatch({ type: "hidden_time", ms: now() - hiddenSince.current });
        hiddenSince.current = null;
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  const intro = needsIntro(state);
  const entry = state.entries[state.index];
  const progress = state.progress[state.index];
  const blockIndex = entry ? blocks.findIndex((block) => block.id === entry.blockId) : -1;
  const block = blocks[blockIndex];
  const feedback = progress?.feedback ?? null;

  // Mỗi khi đổi câu / đổi màn: cuộn đầu khu vực bài lên (dưới thanh đầu trang) và đưa focus tới tiêu đề —
  // trẻ thấy ngay nhiệm vụ, người dùng bàn phím và trình đọc màn hình biết đã chuyển.
  useEffect(() => {
    rootRef.current?.scrollIntoView?.({ block: "start" });
    headingRef.current?.focus({ preventScroll: true });
  }, [state.index, intro, state.phase]);

  // Sau khi chấm: đưa phản hồi vào tầm nhìn (trên điện thoại phản hồi có thể nằm dưới mép màn hình).
  useEffect(() => {
    if (feedback) feedbackRef.current?.scrollIntoView?.({ block: "nearest" });
  }, [feedback]);

  if (state.phase === "finished") {
    return (
      <div ref={rootRef} className="scroll-mt-4">
        <ResultsPanel
          state={state}
          headingRef={headingRef}
          onRestart={() => dispatch({ type: "restart" })}
          onExit={onExit}
          extra={resultsExtra}
        />
      </div>
    );
  }
  if (!entry || !progress || !block) return null;

  if (intro) {
    return (
      <div ref={rootRef} className="scroll-mt-4">
        <IntroScreen
          block={block}
          blockIndex={blockIndex}
          blockCount={blocks.length}
          headingRef={headingRef}
          onStart={() => dispatch({ type: "begin_block", at: now() })}
        />
      </div>
    );
  }

  const typeModule = runtimeOf(entry.item);
  const definition = VARIANTS[entry.item.variant];
  const policy = SUPPORT_POLICIES[entry.supportLevel];
  const done = isDone(progress);
  const settled = isSettled(state, state.index);
  const isLast = state.index === state.entries.length - 1;
  const hints = activeHints(state);
  const stepsTotal = hintSteps(entry).length;
  const paperLike = policy.layout === "paper_like";
  const dots: DotState[] = state.progress.map((item, index) =>
    index === state.index
      ? "current"
      : isDone(item) || isSettled(state, index)
        ? "done"
        : item.visited
          ? "visited"
          : "upcoming",
  );

  return (
    <div ref={rootRef} className="flex scroll-mt-4 flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ProgressDots states={dots} onSelect={(index) => dispatch({ type: "goto", index })} />
        <p className="text-sm font-bold text-ink-soft">
          {vi.practice.controls.progress
            .replace("{current}", String(state.index + 1))
            .replace("{total}", String(state.entries.length))}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <LevelChip level={entry.supportLevel} />
        {paperLike ? <Badge tone="neutral">{vi.practice.runner.paperLike}</Badge> : null}
      </div>
      <h3 ref={headingRef} tabIndex={-1} className="sr-only">
        {`${heading} — ${block.title} — ${vi.practice.controls.progress
          .replace("{current}", String(state.index + 1))
          .replace("{total}", String(state.entries.length))}`}
      </h3>

      <div
        className={cn(
          "flex flex-col gap-6 rounded-card p-4 sm:p-6",
          paperLike ? "border-[3px] border-ink bg-surface" : "border border-line bg-canvas",
        )}
      >
        <BlockInstruction block={block} level={entry.supportLevel} withStimulus />
        {entry.previewOnly ? (
          <p role="note" className="rounded-2xl border-2 border-dashed border-sun-300 bg-sun-50 p-4 text-ink">
            <strong>{vi.practice.runner.previewOnlyTitle}: </strong>
            {vi.practice.audio.requiredMissing}
          </p>
        ) : null}
        <ItemPlayer
          item={entry.item}
          response={progress.draft}
          onChange={(response) => dispatch({ type: "change", response })}
          locked={done}
          marks={progress.lastGrade?.marks ?? {}}
          hint={hints.merged}
          reveal={done ? typeModule.reveal(entry.item) : null}
          paperLike={paperLike}
          idPrefix={entry.item.id}
        />
      </div>

      {hints.views.length > 0 && !done ? (
        <div role="status" aria-live="polite" className="flex gap-3 rounded-2xl border-2 border-sun-200 bg-sun-50 p-4">
          <Lightbulb aria-hidden="true" className="mt-0.5 size-6 shrink-0 text-sun-700" />
          <ul className="space-y-1 font-semibold text-ink">
            {hints.views.map((view, index) => (
              <li key={index}>{hintText(view)}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {progress.helpRequests > 0 && !done ? (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border-2 border-lagoon-200 bg-lagoon-50 p-4">
          <CircleHelp aria-hidden="true" className="size-6 shrink-0 text-lagoon-700" />
          <p className="font-semibold text-ink">
            {vi.practice.runner.helpText.replace("{text}", definition.instruction.text)}
          </p>
          <AudioSlot label={vi.practice.audio.instruction} />
        </div>
      ) : null}
      <div ref={feedbackRef} className="scroll-mb-4">
        <FeedbackBanner feedback={progress.feedback} />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {!done ? (
          // Câu chỉ để xem giao diện vẫn có nút Kiểm tra (bị khóa) để người lớn thấy đúng cơ chế bài.
          <Button size="kid" disabled={!canSubmit(state)} onClick={() => dispatch({ type: "submit", at: now() })}>
            <ClipboardCheck aria-hidden="true" className="size-6" />
            {vi.practice.controls.check}
          </Button>
        ) : null}
        {!settled ? (
          <>
            {progress.status === "retry" && progress.lastGrade ? (
              <Button size="kid" variant="secondary" onClick={() => dispatch({ type: "retry" })}>
                <RotateCcw aria-hidden="true" className="size-6" />
                {vi.practice.controls.retry}
              </Button>
            ) : null}
            {policy.hints !== "none" && stepsTotal > 0 ? (
              <Button
                size="kid"
                variant="outline"
                disabled={!canHint(state)}
                onClick={() => dispatch({ type: "hint" })}
              >
                <Lightbulb aria-hidden="true" className="size-6" />
                {vi.practice.controls.hint}
                <span className="text-base font-semibold">
                  ({vi.practice.runner.hintsLeft.replace("{n}", String(stepsTotal - progress.hintsShown))})
                </span>
              </Button>
            ) : null}
            {hasHelpButton(entry) ? (
              <Button size="kid" variant="outline" onClick={() => dispatch({ type: "help" })}>
                <CircleHelp aria-hidden="true" className="size-6" />
                {vi.practice.controls.help}
              </Button>
            ) : null}
          </>
        ) : isLast ? (
          <Button size="kid" onClick={() => dispatch({ type: "finish", at: now() })}>
            <Trophy aria-hidden="true" className="size-6" />
            {vi.practice.controls.finish}
          </Button>
        ) : (
          <Button size="kid" onClick={() => dispatch({ type: "next", at: now() })}>
            {vi.practice.controls.next}
            <ArrowRight aria-hidden="true" className="size-6" />
          </Button>
        )}
        {state.index > 0 ? (
          <Button variant="ghost" size="lg" onClick={() => dispatch({ type: "prev" })}>
            <ArrowLeft aria-hidden="true" className="size-5" />
            {vi.practice.controls.prev}
          </Button>
        ) : null}
        <Button variant="ghost" size="lg" onClick={onExit} className="sm:ml-auto">
          <LogOut aria-hidden="true" className="size-5" />
          {vi.practice.runner.exit}
        </Button>
      </div>
    </div>
  );
}
