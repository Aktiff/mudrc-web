import type { MouseEvent } from "react";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { isRegistrationOpen, type QuizEvent } from "@/lib/data";
import { eventExternalUrl, isExternalEvent } from "@/lib/event-normalize";
import { eventUsesPayRegistration, payRegisterHrefForEvent } from "@/lib/pay-config";

type RegistrationActionProps = {
  event: QuizEvent & { termQuery?: string };
  onRegister: (e: MouseEvent<HTMLButtonElement>) => void;
  className?: string;
  compact?: boolean;
};

export default function RegistrationAction({ event, onRegister, className = "", compact = false }: RegistrationActionProps) {
  const externalUrl = eventExternalUrl(event);
  const sizeClass = compact ? "text-sm py-2.5" : "w-full text-sm py-3";

  if (isExternalEvent(event) && externalUrl) {
    return (
      <a
        href={externalUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className={`btn-primary justify-center inline-flex items-center gap-1.5 ${sizeClass} ${className}`}
      >
        {compact ? "Externá registrácia" : "Registrovať sa mimo mudrc.sk"}
        <ExternalLink className="w-3.5 h-3.5 shrink-0 opacity-90" aria-hidden />
      </a>
    );
  }

  if (!isRegistrationOpen(event)) {
    return (
      <div
        className={`flex items-center justify-center gap-2 rounded-full border border-brand-border bg-brand-surface text-brand-muted font-semibold ${
          compact ? "text-sm py-2.5 px-4" : "text-sm py-3 w-full"
        } ${className}`}
        aria-live="polite"
      >
        Kvíz je plný
      </div>
    );
  }

  if (eventUsesPayRegistration(event)) {
    const href = payRegisterHrefForEvent(event);
    return (
      <Link
        href={href}
        onClick={(e) => e.stopPropagation()}
        className={`btn-primary justify-center inline-flex items-center ${sizeClass} ${className}`}
      >
        {compact ? "Registrácia tímu" : "Zaregistrovať tím"}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={onRegister}
      className={`btn-primary justify-center ${compact ? "text-sm py-2.5" : "w-full text-sm py-3"} ${className}`}
    >
      {compact ? "Registrácia tímu" : "Zaregistrovať tím"}
    </button>
  );
}
