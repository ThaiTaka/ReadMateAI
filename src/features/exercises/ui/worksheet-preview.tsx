import { FileText } from "lucide-react";
import { PictureIcon } from "@/components/kid/picture-icon";
import { ToneGlyph } from "@/components/kid/tone-glyph";
import { INSTRUCTION_ICONS } from "@/components/learning/visuals";
import type { ExerciseTaskContract, WorksheetItem } from "@/features/exercises/core/worksheet";
import type { PairEquivalence } from "@/features/exercises/generation/pair";
import { vi } from "@/strings/vi";

/** Ô để học sinh khoanh — in đen trắng. */
function CircleChoices({ choices }: { choices: readonly string[] }) {
  return (
    <span className="flex flex-wrap gap-2">
      {choices.map((choice) => (
        <span key={choice} className="rounded-full border-2 border-ink px-3 py-0.5 font-reading text-xl font-bold">
          {choice}
        </span>
      ))}
    </span>
  );
}

function PrintedItem({ item, index }: { item: WorksheetItem; index: number }) {
  const { printed } = item;
  return (
    <li className="flex flex-wrap items-center gap-4 border-b border-dashed border-ink/40 py-3 last:border-b-0">
      <span className="font-bold text-ink">{index + 1}.</span>
      {printed.picture ? <PictureIcon iconKey={printed.picture.iconKey} className="size-14 text-ink" /> : null}
      {printed.text ? <span className="font-reading text-2xl font-bold text-ink">{printed.text}</span> : null}
      {printed.question ? <span className="font-reading text-xl text-ink">{printed.question}</span> : null}
      {printed.matchWords ? (
        <span className="flex flex-col gap-1">
          {printed.matchWords.map((word) => (
            <span key={word} className="font-reading text-xl font-bold">
              {word} •
            </span>
          ))}
        </span>
      ) : null}
      {printed.pictureChoices ? (
        <span className="flex flex-wrap gap-3">
          {printed.pictureChoices.map((picture) => (
            <span key={picture.pictureId} className="rounded-xl border-2 border-ink p-1.5">
              <PictureIcon iconKey={picture.iconKey} className="size-10 text-ink" />
            </span>
          ))}
        </span>
      ) : null}
      {printed.choices ? <CircleChoices choices={printed.choices} /> : null}
      {printed.toneChoices ? (
        <span className="flex gap-2">
          {printed.toneChoices.map((tone) => (
            <span key={tone} className="rounded-full border-2 border-ink p-0.5">
              <ToneGlyph tone={tone} className="size-7 text-ink" />
            </span>
          ))}
        </span>
      ) : null}
      {printed.tokens ? <CircleChoices choices={printed.tokens} /> : null}
      {printed.writeLine ? (
        <span aria-hidden="true" className="h-8 min-w-40 flex-1 border-b-2 border-dotted border-ink" />
      ) : null}
    </li>
  );
}

/**
 * Xem trước phiếu ở lớp tương đương (chưa dựng PDF — GĐ8): trắng đen, cùng biểu tượng và câu lệnh với
 * ứng dụng, dòng "Tên:" để học sinh tự viết (không in tên học sinh — PRD F-PH-04), đáp án tách riêng cho GV.
 */
export function WorksheetPreview({
  contract,
  equivalence,
}: {
  contract: ExerciseTaskContract;
  equivalence: PairEquivalence;
}) {
  const t = vi.practice.worksheet;
  const Icon = INSTRUCTION_ICONS[contract.worksheet.icon];
  return (
    <section aria-label={t.title} className="rounded-card border border-line bg-surface p-5">
      <h4 className="flex items-center gap-2 text-lg font-bold text-ink">
        <FileText aria-hidden="true" className="size-5" />
        {t.title}
      </h4>
      <p className="mt-1 text-sm text-ink-soft">{t.note}</p>
      <div className="mt-4 rounded-xl border-[3px] border-ink bg-white p-4 text-ink grayscale">
        <p className="text-right text-sm">
          {t.name} <span className="inline-block w-40 border-b border-dotted border-ink" />
        </p>
        <p className="mt-2 flex items-center gap-2 text-lg font-extrabold">
          <span className="flex size-9 items-center justify-center rounded-lg border-2 border-ink">
            <Icon aria-hidden="true" className="size-5" />
          </span>
          {contract.worksheet.instruction}
        </p>
        <ol className="mt-2">
          {contract.worksheet.items.map((item, index) => (
            <PrintedItem key={index} item={item} index={index} />
          ))}
        </ol>
      </div>
      <details className="mt-3">
        <summary className="cursor-pointer font-semibold text-ink">{t.answerKey}</summary>
        <ol className="mt-2 list-decimal pl-6 font-reading text-lg">
          {contract.answerKey.map((entry) => (
            <li key={entry.itemId}>{entry.answer}</li>
          ))}
        </ol>
      </details>
      <details className="mt-2">
        <summary className="cursor-pointer font-semibold text-ink">{t.equivalence}</summary>
        <dl className="mt-2 space-y-1 text-sm">
          <div className="flex gap-2">
            <dt className="text-ink-soft">{t.sameObjective}:</dt>
            <dd className="font-semibold">
              {equivalence.sameObjective ? t.yes : t.no} — {contract.learningObjective.description}
            </dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-ink-soft">{t.focus}:</dt>
            <dd className="font-semibold">
              {equivalence.focusUnits.length > 0 ? equivalence.focusUnits.join(", ") : t.skillLevel}
            </dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-ink-soft">{t.difficulty}:</dt>
            <dd className="font-semibold">
              {equivalence.difficulty.home} / {equivalence.difficulty.classroom}
            </dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-ink-soft">{t.twins}:</dt>
            <dd className="font-semibold">{equivalence.twins.length}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-ink-soft">{t.noShared}:</dt>
            <dd className="font-semibold">{equivalence.sharedTargets.length === 0 ? t.yes : t.no}</dd>
          </div>
        </dl>
        <p className="mt-2 text-xs text-ink-faint">{equivalence.caveat}</p>
      </details>
    </section>
  );
}
