import { randomUUID } from "node:crypto";
import { rpcOk, type Actor, type Db } from "./helpers";
import { candidates, linkedStudent, planItems, sessionQuestions, startSession, submit } from "./scoring-helpers";

/**
 * Học sinh có đủ/thiếu từng điều kiện hiển thị + điểm thật qua GATEWAY GHI ĐIỂM (không sửa CSDL để giả lập điểm).
 * Dùng cho kiểm thử vinh danh (R06.1); cùng cách làm với tests/db/leaderboard.test.ts.
 */

export type Mem = { studentId: string; device: Actor; alias: string };

export async function boardMember(
  teacher: Db,
  classId: string,
  options: { alias?: string | null; approved?: boolean; learning?: boolean; display?: boolean } = {},
): Promise<Mem> {
  const { alias = `Bạn ${randomUUID().slice(0, 4)}`, approved = true, learning = true, display = true } = options;
  const { studentId, device } = await linkedStudent(teacher, classId, { consent: learning });
  if (alias) {
    await rpcOk(teacher.rpc("teacher_set_leaderboard_alias", { p_student_id: studentId, p_alias: alias }));
    if (approved) await rpcOk(teacher.rpc("teacher_approve_leaderboard_alias", { p_student_id: studentId }));
  }
  if (display) await recordDisplayConsent(teacher, studentId);
  return { studentId, device, alias: alias ?? "" };
}

export async function recordDisplayConsent(teacher: Db, studentId: string) {
  await rpcOk(
    teacher.rpc("teacher_record_consent", {
      p_student_id: studentId,
      p_scope: "leaderboard_display",
      p_notice_version: "kiem-thu-vinh-danh",
      p_method: "paper_form",
      p_note: "",
      p_attested: true,
    }),
  );
}

/** Học sinh làm bài qua đúng gateway ghi điểm; mỗi nội dung chỉ tính điểm một lần mỗi mùa (+10 mỗi câu đúng). */
export function player(mem: Mem) {
  let items: string[] | null = null;
  let cursor = 0;
  let queue: string[] = [];
  const open = async () => {
    if (!items) {
      const result = await candidates(mem.device, mem.studentId);
      const list = (result.data as { items: Array<{ exerciseItemId: string; fingerprint: string }> }).items;
      const seen = new Set<string>();
      items = list
        .filter((item) => !seen.has(item.fingerprint) && seen.add(item.fingerprint))
        .map((item) => item.exerciseItemId);
    }
    const ids = items.slice(cursor, cursor + 4);
    cursor += ids.length;
    if (ids.length === 0) throw new Error("hết nội dung kiểm thử");
    const session = (await rpcOk(startSession(mem.device, mem.studentId, planItems(ids)))) as { sessionId: string };
    queue = (await sessionQuestions(session.sessionId)).map((q) => q.id);
  };
  return {
    async correct(times = 1) {
      for (let i = 0; i < times; i += 1) {
        if (queue.length === 0) await open();
        await rpcOk(submit(mem.device, queue.shift()!, "correct"));
      }
    },
  };
}
