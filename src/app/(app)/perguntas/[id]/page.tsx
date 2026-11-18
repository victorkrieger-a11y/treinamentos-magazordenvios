import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/common/page-header";
import { QuestionForm } from "@/components/forms/question-form";
import { requireSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { loadCategories } from "@/lib/data/performance";
import { LABELS } from "@/lib/validation/questions";
import { uuid } from "@/lib/validation/common";

export const metadata: Metadata = { title: "Editar questão" };

export default async function EditQuestionPage({ params }: { params: Promise<{ id: string }> }) {
  await requireSession(["supervisor"]);
  const { id } = await params;
  if (!uuid.safeParse(id).success) notFound();
  const supabase = await createClient();
  const [categories, { data: q }] = await Promise.all([
    loadCategories(supabase),
    supabase.from("questions").select("*, question_options(*)").eq("id", id).maybeSingle(),
  ]);
  if (!q) notFound();
  const opt = (l: string) => q.question_options.find((o) => o.option_label === l);
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title={`Editar questão${q.code ? ` ${q.code}` : ""}`} />
      <QuestionForm
        categories={categories}
        initial={{
          id: q.id,
          version: q.version,
          categoryId: q.category_id,
          topic: q.topic,
          statement: q.statement,
          difficulty: q.difficulty,
          explanation: q.explanation,
          studyTip: q.study_tip ?? "",
          inStandardSet: q.in_standard_set,
          isActive: q.is_active,
          correctLabel: (q.question_options.find((o) => o.is_correct)?.option_label ?? "A") as (typeof LABELS)[number],
          options: LABELS.map((label) => ({ label, text: opt(label)?.option_text ?? "", explanation: opt(label)?.explanation ?? "" })),
        }}
      />
    </div>
  );
}
