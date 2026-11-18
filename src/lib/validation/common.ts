import { z } from "zod";

/** Remove caracteres de controle e espaços excedentes. */
export const cleanText = (min: number, max: number, label: string) =>
  z
    .string({ error: `${label} é obrigatório.` })
    .transform((v) => v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim())
    .pipe(
      z
        .string()
        .min(min, `${label} deve ter pelo menos ${min} caracteres.`)
        .max(max, `${label} deve ter no máximo ${max} caracteres.`),
    );

export const optionalText = (max: number, label: string) =>
  z
    .string()
    .optional()
    .nullable()
    .transform((v) => (v ?? "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim())
    .pipe(z.string().max(max, `${label} deve ter no máximo ${max} caracteres.`))
    .transform((v) => (v === "" ? null : v));

export const uuid = z.uuid("Identificador inválido.");

export const optionalDate = z
  .string()
  .optional()
  .nullable()
  .transform((v) => (v ? v : null))
  .refine((v) => v === null || /^\d{4}-\d{2}-\d{2}$/.test(v), "Data inválida.");

export const email = z
  .string({ error: "Informe o e-mail." })
  .trim()
  .toLowerCase()
  .pipe(z.email("Informe um e-mail válido."));

export type ActionResult<T = undefined> =
  | { ok: true; data?: T; message?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[] | undefined> };
