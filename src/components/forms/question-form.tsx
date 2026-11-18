"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field } from "@/components/common/field";
import { Section } from "@/components/common/section";
import { LABELS, questionSchema, type QuestionInput } from "@/lib/validation/questions";
import { DIFFICULTY_LABELS } from "@/lib/domain/status";
import { saveQuestion } from "@/server/actions/questions";
import { cn } from "@/lib/utils";

export function QuestionForm({ categories, initial }: { categories: { id: string; name: string }[]; initial?: QuestionInput & { version?: number } }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<QuestionInput>({
    resolver: zodResolver(questionSchema),
    defaultValues: initial ?? {
      id: null,
      categoryId: "",
      topic: "",
      statement: "",
      difficulty: "media",
      explanation: "",
      studyTip: "",
      inStandardSet: false,
      isActive: true,
      correctLabel: undefined,
      options: LABELS.map((label) => ({ label, text: "", explanation: "" })),
    },
  });
  const { errors } = form.formState;
  const correct = form.watch("correctLabel");

  const onSubmit = form.handleSubmit(
    (values) =>
      start(async () => {
        setError(null);
        const res = await saveQuestion(values);
        if (!res.ok) { setError(res.error); return; }
        toast.success(res.message ?? "Salvo.");
        router.push("/perguntas");
        router.refresh();
      }),
    () => toast.error("Revise os campos destacados."),
  );

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-6">
      {initial?.id && (
        <p className="rounded-lg border border-mz-blue/20 bg-mz-blue-soft px-4 py-3 text-sm text-mz-blue">
          Versão atual: {initial.version}. Ao salvar, uma nova versão será registrada. Avaliações já enviadas mantêm o conteúdo original (gabarito e explicações).
        </p>
      )}
      {error && <p role="alert" className="rounded-lg bg-mz-red-soft px-4 py-3 text-sm text-mz-red-strong">{error}</p>}
      <Section title="Classificação">
        <div className="grid gap-4 md:grid-cols-3">
          <Field id="categoryId" label="Categoria" required error={errors.categoryId?.message}>
            <Controller control={form.control} name="categoryId" render={({ field }) => (
              <Select value={field.value || undefined} onValueChange={field.onChange}>
                <SelectTrigger id="categoryId" className="w-full" aria-invalid={!!errors.categoryId}><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            )} />
          </Field>
          <Field id="topic" label="Assunto" required error={errors.topic?.message} hint="Ex.: Acareação, Troca de etiqueta">
            <Input id="topic" {...form.register("topic")} />
          </Field>
          <Field id="difficulty" label="Dificuldade" required>
            <Controller control={form.control} name="difficulty" render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="difficulty" className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(DIFFICULTY_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            )} />
          </Field>
        </div>
      </Section>
      <Section title="Enunciado e alternativas" description="Marque a única alternativa correta.">
        <div className="grid gap-4">
          <Field id="statement" label="Enunciado" required error={errors.statement?.message}>
            <Textarea id="statement" rows={4} {...form.register("statement")} />
          </Field>
          <Controller control={form.control} name="correctLabel" render={({ field }) => (
            <RadioGroup value={field.value ?? ""} onValueChange={field.onChange} className="grid gap-3" aria-label="Alternativa correta">
              {LABELS.map((label, i) => (
                <div key={label} className={cn("grid gap-2 rounded-lg border p-3", correct === label && "border-mz-green-dark/40 bg-mz-green-soft/50")}>
                  <div className="flex items-center gap-3">
                    <RadioGroupItem value={label} id={`correct-${label}`} aria-label={`Marcar alternativa ${label} como correta`} />
                    <Label htmlFor={`opt-${label}`} className="w-5 font-bold">{label}</Label>
                    <Input id={`opt-${label}`} {...form.register(`options.${i}.text`)} placeholder={`Texto da alternativa ${label}`} aria-invalid={!!errors.options?.[i]?.text} />
                  </div>
                  {errors.options?.[i]?.text && <p className="pl-14 text-xs text-mz-red-strong">{errors.options[i]?.text?.message}</p>}
                  <Input {...form.register(`options.${i}.explanation`)} placeholder="Explicação do erro (opcional) — exibida quando esta alternativa for escolhida" className="ml-14 w-[calc(100%-3.5rem)] text-xs" aria-label={`Explicação do erro da alternativa ${label}`} />
                </div>
              ))}
            </RadioGroup>
          )} />
          {errors.correctLabel && <p role="alert" className="text-xs font-medium text-mz-red-strong">{errors.correctLabel.message}</p>}
        </div>
      </Section>
      <Section title="Explicação e reforço">
        <div className="grid gap-4">
          <Field id="explanation" label="Explicação da resposta correta" required error={errors.explanation?.message}>
            <Textarea id="explanation" rows={3} {...form.register("explanation")} />
          </Field>
          <Field id="studyTip" label="Orientação de estudo" error={errors.studyTip?.message} hint="Recomendação exibida quando a questão é respondida incorretamente.">
            <Input id="studyTip" {...form.register("studyTip")} />
          </Field>
          <div className="flex flex-wrap gap-6">
            <div className="flex items-center gap-3">
              <Controller control={form.control} name="isActive" render={({ field }) => <Switch id="isActive" checked={field.value} onCheckedChange={field.onChange} />} />
              <Label htmlFor="isActive">Questão ativa</Label>
            </div>
            <div className="flex items-center gap-3">
              <Controller control={form.control} name="inStandardSet" render={({ field }) => <Switch id="inStandardSet" checked={field.value} onCheckedChange={field.onChange} />} />
              <Label htmlFor="inStandardSet">Incluir na avaliação padrão</Label>
            </div>
          </div>
        </div>
      </Section>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.back()}>Cancelar</Button>
        <Button type="submit" disabled={pending}>{pending ? <Loader2 className="animate-spin" /> : <Save />} Salvar questão</Button>
      </div>
    </form>
  );
}
