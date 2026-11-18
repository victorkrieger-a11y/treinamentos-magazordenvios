import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/common/page-header";
import { Section } from "@/components/common/section";
import { QuestionsBrowser, type QuestionRow } from "@/components/tables/questions-browser";
import { requireSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { loadCategories } from "@/lib/data/performance";

export const metadata: Metadata = { title: "Banco de perguntas" };

export default async function QuestionsPage() {
  const { profile } = await requireSession(["supervisor", "guardian"]);
  const canEdit = profile.role === "supervisor";
  const supabase = await createClient();
  const [categories, { data }] = await Promise.all([
    loadCategories(supabase),
    supabase.from("questions").select("*, question_options(option_label, option_text, is_correct)").order("code", { nullsFirst: false }).order("created_at"),
  ]);
  const catName = new Map(categories.map((c) => [c.id, c.name]));
  const rows: QuestionRow[] = (data ?? []).map((q) => ({
    id: q.id,
    code: q.code,
    statement: q.statement,
    categoryId: q.category_id,
    categoryName: catName.get(q.category_id) ?? "—",
    topic: q.topic,
    difficulty: q.difficulty,
    explanation: q.explanation,
    isActive: q.is_active,
    inStandardSet: q.in_standard_set,
    version: q.version,
    options: [...q.question_options].sort((a, b) => a.option_label.localeCompare(b.option_label)).map((o) => ({ label: o.option_label, text: o.option_text, isCorrect: o.is_correct })),
  }));
  const counts = categories.map((c) => ({ ...c, active: rows.filter((r) => r.categoryId === c.id && r.isActive).length }));

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Banco de perguntas"
        description={canEdit ? "Questões armazenadas no banco de dados. Edições geram nova versão e não alteram avaliações já aplicadas." : "Consulta das questões disponíveis para as avaliações."}
        actions={canEdit && <Button asChild><Link href="/perguntas/nova"><Plus /> Nova questão</Link></Button>}
      />
      <Section title="Questões ativas por categoria">
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
          {counts.map((c) => (
            <li key={c.id} className="rounded-lg border px-3 py-2">
              <p className="truncate text-xs text-muted-foreground">{c.name}</p>
              <p className="font-display tabular text-xl font-semibold text-mz-chumbo">{c.active}</p>
            </li>
          ))}
          <li className="rounded-lg border border-mz-red/20 bg-mz-red-soft/40 px-3 py-2">
            <p className="text-xs text-mz-red-strong">Total ativo</p>
            <p className="font-display tabular text-xl font-semibold text-mz-chumbo">{rows.filter((r) => r.isActive).length}</p>
          </li>
        </ul>
      </Section>
      <Section>
        <QuestionsBrowser rows={rows} categories={categories} canEdit={canEdit} />
      </Section>
    </div>
  );
}
