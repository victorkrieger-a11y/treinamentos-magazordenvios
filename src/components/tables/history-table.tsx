"use client";

import Link from "next/link";
import { useMemo } from "react";
import { DataTable, nullsLast, type ColumnDef } from "@/components/tables/data-table";
import { AssignmentStatusBadge, ScoreText } from "@/components/common/status-badges";
import { formatDate, formatDateTime } from "@/lib/domain/format";
import type { AssignmentStatus } from "@/lib/domain/status";

export type HistoryRow = {
  assignmentId: string;
  title: string;
  assignedAt: string;
  dueAt: string | null;
  completedAt: string | null;
  score: number | null;
  correct: number | null;
  incorrect: number | null;
  status: AssignmentStatus;
  attemptId: string | null;
  canOpenResult: boolean;
};

export function HistoryTable({ rows, passingScore }: { rows: HistoryRow[]; passingScore: number }) {
  const columns = useMemo<ColumnDef<HistoryRow, unknown>[]>(
    () => [
      { id: "title", accessorKey: "title", header: "Avaliação", cell: ({ row }) => <span className="font-medium text-mz-chumbo">{row.original.title}</span> },
      { id: "assignedAt", accessorKey: "assignedAt", header: "Envio", cell: ({ row }) => formatDate(row.original.assignedAt) },
      { id: "completedAt", accessorFn: (r) => r.completedAt ?? "", header: "Conclusão", cell: ({ row }) => (row.original.completedAt ? formatDateTime(row.original.completedAt) : <span className="text-muted-foreground">—</span>) },
      { id: "score", accessorFn: (r) => r.score, header: "Nota", sortingFn: nullsLast((r: HistoryRow) => r.score), cell: ({ row }) => <ScoreText score={row.original.score} passing={passingScore} />, meta: { className: "text-right" } },
      { id: "correct", accessorFn: (r) => r.correct, header: "Acertos", cell: ({ row }) => row.original.correct ?? "—", meta: { className: "text-right tabular" } },
      { id: "incorrect", accessorFn: (r) => r.incorrect, header: "Erros", cell: ({ row }) => row.original.incorrect ?? "—", meta: { className: "text-right tabular" } },
      { id: "status", accessorKey: "status", header: "Status", cell: ({ row }) => <AssignmentStatusBadge status={row.original.status} dueAt={row.original.dueAt} /> },
      {
        id: "actions",
        header: () => <span className="sr-only">Ações</span>,
        enableSorting: false,
        cell: ({ row }) =>
          row.original.attemptId && row.original.canOpenResult ? (
            <Link href={`/resultado/${row.original.attemptId}`} className="text-xs font-medium text-mz-red-strong hover:underline">Ver resultado</Link>
          ) : null,
      },
    ],
    [passingScore],
  );
  return <DataTable columns={columns} data={rows} pageSize={10} sorting={undefined} emptyTitle="Nenhuma avaliação registrada" caption="Histórico de avaliações" />;
}
