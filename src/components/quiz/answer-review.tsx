"use client";

import { useState } from "react";
import { CheckCircle2, Lightbulb, XCircle } from "lucide-react";
import type { ReviewItem } from "@/lib/domain/quiz";
import { cn } from "@/lib/utils";

export function AnswerReview({ items }: { items: ReviewItem[] }) {
  const [onlyWrong, setOnlyWrong] = useState(false);
  const list = onlyWrong ? items.filter((i) => !i.is_correct) : items;
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">{items.filter((i) => i.is_correct).length} acertos e {items.filter((i) => !i.is_correct).length} erros</p>
        <div className="inline-flex rounded-lg bg-muted p-1" role="tablist" aria-label="Filtro de questões">
          {[false, true].map((v) => (
            <button key={String(v)} type="button" role="tab" aria-selected={onlyWrong === v} onClick={() => setOnlyWrong(v)} className={cn("rounded-md px-3 py-1.5 text-xs font-medium", onlyWrong === v ? "bg-white shadow-sm" : "text-muted-foreground")}>
              {v ? "Somente erradas" : "Todas"}
            </button>
          ))}
        </div>
      </div>
      <ol className="grid gap-4">
        {list.map((item) => {
          const selected = item.options.find((o) => o.id === item.selected_option_id);
          const correct = item.options.find((o) => o.is_correct);
          return (
            <li key={item.position} className={cn("rounded-xl border border-l-[3px] bg-white p-5", item.is_correct ? "border-l-mz-green-dark" : "border-l-mz-red")}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Questão {item.position} · {item.category} · {item.topic}</p>
                {item.is_correct ? (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-mz-green-dark"><CheckCircle2 className="size-4" /> Acerto</span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-mz-red-strong"><XCircle className="size-4" /> {selected ? "Erro" : "Sem resposta"}</span>
                )}
              </div>
              <p className="mt-2 text-sm leading-relaxed text-mz-chumbo">{item.statement}</p>
              <ul className="mt-3 grid gap-1.5">
                {item.options.map((o) => {
                  const isSel = o.id === item.selected_option_id;
                  return (
                    <li key={o.id} className={cn("flex items-start gap-2.5 rounded-lg border px-3 py-2 text-sm", o.is_correct ? "border-mz-green-dark/30 bg-mz-green-soft" : isSel ? "border-mz-red/30 bg-mz-red-soft" : "border-transparent")}>
                      <span className={cn("flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold", o.is_correct ? "bg-mz-green-dark text-white" : isSel ? "bg-mz-red text-white" : "bg-muted text-mz-gray-dark")}>{o.label}</span>
                      <span className="pt-0.5">
                        {o.text}
                        {(isSel || o.is_correct) && (
                          <span className="ml-2 text-xs font-semibold">
                            {o.is_correct && isSel ? "— sua resposta (correta)" : o.is_correct ? "— alternativa correta" : "— sua resposta"}
                          </span>
                        )}
                        {isSel && !o.is_correct && o.explanation && <span className="mt-1 block text-xs text-mz-red-strong">{o.explanation}</span>}
                      </span>
                    </li>
                  );
                })}
              </ul>
              <div className="mt-3 rounded-lg bg-muted/60 p-3 text-sm text-mz-chumbo">
                <p className="text-xs font-semibold text-mz-gray-dark">Explicação{correct ? ` (alternativa ${correct.label})` : ""}</p>
                <p className="mt-1 leading-relaxed">{item.explanation}</p>
                {!item.is_correct && item.study_tip && (
                  <p className="mt-2 flex items-start gap-1.5 text-xs text-mz-gray-dark"><Lightbulb className="mt-0.5 size-3.5 shrink-0 text-mz-yellow" /> {item.study_tip}</p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
