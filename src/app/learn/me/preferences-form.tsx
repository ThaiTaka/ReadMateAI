"use client";

import { useActionState } from "react";
import { AvatarPicker, type AvatarChoice } from "@/components/forms/avatar-picker";
import { SubmitButton } from "@/components/forms/form-controls";
import { updateStudentPreferences, type PreferencesState } from "@/server/student-gateway/actions";
import { vi } from "@/strings/vi";
import type { LinkedStudent } from "@/server/student-gateway/session";

const INITIAL: PreferencesState = { status: "idle" };

/**
 * Chọn avatar và cài đặt — chạm-để-chọn (vùng chạm ≥ 64 px), không ô nhập văn bản. Lưu ở máy chủ
 * (students.motion_preference/sound_preference — AD-50), không dùng localStorage ở khu vực học sinh.
 * Hình avatar dựng ở Server Component và truyền vào qua `art` để SVG không vào bundle JS.
 */
export function PreferencesForm({ student, avatars }: { student: LinkedStudent; avatars: AvatarChoice[] }) {
  const t = vi.learnMe.preferences;
  const [state, formAction] = useActionState(updateStudentPreferences, INITIAL);

  return (
    <form action={formAction} className="space-y-8">
      <input type="hidden" name="studentId" value={student.id} />
      <AvatarPicker legend={t.avatar} name="avatarKey" choices={avatars} defaultValue={student.avatarKey} size="kid" />

      <ChoiceGroup
        legend={t.motion}
        name="motion"
        defaultValue={student.motionPreference}
        options={Object.entries(t.motionOptions).map(([value, label]) => ({ value, label }))}
      />
      <ChoiceGroup
        legend={t.sound}
        name="sound"
        defaultValue={student.soundPreference}
        options={Object.entries(t.soundOptions).map(([value, label]) => ({ value, label }))}
        note={t.soundNote}
      />

      <div className="flex flex-wrap items-center gap-4">
        <SubmitButton size="kid" pendingLabel={t.saving}>
          {t.save}
        </SubmitButton>
        {state.status === "saved" ? (
          <p role="status" className="text-lg font-bold text-brand-700">
            {t.saved}
          </p>
        ) : state.status === "error" ? (
          <p role="alert" className="font-semibold text-coral-800">
            {vi.errors[state.code]}
          </p>
        ) : null}
      </div>
    </form>
  );
}

type ChoiceGroupProps = {
  legend: string;
  name: string;
  defaultValue: string;
  options: Array<{ value: string; label: string }>;
  note?: string;
};

function ChoiceGroup({ legend, name, defaultValue, options, note }: ChoiceGroupProps) {
  return (
    <fieldset>
      <legend className="text-xl font-extrabold text-ink">{legend}</legend>
      {note ? <p className="mt-1 text-ink-soft">{note}</p> : null}
      <div className="mt-3 flex flex-wrap gap-3">
        {options.map((option) => (
          <label
            key={option.value}
            className="flex min-h-touch-kid cursor-pointer items-center gap-3 rounded-tile border-4 border-line bg-surface px-5 text-lg font-bold text-ink has-checked:border-brand-600 has-checked:bg-brand-50 has-focus-visible:outline-3 has-focus-visible:outline-focus"
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              defaultChecked={option.value === defaultValue}
              className="size-6 accent-brand-600"
            />
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
