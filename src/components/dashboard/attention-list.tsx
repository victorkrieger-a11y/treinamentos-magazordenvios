import Link from "next/link";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import type { AttentionAlert } from "@/lib/domain/analytics";
import { formatDate, formatScore } from "@/lib/domain/format";
import { EmptyState } from "@/components/common/empty-state";
import { cn } from "@/lib/utils";

const SEVERITY = {
  high: { label: "Alta", cls: "border-l-mz-red" },
  medium: { label: "Média", cls: "border-l-mz-yellow" },
  low: { label: "Baixa", cls: "border-l-mz-blue" },
};

export function AttentionList({ alerts, limit = 8 }: { alerts: AttentionAlert[]; limit?: number }) {
  if (alerts.length === 0) {
    return <EmptyState icon={CheckCircle2} title="Nenhum ponto de atenção" description="Todos os colaboradores estão dentro das metas e sem pendências." />;
  }
  return (
    <ul className="grid gap-2.5">
      {alerts.slice(0, limit).map((a, i) => (
        <li key={`${a.collaboratorId}-${a.kind}-${i}`} className={cn("rounded-lg border border-l-[3px] bg-white p-3", SEVERITY[a.severity].cls)}>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <Link href={`/colaboradores/${a.collaboratorId}`} className="text-sm font-semibold text-mz-chumbo hover:text-mz-red-strong hover:underline">
              {a.name}
            </Link>
            <span className="text-[11px] text-muted-foreground">
              Última avaliação: {formatDate(a.lastAssessmentAt)} · Nota: <span className="tabular font-medium text-mz-chumbo">{formatScore(a.score)}</span>
            </span>
          </div>
          <p className="mt-1 flex items-start gap-1.5 text-xs text-mz-chumbo">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-mz-red" aria-hidden />
            <span><span className="sr-only">Prioridade {SEVERITY[a.severity].label}. </span>{a.reason}</span>
          </p>
          <p className="mt-1 text-xs text-muted-foreground"><span className="font-medium text-mz-gray-dark">Ação recomendada:</span> {a.action}</p>
        </li>
      ))}
      {alerts.length > limit && <li className="text-center text-xs text-muted-foreground">+ {alerts.length - limit} alerta(s). Consulte os perfis individuais.</li>}
    </ul>
  );
}
