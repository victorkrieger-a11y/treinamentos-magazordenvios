"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PERIOD_OPTIONS } from "@/lib/domain/periods";
import { CLASSIFICATIONS } from "@/lib/domain/scoring";
import { ASSIGNMENT_STATUS } from "@/lib/domain/status";

type Opt = { id: string; label: string };

function NativeSelect({ id, label, value, options, onChange, all }: { id: string; label: string; value: string; options: Opt[]; onChange: (v: string) => void; all: string }) {
  return (
    <label htmlFor={id} className="grid gap-1 text-xs font-semibold text-mz-chumbo">
      {label}
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className="h-9 rounded-lg border border-input bg-white px-2.5 text-sm font-normal outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <option value="">{all}</option>
        {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
      </select>
    </label>
  );
}

export function ReportFilters({ collaborators, guardians, quizzes, categories, showGuardian }: { collaborators: Opt[]; guardians: Opt[]; quizzes: Opt[]; categories: Opt[]; showGuardian: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  const get = (k: string) => params.get(k) ?? "";
  const set = (k: string, v: string) => {
    const sp = new URLSearchParams(params.toString());
    if (v) sp.set(k, v); else sp.delete(k);
    if (k === "periodo" && v !== "personalizado") { sp.delete("de"); sp.delete("ate"); }
    start(() => router.push(`${pathname}?${sp.toString()}`, { scroll: false }));
  };

  return (
    <div className="grid gap-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <NativeSelect id="f-periodo" label="Período" value={get("periodo") || "tudo"} all="Todo o período" options={PERIOD_OPTIONS.filter((p) => p.value !== "tudo").map((p) => ({ id: p.value, label: p.label }))} onChange={(v) => set("periodo", v)} />
        <NativeSelect id="f-colab" label="Colaborador" value={get("colaborador")} all="Todos" options={collaborators} onChange={(v) => set("colaborador", v)} />
        {showGuardian && <NativeSelect id="f-guard" label="Guardião" value={get("guardiao")} all="Todos" options={guardians} onChange={(v) => set("guardiao", v)} />}
        <NativeSelect id="f-quiz" label="Avaliação" value={get("avaliacao")} all="Todas" options={quizzes} onChange={(v) => set("avaliacao", v)} />
        <NativeSelect id="f-cat" label="Categoria (questões)" value={get("categoria")} all="Todas" options={categories} onChange={(v) => set("categoria", v)} />
        <NativeSelect id="f-nota" label="Nota" value={get("nota")} all="Qualquer nota" options={Object.entries(CLASSIFICATIONS).map(([k, v]) => ({ id: k, label: v.label }))} onChange={(v) => set("nota", v)} />
        <NativeSelect id="f-status" label="Status" value={get("status")} all="Qualquer status" options={Object.entries(ASSIGNMENT_STATUS).map(([k, v]) => ({ id: k, label: v.label }))} onChange={(v) => set("status", v)} />
      </div>
      {get("periodo") === "personalizado" && (
        <div className="flex flex-wrap items-end gap-2">
          <label className="grid gap-1 text-xs font-semibold">De<Input type="date" defaultValue={get("de")} onBlur={(e) => set("de", e.target.value)} className="h-9 w-[160px]" /></label>
          <label className="grid gap-1 text-xs font-semibold">Até<Input type="date" defaultValue={get("ate")} onBlur={(e) => set("ate", e.target.value)} className="h-9 w-[160px]" /></label>
        </div>
      )}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => start(() => router.push(pathname))}><RotateCcw /> Limpar filtros</Button>
        {pending && <Loader2 className="size-4 animate-spin text-muted-foreground" aria-label="Atualizando" />}
      </div>
    </div>
  );
}
