import { cn } from "@/lib/utils";
import type { Tone } from "@/lib/domain/status";

const TONES: Record<Tone, string> = {
  success: "bg-mz-green-soft text-mz-green-dark ring-mz-green-dark/15",
  warning: "bg-mz-yellow-soft text-mz-yellow-text ring-mz-yellow/40",
  danger: "bg-mz-red-soft text-mz-red-strong ring-mz-red/15",
  info: "bg-mz-blue-soft text-mz-blue ring-mz-blue/15",
  neutral: "bg-muted text-muted-foreground ring-border",
};

export function ToneBadge({ tone, children, className, dot = true }: { tone: Tone; children: React.ReactNode; className?: string; dot?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset", TONES[tone], className)}>
      {dot && <span aria-hidden className="size-1.5 rounded-full bg-current opacity-80" />}
      {children}
    </span>
  );
}
