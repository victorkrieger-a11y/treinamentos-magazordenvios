"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Loader2, MailCheck } from "lucide-react";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/common/field";
import { recoverSchema } from "@/lib/validation/auth";
import { requestPasswordReset } from "@/server/actions/auth";

export default function RecoverPage() {
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const form = useForm<z.input<typeof recoverSchema>>({ resolver: zodResolver(recoverSchema), defaultValues: { email: "" } });

  const onSubmit = form.handleSubmit((values) =>
    start(async () => {
      const res = await requestPasswordReset(values);
      setMessage(res.ok ? { ok: true, text: res.message ?? "" } : { ok: false, text: res.error });
    }),
  );

  return (
    <div>
      <h1 className="text-2xl font-bold text-mz-chumbo">Recuperar senha</h1>
      <p className="mb-6 mt-1 text-sm text-muted-foreground">Informe seu e-mail corporativo para receber um link de redefinição.</p>
      {message?.ok ? (
        <div role="status" className="flex gap-3 rounded-lg border border-mz-green-dark/20 bg-mz-green-soft p-4 text-sm text-mz-green-dark">
          <MailCheck className="size-5 shrink-0" aria-hidden /> {message.text}
        </div>
      ) : (
        <form onSubmit={onSubmit} className="grid gap-4" noValidate>
          {message && <p role="alert" className="rounded-lg bg-mz-red-soft px-3 py-2 text-sm text-mz-red-strong">{message.text}</p>}
          <Field id="email" label="E-mail corporativo" error={form.formState.errors.email?.message}>
            <Input id="email" type="email" autoComplete="email" className="h-10" {...form.register("email")} />
          </Field>
          <Button type="submit" size="lg" className="h-10 font-semibold" disabled={pending}>
            {pending && <Loader2 className="animate-spin" />} Enviar link
          </Button>
        </form>
      )}
      <Link href="/login" className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-mz-gray-dark hover:text-mz-chumbo">
        <ArrowLeft className="size-4" /> Voltar para o login
      </Link>
    </div>
  );
}
