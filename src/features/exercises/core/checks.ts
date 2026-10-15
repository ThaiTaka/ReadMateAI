import { composeSyllable, tonedRime } from "../../../lib/vietnamese/compose.ts";
import { unmetConventions, type UnitId } from "../../../lib/vietnamese/decodability.ts";
import { diagnoseSyllable } from "../../../lib/vietnamese/diagnostics.ts";
import { analyzeSyllable, type SyllableAnalysis } from "../../../lib/vietnamese/syllable.ts";
import { expectedToneIndex } from "../../../lib/vietnamese/tone-placement.ts";
import type { ToneId } from "../../../lib/vietnamese/tone.ts";
import type { KnowledgeBase } from "../../knowledge/load.ts";
import type { ItemCheckContext } from "./module.ts";
import { issue, type ValidationIssue } from "./primitives.ts";

/**
 * Hàm kiểm tra dùng chung cho các dạng bài — mọi kết luận ngôn ngữ đều đi qua bộ máy GĐ3
 * (`diagnoseSyllable`, `composeSyllable`, quy ước của hồ sơ lớp). Trường hợp chưa chắc chắn
 * (phân tích mơ hồ, quy ước chưa xác nhận) luôn trả về lỗi, không bao giờ được coi là hợp lệ.
 */

export type SyllableCheck = { ok: true; analysis: SyllableAnalysis } | { ok: false; issues: ValidationIssue[] };

/**
 * Phân tích một tiếng và đòi hỏi: viết đúng chính tả, phân tích chắc chắn, và mọi quy ước mà
 * phân tích dựa vào (qu, gi, "i" dùng chung) đã được hồ sơ lớp khai báo.
 */
export function analyzeStrict(text: string, ctx: Pick<ItemCheckContext, "kb" | "state">): SyllableCheck {
  const diagnosis = diagnoseSyllable(text, ctx.kb.inventory);
  if (diagnosis.status === "error") {
    return {
      ok: false,
      issues: [issue("SPELLING_INVALID", `"${text}": ${diagnosis.diagnostics.map((d) => d.message).join(" ")}`)],
    };
  }
  if (diagnosis.status !== "ok" || diagnosis.analysis === null) {
    return {
      ok: false,
      issues: [
        issue(
          "CONTENT_UNVERIFIED",
          `"${text}" chưa phân tích chắc chắn được (${diagnosis.diagnostics.map((d) => d.code).join(", ")}).`,
        ),
      ],
    };
  }
  const conventions = ctx.state?.conventions ?? null;
  const unmet =
    conventions === null
      ? diagnosis.analysis.conventionDependencies
      : unmetConventions(diagnosis.analysis, conventions);
  if (unmet.length > 0) {
    return {
      ok: false,
      issues: [issue("CONVENTION_REQUIRED", `"${text}" phụ thuộc quy ước chưa được xác nhận: ${unmet.join(", ")}.`)],
    };
  }
  return { ok: true, analysis: diagnosis.analysis };
}

/** Tiếng có viết đúng chính tả theo bộ máy không (dùng để biết phương án ghép ra có hợp lệ không). */
export function isWellFormed(text: string, kb: KnowledgeBase): boolean {
  return diagnoseSyllable(text, kb.inventory).status === "ok";
}

/** Ghép tiếng theo kiểu đặt dấu của hồ sơ lớp (quy ước chưa khai báo → không ghép được vần phụ thuộc kiểu). */
export function composeWithProfile(
  parts: { onset: string | null; rime: string; tone: ToneId },
  ctx: Pick<ItemCheckContext, "kb" | "state">,
): string | null {
  const result = composeSyllable(parts, ctx.kb.inventory, ctx.state?.conventions.tonePlacement ?? null);
  return result.ok ? result.text : null;
}

/** Vần kèm dấu thanh khi đứng riêng (phương án "àn" của bài điền vần), theo kiểu đặt dấu của hồ sơ. */
export function tonedRimeWithProfile(
  rime: string,
  tone: ToneId,
  ctx: Pick<ItemCheckContext, "kb" | "state">,
): string | null {
  return tonedRime(rime, tone, ctx.kb.inventory, ctx.state?.conventions.tonePlacement ?? null);
}

/**
 * Vị trí ký tự nhận dấu thanh trong một chuỗi không dấu (vần đứng riêng hoặc cả tiếng), theo kiểu đặt dấu
 * của hồ sơ. Trả về `undefined` nếu không phân tích được, hoặc vị trí phụ thuộc kiểu đặt dấu chưa được xác nhận.
 */
export function toneMarkIndex(text: string, ctx: Pick<ItemCheckContext, "kb" | "state">): number | undefined {
  const parsed = analyzeSyllable(text, ctx.kb.inventory);
  if (parsed.status !== "ok") return undefined;
  const expected = expectedToneIndex(parsed.analysis);
  const style = ctx.state?.conventions.tonePlacement ?? null;
  if (expected.on_main_vowel !== expected.traditional && style === null) return undefined;
  return style === "traditional" ? expected.traditional : expected.on_main_vowel;
}

/** Đơn vị phải nằm trong tập "được phép luyện" của nhóm. Hồ sơ không có tiến độ → không xác minh được. */
export function checkUnitsTaught(units: readonly UnitId[], ctx: Pick<ItemCheckContext, "state">): ValidationIssue[] {
  if (units.length === 0) return [];
  if (ctx.state === null) {
    return [issue("CONTENT_UNVERIFIED", "Hồ sơ lớp chưa có tiến độ — không xác minh được đơn vị đã học.")];
  }
  const missing = units.filter((unit) => !ctx.state?.allowedForPractice.has(unit));
  return missing.length === 0
    ? []
    : [issue("UNIT_NOT_TAUGHT", `Đơn vị chưa học (theo hồ sơ và nhóm): ${Array.from(new Set(missing)).join(", ")}.`)];
}

/** Cách gọi âm khi đánh vần (đề xuất, chờ GV xác nhận) — dùng để soát lời đọc có nói đáp án không. */
export function teachingLabelOf(kb: KnowledgeBase, grapheme: string): string | null {
  return kb.phonemes.find((phoneme) => phoneme.text === grapheme)?.teachingLabel.proposed ?? null;
}

/** Tên thanh ("huyền") và tên dấu ("dấu huyền") theo kho tri thức. */
export function toneNames(kb: KnowledgeBase, tone: ToneId): { name: string; markName: string } {
  const entry = kb.tones.find((item) => item.toneId === tone);
  return { name: entry?.name ?? tone, markName: entry?.markName ?? tone };
}

/** Đơn vị kiến thức (âm đầu, vần/âm, thanh) để giải mã một tiếng đã phân tích. */
export function unitsOfAnalysis(analysis: SyllableAnalysis): UnitId[] {
  const units: UnitId[] = [];
  if (analysis.onset !== null) units.push(`phoneme:${analysis.onset}`);
  units.push(
    analysis.medial === null && analysis.coda === null && Array.from(analysis.nucleus).length === 1
      ? `phoneme:${analysis.nucleus}`
      : `rime:${analysis.rime}`,
  );
  units.push(`tone:${analysis.tone}`);
  return units;
}

export function uniqueUnits(units: Iterable<UnitId>): UnitId[] {
  return Array.from(new Set(units));
}
