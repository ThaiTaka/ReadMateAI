"use client";

import type { Route } from "next";
import { useRouter } from "next/navigation";
import { Crown } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { createHonorSnapshot, setHonorsEnabled } from "@/server/teacher/honors";
import { vi } from "@/strings/vi";

const t = vi.honors.teacher;

type Props = {
  classId: string;
  honorsEnabled: boolean;
  /** Cờ hệ thống 'honors_feature_approved' (suy từ việc CSDL cho đọc lịch sử). Tắt → mọi thao tác bị khóa. */
  featureApproved: boolean;
  isOwner: boolean;
};

/**
 * Nút "Vinh danh TOP 3" + công tắc bật/tắt của chủ nhiệm. Khóa nút khi đang gửi (trạng thái pending VÀ ref đồng bộ cho
 * cú bấm đúp trước khi React kịp vẽ lại). Đây chỉ là chặn ở giao diện — server chưa có khóa ý định, nên hai lần gửi từ
 * hai tab/thiết bị vẫn tạo hai ảnh chụp (giới hạn ghi ở REDESIGN_PROGRESS).
 */
export function HonorLauncher({ classId, honorsEnabled: savedEnabled, featureApproved, isOwner }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const busy = useRef(false);
  // Giá trị hiện trên công tắc: đổi ngay khi bấm, trả lại nếu máy chủ từ chối.
  const [honorsEnabled, setEnabled] = useState(savedEnabled);
  const [message, setMessage] = useState<{ tone: "error" | "ok"; text: string } | null>(null);
  const canCreate = featureApproved && honorsEnabled;

  const create = () => {
    if (busy.current || !canCreate) return;
    busy.current = true;
    setMessage(null);
    startTransition(async () => {
      try {
        const result = await createHonorSnapshot({ classId });
        if (result.ok) {
          router.push(`/teacher/classes/${classId}/honors/${result.data.snapshotId}` as Route);
          return;
        }
        setMessage({ tone: "error", text: vi.errors[result.code] });
      } finally {
        busy.current = false;
      }
    });
  };

  const toggle = (enabled: boolean) => {
    if (busy.current) return;
    busy.current = true;
    setMessage(null);
    setEnabled(enabled);
    startTransition(async () => {
      try {
        const result = await setHonorsEnabled({ classId, enabled });
        if (result.ok) {
          setMessage({ tone: "ok", text: t.savedEnabled });
          router.refresh();
        } else {
          setEnabled(!enabled);
          setMessage({ tone: "error", text: vi.errors[result.code] });
        }
      } finally {
        busy.current = false;
      }
    });
  };

  return (
    <div className="space-y-4">
      <p className="text-ink-soft">{t.description}</p>
      {featureApproved ? null : (
        <Notice title={t.title} tone="progress">
          {t.locked}
        </Notice>
      )}
      <label className="flex min-h-touch items-center gap-3 font-semibold text-ink">
        <input
          type="checkbox"
          checked={honorsEnabled}
          disabled={!isOwner || pending || (!featureApproved && !honorsEnabled)}
          onChange={(event) => toggle(event.target.checked)}
          className="size-6 accent-brand-600"
        />
        {t.enableLabel}
      </label>
      {isOwner ? null : <p className="text-sm text-ink-soft">{t.ownerOnly}</p>}
      <div>
        <Button
          type="button"
          variant="primary"
          disabled={!canCreate || pending}
          aria-describedby="honor-help"
          onClick={create}
        >
          <Crown aria-hidden="true" className="size-5" />
          {pending ? t.creating : t.button}
        </Button>
        <p id="honor-help" className="mt-2 text-sm text-ink-soft">
          {canCreate ? t.repeatNote : featureApproved ? t.disabled : t.lockedShort}
        </p>
      </div>
      <div aria-live="polite">
        {message ? (
          <p
            role={message.tone === "error" ? "alert" : undefined}
            className={
              message.tone === "error"
                ? "rounded-xl bg-coral-50 px-4 py-3 text-sm font-semibold text-coral-800"
                : "text-sm font-semibold text-brand-700"
            }
          >
            {message.text}
          </p>
        ) : null}
      </div>
    </div>
  );
}
