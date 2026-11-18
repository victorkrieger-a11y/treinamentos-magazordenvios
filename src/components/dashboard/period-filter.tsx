"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { CalendarDays, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PERIOD_OPTIONS, type PeriodKey } from "@/lib/domain/periods";

export function PeriodFilter({ value, from, to }: { value: PeriodKey; from?: string; to?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  const [custom, setCustom] = useState({ de: from ?? "", ate: to ?? "" });
  const [mode, setMode] = useState<PeriodKey>(value);

  const apply = (next: Record<string, string | null>) => {
    const sp = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(next)) {
      if (v) sp.set(k, v);
      else sp.delete(k);
    }
    start(() => router.push(`${pathname}?${sp.toString()}`, { scroll: false }));
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {pending && <Loader2 className="size-4 animate-spin text-muted-foreground" aria-label="Carregando" />}
      <Select
        value={mode}
        onValueChange={(v) => {
          setMode(v as PeriodKey);
          if (v !== "personalizado") apply({ periodo: v, de: null, ate: null });
        }}
      >
        <SelectTrigger className="h-9 w-[190px] bg-white" aria-label="Período">
          <CalendarDays className="size-4 text-muted-foreground" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {PERIOD_OPTIONS.map((p) => (
            <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      {mode === "personalizado" && (
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            apply({ periodo: "personalizado", de: custom.de, ate: custom.ate });
          }}
        >
          <Input type="date" aria-label="Data inicial" className="h-9 w-[150px] bg-white" value={custom.de} onChange={(e) => setCustom((c) => ({ ...c, de: e.target.value }))} required />
          <span className="text-xs text-muted-foreground">até</span>
          <Input type="date" aria-label="Data final" className="h-9 w-[150px] bg-white" value={custom.ate} onChange={(e) => setCustom((c) => ({ ...c, ate: e.target.value }))} required />
          <Button type="submit" size="sm" className="h-9">Aplicar</Button>
        </form>
      )}
    </div>
  );
}
