"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, Clock, CloudOff, Flag, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { countUnanswered, type AttemptPayload } from "@/lib/domain/quiz";
import { finalizeAttempt, saveAnswer } from "@/server/actions/attempts";
import { cn } from "@/lib/utils";

type SaveState = "idle" | "saving" | "saved" | "error";

function useElapsed(startedAt: string) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const s = Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return { text: `${h > 0 ? `${h}:` : ""}${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`, now };
}

export function QuizRunner({ data }: { data: AttemptPayload }) {
  const questions = data.questions;
  const [index, setIndex] = useState(() => Math.max(0, questions.findIndex((q) => !q.selected_option_id)));
  const [answers, setAnswers] = useState<Record<string, string | null>>(() => Object.fromEntries(questions.map((q) => [q.answer_id, q.selected_option_id])));
  const [save, setSave] = useState<SaveState>("idle");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [finishing, startFinish] = useTransition();
  const inflight = useRef(0);
  const elapsed = useElapsed(data.started_at);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const q = questions[index];
  const answered = questions.length - countUnanswered(answers, questions);
  const unanswered = questions.length - answered;
  const overdue = data.due_at ? new Date(data.due_at).getTime() < elapsed.now : false;

  const select = useCallback(
    async (optionId: string) => {
      const prev = answers[q.answer_id];
      if (prev === optionId) return;
      setAnswers((a) => ({ ...a, [q.answer_id]: optionId }));
      setSave("saving");
      inflight.current++;
      const res = await saveAnswer(data.attempt_id, q.answer_id, optionId);
      inflight.current--;
      if (!res.ok) {
        setAnswers((a) => ({ ...a, [q.answer_id]: prev }));
        setSave("error");
        toast.error(res.error);
      } else if (inflight.current === 0) setSave("saved");
    },
    [answers, q, data.attempt_id],
  );

  const go = (i: number) => {
    setIndex(Math.min(questions.length - 1, Math.max(0, i)));
    requestAnimationFrame(() => headingRef.current?.focus());
  };

  // Atalhos: setas para navegar, 1–4 / A–D para responder.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (confirmOpen || e.ctrlKey || e.metaKey || e.altKey) return;
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      const map: Record<string, number> = { "1": 0, "2": 1, "3": 2, "4": 3, a: 0, b: 1, c: 2, d: 3 };
      const k = e.key.toLowerCase();
      if (k in map && q.options[map[k]]) select(q.options[map[k]].id);
      else if (e.key === "ArrowRight" && (e.target as HTMLElement).getAttribute("role") !== "radio") go(index + 1);
      else if (e.key === "ArrowLeft" && (e.target as HTMLElement).getAttribute("role") !== "radio") go(index - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const finish = () =>
    startFinish(async () => {
      const res = await finalizeAttempt(data.attempt_id);
      if (res && !res.ok) toast.error(res.error);
    });

  const progress = useMemo(() => Math.round((answered / questions.length) * 100), [answered, questions.length]);
  const blocked = !data.quiz.allow_incomplete && unanswered > 0;

  return (
    <div className="mx-auto grid max-w-5xl gap-5 lg:grid-cols-[1fr_260px]">
      <div className="grid gap-4">
        <header className="rounded-xl border bg-card p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h1 className="text-base font-semibold text-mz-chumbo">{data.quiz.title}</h1>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1" aria-live="polite">
                {save === "saving" && <><Loader2 className="size-3.5 animate-spin" /> Salvando...</>}
                {save === "saved" && <><CheckCircle2 className="size-3.5 text-mz-green-dark" /> Resposta salva</>}
                {save === "error" && <><CloudOff className="size-3.5 text-mz-red" /> Falha ao salvar</>}
              </span>
              <span className="tabular inline-flex items-center gap-1" title="Tempo decorrido"><Clock className="size-3.5" /> {elapsed.text}</span>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-3">
            <Progress value={progress} className="h-2 flex-1 [&>div]:bg-mz-red" aria-label={`${answered} de ${questions.length} questões respondidas`} />
            <span className="tabular text-xs font-medium text-mz-gray-dark">{answered}/{questions.length}</span>
          </div>
          {overdue && <p className="mt-2 flex items-center gap-1 text-xs font-medium text-mz-red-strong"><AlertTriangle className="size-3.5" /> O prazo foi encerrado. Finalize para registrar as respostas já salvas.</p>}
        </header>

        <section className="rounded-xl border bg-card p-5 sm:p-6" aria-labelledby="question-title">
          <p className="text-xs font-semibold uppercase tracking-wide text-mz-red">Questão {index + 1} de {questions.length} <span className="ml-2 font-normal normal-case tracking-normal text-muted-foreground">· {q.category}</span></p>
          <h2 id="question-title" ref={headingRef} tabIndex={-1} className="mt-3 text-base leading-relaxed text-mz-chumbo outline-none sm:text-lg">{q.statement}</h2>

          <div role="radiogroup" aria-labelledby="question-title" className="mt-5 grid gap-2.5">
            {q.options.map((o, i) => {
              const checked = answers[q.answer_id] === o.id;
              return (
                <button
                  key={o.id}
                  type="button"
                  role="radio"
                  aria-checked={checked}
                  tabIndex={checked || (!answers[q.answer_id] && i === 0) ? 0 : -1}
                  onClick={() => select(o.id)}
                  onKeyDown={(e) => {
                    if (e.key === "ArrowDown" || e.key === "ArrowRight") {
                      e.preventDefault();
                      const next = q.options[(i + 1) % 4];
                      select(next.id);
                      (e.currentTarget.parentElement?.children[(i + 1) % 4] as HTMLElement)?.focus();
                    } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
                      e.preventDefault();
                      const prev = q.options[(i + 3) % 4];
                      select(prev.id);
                      (e.currentTarget.parentElement?.children[(i + 3) % 4] as HTMLElement)?.focus();
                    }
                  }}
                  className={cn(
                    "group flex w-full items-start gap-3 rounded-xl border px-4 py-3.5 text-left text-sm transition-all focus-visible:ring-2 focus-visible:ring-mz-red focus-visible:outline-none",
                    checked ? "border-mz-red bg-mz-red-soft/50 shadow-sm" : "border-border bg-white hover:border-mz-gray hover:bg-muted/40",
                  )}
                >
                  <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-bold transition-colors", checked ? "border-mz-red bg-mz-red text-white" : "border-mz-gray text-mz-gray-dark group-hover:border-mz-chumbo")}>{o.label}</span>
                  <span className="pt-1 leading-relaxed text-mz-chumbo">{o.text}</span>
                </button>
              );
            })}
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t pt-5">
            <Button variant="outline" onClick={() => go(index - 1)} disabled={index === 0}><ChevronLeft /> Anterior</Button>
            <div className="flex gap-2">
              {index < questions.length - 1 && <Button variant="secondary" onClick={() => go(index + 1)}>Próxima <ChevronRight /></Button>}
              <Button onClick={() => setConfirmOpen(true)} disabled={finishing}><Flag /> Finalizar avaliação</Button>
            </div>
          </div>
        </section>
        <p className="hidden text-center text-[11px] text-muted-foreground sm:block">Atalhos: teclas 1–4 ou A–D para responder · setas ← → para navegar</p>
      </div>

      <aside className="lg:sticky lg:top-24 lg:self-start">
        <nav aria-label="Navegação entre questões" className="rounded-xl border bg-card p-4">
          <p className="mb-3 text-xs font-semibold text-mz-chumbo">Questões</p>
          <ol className="grid grid-cols-6 gap-1.5 sm:grid-cols-10 lg:grid-cols-5">
            {questions.map((item, i) => {
              const done = !!answers[item.answer_id];
              return (
                <li key={item.answer_id}>
                  <button
                    type="button"
                    onClick={() => go(i)}
                    aria-current={i === index ? "step" : undefined}
                    aria-label={`Questão ${i + 1}${done ? ", respondida" : ", sem resposta"}`}
                    className={cn(
                      "tabular flex h-8 w-full items-center justify-center rounded-md text-xs font-semibold transition-colors",
                      i === index ? "ring-2 ring-mz-red ring-offset-1" : "",
                      done ? "bg-mz-chumbo text-white" : "bg-muted text-mz-gray-dark hover:bg-border",
                    )}
                  >
                    {i + 1}
                  </button>
                </li>
              );
            })}
          </ol>
          <div className="mt-3 flex gap-4 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1"><span className="size-2.5 rounded-sm bg-mz-chumbo" /> Respondida</span>
            <span className="flex items-center gap-1"><span className="size-2.5 rounded-sm bg-muted ring-1 ring-border" /> Pendente</span>
          </div>
        </nav>
      </aside>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Finalizar avaliação</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="grid gap-3 text-sm">
                <p>Tem certeza de que deseja finalizar sua avaliação? Após a confirmação, suas respostas serão enviadas para correção.</p>
                {unanswered > 0 && (
                  <p className="flex items-start gap-2 rounded-lg bg-mz-yellow-soft px-3 py-2 text-mz-yellow-text">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                    {blocked
                      ? `Você ainda tem ${unanswered} questão(ões) sem resposta. Esta avaliação exige que todas sejam respondidas.`
                      : `Você ainda tem ${unanswered} questão(ões) sem resposta. Elas serão consideradas incorretas.`}
                  </p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={finishing}>Continuar respondendo</AlertDialogCancel>
            <AlertDialogAction disabled={finishing || blocked} onClick={(e) => { e.preventDefault(); finish(); }}>
              {finishing && <Loader2 className="animate-spin" />} Confirmar e finalizar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
