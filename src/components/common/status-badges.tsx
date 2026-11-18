import { ToneBadge } from "@/components/common/tone-badge";
import { ASSIGNMENT_STATUS, effectiveAssignmentStatus, type AssignmentStatus } from "@/lib/domain/status";
import { CLASSIFICATIONS, classify } from "@/lib/domain/scoring";
import { USER_STATUS_LABELS, type UserStatus } from "@/lib/auth/roles";
import { TREND_LABELS, type Trend } from "@/lib/domain/analytics";
import { formatScore } from "@/lib/domain/format";
import { Minus, TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

export function AssignmentStatusBadge({ status, dueAt }: { status: AssignmentStatus; dueAt?: string | null }) {
  const s = ASSIGNMENT_STATUS[effectiveAssignmentStatus(status, dueAt ?? null)];
  return <ToneBadge tone={s.tone}>{s.label}</ToneBadge>;
}

export function ClassificationBadge({ score }: { score: number | null | undefined }) {
  if (score === null || score === undefined) return <ToneBadge tone="neutral">Sem avaliação</ToneBadge>;
  const c = CLASSIFICATIONS[classify(score)];
  return <ToneBadge tone={c.tone === "info" ? "info" : c.tone}>{c.label}</ToneBadge>;
}

export function SituationBadge({ situation }: { situation: "excelente" | "aprovado" | "em_desenvolvimento" | "precisa_reforco" | "sem_avaliacao" }) {
  if (situation === "sem_avaliacao") return <ToneBadge tone="neutral">Sem avaliação</ToneBadge>;
  const c = CLASSIFICATIONS[situation];
  return <ToneBadge tone={c.tone}>{c.label}</ToneBadge>;
}

export function UserStatusBadge({ status }: { status: UserStatus }) {
  const tone = status === "active" ? "success" : status === "invited" ? "info" : "neutral";
  return <ToneBadge tone={tone}>{USER_STATUS_LABELS[status]}</ToneBadge>;
}

export function ScoreText({ score, passing, className }: { score: number | null | undefined; passing: number; className?: string }) {
  if (score === null || score === undefined) return <span className={cn("text-muted-foreground", className)}>—</span>;
  return (
    <span className={cn("tabular font-semibold", score >= passing ? "text-mz-green-dark" : score >= 70 ? "text-mz-yellow-text" : "text-mz-red-strong", className)}>
      {formatScore(score)}
    </span>
  );
}

export function TrendIndicator({ trend, delta }: { trend: Trend; delta?: number | null }) {
  const Icon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;
  const color = trend === "up" ? "text-mz-green-dark" : trend === "down" ? "text-mz-red-strong" : "text-muted-foreground";
  return (
    <span className={cn("relative inline-flex items-center gap-1 text-xs font-medium", color)} title={TREND_LABELS[trend]}>
      <Icon className="size-3.5" aria-hidden />
      {delta !== null && delta !== undefined ? `${delta > 0 ? "+" : ""}${formatScore(delta)}` : TREND_LABELS[trend]}
      <span className="sr-only">{TREND_LABELS[trend]}</span>
    </span>
  );
}
