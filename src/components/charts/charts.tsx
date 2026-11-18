"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts";
import { formatScore } from "@/lib/domain/format";
import { EmptyState } from "@/components/common/empty-state";
import { BarChart3 } from "lucide-react";

const C = {
  red: "#e52944",
  chumbo: "#383838",
  gray: "#adadad",
  grid: "#ececec",
  green: "#198e4d",
  yellow: "#fdc418",
  blue: "#041bf7",
};
const axis = { fontSize: 11, fill: "#606060" };

type Row = Record<string, string | number | null>;

function ChartTooltip({ active, payload, label, suffix = "" }: Partial<TooltipContentProps<number, string>> & { suffix?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-white px-3 py-2 text-xs shadow-md">
      {label !== undefined && <p className="mb-1 font-semibold text-mz-chumbo">{String(label)}</p>}
      {payload.map((p) => (
        <p key={String(p.dataKey)} className="flex items-center gap-2 text-muted-foreground">
          <span className="size-2 rounded-full" style={{ background: p.color }} />
          {p.name}: <span className="tabular font-semibold text-mz-chumbo">{typeof p.value === "number" ? formatScore(p.value) : "—"}{suffix}</span>
        </p>
      ))}
    </div>
  );
}

function Empty() {
  return <EmptyState icon={BarChart3} title="Sem dados no período" description="Os gráficos são gerados a partir das avaliações concluídas." className="h-full" />;
}

/** Evolução da média e do percentual de aprovação. */
export function ScoreTrendChart({ data, passingScore, height = 260 }: { data: Row[]; passingScore: number; height?: number }) {
  if (data.length === 0) return <div style={{ height }}><Empty /></div>;
  return (
    <div style={{ height }} role="img" aria-label="Gráfico de evolução da média de notas e do percentual de aprovação">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -16 }}>
          <CartesianGrid stroke={C.grid} vertical={false} />
          <XAxis dataKey="label" tick={axis} tickLine={false} axisLine={{ stroke: C.grid }} />
          <YAxis domain={[0, 100]} tick={axis} tickLine={false} axisLine={false} />
          <Tooltip content={<ChartTooltip />} />
          <ReferenceLine y={passingScore} stroke={C.green} strokeDasharray="4 4" label={{ value: `Meta ${formatScore(passingScore)}`, position: "insideTopRight", fontSize: 10, fill: C.green }} />
          <Line type="monotone" dataKey="average" name="Média" stroke={C.red} strokeWidth={2.5} dot={{ r: 3, fill: C.red }} activeDot={{ r: 5 }} connectNulls />
          <Line type="monotone" dataKey="approvalRate" name="Aprovação (%)" stroke={C.chumbo} strokeWidth={1.5} strokeDasharray="5 4" dot={false} connectNulls />
        </LineChart>
      </ResponsiveContainer>
      <div className="mt-2 flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 bg-mz-red" />Média das notas</span>
        <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 border-t-2 border-dashed border-mz-chumbo" />Percentual de aprovação</span>
        <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 border-t-2 border-dashed border-mz-green-dark" />Meta de aprovação</span>
      </div>
    </div>
  );
}

export function CompletedChart({ data, height = 220 }: { data: Row[]; height?: number }) {
  if (data.length === 0) return <div style={{ height }}><Empty /></div>;
  return (
    <div style={{ height }} role="img" aria-label="Gráfico de avaliações concluídas por período">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
          <CartesianGrid stroke={C.grid} vertical={false} />
          <XAxis dataKey="label" tick={axis} tickLine={false} axisLine={{ stroke: C.grid }} />
          <YAxis allowDecimals={false} tick={axis} tickLine={false} axisLine={false} />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: "#f3f3f3" }} />
          <Bar dataKey="completed" name="Concluídas" fill={C.chumbo} radius={[4, 4, 0, 0]} maxBarSize={36} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Aproveitamento (%) por categoria — barras horizontais. */
export function CategoryChart({ data, passingScore, height }: { data: { name: string; rate: number | null; total: number }[]; passingScore: number; height?: number }) {
  const rows = data.filter((d) => d.total > 0);
  const h = height ?? Math.max(180, rows.length * 34 + 30);
  if (rows.length === 0) return <div style={{ height: 200 }}><Empty /></div>;
  return (
    <div style={{ height: h }} role="img" aria-label="Gráfico de aproveitamento por categoria">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid stroke={C.grid} horizontal={false} />
          <XAxis type="number" domain={[0, 100]} tick={axis} tickLine={false} axisLine={false} unit="%" />
          <YAxis type="category" dataKey="name" width={150} tick={{ ...axis, fill: "#383838" }} tickLine={false} axisLine={false} />
          <Tooltip content={<ChartTooltip suffix="%" />} cursor={{ fill: "#f7f7f7" }} />
          <ReferenceLine x={passingScore} stroke={C.green} strokeDasharray="4 4" />
          <Bar dataKey="rate" name="Aproveitamento" radius={[0, 4, 4, 0]} maxBarSize={18}>
            {rows.map((r) => (
              <Cell key={r.name} fill={(r.rate ?? 0) >= passingScore ? C.chumbo : (r.rate ?? 0) >= 70 ? C.yellow : C.red} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Evolução individual: nota de cada avaliação concluída. */
export function EvolutionChart({ data, passingScore, height = 240 }: { data: { label: string; score: number; title: string }[]; passingScore: number; height?: number }) {
  if (data.length === 0) return <div style={{ height }}><Empty /></div>;
  return (
    <div style={{ height }} role="img" aria-label="Gráfico de evolução das notas">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -16 }}>
          <CartesianGrid stroke={C.grid} vertical={false} />
          <XAxis dataKey="label" tick={axis} tickLine={false} axisLine={{ stroke: C.grid }} />
          <YAxis domain={[0, 100]} tick={axis} tickLine={false} axisLine={false} />
          <Tooltip
            content={({ active, payload }) =>
              active && payload?.length ? (
                <div className="rounded-lg border bg-white px-3 py-2 text-xs shadow-md">
                  <p className="font-semibold text-mz-chumbo">{(payload[0].payload as { title: string }).title}</p>
                  <p className="text-muted-foreground">Nota: <span className="tabular font-semibold text-mz-chumbo">{formatScore(payload[0].value as number)}</span></p>
                </div>
              ) : null
            }
          />
          <ReferenceLine y={passingScore} stroke={C.green} strokeDasharray="4 4" />
          <Line type="monotone" dataKey="score" name="Nota" stroke={C.red} strokeWidth={2.5} dot={{ r: 4, fill: C.red }} activeDot={{ r: 6 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
