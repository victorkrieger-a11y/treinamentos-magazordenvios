import { z } from "zod";
import { cleanText, optionalText, uuid } from "@/lib/validation/common";

export const LABELS = ["A", "B", "C", "D"] as const;

export const questionSchema = z.object({
  id: uuid.optional().nullable(),
  categoryId: uuid,
  topic: cleanText(2, 120, "Assunto"),
  statement: cleanText(10, 2000, "Enunciado"),
  difficulty: z.enum(["facil", "media", "dificil"], { error: "Selecione a dificuldade." }),
  explanation: cleanText(10, 4000, "Explicação"),
  studyTip: optionalText(500, "Orientação de estudo"),
  inStandardSet: z.boolean(),
  isActive: z.boolean(),
  correctLabel: z.enum(LABELS, { error: "Indique a alternativa correta." }),
  options: z
    .array(
      z.object({
        label: z.enum(LABELS),
        text: cleanText(1, 1000, "Alternativa"),
        explanation: optionalText(2000, "Explicação do erro"),
      }),
    )
    .length(4, "A questão precisa ter exatamente quatro alternativas."),
});
export type QuestionInput = z.input<typeof questionSchema>;
export type QuestionData = z.output<typeof questionSchema>;

export function toQuestionPayload(q: QuestionData) {
  return {
    id: q.id ?? null,
    category_id: q.categoryId,
    topic: q.topic,
    statement: q.statement,
    difficulty: q.difficulty,
    explanation: q.explanation,
    study_tip: q.studyTip,
    in_standard_set: q.inStandardSet,
    is_active: q.isActive,
    options: q.options.map((o) => ({
      label: o.label,
      text: o.text,
      explanation: o.explanation,
      is_correct: o.label === q.correctLabel,
    })),
  };
}
