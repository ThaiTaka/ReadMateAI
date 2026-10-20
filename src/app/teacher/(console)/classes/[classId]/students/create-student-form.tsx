"use client";

import { UserPlus } from "lucide-react";
import { useActionState } from "react";
import { AvatarPicker, type AvatarChoice } from "@/components/forms/avatar-picker";
import { Field, FormMessage, SubmitButton, TextInput } from "@/components/forms/form-controls";
import { createStudent, type ActionState } from "@/server/teacher/actions";
import { vi } from "@/strings/vi";

const INITIAL: ActionState = { status: "idle" };

/** Thêm hồ sơ tối thiểu: biệt danh + số thứ tự (tùy chọn) + avatar có sẵn. Không có trường họ tên, ngày sinh, liên hệ. */
export function CreateStudentForm({ classId, avatars }: { classId: string; avatars: AvatarChoice[] }) {
  const t = vi.studentsPage.create;
  const [state, formAction] = useActionState(createStudent.bind(null, classId), INITIAL);

  return (
    // React 19 tự đặt lại biểu mẫu sau khi action chạy xong (sẵn sàng nhập học sinh kế tiếp).
    <form action={formAction} className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-[2fr_1fr]">
        <Field id="student-name" label={t.displayName} hint={t.displayNameHint}>
          <TextInput
            id="student-name"
            name="displayName"
            required
            maxLength={30}
            autoComplete="off"
            aria-describedby="student-name-hint"
          />
        </Field>
        <Field id="student-number" label={t.studentNumber}>
          <TextInput id="student-number" name="studentNumber" type="number" min={1} max={99} inputMode="numeric" />
        </Field>
      </div>
      <AvatarPicker legend={t.avatar} name="avatarKey" choices={avatars} defaultValue={avatars[0]?.key ?? ""} />
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton pendingLabel={t.submitting}>
          <UserPlus aria-hidden="true" className="size-5" />
          {t.submit}
        </SubmitButton>
        <FormMessage state={state} successText={vi.common.saved} />
      </div>
    </form>
  );
}
