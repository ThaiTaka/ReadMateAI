"use client";

import { useActionState } from "react";
import { Field, FormMessage, SelectInput, SubmitButton } from "@/components/forms/form-controls";
import type { LeaderboardView } from "@/features/gamification/ranking";
import { saveLeaderboardSettings, type ActionState } from "@/server/teacher/actions";
import { vi } from "@/strings/vi";

const INITIAL: ActionState = { status: "idle" };

type SettingsFormProps = {
  classId: string;
  enabled: boolean;
  view: LeaderboardView;
  /** Cờ hệ thống chưa bật → không thể bật bảng (CSDL cũng chặn). */
  featureApproved: boolean;
  isOwner: boolean;
};

export function LeaderboardSettingsForm({ classId, enabled, view, featureApproved, isOwner }: SettingsFormProps) {
  const t = vi.leaderboard.teacher;
  const [state, formAction] = useActionState(saveLeaderboardSettings.bind(null, classId), INITIAL);
  const locked = !isOwner;
  return (
    <form action={formAction} className="flex flex-col gap-4">
      <label className="flex min-h-touch items-center gap-3 font-semibold text-ink">
        <input
          type="checkbox"
          name="enabled"
          defaultChecked={enabled}
          disabled={locked || (!featureApproved && !enabled)}
          className="size-6 accent-brand-600"
        />
        {t.enableLabel}
      </label>
      <Field id="leaderboard-view" label={t.viewLabel}>
        <SelectInput id="leaderboard-view" name="view" defaultValue={view} disabled={locked}>
          <option value="top10_and_me">{t.views.top10_and_me}</option>
          <option value="full">{t.views.full}</option>
        </SelectInput>
      </Field>
      {locked ? <p className="text-sm text-ink-soft">{t.ownerOnly}</p> : null}
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton variant="outline" disabled={locked}>
          {t.save}
        </SubmitButton>
        <FormMessage state={state} successText={t.saved} />
      </div>
    </form>
  );
}
