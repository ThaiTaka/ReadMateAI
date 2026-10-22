import type { Position } from "../core/types.ts";

/*
 * Bộ tự lưu vị trí Mê cung (R07.5b2). Thuần TypeScript, không DOM: gửi qua hàm `send` được tiêm vào.
 *  - Tối đa MỘT yêu cầu bay tại một thời điểm; bước mới xếp hàng phía sau.
 *  - Lô đang gửi bị "đóng băng" (`frozen`) cho tới khi máy chủ xác nhận: gửi lại sau lỗi mạng dùng CHÍNH lô đó với
 *    cùng `stateVersion`, nên nếu lần trước thực ra đã thành công, CSDL trả `replayed` — không mất, không nhân đôi bước.
 *  - Chỉ máy chủ quyết định vị trí hợp lệ; bộ này không bao giờ coi việc lưu là đã xác thực thử thách (R08).
 */

/** Khớp MAX_POSITION_PATH của `features/game-runs/dto.ts` (không import vì tệp đó kéo zod vào trình duyệt). */
export const MAX_BATCH = 64;
export const SAVE_EVERY_STEPS = 5;
export const SAVE_AFTER_MS = 3000;

export type SendResult =
  | { kind: "ok"; stateVersion: number; position: Position }
  /** Máy chủ từ chối đường đi/phiên bản (tab khác đã lưu, đường đi không khớp…): phải tải lại vị trí từ máy chủ. */
  | { kind: "conflict" }
  /** Mùa đã đóng hoặc lượt chơi không còn hoạt động. */
  | { kind: "closed" }
  /** Hết phiên/thiết bị không còn liên kết. */
  | { kind: "signed_out" }
  /** Mất mạng, quá tải, lỗi máy chủ — có thể thử lại. */
  | { kind: "failed" };

export type SendPosition = (path: readonly Position[], stateVersion: number, keepalive: boolean) => Promise<SendResult>;

export type SaveStatus = "saved" | "saving" | "unsaved" | "conflict" | "closed" | "signed_out";

export type SaverSnapshot = {
  readonly status: SaveStatus;
  /** Số bước chưa được máy chủ xác nhận (đang gửi + đang chờ). */
  readonly unsaved: number;
};

const TERMINAL: ReadonlySet<SaveStatus> = new Set(["conflict", "closed", "signed_out"]);

export class PositionSaver {
  private version: number;
  private readonly send: SendPosition;
  private queue: Position[] = [];
  private frozen: Position[] | null = null;
  private inflight = false;
  private failed = false;
  private terminal: SaveStatus | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private listeners = new Set<() => void>();
  private snapshot: SaverSnapshot = { status: "saved", unsaved: 0 };

  constructor(options: { stateVersion: number; send: SendPosition }) {
    this.version = options.stateVersion;
    this.send = options.send;
  }

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  readonly getSnapshot = (): SaverSnapshot => this.snapshot;

  /** Ghi nhận một bước đi THỰC SỰ (đã qua reducer, không phải va tường). */
  push(step: Position): void {
    if (this.terminal) return;
    this.queue.push({ row: step.row, col: step.col });
    this.refresh();
    this.schedule();
  }

  /** Lưu ngay nếu có bước chưa lưu (tạm dừng, ẩn trang, rời màn). `keepalive` để yêu cầu sống sót khi trang đóng. */
  flush(keepalive = false): void {
    if (this.terminal || this.inflight) return;
    this.clearTimer();
    if (!this.frozen) {
      if (this.queue.length === 0) return;
      this.frozen = this.queue.splice(0, MAX_BATCH);
    }
    const batch = this.frozen;
    this.inflight = true;
    this.refresh();
    void this.send(
      batch.map((p) => ({ row: p.row, col: p.col })),
      this.version,
      keepalive,
    )
      .catch((): SendResult => ({ kind: "failed" }))
      .then((result) => this.settle(batch, result));
  }

  /**
   * Rời màn: lưu bước còn chờ rồi đợi máy chủ xác nhận. `true` CHỈ khi không còn bước nào chưa được xác nhận;
   * hết hạn, lỗi mạng hoặc trạng thái cuối → `false` (không bao giờ hứa rằng đã lưu).
   */
  flushAndWait(timeoutMs: number): Promise<boolean> {
    const done = () => !this.terminal && !this.failed && !this.inflight && this.queue.length === 0 && !this.frozen;
    if (done()) return Promise.resolve(true);
    this.retry();
    return new Promise((resolve) => {
      const finish = (ok: boolean) => {
        clearTimeout(timer);
        this.listeners.delete(check);
        resolve(ok);
      };
      const check = () => {
        if (done()) finish(true);
        else if (this.terminal || this.failed) finish(false);
      };
      const timer = setTimeout(() => finish(false), timeoutMs);
      this.listeners.add(check);
      check();
    });
  }

  /** Nút "Thử lại" hoặc khi có mạng trở lại. */
  retry(): void {
    if (this.terminal || this.inflight) return;
    this.failed = false;
    this.refresh();
    this.flush();
  }

  private settle(batch: Position[], result: SendResult): void {
    this.inflight = false;
    if (result.kind === "ok") {
      const last = batch[batch.length - 1]!;
      if (result.position.row !== last.row || result.position.col !== last.col) {
        // Máy chủ báo vị trí khác điều ta vừa gửi: không tin rằng đã lưu đúng.
        this.finish("conflict");
        return;
      }
      this.version = result.stateVersion;
      this.frozen = null;
      this.failed = false;
      this.refresh();
      this.schedule();
      return;
    }
    if (result.kind === "failed") {
      this.failed = true;
      this.refresh();
      return;
    }
    this.finish(result.kind);
  }

  private finish(status: SaveStatus): void {
    this.terminal = status;
    this.clearTimer();
    this.refresh();
  }

  private schedule(): void {
    if (this.terminal || this.inflight) return;
    const waiting = (this.frozen?.length ?? 0) + this.queue.length;
    if (waiting === 0) return;
    if (this.queue.length >= SAVE_EVERY_STEPS) {
      this.flush();
      return;
    }
    if (this.timer === null) {
      this.timer = setTimeout(() => {
        this.timer = null;
        this.flush();
      }, SAVE_AFTER_MS);
    }
  }

  private clearTimer(): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
  }

  private refresh(): void {
    const unsaved = (this.frozen?.length ?? 0) + this.queue.length;
    const status: SaveStatus =
      this.terminal ?? (this.failed ? "unsaved" : unsaved > 0 || this.inflight ? "saving" : "saved");
    if (status === this.snapshot.status && unsaved === this.snapshot.unsaved) return;
    this.snapshot = { status, unsaved };
    for (const listener of this.listeners) listener();
  }
}

export function isTerminalStatus(status: SaveStatus): boolean {
  return TERMINAL.has(status);
}
