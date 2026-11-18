import { todayInBrasilia } from "@/lib/domain/format";

export type PeriodKey = "hoje" | "7d" | "30d" | "90d" | "tudo" | "personalizado";

export const PERIOD_OPTIONS: { value: PeriodKey; label: string }[] = [
  { value: "hoje", label: "Hoje" },
  { value: "7d", label: "Últimos 7 dias" },
  { value: "30d", label: "Últimos 30 dias" },
  { value: "90d", label: "Últimos 90 dias" },
  { value: "tudo", label: "Todo o período" },
  { value: "personalizado", label: "Personalizado" },
];

export type Period = { key: PeriodKey; from: string | null; to: string | null; label: string };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Converte os parâmetros de URL em um intervalo [from, to) em ISO. */
export function resolvePeriod(params: { periodo?: string; de?: string; ate?: string }, fallback: PeriodKey = "30d"): Period {
  const key = (PERIOD_OPTIONS.some((p) => p.value === params.periodo) ? params.periodo : fallback) as PeriodKey;
  const label = PERIOD_OPTIONS.find((p) => p.value === key)!.label;
  const startOf = (date: string) => `${date}T00:00:00-03:00`;
  const today = todayInBrasilia();
  const tomorrow = todayInBrasilia(1);

  switch (key) {
    case "hoje":
      return { key, from: startOf(today), to: startOf(tomorrow), label };
    case "7d":
      return { key, from: startOf(todayInBrasilia(-6)), to: startOf(tomorrow), label };
    case "30d":
      return { key, from: startOf(todayInBrasilia(-29)), to: startOf(tomorrow), label };
    case "90d":
      return { key, from: startOf(todayInBrasilia(-89)), to: startOf(tomorrow), label };
    case "personalizado": {
      const de = params.de && DATE_RE.test(params.de) ? params.de : todayInBrasilia(-29);
      const ate = params.ate && DATE_RE.test(params.ate) ? params.ate : today;
      const [a, b] = de <= ate ? [de, ate] : [ate, de];
      const end = new Date(`${b}T12:00:00-03:00`);
      end.setUTCDate(end.getUTCDate() + 1);
      return { key, from: startOf(a), to: startOf(end.toISOString().slice(0, 10)), label: `${a.split("-").reverse().join("/")} a ${b.split("-").reverse().join("/")}` };
    }
    default:
      return { key: "tudo", from: null, to: null, label };
  }
}

export function inPeriod(iso: string | null | undefined, period: Pick<Period, "from" | "to">) {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  if (period.from && t < new Date(period.from).getTime()) return false;
  if (period.to && t >= new Date(period.to).getTime()) return false;
  return true;
}
