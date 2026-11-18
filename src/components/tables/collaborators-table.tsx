"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataTable, nullsLast, type ColumnDef } from "@/components/tables/data-table";
import { ScoreText, UserStatusBadge } from "@/components/common/status-badges";

export type CollaboratorListRow = {
  id: string;
  name: string;
  email: string;
  guardianId: string | null;
  guardianName: string | null;
  average: number | null;
  count: number;
  status: "invited" | "active" | "inactive";
  jobTitle: string | null;
};

const ALL = "__all__";

export function CollaboratorsTable({ rows, guardians, passingScore, attentionScore, showGuardianFilter }: { rows: CollaboratorListRow[]; guardians: { id: string; fullName: string }[]; passingScore: number; attentionScore: number; showGuardianFilter: boolean }) {
  const [q, setQ] = useState("");
  const [guardian, setGuardian] = useState(ALL);
  const [status, setStatus] = useState("ativos");
  const [perf, setPerf] = useState(ALL);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (term && !r.name.toLowerCase().includes(term) && !r.email.toLowerCase().includes(term)) return false;
      if (guardian !== ALL && (guardian === "sem" ? r.guardianId !== null : r.guardianId !== guardian)) return false;
      if (status === "ativos" && r.status === "inactive") return false;
      if (status !== "ativos" && status !== ALL && r.status !== status) return false;
      if (perf === "aprovados" && !(r.average !== null && r.average >= passingScore)) return false;
      if (perf === "abaixo_meta" && !(r.average !== null && r.average < passingScore)) return false;
      if (perf === "reforco" && !(r.average !== null && r.average < attentionScore)) return false;
      if (perf === "sem_avaliacao" && r.count > 0) return false;
      return true;
    });
  }, [rows, q, guardian, status, perf, passingScore, attentionScore]);

  const columns = useMemo<ColumnDef<CollaboratorListRow, unknown>[]>(
    () => [
      {
        id: "name",
        accessorKey: "name",
        header: "Nome",
        cell: ({ row }) => (
          <div>
            <Link href={`/colaboradores/${row.original.id}`} className="font-medium text-mz-chumbo hover:text-mz-red-strong hover:underline">{row.original.name}</Link>
            {row.original.jobTitle && <p className="text-xs text-muted-foreground">{row.original.jobTitle}</p>}
          </div>
        ),
      },
      { id: "email", accessorKey: "email", header: "E-mail", cell: ({ row }) => <span className="text-muted-foreground">{row.original.email}</span> },
      { id: "guardian", accessorFn: (r) => r.guardianName ?? "", header: "Guardião", cell: ({ row }) => row.original.guardianName ?? <span className="text-muted-foreground">Sem vínculo</span> },
      { id: "average", accessorFn: (r) => r.average, header: "Média", sortingFn: nullsLast((r: CollaboratorListRow) => r.average), cell: ({ row }) => <ScoreText score={row.original.average} passing={passingScore} />, meta: { className: "text-right" } },
      { id: "count", accessorKey: "count", header: "Avaliações", meta: { className: "text-right tabular" } },
      { id: "status", accessorKey: "status", header: "Status", cell: ({ row }) => <UserStatusBadge status={row.original.status} /> },
    ],
    [passingScore],
  );

  return (
    <div className="grid gap-4">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Pesquisar por nome ou e-mail" className="h-9 pl-9" aria-label="Pesquisar por nome ou e-mail" />
        </div>
        <div className="flex flex-wrap gap-2">
          {showGuardianFilter && (
            <Select value={guardian} onValueChange={setGuardian}>
              <SelectTrigger className="h-9 w-[190px]" aria-label="Filtrar por guardião"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todos os guardiões</SelectItem>
                <SelectItem value="sem">Sem guardião</SelectItem>
                {guardians.map((g) => <SelectItem key={g.id} value={g.id}>{g.fullName}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="h-9 w-[160px]" aria-label="Filtrar por status"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ativos">Ativos e convidados</SelectItem>
              <SelectItem value="active">Somente ativos</SelectItem>
              <SelectItem value="invited">Convidados</SelectItem>
              <SelectItem value="inactive">Inativos</SelectItem>
              <SelectItem value={ALL}>Todos</SelectItem>
            </SelectContent>
          </Select>
          <Select value={perf} onValueChange={setPerf}>
            <SelectTrigger className="h-9 w-[190px]" aria-label="Filtrar por desempenho"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Qualquer desempenho</SelectItem>
              <SelectItem value="aprovados">Média na meta</SelectItem>
              <SelectItem value="abaixo_meta">Abaixo da meta</SelectItem>
              <SelectItem value="reforco">Precisam de reforço</SelectItem>
              <SelectItem value="sem_avaliacao">Sem avaliação</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <DataTable columns={columns} data={filtered} pageSize={20} emptyTitle="Nenhum colaborador encontrado" emptyDescription="Ajuste os filtros ou cadastre um novo colaborador." caption="Lista de colaboradores" />
    </div>
  );
}
