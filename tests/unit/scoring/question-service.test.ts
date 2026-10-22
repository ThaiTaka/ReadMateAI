import { describe, expect, it } from "vitest";
import { contentFingerprint } from "@/features/exercises/fingerprint";
import { exerciseItemSchema, type ExerciseItem } from "@/features/exercises/items";
import type { VariantId } from "@/features/exercises/core/module";
import type { Json } from "@/lib/supabase/database.types";
import {
  FIXTURE_DISTINCT_ELIGIBLE,
  FIXTURE_EXERCISES,
  visualMatchAnswer,
} from "../../../scripts/fixtures/scoring-items";
import { toPublicQuestion } from "@/server/question-instances/service";
import {
  attemptRequestSchema,
  mapTileRequestSchema,
  practiceSessionRequestSchema,
} from "@/server/student-gateway/api-schemas";
import { readJson, statusFor } from "@/server/student-gateway/http";
import { demoItems } from "../exercises/helpers";

type Row = Parameters<typeof toPublicQuestion>[0];

function rowFor(item: ExerciseItem, patch: Partial<Row> = {}): Row {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    student_id: "00000000-0000-4000-8000-000000000002",
    season_id: "00000000-0000-4000-8000-000000000003",
    practice_session_id: "00000000-0000-4000-8000-000000000004",
    game_encounter_id: null,
    position: 1,
    exercise_item_id: "00000000-0000-4000-8000-000000000005",
    view: { type: item.type, variant: item.variant, content: item.content } as unknown as Json,
    status: "open",
    attempts_used: 0,
    max_attempts: 3,
    support_level: 3,
    scorable: true,
    ...patch,
  };
}

/**
 * Chuỗi "bí mật" của đáp án (tên tranh…) KHÔNG nằm sẵn trong nội dung hiển thị — không được xuất hiện trong payload
 * trước khi câu đóng. (Với nối từ–tranh, chữ trẻ phải đọc vốn nằm trong nội dung; bí mật là cách ghép, không phải chữ.)
 */
function secrets(item: ExerciseItem): string[] {
  const answer = item.answer as Record<string, unknown>;
  const out: string[] = [];
  if (typeof answer.pictureName === "string") out.push(answer.pictureName);
  if (answer.pictureNames && typeof answer.pictureNames === "object") {
    out.push(...Object.values(answer.pictureNames as Record<string, string>));
  }
  const visible = JSON.stringify(item.content);
  return out.filter((secret) => !visible.includes(secret));
}

const VARIANTS: VariantId[] = [
  "picture_onset",
  "visual_match",
  "which_rime",
  "find_with_unit",
  "missing_rime",
  "choose_picture",
  "match_pairs",
  "sentence_picture",
  "comprehension_question",
  "arrange_words",
];

describe("payload câu trước khi đóng KHÔNG chứa đáp án (GAMIFICATION_SPEC §13.8)", () => {
  for (const variant of VARIANTS) {
    it(`${variant}: mở → không answer/reveal/tên tranh; sau lượt sai vẫn không; đóng → có reveal`, () => {
      const item = demoItems(variant, "extending")[0]!;
      const open = toPublicQuestion(rowFor(item), item, [], 8);
      const text = JSON.stringify(open);
      expect(open.reveal).toBeNull();
      expect(text).not.toMatch(/"answer"|"correctIds"|"pictureNames?"|"distractorTags"|"explanation"/u);
      for (const secret of secrets(item)) expect(text).not.toContain(secret);
      expect(open.view).toEqual({ type: item.type, variant: item.variant, content: item.content });

      const wrongAttempt = {
        attempt_no: 1,
        is_correct: false,
        error_tags: ["distractor:other"],
        marks: {},
        response: {},
      };
      const retry = toPublicQuestion(rowFor(item, { attempts_used: 1 }), item, [wrongAttempt], 8);
      const retryText = JSON.stringify(retry);
      expect(retry.reveal).toBeNull();
      expect(retry.feedback?.tone).toBe("retry");
      expect(retry.feedback?.reveal).toBeNull();
      expect(retryText).not.toMatch(/"answer"|"correctIds"|"pictureNames?"/u);
      for (const secret of secrets(item)) expect(retryText).not.toContain(secret);

      const closed = toPublicQuestion(rowFor(item, { status: "exhausted", attempts_used: 3 }), item, [wrongAttempt], 8);
      expect(closed.reveal).not.toBeNull();
      expect(closed.hint).toBeNull();
    });
  }

  it("gợi ý chỉ sau lượt sai, theo mức hỗ trợ; H0 không có gợi ý", () => {
    const item = demoItems("visual_match", "developing")[0]!;
    const wrong = { attempt_no: 1, is_correct: false, error_tags: [], marks: {}, response: {} };
    expect(toPublicQuestion(rowFor(item), item, [], 1).hint).toBeNull();
    expect(toPublicQuestion(rowFor(item, { attempts_used: 1 }), item, [wrong], 1).hint).not.toBeNull();
    const h0 = toPublicQuestion(
      rowFor(item, { support_level: 0, max_attempts: 1, attempts_used: 1 }),
      item,
      [wrong],
      1,
    );
    expect(h0.hint).toBeNull();
    expect(h0.hintMode).toBe("none");
  });

  it("câu bị hủy (void) không hiện đáp án, không phản hồi", () => {
    const item = demoItems("visual_match", "developing")[0]!;
    const question = toPublicQuestion(rowFor(item, { status: "void" }), item, [], 1);
    expect(question.reveal).toBeNull();
    expect(question.feedback).toBeNull();
  });
});

describe("lược đồ request chặn trường điểm/đúng sai/mã học sinh (GAMIFICATION_SPEC §13.7)", () => {
  const response = { kind: "choice", optionId: "o1" };
  const clientAttemptId = "4b8f1c1e-3a2d-4c6e-9f10-1234567890ab";

  it("chỉ nhận { clientAttemptId, response }", () => {
    expect(attemptRequestSchema.safeParse({ clientAttemptId, response }).success).toBe(true);
    for (const extra of [
      { points: 999999 },
      { is_correct: true },
      { isCorrect: true },
      { balance: 500 },
      { student_id: clientAttemptId },
      { class_id: clientAttemptId },
    ]) {
      expect(attemptRequestSchema.safeParse({ clientAttemptId, response, ...extra }).success).toBe(false);
    }
    expect(attemptRequestSchema.safeParse({ clientAttemptId: "khong-phai-uuid", response }).success).toBe(false);
    expect(attemptRequestSchema.safeParse({ clientAttemptId, response: { ...response, correct: true } }).success).toBe(
      false,
    );
  });

  it("buổi luyện và thẻ bản đồ không nhận trường lạ", () => {
    expect(practiceSessionRequestSchema.safeParse({}).success).toBe(true);
    expect(practiceSessionRequestSchema.safeParse({ points: 10 }).success).toBe(false);
    expect(mapTileRequestSchema.safeParse({ tileKey: "lotus_pond" }).success).toBe(true);
    expect(mapTileRequestSchema.safeParse({ tileKey: "lotus_pond", free: true }).success).toBe(false);
    expect(mapTileRequestSchema.safeParse({ tileKey: "../../x" }).success).toBe(false);
  });

  it("mã HTTP theo mã lỗi", () => {
    expect(statusFor("UNAUTHENTICATED")).toBe(401);
    expect(statusFor("FORBIDDEN")).toBe(403);
    expect(statusFor("NOT_FOUND")).toBe(404);
    expect(statusFor("INVALID_INPUT")).toBe(400);
    expect(statusFor("RATE_LIMITED")).toBe(429);
    expect(statusFor("DUPLICATE_RESPONSE")).toBe(409);
    expect(statusFor("INSUFFICIENT_CONTENT")).toBe(409);
  });
});

describe("fixture kiểm thử R04 (hư cấu, chỉ local)", () => {
  const all = FIXTURE_EXERCISES.flatMap((exercise) => exercise.items);

  it("mọi câu qua lược đồ zod của bộ máy GĐ4; nội dung không chứa đáp án", () => {
    for (const item of all) {
      expect(exerciseItemSchema.safeParse(item).success).toBe(true);
      expect(Object.keys(item.content)).not.toContain("answer");
    }
  });

  it("16 nội dung phát được + 1 bản sao (trùng vân tay, khác mã câu và thứ tự phương án)", () => {
    const eligible = FIXTURE_EXERCISES.filter(
      (exercise) => exercise.status === "approved" && exercise.lessonOrdinal <= 2,
    );
    const fingerprints = eligible.flatMap((exercise) => exercise.items).map(contentFingerprint);
    expect(new Set(fingerprints).size).toBe(FIXTURE_DISTINCT_ELIGIBLE);
    const duplicate = FIXTURE_EXERCISES.find((exercise) => exercise.key === "fixture:r04:duplicate")!.items[0]!;
    const original = FIXTURE_EXERCISES[0]!.items[0]!;
    expect(duplicate.id).not.toBe(original.id);
    expect(duplicate.content).not.toEqual(original.content);
    expect(contentFingerprint(duplicate)).toBe(contentFingerprint(original));
  });

  it("đáp án visual_match suy ra được từ nội dung hiển thị (E2E làm như học sinh)", () => {
    for (const item of all) {
      if (item.type === "letter_sound" && item.variant === "visual_match") {
        expect(visualMatchAnswer(item.content)).toBe(item.answer.optionId);
      }
    }
  });
});

describe("readJson: chỉ JSON cùng nguồn, thân nhỏ, lược đồ chặt", () => {
  const request = (headers: Record<string, string>, body = '{"tileKey":"lotus_pond"}') =>
    new Request("http://localhost:3000/api/student/map-tiles", { method: "POST", headers, body });
  const json = { "content-type": "application/json", host: "127.0.0.1:3200" };

  it("nhận request cùng nguồn (so Origin với Host, không với request.url)", async () => {
    expect((await readJson(request({ ...json, origin: "http://127.0.0.1:3200" }), mapTileRequestSchema)).ok).toBe(true);
    expect((await readJson(request({ ...json, "sec-fetch-site": "same-origin" }), mapTileRequestSchema)).ok).toBe(true);
  });

  it("từ chối khác nguồn, không phải JSON, JSON hỏng, thân quá lớn", async () => {
    expect(await readJson(request({ ...json, origin: "https://ke-gian.example" }), mapTileRequestSchema)).toEqual({
      ok: false,
      code: "FORBIDDEN",
    });
    expect((await readJson(request({ ...json, "sec-fetch-site": "cross-site" }), mapTileRequestSchema)).ok).toBe(false);
    expect((await readJson(request({ ...json, "content-type": "text/plain" }), mapTileRequestSchema)).ok).toBe(false);
    expect((await readJson(request(json, "{không phải json"), mapTileRequestSchema)).ok).toBe(false);
    const big = JSON.stringify({ tileKey: "lotus_pond", pad: "x".repeat(9000) });
    expect((await readJson(request(json, big), mapTileRequestSchema)).ok).toBe(false);
  });
});
