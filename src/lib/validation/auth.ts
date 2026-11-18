import { z } from "zod";
import { email } from "@/lib/validation/common";

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Informe a senha."),
});

export const recoverSchema = z.object({ email });

export const newPasswordSchema = z
  .object({
    password: z
      .string()
      .min(8, "A senha deve ter pelo menos 8 caracteres.")
      .max(72, "A senha deve ter no máximo 72 caracteres.")
      .regex(/[A-Za-z]/, "A senha deve conter letras.")
      .regex(/\d/, "A senha deve conter números."),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "As senhas não conferem." });
