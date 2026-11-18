"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { SortingState } from "@tanstack/react-table";
import { DataTable, nullsLast, type ColumnDef } from "@/components/tables/data-table";
import { ScoreText, SituationBadge, TrendIndicator } from "@/components/common/status-badges";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { RankingRow } from "@/lib/domain/analytics";

const SORTS: Record<string, { label: string; sorting: SortingState }> = {
  maior_media: { label: "Maior média", sorting: [{ id: "average", desc: true }] },
  menor_media: { label: "Menor média", sorting: [{ id: "average", desc: false }] },
  maior_evolucao: { label: "Maior evolução", sorting: [{ id: "evolution", desc: true }] },
  menor_evolucao: { label: "Menor evolução", sorting: [{ id: "evolution", desc: false }] },
  mais_avaliacoes: { label: "Mais avaliações concluídas", sorting: [{ id: "count", desc: true }] },
};

export function RankingTable({ rows, passingScore, showGuardian = true }: { rows: RankingRow[]; passingScore: number; showGuardian?: boolean }) {
  const [sortKey, setSortKey] = useState("maior_media");
  const [sorting, setSorting] = useState<SortingState>(SORTS.maior_media.sorting);

  const columns = useMemo<ColumnDef<RankingRow, unknown>[]>(() => {
    const cols: ColumnDef<RankingRow, unknown>[] = [
      {
        id: "name",
        accessorKey: "name",
        header: "Colaborador",
        cell: ({ row }) => (
          <Link href={`/colaboradores/${row.original.collaboratorId}`} className="font-medium text-mz-chumbo hover:text-mz-red-strong hover:underline">
            {row.original.name}
          </Link>
        ),
      },
    ];
    if (showGuardian) cols.push({ id: "guardian", accessorFn: (r) => r.guardianName ?? "", header: "Guardião", cell: ({ row }) => row.original.guardianName ?? <span className="text-muted-foreground">Sem vínculo</span> });
    cols.push(
      { id: "average", accessorFn: (r) => r.average, header: "Média", sortingFn: nullsLast((r: RankingRow) => r.average), cell: ({ row }) => <ScoreText score={row.original.average} passing={passingScore} />, meta: { className: "text-right" } },
      { id: "lastScore", accessorFn: (r) => r.lastScore, header: "Última nota", sortingFn: nullsLast((r: RankingRow) => r.lastScore), cell: ({ row }) => <ScoreText score={row.original.lastScore} passing={passingScore} />, meta: { className: "text-right" } },
      { id: "count", accessorKey: "count", header: "Avaliações", meta: { className: "text-right tabular" } },
      { id: "evolution", accessorFn: (r) => r.evolution, header: "Evolução", sortingFn: nullsLast((r: RankingRow) => r.evolution), cell: ({ row }) => <TrendIndicator trend={row.original.trend} delta={row.original.evolution} /> },
      { id: "situation", accessorKey: "situation", header: "Situação", enableSorting: false, cell: ({ row }) => <SituationBadge situation={row.original.situation} /> },
    );
    return cols;
  }, [passingScore, showGuardian]);

  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-end gap-2">
        <label htmlFor="ranking-sort" className="text-xs text-muted-foreground">Ordenar por</label>
        <Select
          value={sortKey}
          onValueChange={(v) => {
            setSortKey(v);
            setSorting(SORTS[v].sorting);
          }}
        >
          <SelectTrigger id="ranking-sort" className="h-8 w-[220px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {Object.entries(SORTS).map(([k, s]) => <SelectItem key={k} value={k}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <DataTable columns={columns} data={rows} sorting={sorting} onSortingChange={setSorting} pageSize={10} emptyTitle="Nenhum colaborador" caption="Ranking administrativo de desempenho" />
    </div>
  );
}
