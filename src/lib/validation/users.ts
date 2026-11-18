import { z } from "zod";
import { cleanText, email, optionalDate, optionalText, uuid } from "@/lib/validation/common";

export const createUserSchema = z
  .object({
    fullName: cleanText(3, 120, "Nome completo"),
    email,
    role: z.enum(["collaborator", "guardian", "supervisor"], { error: "Perfil inválido." }),
    guardianId: uuid.optional().nullable().or(z.literal("").transform(() => null)),
    jobTitle: optionalText(120, "Cargo"),
    startedAt: optionalDate,
  })
  .refine((v) => v.role === "collaborator" || !v.guardianId, {
    path: ["guardianId"],
    message: "Somente colaboradores podem ter guardião.",
  });
export type CreateUserInput = z.input<typeof createUserSchema>;

export const updateUserSchema = z.object({
  id: uuid,
  fullName: cleanText(3, 120, "Nome completo"),
  jobTitle: optionalText(120, "Cargo"),
  startedAt: optionalDate,
  status: z.enum(["invited", "active", "inactive"]),
});
export type UpdateUserInput = z.input<typeof updateUserSchema>;

export const assignGuardianSchema = z.object({
  collaboratorId: uuid,
  guardianId: uuid.nullable(),
});
