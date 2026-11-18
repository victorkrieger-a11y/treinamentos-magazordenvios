import { describe, expect, it } from "vitest";
import { average, calculateScore, classify, isApproved, percentage } from "@/lib/domain/scoring";

describe("calculateScore", () => {
  it.each([
    [30, 100],
    [27, 90],
    [24, 80],
    [21, 70],
    [15, 50],
    [0, 0],
  ])("%i acertos de 30 = %i pontos", (correct, expected) => {
    expect(calculateScore(correct, 30)).toBe(expected);
  });

  it("arredonda para duas casas decimais", () => {
    expect(calculateScore(26, 30)).toBe(86.67);
    expect(calculateScore(19, 30)).toBe(63.33);
    expect(calculateScore(5, 7)).toBe(71.43);
  });

  it("trata entradas inválidas", () => {
    expect(calculateScore(0, 0)).toBe(0);
    expect(() => calculateScore(31, 30)).toThrow(RangeError);
    expect(() => calculateScore(-1, 30)).toThrow(RangeError);
  });
});

describe("classify", () => {
  it.each([
    [100, "excelente"],
    [90, "excelente"],
    [89.99, "aprovado"],
    [80, "aprovado"],
    [79.99, "em_desenvolvimento"],
    [70, "em_desenvolvimento"],
    [69.99, "precisa_reforco"],
    [0, "precisa_reforco"],
  ])("%d → %s", (score, expected) => {
    expect(classify(score)).toBe(expected);
  });
});

describe("aprovação e agregados", () => {
  it("meta padrão 80 e meta configurável", () => {
    expect(isApproved(80)).toBe(true);
    expect(isApproved(79.99)).toBe(false);
    expect(isApproved(75, 70)).toBe(true);
  });
  it("média e percentual", () => {
    expect(average([])).toBeNull();
    expect(average([63.33, 76.67, 90])).toBe(76.67);
    expect(percentage(4, 5)).toBe(80);
    expect(percentage(5, 7)).toBe(71.43);
    expect(percentage(1, 0)).toBeNull();
  });
});
