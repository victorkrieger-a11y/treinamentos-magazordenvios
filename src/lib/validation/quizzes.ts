import { z } from "zod";
import { brasiliaToIso } from "@/lib/domain/format";
import { cleanText, optionalText, uuid } from "@/lib/validation/common";

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida.");
const timeStr = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Horário inválido.");

export const quizSchema = z
  .object({
    title: cleanText(3, 150, "Nome da avaliação"),
    description: optionalText(2000, "Descrição"),
    mode: z.enum(["standard", "custom"]),
    selectionType: z.enum(["categories", "manual"]),
    categoryCounts: z.array(z.object({ categoryId: uuid, count: z.number().int().min(0).max(200) })),
    questionIds: z.array(uuid).max(200),
    collaboratorIds: z.array(uuid).min(1, "Selecione pelo menos um colaborador."),
    sendNow: z.boolean(),
    availableDate: dateStr.optional().or(z.literal("")),
    availableTime: timeStr.optional().or(z.literal("")),
    hasDeadline: z.boolean(),
    deadlineDate: dateStr.optional().or(z.literal("")),
    deadlineTime: timeStr.optional().or(z.literal("")),
    maxAttempts: z.number().int().min(1, "Mínimo de 1 tentativa.").max(10, "Máximo de 10 tentativas."),
    showFeedback: z.boolean(),
    allowIncomplete: z.boolean(),
    passingScore: z.number().min(0).max(100),
  })
  .superRefine((v, ctx) => {
    if (v.mode === "custom") {
      if (v.selectionType === "categories" && v.categoryCounts.reduce((s, c) => s + c.count, 0) === 0) {
        ctx.addIssue({ code: "custom", path: ["categoryCounts"], message: "Defina a quantidade de questões em pelo menos uma categoria." });
      }
      if (v.selectionType === "manual" && v.questionIds.length === 0) {
        ctx.addIssue({ code: "custom", path: ["questionIds"], message: "Selecione pelo menos uma questão." });
      }
    }
    if (!v.sendNow && (!v.availableDate || !v.availableTime)) {
      ctx.addIssue({ code: "custom", path: ["availableDate"], message: "Informe a data e o horário de envio." });
    }
    if (v.hasDeadline) {
      if (!v.deadlineDate || !v.deadlineTime) {
        ctx.addIssue({ code: "custom", path: ["deadlineDate"], message: "Informe a data e o horário do prazo." });
        return;
      }
      const deadline = new Date(brasiliaToIso(v.deadlineDate, v.deadlineTime));
      const start = !v.sendNow && v.availableDate && v.availableTime ? new Date(brasiliaToIso(v.availableDate, v.availableTime)) : new Date();
      if (deadline <= start) {
        ctx.addIssue({ code: "custom", path: ["deadlineDate"], message: "O prazo precisa ser posterior à data de envio." });
      }
    }
  });
export type QuizFormInput = z.input<typeof quizSchema>;
export type QuizFormData = z.output<typeof quizSchema>;

export function toQuizPayload(v: QuizFormData) {
  return {
    title: v.title,
    description: v.description,
    mode: v.mode,
    selection:
      v.mode === "standard"
        ? { type: "standard" }
        : v.selectionType === "manual"
          ? { type: "manual", question_ids: [...new Set(v.questionIds)] }
          : { type: "categories", items: v.categoryCounts.filter((c) => c.count > 0).map((c) => ({ category_id: c.categoryId, count: c.count })) },
    collaborator_ids: [...new Set(v.collaboratorIds)],
    available_from: v.sendNow || !v.availableDate || !v.availableTime ? null : brasiliaToIso(v.availableDate, v.availableTime),
    deadline: v.hasDeadline && v.deadlineDate && v.deadlineTime ? brasiliaToIso(v.deadlineDate, v.deadlineTime) : null,
    max_attempts: v.maxAttempts,
    show_feedback: v.showFeedback,
    allow_incomplete: v.allowIncomplete,
    passing_score: v.passingScore,
  };
}
