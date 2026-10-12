import { Compass } from "lucide-react";
import { MAIN_CONTENT_ID } from "@/components/layout/skip-link";
import { ButtonLink } from "@/components/ui/button";
import { vi } from "@/strings/vi";

export default function NotFound() {
  return (
    <main
      id={MAIN_CONTENT_ID}
      tabIndex={-1}
      className="flex flex-1 items-center justify-center px-4 py-20 outline-none"
    >
      <div className="max-w-md text-center">
        <span className="mx-auto flex size-16 items-center justify-center rounded-full bg-brand-50 text-brand-700">
          <Compass aria-hidden="true" className="size-8" />
        </span>
        <h1 className="mt-5 text-3xl font-extrabold text-ink">{vi.notFound.title}</h1>
        <p className="mt-3 text-lg leading-relaxed text-ink-soft">{vi.notFound.text}</p>
        <ButtonLink href="/" className="mt-8">
          {vi.notFound.action}
        </ButtonLink>
      </div>
    </main>
  );
}
