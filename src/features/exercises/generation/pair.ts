import type { SupportLevel } from "../../../types/learning.ts";
import { DIFFICULTY_CAVEAT, type ExerciseTaskContract, type WorksheetSection } from "../core/worksheet.ts";
import { moduleOf, VARIANTS } from "../registry.ts";
import type { ExerciseItem } from "../items.ts";
import type { GenerationRequest } from "./context.ts";
import { generateExerciseSet, type ExerciseSet, type GenerationDiagnostics } from "./generate.ts";

/**
 * Bài ở nhà ↔ bài ở lớp (PRD §13): cùng dạng, cùng biểu tượng và câu lệnh, cùng mục tiêu kiến thức,
 * độ khó ƯỚC LƯỢNG chênh ≤ 1 bậc, KHÁC nội dung (không trùng mục tiêu cụ thể nào).
 * Không khẳng định hai bài tương đương hoàn toàn về độ khó khi chưa có dữ liệu thử nghiệm thực tế.
 */

export function meanDifficulty(set: ExerciseSet): number {
  return set.items.reduce((sum, item) => sum + item.difficulty, 0) / Math.max(1, set.items.length);
}

export function answerKey(set: ExerciseSet): Array<{ itemId: string; answer: string }> {
  return set.items.map((item) => ({ itemId: item.id, answer: moduleOf(item).reveal(item).answerText }));
}

export function worksheetSection(set: ExerciseSet): WorksheetSection {
  const definition = VARIANTS[set.variant];
  return {
    type: set.type,
    variant: set.variant,
    icon: definition.instruction.icon,
    instruction: definition.instruction.text,
    paperSupported: definition.paper.supported,
    note: definition.paper.note,
    items: set.items.map((item) => moduleOf(item).worksheet(item)),
  };
}

/** Hợp đồng dữ liệu của một bài (8 thông tin — docs/EXERCISE_ENGINE.md §3.4). */
export function buildTaskContract(
  set: ExerciseSet,
  role: "home" | "classroom",
  supportLevel: SupportLevel,
): ExerciseTaskContract {
  const definition = VARIANTS[set.variant];
  const mean = meanDifficulty(set);
  return {
    contractVersion: 1,
    role,
    learningObjective: {
      code: set.objective.code,
      description: definition.objectiveDescription,
      focusUnits: set.objective.focusUnits,
      ruleIds: set.objective.ruleIds,
    },
    exerciseType: set.type,
    variant: set.variant,
    difficulty: {
      level: Math.min(5, Math.max(1, Math.round(mean))) as 1 | 2 | 3 | 4 | 5,
      mean: Math.round(mean * 100) / 100,
      basis: "structural_estimate",
      caveat: DIFFICULTY_CAVEAT,
    },
    requiredKnowledge: Array.from(new Set(set.items.flatMap((item) => item.requiredUnits))),
    supportLevel: role === "classroom" ? 0 : supportLevel,
    answerKey: answerKey(set),
    worksheet: worksheetSection(set),
    variantMetadata: {
      seed: set.seed,
      generatorVersion: set.generatorVersion,
      mode: set.mode,
      profileId: set.profileId,
      band: set.band,
      lessonOrdinal: set.lessonOrdinal,
      itemIds: set.items.map((item) => item.id),
      sourceIds: Array.from(
        new Set(set.items.flatMap((item) => [...item.source.corpusIds, ...item.source.pictureIds])),
      ),
    },
  };
}

export type PairEquivalence = {
  sameType: true;
  sameObjective: boolean;
  focusUnits: string[];
  /** Từng cặp "bài sinh đôi": câu ở lớp cùng đơn vị trọng tâm với câu ở nhà, khác mục tiêu cụ thể. */
  twins: Array<{ homeItemId: string; classroomItemId: string; focusUnits: string[] }>;
  difficulty: { home: number; classroom: number; delta: number; withinOneLevel: boolean };
  sharedTargets: string[];
  identicalAnswerKey: boolean;
  caveat: string;
};

export type PairResult =
  | {
      ok: true;
      home: ExerciseSet;
      classroom: ExerciseSet;
      equivalence: PairEquivalence;
      contracts: { home: ExerciseTaskContract; classroom: ExerciseTaskContract };
    }
  | {
      ok: false;
      code: "HOME_SET_FAILED" | "INSUFFICIENT_CONTENT_FOR_PAIR";
      message: string;
      /** Bài ở nhà vẫn dùng được khi chỉ thiếu ngữ liệu cho bài ở lớp. */
      home: ExerciseSet | null;
      diagnostics: { home: GenerationDiagnostics; classroom: GenerationDiagnostics | null };
    };

/** Khóa nhóm "cùng mục tiêu": tập đơn vị trọng tâm đã sắp xếp (rỗng = mục tiêu kỹ năng chung của biến thể). */
function focusKey(item: ExerciseItem): string {
  return [...item.objective.focusUnits].sort().join("|");
}

function subset(set: ExerciseSet, indexes: readonly number[], role: "home" | "classroom"): ExerciseSet {
  const items = indexes.flatMap((index) => (set.items[index] ? [set.items[index]] : []));
  return {
    ...set,
    items,
    keys: indexes.flatMap((index) => (set.keys[index] !== undefined ? [set.keys[index]] : [])),
    objective: {
      ...set.objective,
      focusUnits: Array.from(new Set(items.flatMap((item) => item.objective.focusUnits))),
      ruleIds: Array.from(new Set(items.flatMap((item) => item.objective.ruleIds))),
    },
    seed: `${set.seed}|${role}`,
  };
}

/**
 * Tạo bài ở nhà và bài ở lớp bằng cách ghép "bài sinh đôi" (ARCHITECTURE §11.4, §16):
 *  1. sinh MỘT kho câu hợp lệ (mỗi câu đã qua toàn bộ chuỗi kiểm tra), thứ tự theo seed;
 *  2. với mỗi câu ở nhà, tìm câu khác mục tiêu cụ thể nhưng CÙNG nhóm đơn vị trọng tâm và độ khó chênh ≤ 1;
 *  3. không đủ cặp → trả về lý do (bài ở nhà vẫn có thể dùng), không nới quy tắc.
 */
export function generateHomeClassPair(
  request: GenerationRequest & { classroomCount?: number; homeSupportLevel: SupportLevel },
): PairResult {
  const homeCount = request.count;
  const classroomCount = request.classroomCount ?? request.count;
  const minimum = request.minCount ?? Math.min(homeCount, classroomCount);
  const pool = generateExerciseSet({ ...request, count: 1000, minCount: 1, seed: `${request.seed}|pair` });
  if (!pool.ok) {
    return {
      ok: false,
      code: "HOME_SET_FAILED",
      message: `Không tạo được bài ở nhà: ${pool.message}`,
      home: null,
      diagnostics: { home: pool.diagnostics, classroom: null },
    };
  }
  const items = pool.set.items;
  const used = new Set<number>();
  const homeIndexes: number[] = [];
  const classroomIndexes: number[] = [];
  for (let index = 0; index < items.length && homeIndexes.length < homeCount; index += 1) {
    const item = items[index];
    if (!item || used.has(index) || classroomIndexes.length >= classroomCount) continue;
    const twin = items.findIndex(
      (other, position) =>
        position > index &&
        !used.has(position) &&
        focusKey(other) === focusKey(item) &&
        Math.abs(other.difficulty - item.difficulty) <= 1,
    );
    if (twin < 0) continue;
    used.add(index).add(twin);
    homeIndexes.push(index);
    classroomIndexes.push(twin);
  }
  // Bài ở nhà có thể dài hơn bài ở lớp: thêm câu chưa dùng (không cần sinh đôi).
  for (let index = 0; index < items.length && homeIndexes.length < homeCount; index += 1) {
    if (!used.has(index)) {
      used.add(index);
      homeIndexes.push(index);
    }
  }
  if (items.length < minimum) {
    return {
      ok: false,
      code: "HOME_SET_FAILED",
      message: `Không tạo được bài ở nhà: chỉ có ${items.length} câu hợp lệ (cần ${minimum}).`,
      home: null,
      diagnostics: { home: pool.diagnostics, classroom: null },
    };
  }
  if (classroomIndexes.length < minimum || homeIndexes.length < minimum) {
    // Không ghép đủ cặp: bài ở nhà vẫn dùng được (lấy theo thứ tự seed, không cần sinh đôi).
    const homeOnly = items.slice(0, homeCount).map((_item, index) => index);
    return {
      ok: false,
      code: "INSUFFICIENT_CONTENT_FOR_PAIR",
      message: `Không đủ ngữ liệu để tạo bài ở lớp cùng mục tiêu, khác nội dung: chỉ ghép được ${classroomIndexes.length} cặp "bài sinh đôi" (cần ${minimum}) từ ${items.length} câu hợp lệ.`,
      home: subset(pool.set, homeOnly, "home"),
      diagnostics: { home: pool.diagnostics, classroom: null },
    };
  }
  const homeSet = subset(pool.set, homeIndexes, "home");
  const twins = classroomIndexes.map((classroomIndex, position) => ({
    homeItemId: items[homeIndexes[position] ?? -1]?.id ?? "",
    classroomItemId: items[classroomIndex]?.id ?? "",
    focusUnits: items[classroomIndex]?.objective.focusUnits ?? [],
  }));
  // Bài sinh đôi cùng đơn vị trọng tâm có thể có đáp án giống hệt theo đúng thứ tự (ví dụ c, nh, th) — xoay thứ tự
  // bài ở lớp để học sinh không thể chỉ nhớ dãy đáp án của bài ở nhà.
  const answersOf = (indexes: readonly number[]) =>
    indexes.map((index) => {
      const item = items[index];
      return item ? moduleOf(item).reveal(item).answerText : "";
    });
  const homeSequence = answersOf(homeIndexes.slice(0, classroomIndexes.length)).join("\u0000");
  const orderedClassroom =
    classroomIndexes.length > 1 && answersOf(classroomIndexes).join("\u0000") === homeSequence
      ? [...classroomIndexes.slice(1), ...classroomIndexes.slice(0, 1)]
      : classroomIndexes;
  const classroomSet = subset(pool.set, orderedClassroom, "classroom");
  const homeMean = meanDifficulty(homeSet);
  const homeAnswers = answerKey(homeSet).map((entry) => entry.answer);
  const classroomAnswers = answerKey(classroomSet).map((entry) => entry.answer);
  const classroomMean = meanDifficulty(classroomSet);
  const delta = Math.abs(homeMean - classroomMean);
  const homeFocus = new Set(homeSet.objective.focusUnits);
  return {
    ok: true,
    home: homeSet,
    classroom: classroomSet,
    equivalence: {
      sameType: true,
      sameObjective:
        homeSet.objective.code === classroomSet.objective.code &&
        classroomSet.objective.focusUnits.every((unit) => homeFocus.has(unit)),
      focusUnits: homeSet.objective.focusUnits,
      twins,
      difficulty: {
        home: Math.round(homeMean * 100) / 100,
        classroom: Math.round(classroomMean * 100) / 100,
        delta: Math.round(delta * 100) / 100,
        withinOneLevel: delta <= 1,
      },
      sharedTargets: homeSet.keys.filter((key) => classroomSet.keys.includes(key)),
      identicalAnswerKey:
        homeAnswers.length === classroomAnswers.length &&
        homeAnswers.every((answer, index) => answer === classroomAnswers[index]),
      caveat: DIFFICULTY_CAVEAT,
    },
    contracts: {
      home: buildTaskContract(homeSet, "home", request.homeSupportLevel),
      classroom: buildTaskContract(classroomSet, "classroom", 0),
    },
  };
}
