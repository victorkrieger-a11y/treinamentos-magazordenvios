"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/common/field";
import { newPasswordSchema } from "@/lib/validation/auth";
import { setNewPassword } from "@/server/actions/auth";

export function PasswordForm() {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const form = useForm<z.input<typeof newPasswordSchema>>({ resolver: zodResolver(newPasswordSchema), defaultValues: { password: "", confirm: "" } });
  const { errors } = form.formState;
  const onSubmit = form.handleSubmit((values) =>
    start(async () => {
      const res = await setNewPassword(values);
      if (res && !res.ok) setError(res.error);
    }),
  );
  return (
    <form onSubmit={onSubmit} className="grid gap-4" noValidate>
      {error && <p role="alert" className="rounded-lg bg-mz-red-soft px-3 py-2 text-sm text-mz-red-strong">{error}</p>}
      <Field id="password" label="Nova senha" error={errors.password?.message} hint="Mínimo de 8 caracteres, com letras e números.">
        <Input id="password" type="password" autoComplete="new-password" className="h-10" {...form.register("password")} />
      </Field>
      <Field id="confirm" label="Confirmar senha" error={errors.confirm?.message}>
        <Input id="confirm" type="password" autoComplete="new-password" className="h-10" {...form.register("confirm")} />
      </Field>
      <Button type="submit" size="lg" className="h-10 font-semibold" disabled={pending}>
        {pending && <Loader2 className="animate-spin" />} Salvar senha e acessar
      </Button>
    </form>
  );
}
