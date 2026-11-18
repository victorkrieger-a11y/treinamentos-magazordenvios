import type { Metadata } from "next";
import { PageHeader } from "@/components/common/page-header";
import { QuestionForm } from "@/components/forms/question-form";
import { requireSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { loadCategories } from "@/lib/data/performance";

export const metadata: Metadata = { title: "Nova questão" };

export default async function NewQuestionPage() {
  await requireSession(["supervisor"]);
  const categories = await loadCategories(await createClient());
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Nova questão" description="A questão fica disponível para novas avaliações assim que for salva." />
      <QuestionForm categories={categories} />
    </div>
  );
}
