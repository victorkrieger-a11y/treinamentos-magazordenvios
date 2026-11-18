"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckSquare, Loader2, Search, Send, Square } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Field } from "@/components/common/field";
import { Section } from "@/components/common/section";
import { quizSchema, type QuizFormInput } from "@/lib/validation/quizzes";
import { createQuiz } from "@/server/actions/quizzes";
import { DIFFICULTY_LABELS } from "@/lib/domain/status";
import { cn } from "@/lib/utils";

type Category = { id: string; name: string; available: number };
type Question = { id: string; code: string | null; statement: string; categoryId: string; topic: string; difficulty: "facil" | "media" | "dificil" };
type Collaborator = { id: string; name: string; guardianName: string | null; status: string };

export function QuizForm({
  categories,
  questions,
  standardCount,
  collaborators,
  defaults,
  isSupervisor,
}: {
  categories: Category[];
  questions: Question[];
  standardCount: number;
  collaborators: Collaborator[];
  defaults: { passingScore: number; maxAttempts: number; deadlineDate: string; preselected: string[] };
  isSupervisor: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const [collabSearch, setCollabSearch] = useState("");
  const [questionSearch, setQuestionSearch] = useState("");
  const [questionCat, setQuestionCat] = useState("");

  const form = useForm<QuizFormInput>({
    resolver: zodResolver(quizSchema),
    defaultValues: {
      title: "",
      description: "",
      mode: "standard",
      selectionType: "categories",
      categoryCounts: categories.map((c) => ({ categoryId: c.id, count: 0 })),
      questionIds: [],
      collaboratorIds: defaults.preselected,
      sendNow: true,
      availableDate: "",
      availableTime: "08:00",
      hasDeadline: true,
      deadlineDate: defaults.deadlineDate,
      deadlineTime: "23:59",
      maxAttempts: defaults.maxAttempts,
      showFeedback: true,
      allowIncomplete: true,
      passingScore: defaults.passingScore,
    },
  });
  const { errors } = form.formState;
  const [mode, selectionType, categoryCounts, questionIds, collaboratorIds, sendNow, hasDeadline] = useWatch({
    control: form.control,
    name: ["mode", "selectionType", "categoryCounts", "questionIds", "collaboratorIds", "sendNow", "hasDeadline"],
  });

  const totalQuestions =
    mode === "standard" ? standardCount : selectionType === "manual" ? questionIds.length : categoryCounts.reduce((s, c) => s + (Number(c.count) || 0), 0);

  const visibleCollaborators = useMemo(() => {
    const t = collabSearch.trim().toLowerCase();
    return collaborators.filter((c) => !t || c.name.toLowerCase().includes(t));
  }, [collaborators, collabSearch]);

  const visibleQuestions = useMemo(() => {
    const t = questionSearch.trim().toLowerCase();
    return questions.filter((q) => (!questionCat || q.categoryId === questionCat) && (!t || q.statement.toLowerCase().includes(t) || q.topic.toLowerCase().includes(t)));
  }, [questions, questionSearch, questionCat]);

  const toggle = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

  const onSubmit = form.handleSubmit(
    (values) => {
      setServerError(null);
      start(async () => {
        const res = await createQuiz(values);
        if (!res.ok) {
          setServerError(res.error);
          toast.error(res.error);
          return;
        }
        toast.success(res.message ?? "Avaliação enviada.");
        router.push(`/avaliacoes/${res.data!.id}`);
      });
    },
    () => toast.error("Revise os campos destacados."),
  );

  const catName = new Map(categories.map((c) => [c.id, c.name]));

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-6 xl:grid-cols-[1fr_320px]">
      <div className="grid gap-6">
        {serverError && <p role="alert" className="rounded-lg border border-mz-red/20 bg-mz-red-soft px-4 py-3 text-sm text-mz-red-strong">{serverError}</p>}

        <Section title="1. Identificação">
          <div className="grid gap-4">
            <Field id="title" label="Nome da avaliação" required error={errors.title?.message}>
              <Input id="title" placeholder="Ex.: Treinamento inicial — Magazord Envios" {...form.register("title")} aria-invalid={!!errors.title} />
            </Field>
            <Field id="description" label="Descrição" error={errors.description?.message} hint="Opcional. Exibida para o colaborador antes de iniciar.">
              <Textarea id="description" rows={3} {...form.register("description")} />
            </Field>
          </div>
        </Section>

        <Section title="2. Perguntas">
          <Controller
            control={form.control}
            name="mode"
            render={({ field }) => (
              <RadioGroup value={field.value} onValueChange={field.onChange} className="grid gap-3 sm:grid-cols-2" aria-label="Modo da avaliação">
                {[
                  { v: "standard", t: "Avaliação padrão", d: `Utiliza as ${standardCount} perguntas do conjunto padrão.` },
                  { v: "custom", t: "Avaliação personalizada", d: "Escolha categorias e quantidades ou selecione questões." },
                ].map((o) => (
                  <Label key={o.v} htmlFor={`mode-${o.v}`} className={cn("flex cursor-pointer items-start gap-3 rounded-lg border p-4 font-normal transition-colors", field.value === o.v ? "border-mz-red bg-mz-red-soft/40" : "hover:bg-muted")}>
                    <RadioGroupItem value={o.v} id={`mode-${o.v}`} className="mt-0.5" />
                    <span><span className="block text-sm font-semibold text-mz-chumbo">{o.t}</span><span className="text-xs text-muted-foreground">{o.d}</span></span>
                  </Label>
                ))}
              </RadioGroup>
            )}
          />

          {mode === "custom" && (
            <div className="mt-5 grid gap-4">
              <div className="inline-flex w-fit rounded-lg bg-muted p-1" role="tablist" aria-label="Forma de seleção">
                {(["categories", "manual"] as const).map((t) => (
                  <button key={t} type="button" role="tab" aria-selected={selectionType === t} onClick={() => form.setValue("selectionType", t)} className={cn("rounded-md px-3 py-1.5 text-xs font-medium transition-colors", selectionType === t ? "bg-white text-mz-chumbo shadow-sm" : "text-muted-foreground hover:text-mz-chumbo")}>
                    {t === "categories" ? "Por categoria (sorteio)" : "Seleção manual"}
                  </button>
                ))}
              </div>

              {selectionType === "categories" ? (
                <div className="grid gap-2">
                  <p className="text-xs text-muted-foreground">As questões de cada categoria são sorteadas entre as ativas. Todos os colaboradores recebem o mesmo conjunto (em ordem embaralhada).</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {categories.map((c, i) => (
                      <div key={c.id} className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
                        <label htmlFor={`cat-${c.id}`} className="text-sm">{c.name} <span className="text-xs text-muted-foreground">({c.available} disponíveis)</span></label>
                        <Input id={`cat-${c.id}`} type="number" min={0} max={c.available} className="h-8 w-20 text-right" {...form.register(`categoryCounts.${i}.count`, { valueAsNumber: true })} />
                      </div>
                    ))}
                  </div>
                  {errors.categoryCounts && <p role="alert" className="text-xs font-medium text-mz-red-strong">{errors.categoryCounts.message ?? errors.categoryCounts.root?.message}</p>}
                </div>
              ) : (
                <div className="grid gap-3">
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <div className="relative flex-1">
                      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input value={questionSearch} onChange={(e) => setQuestionSearch(e.target.value)} placeholder="Pesquisar questões" className="h-9 pl-9" aria-label="Pesquisar questões" />
                    </div>
                    <select value={questionCat} onChange={(e) => setQuestionCat(e.target.value)} className="h-9 rounded-lg border bg-white px-3 text-sm" aria-label="Filtrar por categoria">
                      <option value="">Todas as categorias</option>
                      {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    <Button type="button" variant="outline" size="sm" className="h-9" onClick={() => form.setValue("questionIds", [...new Set([...questionIds, ...visibleQuestions.map((q) => q.id)])])}>Selecionar visíveis</Button>
                  </div>
                  <ul className="max-h-96 divide-y overflow-y-auto rounded-lg border">
                    {visibleQuestions.map((q) => {
                      const checked = questionIds.includes(q.id);
                      return (
                        <li key={q.id}>
                          <label className={cn("flex cursor-pointer items-start gap-3 px-3 py-2.5 text-sm hover:bg-muted/60", checked && "bg-mz-red-soft/30")}>
                            <Checkbox checked={checked} onCheckedChange={() => form.setValue("questionIds", toggle(questionIds, q.id), { shouldValidate: true })} className="mt-0.5" />
                            <span className="min-w-0">
                              <span className="line-clamp-2 text-mz-chumbo">{q.code && <span className="mr-1 font-semibold">{q.code}.</span>}{q.statement}</span>
                              <span className="text-xs text-muted-foreground">{catName.get(q.categoryId)} · {q.topic} · {DIFFICULTY_LABELS[q.difficulty]}</span>
                            </span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                  {errors.questionIds && <p role="alert" className="text-xs font-medium text-mz-red-strong">{errors.questionIds.message}</p>}
                </div>
              )}
            </div>
          )}
        </Section>

        <Section
          title="3. Colaboradores"
          description={isSupervisor ? "Selecione um, vários ou todos os colaboradores ativos." : "Selecione colaboradores da sua equipe."}
          actions={
            <div className="flex gap-1">
              <Button type="button" variant="ghost" size="sm" onClick={() => form.setValue("collaboratorIds", collaborators.map((c) => c.id), { shouldValidate: true })}><CheckSquare /> {isSupervisor ? "Todos os ativos" : "Toda a equipe"}</Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => form.setValue("collaboratorIds", [])}><Square /> Limpar</Button>
            </div>
          }
        >
          <div className="relative mb-3">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={collabSearch} onChange={(e) => setCollabSearch(e.target.value)} placeholder="Pesquisar colaborador" className="h-9 pl-9" aria-label="Pesquisar colaborador" />
          </div>
          {collaborators.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum colaborador ativo disponível.</p>
          ) : (
            <ul className="grid max-h-80 gap-1 overflow-y-auto sm:grid-cols-2" aria-label="Colaboradores">
              {visibleCollaborators.map((c) => {
                const checked = collaboratorIds.includes(c.id);
                return (
                  <li key={c.id}>
                    <label className={cn("flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-sm transition-colors hover:bg-muted/60", checked && "border-mz-red/40 bg-mz-red-soft/30")}>
                      <Checkbox checked={checked} onCheckedChange={() => form.setValue("collaboratorIds", toggle(collaboratorIds, c.id), { shouldValidate: true })} />
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-mz-chumbo">{c.name}</span>
                        <span className="block truncate text-xs text-muted-foreground">{c.guardianName ? `Guardião: ${c.guardianName}` : "Sem guardião"}{c.status === "invited" ? " · aguardando 1º acesso" : ""}</span>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
          {errors.collaboratorIds && <p role="alert" className="mt-2 text-xs font-medium text-mz-red-strong">{errors.collaboratorIds.message}</p>}
        </Section>

        <Section title="4. Envio, prazo e regras">
          <div className="grid gap-5">
            <div className="grid gap-3">
              <div className="flex items-center gap-3">
                <Controller control={form.control} name="sendNow" render={({ field }) => <Switch id="sendNow" checked={field.value} onCheckedChange={field.onChange} />} />
                <Label htmlFor="sendNow" className="text-sm">Enviar imediatamente</Label>
              </div>
              {!sendNow && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field id="availableDate" label="Data de envio" error={errors.availableDate?.message}><Input id="availableDate" type="date" {...form.register("availableDate")} /></Field>
                  <Field id="availableTime" label="Horário (Brasília)"><Input id="availableTime" type="time" {...form.register("availableTime")} /></Field>
                </div>
              )}
            </div>
            <div className="grid gap-3">
              <div className="flex items-center gap-3">
                <Controller control={form.control} name="hasDeadline" render={({ field }) => <Switch id="hasDeadline" checked={field.value} onCheckedChange={field.onChange} />} />
                <Label htmlFor="hasDeadline" className="text-sm">Definir prazo de conclusão</Label>
              </div>
              {hasDeadline && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field id="deadlineDate" label="Prazo — data" error={errors.deadlineDate?.message}><Input id="deadlineDate" type="date" {...form.register("deadlineDate")} /></Field>
                  <Field id="deadlineTime" label="Prazo — horário (Brasília)"><Input id="deadlineTime" type="time" {...form.register("deadlineTime")} /></Field>
                </div>
              )}
            </div>
            <div className="grid items-start gap-4 sm:grid-cols-2">
              <Field id="maxAttempts" label="Tentativas permitidas" error={errors.maxAttempts?.message} hint="A melhor nota é considerada o resultado oficial.">
                <Input id="maxAttempts" type="number" min={1} max={10} {...form.register("maxAttempts", { valueAsNumber: true })} />
              </Field>
              <Field id="passingScore" label="Nota mínima de aprovação" error={errors.passingScore?.message}>
                <Input id="passingScore" type="number" min={0} max={100} step="0.01" {...form.register("passingScore", { valueAsNumber: true })} />
              </Field>
            </div>
            <div className="grid gap-3">
              <div className="flex items-start gap-3">
                <Controller control={form.control} name="showFeedback" render={({ field }) => <Switch id="showFeedback" checked={field.value} onCheckedChange={field.onChange} />} />
                <Label htmlFor="showFeedback" className="grid gap-0.5 text-sm font-normal"><span className="font-medium">Exibir gabarito após a conclusão</span><span className="text-xs text-muted-foreground">O gabarito nunca é exibido durante a avaliação.</span></Label>
              </div>
              <div className="flex items-start gap-3">
                <Controller control={form.control} name="allowIncomplete" render={({ field }) => <Switch id="allowIncomplete" checked={field.value} onCheckedChange={field.onChange} />} />
                <Label htmlFor="allowIncomplete" className="grid gap-0.5 text-sm font-normal"><span className="font-medium">Permitir finalizar com questões sem resposta</span><span className="text-xs text-muted-foreground">Questões sem resposta contam como erro.</span></Label>
              </div>
            </div>
          </div>
        </Section>
      </div>

      <aside className="xl:sticky xl:top-24 xl:self-start">
        <Section title="Resumo">
          <dl className="grid gap-3 text-sm">
            <div className="flex justify-between"><dt className="text-muted-foreground">Modo</dt><dd className="font-medium">{mode === "standard" ? "Padrão" : "Personalizada"}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">Questões</dt><dd className="font-display tabular text-lg font-semibold">{totalQuestions}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">Colaboradores</dt><dd className="font-display tabular text-lg font-semibold">{collaboratorIds.length}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">Envio</dt><dd className="font-medium">{sendNow ? "Imediato" : "Agendado"}</dd></div>
          </dl>
          <p className="mt-4 text-xs text-muted-foreground">Ao iniciar, a ordem das questões e das alternativas é embaralhada para cada colaborador. A correção é feita no servidor.</p>
          <Button type="submit" className="mt-5 w-full" size="lg" disabled={pending || totalQuestions === 0}>
            {pending ? <Loader2 className="animate-spin" /> : <Send />} Enviar avaliação
          </Button>
        </Section>
      </aside>
    </form>
  );
}
