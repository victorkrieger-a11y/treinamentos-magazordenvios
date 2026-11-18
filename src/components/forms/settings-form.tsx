"use client";

import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/common/field";
import { settingsSchema, type SettingsInput } from "@/lib/validation/settings";
import { updateSettings } from "@/server/actions/settings";

export function SettingsForm({ initial }: { initial: SettingsInput }) {
  const [pending, start] = useTransition();
  const form = useForm<SettingsInput>({ resolver: zodResolver(settingsSchema), defaultValues: initial });
  const { errors } = form.formState;
  const num = { valueAsNumber: true } as const;
  return (
    <form
      noValidate
      onSubmit={form.handleSubmit((v) => start(async () => {
        const res = await updateSettings(v);
        if (res.ok) toast.success(res.message ?? "Salvo."); else toast.error(res.error);
      }))}
      className="grid gap-5"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="passingScore" label="Meta mínima de aprovação (pontos)" error={errors.passingScore?.message} hint="Padrão para novas avaliações. Avaliações já enviadas mantêm a meta original.">
          <Input id="passingScore" type="number" step="0.01" min={0} max={100} {...form.register("passingScore", num)} />
        </Field>
        <Field id="attentionScore" label="Limite de atenção (pontos)" error={errors.attentionScore?.message} hint="Notas abaixo deste valor geram alerta de reforço.">
          <Input id="attentionScore" type="number" step="0.01" min={0} max={100} {...form.register("attentionScore", num)} />
        </Field>
        <Field id="minAnswers" label="Mínimo de respostas por categoria para diagnóstico" error={errors.minAnswersForDiagnosis?.message} hint="Abaixo disso, o sistema informa que não há dados suficientes.">
          <Input id="minAnswers" type="number" min={1} max={50} {...form.register("minAnswersForDiagnosis", num)} />
        </Field>
        <Field id="maxAttempts" label="Tentativas padrão por avaliação" error={errors.defaultMaxAttempts?.message}>
          <Input id="maxAttempts" type="number" min={1} max={10} {...form.register("defaultMaxAttempts", num)} />
        </Field>
        <Field id="dueDays" label="Prazo padrão (dias após o envio)" error={errors.defaultDueDays?.message}>
          <Input id="dueDays" type="number" min={1} max={365} {...form.register("defaultDueDays", num)} />
        </Field>
      </div>
      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>{pending ? <Loader2 className="animate-spin" /> : <Save />} Salvar configurações</Button>
      </div>
    </form>
  );
}
