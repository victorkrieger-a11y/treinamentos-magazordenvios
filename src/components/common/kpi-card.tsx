import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type Accent = "red" | "neutral" | "green" | "yellow" | "blue";
const ACCENTS: Record<Accent, string> = {
  red: "bg-mz-red-soft text-mz-red",
  neutral: "bg-muted text-mz-chumbo",
  green: "bg-mz-green-soft text-mz-green-dark",
  yellow: "bg-mz-yellow-soft text-mz-yellow-text",
  blue: "bg-mz-blue-soft text-mz-blue",
};

export function KpiCard({ label, value, hint, icon: Icon, accent = "neutral", className }: { label: string; value: React.ReactNode; hint?: React.ReactNode; icon: LucideIcon; accent?: Accent; className?: string }) {
  return (
    <div className={cn("flex items-start gap-3 rounded-xl border bg-card p-4 shadow-[0_1px_2px_rgba(56,56,56,0.04)] transition-shadow hover:shadow-sm", className)}>
      <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", ACCENTS[accent])}>
        <Icon className="size-[18px]" aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className="font-display tabular mt-0.5 text-2xl font-semibold leading-tight text-mz-chumbo">{value}</p>
        {hint && <p className="mt-0.5 truncate text-xs text-muted-foreground">{hint}</p>}
      </div>
    </div>
  );
}
