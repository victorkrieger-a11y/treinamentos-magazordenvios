"use client";

import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/common/empty-state";
import { cn } from "@/lib/utils";

export type { ColumnDef };

export function DataTable<T>({
  columns,
  data,
  sorting: controlledSorting,
  onSortingChange,
  pageSize = 15,
  emptyTitle = "Nenhum registro encontrado",
  emptyDescription,
  caption,
  className,
}: {
  columns: ColumnDef<T, unknown>[];
  data: T[];
  sorting?: SortingState;
  onSortingChange?: (s: SortingState) => void;
  pageSize?: number;
  emptyTitle?: string;
  emptyDescription?: string;
  caption?: string;
  className?: string;
}) {
  const [internalSorting, setInternalSorting] = useState<SortingState>([]);
  const sorting = controlledSorting ?? internalSorting;
  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: (updater) => {
      const next = typeof updater === "function" ? updater(sorting) : updater;
      if (onSortingChange) onSortingChange(next);
      else setInternalSorting(next);
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize } },
    autoResetPageIndex: true,
  });

  if (data.length === 0) return <EmptyState title={emptyTitle} description={emptyDescription} />;

  const pageCount = table.getPageCount();
  return (
    <div className={className}>
      <div className="relative overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          {caption && <caption className="sr-only">{caption}</caption>}
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="border-b">
                {hg.headers.map((h) => {
                  const sortable = h.column.getCanSort();
                  const dir = h.column.getIsSorted();
                  const meta = h.column.columnDef.meta as { className?: string } | undefined;
                  return (
                    <th key={h.id} scope="col" aria-sort={dir === "asc" ? "ascending" : dir === "desc" ? "descending" : undefined} className={cn("whitespace-nowrap px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground", meta?.className)}>
                      {h.isPlaceholder ? null : sortable ? (
                        <button type="button" onClick={h.column.getToggleSortingHandler()} className="inline-flex items-center gap-1 rounded hover:text-mz-chumbo">
                          {flexRender(h.column.columnDef.header, h.getContext())}
                          {dir === "asc" ? <ArrowUp className="size-3" /> : dir === "desc" ? <ArrowDown className="size-3" /> : <ArrowUpDown className="size-3 opacity-40" />}
                        </button>
                      ) : (
                        flexRender(h.column.columnDef.header, h.getContext())
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} className="border-b last:border-0 transition-colors hover:bg-muted/50">
                {row.getVisibleCells().map((cell) => {
                  const meta = cell.column.columnDef.meta as { className?: string } | undefined;
                  return (
                    <td key={cell.id} className={cn("px-3 py-2.5 align-middle", meta?.className)}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pageCount > 1 && (
        <div className="flex items-center justify-between gap-2 border-t px-3 pt-3 text-xs text-muted-foreground">
          <span>
            {table.getRowModel().rows.length} de {data.length} registros · página {table.getState().pagination.pageIndex + 1} de {pageCount}
          </span>
          <div className="flex gap-1">
            <Button variant="outline" size="icon-sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()} aria-label="Página anterior">
              <ChevronLeft />
            </Button>
            <Button variant="outline" size="icon-sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()} aria-label="Próxima página">
              <ChevronRight />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Ordenação que mantém valores nulos sempre no final. */
export function nullsLast<T>(get: (row: T) => number | null) {
  return (a: { original: T }, b: { original: T }) => {
    const x = get(a.original);
    const y = get(b.original);
    if (x === null && y === null) return 0;
    if (x === null) return -Infinity;
    if (y === null) return Infinity;
    return x - y;
  };
}
