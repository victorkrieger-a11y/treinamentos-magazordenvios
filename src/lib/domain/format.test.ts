import { describe, expect, it } from "vitest";
import { brasiliaToIso, formatDate, formatDateTime, formatDuration, formatPercent, formatScore, formatScoreFixed } from "@/lib/domain/format";
import { effectiveAssignmentStatus } from "@/lib/domain/status";
import { inPeriod, resolvePeriod } from "@/lib/domain/periods";

describe("formatação pt-BR", () => {
  it("datas DD/MM/AAAA e horário 24h em Brasília", () => {
    expect(formatDate("2026-03-05")).toBe("05/03/2026");
    expect(formatDate("2026-03-05T02:30:00Z")).toBe("04/03/2026");
    expect(formatDateTime("2026-03-05T21:15:00Z")).toBe("05/03/2026 às 18:15");
    expect(formatDate(null)).toBe("—");
  });
  it("pontuação e percentuais", () => {
    expect(formatScore(86.67)).toBe("86,67");
    expect(formatScore(80)).toBe("80");
    expect(formatScoreFixed(80)).toBe("80,00");
    expect(formatPercent(71.43)).toBe("71,43%");
  });
  it("duração", () => {
    expect(formatDuration(45)).toBe("45s");
    expect(formatDuration(754)).toBe("12min 34s");
    expect(formatDuration(3720)).toBe("1h 02min");
  });
  it("conversão de horário de Brasília para ISO", () => {
    expect(new Date(brasiliaToIso("2026-11-20", "23:59")).toISOString()).toBe("2026-11-21T02:59:00.000Z");
  });
});

describe("status e períodos", () => {
  const now = new Date("2026-06-10T12:00:00Z");
  it("atribuição aberta com prazo vencido é exibida como expirada", () => {
    expect(effectiveAssignmentStatus("pending", "2026-06-09T00:00:00Z", now)).toBe("expired");
    expect(effectiveAssignmentStatus("in_progress", "2026-06-11T00:00:00Z", now)).toBe("in_progress");
    expect(effectiveAssignmentStatus("completed", "2026-06-09T00:00:00Z", now)).toBe("completed");
  });
  it("período personalizado inclui o dia final inteiro", () => {
    const p = resolvePeriod({ periodo: "personalizado", de: "2026-06-01", ate: "2026-06-05" });
    expect(p.label).toBe("01/06/2026 a 05/06/2026");
    expect(inPeriod("2026-06-06T02:59:00Z", p)).toBe(true);
    expect(inPeriod("2026-06-06T03:00:00Z", p)).toBe(false);
    expect(inPeriod("2026-06-01T02:59:00Z", p)).toBe(false);
  });
  it("período inválido usa o padrão", () => {
    expect(resolvePeriod({ periodo: "xyz" }, "30d").key).toBe("30d");
    expect(resolvePeriod({ periodo: "tudo" })).toMatchObject({ from: null, to: null });
  });
});
