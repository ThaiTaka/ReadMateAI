"use client";

import { Plus } from "lucide-react";
import { useActionState } from "react";
import { Field, FormMessage, SubmitButton, TextInput } from "@/components/forms/form-controls";
import { createClass, type ActionState } from "@/server/teacher/actions";
import { vi } from "@/strings/vi";

const INITIAL: ActionState = { status: "idle" };

export function CreateClassForm() {
  const t = vi.classesPage.create;
  const [state, formAction] = useActionState(createClass, INITIAL);
  return (
    <form action={formAction} className="grid gap-5 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
      <Field id="class-name" label={t.name} hint={t.nameHint}>
        <TextInput
          id="class-name"
          name="name"
          required
          maxLength={40}
          autoComplete="off"
          aria-describedby="class-name-hint"
        />
      </Field>
      <Field id="class-year" label={t.schoolYear} hint={t.schoolYearHint}>
        <TextInput
          id="class-year"
          name="schoolYear"
          required
          inputMode="numeric"
          pattern="\d{4}-\d{4}"
          placeholder="2026-2027"
          maxLength={9}
          autoComplete="off"
          aria-describedby="class-year-hint"
        />
      </Field>
      <SubmitButton pendingLabel={t.submitting}>
        <Plus aria-hidden="true" className="size-5" />
        {t.submit}
      </SubmitButton>
      <FormMessage state={state} className="sm:col-span-3" />
    </form>
  );
}
