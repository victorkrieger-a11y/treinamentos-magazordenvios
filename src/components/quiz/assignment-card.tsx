import Link from "next/link";
import { CalendarDays, Clock, PlayCircle, RotateCcw, UserRound, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AssignmentStatusBadge, ScoreText } from "@/components/common/status-badges";
import type { MyAssignment } from "@/lib/data/my-assignments";
import { formatDate, formatDateTime } from "@/lib/domain/format";
import { cn } from "@/lib/utils";

export function timeLeft(dueAt: string | null, now = new Date()) {
  if (!dueAt) return null;
  const ms = new Date(dueAt).getTime() - now.getTime();
  if (ms <= 0) return "Prazo encerrado";
  const h = Math.floor(ms / 3600000);
  if (h < 1) return `Restam ${Math.max(1, Math.floor(ms / 60000))} min`;
  if (h < 48) return `Restam ${h} h`;
  return `Restam ${Math.floor(h / 24)} dias`;
}

export function AssignmentCard({ a, highlight = false }: { a: MyAssignment; highlight?: boolean }) {
  const left = timeLeft(a.dueAt);
  const urgent = a.dueAt && new Date(a.dueAt).getTime() - Date.now() < 48 * 3600000;
  const pending = a.status === "pending" || a.status === "in_progress";
  return (
    <article className={cn("flex flex-col gap-4 rounded-xl border bg-card p-5 shadow-[0_1px_2px_rgba(56,56,56,0.04)]", highlight && pending && "border-mz-red/30 ring-1 ring-mz-red/10")}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-mz-chumbo">{a.title}</h3>
          {a.description && <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{a.description}</p>}
        </div>
        <AssignmentStatusBadge status={a.status} dueAt={a.dueAt} />
      </div>
      <dl className="grid grid-cols-1 gap-2 text-xs text-muted-foreground sm:grid-cols-2">
        <div className="flex items-center gap-1.5"><UserRound className="size-3.5" aria-hidden /><dt className="sr-only">Enviada por</dt><dd>Enviada por {a.senderName ?? "—"}</dd></div>
        <div className="flex items-center gap-1.5"><CalendarDays className="size-3.5" aria-hidden /><dt className="sr-only">Data de envio</dt><dd>Envio: {formatDate(a.assignedAt)}</dd></div>
        <div className="flex items-center gap-1.5"><FileText className="size-3.5" aria-hidden /><dt className="sr-only">Questões</dt><dd>{a.questionCount} questões · {a.maxAttempts} tentativa(s)</dd></div>
        <div className={cn("flex items-center gap-1.5", pending && urgent && "font-semibold text-mz-red-strong")}>
          <Clock className="size-3.5" aria-hidden /><dt className="sr-only">Prazo</dt>
          <dd>{a.dueAt ? `Prazo: ${formatDateTime(a.dueAt)}${pending && left ? ` · ${left}` : ""}` : "Sem prazo definido"}</dd>
        </div>
      </dl>
      <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t pt-4">
        <div className="text-xs text-muted-foreground">
          {a.bestScore !== null ? (
            <>Sua nota: <ScoreText score={a.bestScore} passing={a.passingScore} className="text-sm" /></>
          ) : (
            <>Meta de aprovação: {a.passingScore} pontos</>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {a.bestAttemptId && (
            <Button asChild variant="outline" size="sm"><Link href={`/resultado/${a.bestAttemptId}`}>Ver resultado</Link></Button>
          )}
          {a.canStart && (
            <Button asChild size="sm">
              <Link href={`/minhas-avaliacoes/${a.id}`}>
                {a.openAttemptId ? <><PlayCircle /> Continuar</> : a.completedAttempts > 0 ? <><RotateCcw /> Nova tentativa</> : <><PlayCircle /> Iniciar avaliação</>}
              </Link>
            </Button>
          )}
        </div>
      </div>
    </article>
  );
}
