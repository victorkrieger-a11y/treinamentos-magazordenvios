import { z } from "zod";

export const settingsSchema = z
  .object({
    passingScore: z.number({ error: "Informe um número." }).min(0).max(100),
    attentionScore: z.number({ error: "Informe um número." }).min(0).max(100),
    minAnswersForDiagnosis: z.number().int().min(1).max(50),
    defaultMaxAttempts: z.number().int().min(1).max(10),
    defaultDueDays: z.number().int().min(1).max(365),
  })
  .refine((v) => v.attentionScore <= v.passingScore, {
    path: ["attentionScore"],
    message: "O limite de atenção deve ser menor ou igual à meta de aprovação.",
  });
export type SettingsInput = z.input<typeof settingsSchema>;
