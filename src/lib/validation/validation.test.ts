import { describe, expect, it } from "vitest";
import { createUserSchema } from "@/lib/validation/users";
import { questionSchema, toQuestionPayload } from "@/lib/validation/questions";
import { quizSchema, toQuizPayload } from "@/lib/validation/quizzes";
import { newPasswordSchema } from "@/lib/validation/auth";
import { settingsSchema } from "@/lib/validation/settings";

const UUID = "11111111-1111-4111-8111-111111111111";

describe("cadastro de usuários", () => {
  it("normaliza e-mail e remove caracteres de controle", () => {
    const r = createUserSchema.parse({ fullName: "  Ana\u0007 Souza ", email: " ANA@Magazord.com.br ", role: "collaborator", guardianId: UUID, jobTitle: "", startedAt: "" });
    expect(r).toMatchObject({ fullName: "Ana Souza", email: "ana@magazord.com.br", jobTitle: null, startedAt: null });
  });
  it("rejeita dados inválidos", () => {
    expect(createUserSchema.safeParse({ fullName: "A", email: "x", role: "collaborator" }).success).toBe(false);
    expect(createUserSchema.safeParse({ fullName: "Guardião X", email: "g@x.com", role: "guardian", guardianId: UUID }).success).toBe(false);
    expect(createUserSchema.safeParse({ fullName: "Admin X", email: "a@x.com", role: "root" }).success).toBe(false);
  });
});

describe("senha", () => {
  it("exige 8+ caracteres com letras e números e confirmação igual", () => {
    expect(newPasswordSchema.safeParse({ password: "abcdefgh", confirm: "abcdefgh" }).success).toBe(false);
    expect(newPasswordSchema.safeParse({ password: "abc12345", confirm: "abc12346" }).success).toBe(false);
    expect(newPasswordSchema.safeParse({ password: "abc12345", confirm: "abc12345" }).success).toBe(true);
  });
});

describe("questões", () => {
  const base = {
    categoryId: UUID, topic: "Acareação", statement: "Qual é o prazo de acareação?", difficulty: "media", explanation: "Até 6 dias corridos.",
    studyTip: "", inStandardSet: true, isActive: true, correctLabel: "B",
    options: ["A", "B", "C", "D"].map((label) => ({ label, text: `Opção ${label}`, explanation: "" })),
  };
  it("gera payload com exatamente uma correta", () => {
    const p = toQuestionPayload(questionSchema.parse(base));
    expect(p.options.filter((o) => o.is_correct).map((o) => o.label)).toEqual(["B"]);
  });
  it("exige quatro alternativas e a correta", () => {
    expect(questionSchema.safeParse({ ...base, options: base.options.slice(0, 3) }).success).toBe(false);
    expect(questionSchema.safeParse({ ...base, correctLabel: undefined }).success).toBe(false);
  });
});

describe("avaliações", () => {
  const base = {
    title: "Treinamento inicial", description: "", mode: "standard", selectionType: "categories", categoryCounts: [], questionIds: [],
    collaboratorIds: [UUID], sendNow: true, availableDate: "", availableTime: "", hasDeadline: true, deadlineDate: "2099-01-10", deadlineTime: "18:00",
    maxAttempts: 1, showFeedback: true, allowIncomplete: true, passingScore: 80,
  };
  it("converte para o payload do servidor com prazo em Brasília", () => {
    const p = toQuizPayload(quizSchema.parse(base));
    expect(p).toMatchObject({ mode: "standard", deadline: "2099-01-10T18:00:00-03:00", available_from: null, collaborator_ids: [UUID] });
  });
  it("valida colaboradores, prazo e seleção personalizada", () => {
    expect(quizSchema.safeParse({ ...base, collaboratorIds: [] }).success).toBe(false);
    expect(quizSchema.safeParse({ ...base, deadlineDate: "2001-01-01" }).success).toBe(false);
    expect(quizSchema.safeParse({ ...base, mode: "custom", categoryCounts: [{ categoryId: UUID, count: 0 }] }).success).toBe(false);
    expect(quizSchema.safeParse({ ...base, mode: "custom", selectionType: "manual", questionIds: [UUID] }).success).toBe(true);
    expect(quizSchema.safeParse({ ...base, maxAttempts: 0 }).success).toBe(false);
  });
});

describe("configurações", () => {
  it("limite de atenção não pode superar a meta", () => {
    expect(settingsSchema.safeParse({ passingScore: 80, attentionScore: 90, minAnswersForDiagnosis: 2, defaultMaxAttempts: 1, defaultDueDays: 7 }).success).toBe(false);
  });
});
