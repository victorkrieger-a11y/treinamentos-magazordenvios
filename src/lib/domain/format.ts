const TZ = "America/Sao_Paulo";

const dateFmt = new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, day: "2-digit", month: "2-digit", year: "numeric" });
const dateTimeFmt = new Intl.DateTimeFormat("pt-BR", {
  timeZone: TZ,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
const shortDateFmt = new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, day: "2-digit", month: "2-digit" });
const numberFmt = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const score2Fmt = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

type DateInput = string | Date | null | undefined;

function toDate(value: DateInput): Date | null {
  if (!value) return null;
  // Datas puras (AAAA-MM-DD) são interpretadas como data local, sem fuso.
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d, 12));
  }
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** DD/MM/AAAA */
export function formatDate(value: DateInput, fallback = "—") {
  const d = toDate(value);
  return d ? dateFmt.format(d) : fallback;
}

/** DD/MM/AAAA HH:mm (24h) */
export function formatDateTime(value: DateInput, fallback = "—") {
  const d = toDate(value);
  return d ? dateTimeFmt.format(d).replace(",", " às") : fallback;
}

export function formatShortDate(value: DateInput) {
  const d = toDate(value);
  return d ? shortDateFmt.format(d) : "";
}

/** 86,67 — pontuação com até 2 casas decimais. */
export function formatScore(value: number | null | undefined, fallback = "—") {
  if (value === null || value === undefined || Number.isNaN(value)) return fallback;
  return numberFmt.format(value);
}

/** 86,67 — sempre 2 casas (telas de resultado). */
export function formatScoreFixed(value: number | null | undefined, fallback = "—") {
  if (value === null || value === undefined || Number.isNaN(value)) return fallback;
  return score2Fmt.format(value);
}

export function formatPercent(value: number | null | undefined, fallback = "—") {
  if (value === null || value === undefined || Number.isNaN(value)) return fallback;
  return `${numberFmt.format(value)}%`;
}

export function formatDuration(seconds: number | null | undefined) {
  if (seconds === null || seconds === undefined) return "—";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}min`;
  if (m > 0) return `${m}min ${String(s).padStart(2, "0")}s`;
  return `${s}s`;
}

export function formatRelative(value: DateInput, now: Date = new Date()) {
  const d = toDate(value);
  if (!d) return "—";
  const diff = Math.round((now.getTime() - d.getTime()) / 1000);
  if (diff < 60) return "agora mesmo";
  if (diff < 3600) return `há ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `há ${Math.floor(diff / 3600)} h`;
  if (diff < 86400 * 7) {
    const days = Math.floor(diff / 86400);
    return days === 1 ? "ontem" : `há ${days} dias`;
  }
  return formatDate(d);
}

/**
 * Converte data (AAAA-MM-DD) e hora (HH:mm) informadas no horário de Brasília
 * para ISO 8601 com fuso (-03:00). O Brasil não adota horário de verão desde 2019.
 */
export function brasiliaToIso(date: string, time = "23:59") {
  return `${date}T${time}:00-03:00`;
}

/** Data de hoje (AAAA-MM-DD) no horário de Brasília. */
export function todayInBrasilia(offsetDays = 0) {
  const d = new Date(Date.now() + offsetDays * 86400000);
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  return parts; // en-CA → AAAA-MM-DD
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}
