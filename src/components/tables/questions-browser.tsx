"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Pencil, Power, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToneBadge } from "@/components/common/tone-badge";
import { EmptyState } from "@/components/common/empty-state";
import { DIFFICULTY_LABELS } from "@/lib/domain/status";
import { setQuestionActive } from "@/server/actions/questions";
import { cn } from "@/lib/utils";

export type QuestionRow = {
  id: string;
  code: string | null;
  statement: string;
  categoryId: string;
  categoryName: string;
  topic: string;
  difficulty: "facil" | "media" | "dificil";
  explanation: string;
  isActive: boolean;
  inStandardSet: boolean;
  version: number;
  options: { label: string; text: string; isCorrect: boolean }[];
};

const ALL = "__all__";

function ToggleActive({ id, active }: { id: string; active: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button variant="ghost" size="sm" disabled={pending} onClick={() => start(async () => {
      const res = await setQuestionActive(id, !active);
      if (res.ok) { toast.success(res.message ?? "Atualizado."); router.refresh(); } else toast.error(res.error);
    })}>
      <Power /> {active ? "Desativar" : "Ativar"}
    </Button>
  );
}

export function QuestionsBrowser({ rows, categories, canEdit }: { rows: QuestionRow[]; categories: { id: string; name: string }[]; canEdit: boolean }) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState(ALL);
  const [diff, setDiff] = useState(ALL);
  const [status, setStatus] = useState("active");
  const [open, setOpen] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return rows.filter((r) =>
      (!t || r.statement.toLowerCase().includes(t) || r.topic.toLowerCase().includes(t) || (r.code ?? "").toLowerCase().includes(t)) &&
      (cat === ALL || r.categoryId === cat) &&
      (diff === ALL || r.difficulty === diff) &&
      (status === ALL || (status === "active" ? r.isActive : !r.isActive)),
    );
  }, [rows, q, cat, diff, status]);

  return (
    <div className="grid gap-4">
      <div className="flex flex-col gap-2 lg:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Pesquisar enunciado, assunto ou código" className="h-9 pl-9" aria-label="Pesquisar perguntas" />
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={cat} onValueChange={setCat}>
            <SelectTrigger className="h-9 w-[210px]" aria-label="Filtrar por categoria"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todas as categorias</SelectItem>
              {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={diff} onValueChange={setDiff}>
            <SelectTrigger className="h-9 w-[150px]" aria-label="Filtrar por dificuldade"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Qualquer dificuldade</SelectItem>
              {Object.entries(DIFFICULTY_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="h-9 w-[130px]" aria-label="Filtrar por status"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Ativas</SelectItem>
              <SelectItem value="inactive">Inativas</SelectItem>
              <SelectItem value={ALL}>Todas</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">{filtered.length} questão(ões)</p>
      {filtered.length === 0 ? <EmptyState title="Nenhuma questão encontrada" /> : (
        <ul className="grid gap-2">
          {filtered.map((r) => {
            const expanded = open === r.id;
            return (
              <li key={r.id} className={cn("rounded-xl border bg-white", !r.isActive && "opacity-70")}>
                <button type="button" onClick={() => setOpen(expanded ? null : r.id)} aria-expanded={expanded} className="flex w-full items-start gap-3 px-4 py-3 text-left">
                  <span className="font-display tabular mt-0.5 w-9 shrink-0 text-sm font-semibold text-mz-red">{r.code ?? "—"}</span>
                  <span className="min-w-0 flex-1">
                    <span className={cn("block text-sm text-mz-chumbo", !expanded && "line-clamp-2")}>{r.statement}</span>
                    <span className="mt-1 flex flex-wrap items-center gap-1.5">
                      <ToneBadge tone="neutral" dot={false}>{r.categoryName}</ToneBadge>
                      <span className="text-xs text-muted-foreground">{r.topic} · {DIFFICULTY_LABELS[r.difficulty]} · v{r.version}</span>
                      {r.inStandardSet && <ToneBadge tone="info" dot={false}>Avaliação padrão</ToneBadge>}
                      {!r.isActive && <ToneBadge tone="neutral">Inativa</ToneBadge>}
                    </span>
                  </span>
                  <ChevronDown className={cn("mt-1 size-4 shrink-0 text-muted-foreground transition-transform", expanded && "rotate-180")} aria-hidden />
                </button>
                {expanded && (
                  <div className="border-t px-4 py-3 sm:pl-16">
                    <ul className="grid gap-1.5">
                      {r.options.map((o) => (
                        <li key={o.label} className={cn("flex gap-2 rounded-lg px-2 py-1.5 text-sm", o.isCorrect && "bg-mz-green-soft font-medium text-mz-green-dark")}>
                          <span className="font-semibold">{o.label}.</span> {o.text} {o.isCorrect && <span className="text-xs">(correta)</span>}
                        </li>
                      ))}
                    </ul>
                    <p className="mt-3 text-xs text-muted-foreground"><span className="font-semibold text-mz-gray-dark">Explicação:</span> {r.explanation}</p>
                    {canEdit && (
                      <div className="mt-3 flex gap-2">
                        <Button asChild variant="outline" size="sm"><Link href={`/perguntas/${r.id}`}><Pencil /> Editar</Link></Button>
                        <ToggleActive id={r.id} active={r.isActive} />
                      </div>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
