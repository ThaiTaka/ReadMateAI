import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  MAX_BATCH,
  PositionSaver,
  SAVE_AFTER_MS,
  SAVE_EVERY_STEPS,
  type SendPosition,
  type SendResult,
} from "@/features/game-engine/ui/position-saver";

/** R07.5b2 — bộ tự lưu: một yêu cầu bay, lô đóng băng khi thử lại, không mất/nhân đôi bước. */

type Call = {
  path: { row: number; col: number }[];
  version: number;
  keepalive: boolean;
  resolve: (r: SendResult) => void;
};

function harness(version = 1) {
  const calls: Call[] = [];
  const send: SendPosition = (path, v, keepalive) =>
    new Promise<SendResult>((resolve) => calls.push({ path: [...path], version: v, keepalive, resolve }));
  return { calls, saver: new PositionSaver({ stateVersion: version, send }) };
}

const cell = (n: number) => ({ row: 1, col: n });
const ok = (stateVersion: number, n: number): SendResult => ({ kind: "ok", stateVersion, position: cell(n) });
const settle = () => vi.advanceTimersByTimeAsync(0);

describe("PositionSaver", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("lưu sau 5 bước, gửi đúng các bước và giữ stateVersion máy chủ trả về", async () => {
    const { calls, saver } = harness(3);
    for (let n = 1; n <= SAVE_EVERY_STEPS - 1; n += 1) saver.push(cell(n));
    expect(calls).toHaveLength(0);
    expect(saver.getSnapshot()).toEqual({ status: "saving", unsaved: 4 });
    saver.push(cell(5));
    expect(calls).toHaveLength(1);
    expect(calls[0]!.path.map((p) => p.col)).toEqual([1, 2, 3, 4, 5]);
    expect(calls[0]!.version).toBe(3);
    calls[0]!.resolve(ok(4, 5));
    await settle();
    expect(saver.getSnapshot()).toEqual({ status: "saved", unsaved: 0 });
    saver.push(cell(6));
    await vi.advanceTimersByTimeAsync(SAVE_AFTER_MS);
    expect(calls[1]!.version).toBe(4);
    expect(calls[1]!.path).toEqual([cell(6)]);
  });

  it("tối đa 3 giây khi có bước chưa lưu", async () => {
    const { calls, saver } = harness();
    saver.push(cell(1));
    await vi.advanceTimersByTimeAsync(SAVE_AFTER_MS - 1);
    expect(calls).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(1);
    expect(calls).toHaveLength(1);
  });

  it("chỉ một yêu cầu bay; bước mới xếp hàng và gửi sau khi xác nhận", async () => {
    const { calls, saver } = harness();
    for (let n = 1; n <= 5; n += 1) saver.push(cell(n));
    for (let n = 6; n <= 12; n += 1) saver.push(cell(n));
    saver.flush();
    expect(calls).toHaveLength(1);
    calls[0]!.resolve(ok(2, 5));
    await settle();
    expect(calls).toHaveLength(2);
    expect(calls[1]!.path.map((p) => p.col)).toEqual([6, 7, 8, 9, 10, 11, 12]);
    expect(calls[1]!.version).toBe(2);
  });

  it("mỗi yêu cầu tối đa 64 bước; phần dư gửi tiếp", async () => {
    const { calls, saver } = harness();
    for (let n = 1; n <= SAVE_EVERY_STEPS; n += 1) saver.push(cell(n)); // lô đầu đang bay
    for (let n = SAVE_EVERY_STEPS + 1; n <= SAVE_EVERY_STEPS + MAX_BATCH + 10; n += 1) saver.push(cell(n));
    calls[0]!.resolve(ok(2, SAVE_EVERY_STEPS));
    await settle();
    expect(calls[1]!.path).toHaveLength(MAX_BATCH);
    calls[1]!.resolve(ok(3, SAVE_EVERY_STEPS + MAX_BATCH));
    await settle();
    expect(calls[2]!.path).toHaveLength(10);
  });

  it("mất mạng: báo chưa lưu, giữ nguyên lô; thử lại gửi CHÍNH lô đó với cùng phiên bản, không nhân đôi", async () => {
    const { calls, saver } = harness(7);
    for (let n = 1; n <= 5; n += 1) saver.push(cell(n));
    calls[0]!.resolve({ kind: "failed" });
    await settle();
    expect(saver.getSnapshot()).toEqual({ status: "unsaved", unsaved: 5 });
    saver.push(cell(6)); // bước mới trong lúc đang lỗi chỉ xếp hàng phía sau
    expect(saver.getSnapshot().unsaved).toBe(6);
    saver.retry();
    expect(calls).toHaveLength(2);
    expect(calls[1]!.path).toEqual(calls[0]!.path);
    expect(calls[1]!.version).toBe(7);
    calls[1]!.resolve({ kind: "ok", stateVersion: 8, position: cell(5) }); // máy chủ báo 'replayed' cũng là ok
    await vi.advanceTimersByTimeAsync(SAVE_AFTER_MS);
    expect(calls).toHaveLength(3);
    expect(calls[2]!.path).toEqual([cell(6)]);
    expect(calls[2]!.version).toBe(8);
  });

  it("yêu cầu ném lỗi (fetch hỏng) được coi là chưa lưu được", async () => {
    const saver = new PositionSaver({ stateVersion: 1, send: () => Promise.reject(new Error("offline")) });
    saver.push(cell(1));
    saver.flush();
    await settle();
    expect(saver.getSnapshot().status).toBe("unsaved");
  });

  it("STATE_CONFLICT dừng ghi hẳn: không gửi thêm, giữ số bước chưa lưu để giải thích", async () => {
    const { calls, saver } = harness();
    for (let n = 1; n <= 5; n += 1) saver.push(cell(n));
    calls[0]!.resolve({ kind: "conflict" });
    await settle();
    expect(saver.getSnapshot()).toEqual({ status: "conflict", unsaved: 5 });
    saver.push(cell(6));
    saver.flush();
    saver.retry();
    await vi.advanceTimersByTimeAsync(SAVE_AFTER_MS * 2);
    expect(calls).toHaveLength(1);
  });

  it("mùa đóng / hết phiên là trạng thái cuối, không báo đã lưu", async () => {
    for (const kind of ["closed", "signed_out"] as const) {
      const { calls, saver } = harness();
      saver.push(cell(1));
      saver.flush();
      calls[0]!.resolve({ kind });
      await settle();
      expect(saver.getSnapshot().status).toBe(kind);
      expect(saver.getSnapshot().unsaved).toBe(1);
    }
  });

  it("phản hồi ok nhưng vị trí khác bước cuối đã gửi → coi là xung đột, không báo đã lưu", async () => {
    const { calls, saver } = harness();
    saver.push(cell(1));
    saver.flush();
    calls[0]!.resolve(ok(2, 9));
    await settle();
    expect(saver.getSnapshot().status).toBe("conflict");
  });

  it("flush khi ẩn trang dùng keepalive; không gửi khi không có gì chưa lưu", () => {
    const { calls, saver } = harness();
    saver.flush(true);
    expect(calls).toHaveLength(0);
    saver.push(cell(1));
    saver.flush(true);
    expect(calls[0]!.keepalive).toBe(true);
  });

  it("flushAndWait: true chỉ khi máy chủ xác nhận hết; lỗi mạng hoặc hết hạn → false", async () => {
    const clean = harness();
    await expect(clean.saver.flushAndWait(1000)).resolves.toBe(true);

    const okCase = harness();
    okCase.saver.push(cell(1));
    const waiting = okCase.saver.flushAndWait(4000);
    okCase.calls[0]!.resolve(ok(2, 1));
    await expect(waiting).resolves.toBe(true);

    const failCase = harness();
    failCase.saver.push(cell(1));
    const failing = failCase.saver.flushAndWait(4000);
    failCase.calls[0]!.resolve({ kind: "failed" });
    await expect(failing).resolves.toBe(false);
    expect(failCase.saver.getSnapshot().status).toBe("unsaved");

    const slow = harness();
    slow.saver.push(cell(1));
    const timedOut = slow.saver.flushAndWait(4000);
    await vi.advanceTimersByTimeAsync(4000);
    await expect(timedOut).resolves.toBe(false);
  });
});
