"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import type { EncounterStateDto } from "@/features/game-runs/encounter-dto";
import type { Route } from "next";
import { vi } from "@/strings/vi";
import type { GameRunDto } from "@/features/game-runs/dto";
import type { Level } from "../core/index.ts";
import { EncounterGate } from "./encounter/encounter-gate.tsx";
import { fetchEncounterState } from "./encounter/encounter-client.ts";
import { TreasureGate } from "./encounter/treasure-gate.tsx";
import { sendPosition, startRun, type StartResult } from "./game-run-client.ts";
import { MazeRun, type SavedBinding } from "./maze-player.tsx";
import { PositionSaver, type SaveStatus } from "./position-saver.ts";

/*
 * Mê cung kho báu của học sinh có xác thực (R07.5b2). Mở trang → POST bắt đầu/tiếp tục (máy chủ quyết định ngưỡng điểm,
 * đồng ý, mùa, nội dung); chỉ khi máy chủ trả lượt thật mới dựng bàn chơi. Không có fixture ở client: lượt "không tính
 * điểm" chỉ tồn tại khi CSDL LOCAL tạo ra.
 */

const t = vi.treasureMazePlay;

const BLOCKED_NOTE_CLASS = "mx-auto max-w-xl rounded-3xl border-2 border-line bg-surface p-6 text-center";

function Panel({
  testId,
  title,
  children,
  actions,
}: {
  testId: string;
  title?: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div data-testid={testId} role="group" aria-label={title ?? t.title} className={BLOCKED_NOTE_CLASS}>
      {title ? <h2 className="text-2xl font-extrabold text-ink">{title}</h2> : null}
      <p className="mt-2 text-lg font-semibold text-ink-soft">{children}</p>
      {actions ? <div className="mt-5 flex flex-wrap justify-center gap-3">{actions}</div> : null}
    </div>
  );
}

const BUTTON =
  "inline-flex min-h-16 items-center justify-center rounded-2xl border-2 border-jade-600 bg-jade-50 px-6 text-lg font-extrabold text-ink";

const HOME_HREF = "/learn/me" as Route;

function homeHref(studentId: string, multiple: boolean): Route {
  return (multiple ? `/learn/me?student=${studentId}` : "/learn/me") as Route;
}

export function SavedMaze({
  studentId,
  multipleProfiles,
  levelKey,
  level,
  balance = null,
}: {
  studentId: string;
  multipleProfiles: boolean;
  levelKey: string;
  level: Level;
  /** Điểm hiện tại do máy chủ trả khi mở trang (hiện ở màn quái vật; sau mỗi câu được thay bằng số máy chủ trả). */
  balance?: number | null;
}) {
  type Load =
    | { phase: "loading" }
    | { phase: "failed"; result: Extract<StartResult, { ok: false }>; replay: boolean }
    /** Lượt tính điểm của màn này trong mùa đã xong: mời "Chơi lại cho vui" (máy chủ vẫn kiểm điều kiện khi bấm). */
    | { phase: "offer" }
    | {
        phase: "ready";
        run: GameRunDto["run"];
        epoch: number;
        /** Trạng thái chạm trán của máy chủ (tiến độ, điểm đã dùng, chạm trán đang diễn ra); null = lượt không có chạm trán. */
        encounters: EncounterStateDto | null;
      };
  const [load, setLoad] = useState<Load>({ phase: "loading" });
  const epoch = useRef(0);
  const home = homeHref(studentId, multipleProfiles);

  /** Bắt đầu/tiếp tục lượt rồi nạp trạng thái chạm trán của MÁY CHỦ (không suy từ trình duyệt). */
  const fetchRun = useCallback(
    async (replay = false): Promise<Load> => {
      const result = await startRun(studentId, levelKey, replay);
      if (!result.ok) {
        // Lượt tính điểm đã xong trong mùa này (CSDL trả RUN_NOT_ACTIVE) → chỉ còn đường chơi lại không tính điểm.
        if (!replay && result.code === "RUN_NOT_ACTIVE") return { phase: "offer" };
        return { phase: "failed", result, replay };
      }
      const state = await fetchEncounterState(result.data.run.id);
      if (!state.ok) return { phase: "failed", result: { ok: false, code: state.code }, replay };
      epoch.current += 1;
      return {
        phase: "ready",
        run: result.data.run,
        epoch: epoch.current,
        // Lượt fixture local (R07: không tính điểm, không chơi lại) không có chạm trán: giữ hành vi lưu vị trí thuần.
        encounters:
          (result.data.run.scored || result.data.run.replay) && state.data.progress.total > 0 ? state.data : null,
      };
    },
    [studentId, levelKey],
  );

  const open = useCallback(
    async (replay = false) => {
      setLoad({ phase: "loading" });
      setLoad(await fetchRun(replay));
    },
    [fetchRun],
  );

  useEffect(() => {
    let cancelled = false;
    void fetchRun().then((next) => {
      if (!cancelled) setLoad(next);
    });
    return () => {
      cancelled = true;
    };
  }, [fetchRun]);

  if (load.phase === "loading") {
    return (
      <p
        data-testid="maze-loading"
        aria-live="polite"
        className="py-10 text-center text-lg font-semibold text-ink-soft"
      >
        {t.loading}
      </p>
    );
  }
  if (load.phase === "offer") {
    return (
      <Panel
        testId="maze-replay-offer"
        title={t.replay.offerTitle}
        actions={
          <>
            <button type="button" onClick={() => void open(true)} className={BUTTON} data-testid="replay-start">
              {t.replay.cta}
            </button>
            <Link href={home} className={BUTTON}>
              {t.back}
            </Link>
          </>
        }
      >
        {t.replay.offerText}
      </Panel>
    );
  }
  if (load.phase === "failed") {
    const code = load.result.code;
    if (code === "INSUFFICIENT_CONTENT") {
      return (
        <Panel
          testId="maze-preparing"
          actions={
            <Link href={"/demo/treasure-maze" as Route} className={BUTTON}>
              {t.demoCta}
            </Link>
          }
        >
          {t.preparing}
        </Panel>
      );
    }
    if (code === "SEASON_CLOSED") {
      return (
        <Panel
          testId="maze-closed"
          title={t.closed.title}
          actions={
            <Link href={home} className={BUTTON}>
              {t.back}
            </Link>
          }
        >
          {t.closed.text}
        </Panel>
      );
    }
    const retryable = code === "NETWORK" || code === "UNKNOWN" || code === "RATE_LIMITED" || code === "NOT_CONFIGURED";
    return (
      <Panel
        testId="maze-load-error"
        actions={
          <>
            {retryable ? (
              <button type="button" onClick={() => void open(load.replay)} className={BUTTON}>
                {t.retryLoad}
              </button>
            ) : null}
            <Link href={home} className={BUTTON}>
              {t.back}
            </Link>
          </>
        }
      >
        {code === "NETWORK" ? t.loadFailed : (vi.errors[code] ?? t.loadFailed)}
      </Panel>
    );
  }
  return (
    <ReadyMaze
      key={`${load.run.id}:${load.epoch}`}
      studentId={studentId}
      run={load.run}
      encounters={load.encounters}
      balance={balance}
      level={level}
      home={home}
      onReload={() => void open()}
      onPlayAgain={() => void open(true)}
    />
  );
}

const STATUS_TEXT: Record<SaveStatus, string> = {
  saved: t.save.saved,
  saving: t.save.saving,
  unsaved: t.save.unsaved,
  conflict: t.save.unsaved,
  closed: t.save.unsaved,
  signed_out: t.save.unsaved,
};

function ReadyMaze({
  studentId,
  run,
  encounters,
  balance,
  level,
  home,
  onReload,
  onPlayAgain,
}: {
  studentId: string;
  run: GameRunDto["run"];
  encounters: EncounterStateDto | null;
  balance: number | null;
  level: Level;
  home: Route;
  onReload: () => void;
  onPlayAgain: () => void;
}) {
  const saver = useMemo(
    () =>
      new PositionSaver({
        stateVersion: run.stateVersion,
        send: (path, version, keepalive) => sendPosition(studentId, run.id, path, version, keepalive),
      }),
    [run.id, run.stateVersion, studentId],
  );
  const [progress, setProgress] = useState(encounters?.progress ?? null);
  // Chạm trán đang diễn ra khi tải lại: chỉ dùng cho cổng ĐẦU TIÊN; các chạm trán sau do máy chủ kích hoạt.
  const [resume, setResume] = useState<EncounterStateDto | null>(encounters?.encounter ? encounters : null);
  const [treasureOpened, setTreasureOpened] = useState(false);
  // Điểm hiện có theo máy chủ: cập nhật sau mỗi lượt nộp để chạm trán kế tiếp không hiện số cũ lúc mở trang.
  const [liveBalance, setLiveBalance] = useState(balance);
  const refreshProgress = useCallback(async () => {
    const result = await fetchEncounterState(run.id);
    if (result.ok) setProgress(result.data.progress);
  }, [run.id]);
  const binding: SavedBinding = useMemo(
    () => ({
      initial: run.position,
      saver,
      encounters: encounters
        ? {
            resolvedTriggerIds: encounters.resolvedTriggerKeys,
            progressText: progress
              ? vi.mazeProgress.met.replace("{n}", String(progress.resolved)).replace("{total}", String(progress.total))
              : vi.mazeProgress.unknown,
            locked: treasureOpened,
            renderEncounter: ({ triggerId, dismiss }) => (
              <EncounterGate
                key={triggerId}
                studentId={studentId}
                runId={run.id}
                saver={saver}
                resume={resume}
                balance={liveBalance}
                onScore={setLiveBalance}
                replay={run.replay}
                home={home}
                onDismiss={() => {
                  setResume(null);
                  dismiss();
                  void refreshProgress();
                }}
                onFinished={(next) => {
                  setResume(null);
                  dismiss();
                  if (next) setProgress(next);
                  else void refreshProgress();
                }}
              />
            ),
            renderTreasure: (atTreasure) => (
              <TreasureGate
                studentId={studentId}
                runId={run.id}
                saver={saver}
                active={atTreasure}
                progress={progress}
                home={home}
                onOpened={() => setTreasureOpened(true)}
                replay={run.replay}
                onPlayAgain={onPlayAgain}
              />
            ),
          }
        : undefined,
    }),
    [
      run.position,
      run.id,
      saver,
      encounters,
      progress,
      resume,
      treasureOpened,
      studentId,
      liveBalance,
      home,
      refreshProgress,
      run.replay,
      onPlayAgain,
    ],
  );
  const snapshot = useSyncExternalStore(saver.subscribe, saver.getSnapshot, saver.getSnapshot);
  const rootRef = useRef<HTMLDivElement>(null);

  // Cố gắng lưu khi trang bị ẩn/đóng, khi rời màn và tự thử lại khi có mạng; không giả định yêu cầu luôn hoàn tất.
  useEffect(() => {
    const hide = () => {
      if (document.visibilityState === "hidden") saver.flush(true);
    };
    const leave = () => saver.flush(true);
    const online = () => {
      if (saver.getSnapshot().status === "unsaved") saver.retry();
    };
    document.addEventListener("visibilitychange", hide);
    window.addEventListener("pagehide", leave);
    window.addEventListener("online", online);
    return () => {
      document.removeEventListener("visibilitychange", hide);
      window.removeEventListener("pagehide", leave);
      window.removeEventListener("online", online);
      saver.flush(true);
    };
  }, [saver]);

  const { status, unsaved } = snapshot;
  const ribbon = run.replay ? t.replay.ribbon : run.scored ? t.scoredRibbon : t.tryRibbon;
  return (
    <div ref={rootRef} data-testid="saved-maze" data-run-id={run.id} data-scored={run.scored} data-replay={run.replay}>
      <p
        role="note"
        data-testid="maze-ribbon"
        className="inline-flex rounded-full border-2 border-dashed border-sun-400 bg-sun-50 px-4 py-2 text-sm font-extrabold tracking-wide text-sun-800 uppercase"
      >
        {ribbon}
      </p>
      {run.replay ? (
        <p className="mt-2 mb-4 max-w-prose text-ink-soft">{t.replay.offerText}</p>
      ) : !run.scored ? (
        <p className="mt-2 mb-4 max-w-prose text-ink-soft">{t.tryNote}</p>
      ) : (
        <div className="mb-4" />
      )}

      {status === "conflict" ? (
        <Panel
          testId="maze-conflict"
          title={t.conflict.title}
          actions={
            <button type="button" onClick={onReload} className={BUTTON}>
              {t.conflict.action}
            </button>
          }
        >
          {unsaved > 0 ? t.conflict.text.replace("{n}", String(unsaved)) : t.conflict.textNone}
        </Panel>
      ) : status === "closed" ? (
        <Panel
          testId="maze-closed"
          title={t.closed.title}
          actions={
            <Link href={home} className={BUTTON}>
              {t.back}
            </Link>
          }
        >
          {t.closed.text}
        </Panel>
      ) : status === "signed_out" ? (
        <Panel
          testId="maze-signed-out"
          title={t.signedOut.title}
          actions={
            <Link href={HOME_HREF} className={BUTTON}>
              {t.back}
            </Link>
          }
        >
          {t.signedOut.text}
        </Panel>
      ) : (
        <>
          <p
            aria-live="polite"
            data-testid="save-status"
            data-state={status}
            className="mx-auto mb-3 flex max-w-[34rem] flex-wrap items-center justify-center gap-3 text-base font-bold text-ink"
          >
            <span>
              <span className="sr-only">{`${t.save.label}: `}</span>
              {STATUS_TEXT[status]}
            </span>
            {status === "unsaved" ? (
              <button
                type="button"
                onClick={() => saver.retry()}
                className="inline-flex min-h-12 items-center rounded-2xl border-2 border-line-strong bg-surface px-4 text-base font-bold text-ink"
              >
                {t.save.retry}
              </button>
            ) : null}
          </p>
          {status === "unsaved" ? (
            <p className="mx-auto mb-3 max-w-[34rem] text-center text-sm font-semibold text-ink-soft">
              {t.save.unsavedHint}
            </p>
          ) : null}
          <MazeRun level={level} rootRef={rootRef} onReplay={() => undefined} saved={binding} backHref={home} />
        </>
      )}
    </div>
  );
}
