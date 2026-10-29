"use client";

import { useActionState, useState } from "react";
import { Field, FormMessage, SelectInput, SubmitButton, TextInput } from "@/components/forms/form-controls";
import { confirmClassCurriculum, renameClass, setClassCurriculum, type ActionState } from "@/server/teacher/actions";
import type { SeriesOption } from "@/server/teacher/queries";
import { vi } from "@/strings/vi";

const INITIAL: ActionState = { status: "idle" };

export function RenameClassForm({ classId, name }: { classId: string; name: string }) {
  const t = vi.classPage.rename;
  const [state, formAction] = useActionState(renameClass.bind(null, classId), INITIAL);
  return (
    <form action={formAction} className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <Field id="rename-class" label={t.label} className="flex-1">
        <TextInput id="rename-class" name="name" defaultValue={name} required maxLength={40} autoComplete="off" />
      </Field>
      <SubmitButton variant="outline">{t.submit}</SubmitButton>
      <FormMessage state={state} successText={vi.common.saved} />
    </form>
  );
}

type CurriculumFormProps = {
  classId: string;
  series: SeriesOption[];
  seriesId: string | null;
  lessonId: string | null;
};

/** Chọn bộ bài + bài hiện tại. Lưu luôn đưa về "chưa xác nhận" (hàm CSDL teacher_set_class_curriculum). */
export function CurriculumForm({ classId, series, seriesId, lessonId }: CurriculumFormProps) {
  const t = vi.classPage.curriculum;
  const [state, formAction] = useActionState(setClassCurriculum.bind(null, classId), INITIAL);
  const [selected, setSelected] = useState(seriesId ?? "");
  const lessons = series.find((entry) => entry.id === selected)?.lessons ?? [];
  const kindLabel = (kind: string) =>
    kind === "textbook" ? t.kindTextbook : kind === "illustrative" ? t.kindIllustrative : t.kindCustom;

  return (
    <form action={formAction} className="grid gap-4 md:grid-cols-2 md:items-end">
      <Field id="curriculum-series" label={t.series}>
        <SelectInput
          id="curriculum-series"
          name="seriesId"
          value={selected}
          onChange={(event) => setSelected(event.target.value)}
        >
          <option value="">{t.noSeries}</option>
          {series.map((entry) => (
            <option key={entry.id} value={entry.id}>
              {entry.title} ({kindLabel(entry.seriesKind)})
            </option>
          ))}
        </SelectInput>
      </Field>
      <Field id="curriculum-lesson" label={t.lesson}>
        <SelectInput
          id="curriculum-lesson"
          name="lessonId"
          key={selected}
          defaultValue={selected === seriesId ? (lessonId ?? "") : ""}
          disabled={!selected}
        >
          <option value="">{t.noLesson}</option>
          {lessons.map((lesson) => (
            <option key={lesson.id} value={lesson.id}>
              {lesson.code} — {lesson.title}
            </option>
          ))}
        </SelectInput>
      </Field>
      <div className="flex flex-wrap items-center gap-3 md:col-span-2">
        <SubmitButton variant="outline">{t.save}</SubmitButton>
        <FormMessage state={state} successText={vi.common.saved} />
      </div>
    </form>
  );
}

/** Chỉ hiện khi bộ bài là bộ sách thật đã duyệt; CSDL (trigger guard_class) vẫn kiểm tra lại. */
export function ConfirmCurriculumForm({ classId }: { classId: string }) {
  const [state, formAction] = useActionState(async () => confirmClassCurriculum(classId), INITIAL);
  return (
    <form action={formAction} className="flex flex-wrap items-center gap-3">
      <SubmitButton>{vi.classPage.curriculum.confirm}</SubmitButton>
      <FormMessage state={state} successText={vi.common.saved} />
    </form>
  );
}
