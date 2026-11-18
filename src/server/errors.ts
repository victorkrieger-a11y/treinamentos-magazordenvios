import "server-only";

import { ZodError } from "zod";
import { AuthorizationError } from "@/lib/auth/session";
import type { ActionResult } from "@/lib/validation/common";

type PgError = { code?: string; message?: string } | null | undefined;

/** Códigos de erro de negócio lançados pelas funções do banco (mensagens em pt-BR). */
const BUSINESS_CODES = new Set(["P0001", "P0002", "42501"]);

export function dbErrorMessage(error: PgError, fallback = "Não foi possível concluir a operação. Tente novamente.") {
  if (!error) return fallback;
  if (error.code && BUSINESS_CODES.has(error.code) && error.message) return error.message;
  if (error.code === "23505") return "Registro duplicado: esta informação já está cadastrada.";
  console.error("[db]", error.code, error.message);
  return fallback;
}

export function failure(error: unknown): ActionResult<never> {
  if (error instanceof ZodError) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of error.issues) {
      const key = issue.path.join(".") || "_";
      (fieldErrors[key] ??= []).push(issue.message);
    }
    return { ok: false, error: error.issues[0]?.message ?? "Dados inválidos.", fieldErrors };
  }
  if (error instanceof AuthorizationError) return { ok: false, error: error.message };
  console.error("[action]", error);
  return { ok: false, error: "Ocorreu um erro inesperado. Tente novamente." };
}
