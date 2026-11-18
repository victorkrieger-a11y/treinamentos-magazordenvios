"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/common/field";
import { loginSchema } from "@/lib/validation/auth";
import { signIn } from "@/server/actions/auth";

export function LoginForm({ next }: { next?: string }) {
  const [error, setError] = useState<string | null>(null);
  const [show, setShow] = useState(false);
  const [pending, start] = useTransition();
  const form = useForm<z.input<typeof loginSchema>>({ resolver: zodResolver(loginSchema), defaultValues: { email: "", password: "" } });
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit((values) => {
    setError(null);
    start(async () => {
      const res = await signIn(values, next);
      if (res && !res.ok) setError(res.error);
    });
  });

  return (
    <form onSubmit={onSubmit} className="grid gap-4" noValidate>
      {error && (
        <p role="alert" className="rounded-lg border border-mz-red/20 bg-mz-red-soft px-3 py-2 text-sm text-mz-red-strong">
          {error}
        </p>
      )}
      <Field id="email" label="E-mail corporativo" error={errors.email?.message}>
        <Input id="email" type="email" autoComplete="email" autoFocus className="h-10" aria-invalid={!!errors.email} {...form.register("email")} />
      </Field>
      <Field id="password" label="Senha" error={errors.password?.message}>
        <div className="relative">
          <Input id="password" type={show ? "text" : "password"} autoComplete="current-password" className="h-10 pr-10" aria-invalid={!!errors.password} {...form.register("password")} />
          <button type="button" onClick={() => setShow((s) => !s)} className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground hover:text-mz-chumbo" aria-label={show ? "Ocultar senha" : "Mostrar senha"}>
            {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
      </Field>
      <div className="flex justify-end">
        <Link href="/recuperar-senha" className="text-xs font-medium text-mz-red-strong hover:underline">Esqueci minha senha</Link>
      </div>
      <Button type="submit" size="lg" className="h-10 font-semibold" disabled={pending}>
        {pending && <Loader2 className="animate-spin" />} Entrar
      </Button>
    </form>
  );
}
