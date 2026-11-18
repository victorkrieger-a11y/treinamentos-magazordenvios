import type { Metadata } from "next";
import { PageHeader } from "@/components/common/page-header";
import { QuizForm } from "@/components/forms/quiz-form";
import { requireSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { loadCategories, loadCollaborators, loadSettings } from "@/lib/data/performance";
import { todayInBrasilia } from "@/lib/domain/format";

export const metadata: Metadata = { title: "Nova avaliação" };

export default async function NewQuizPage({ searchParams }: { searchParams: Promise<{ colaborador?: string }> }) {
  const { profile } = await requireSession(["supervisor", "guardian"]);
  const { colaborador } = await searchParams;
  const supabase = await createClient();
  const [settings, categories, collaborators, { data: questions }] = await Promise.all([
    loadSettings(supabase),
    loadCategories(supabase),
    loadCollaborators(supabase),
    supabase.from("questions").select("id, code, statement, category_id, topic, difficulty, in_standard_set").eq("is_active", true).order("code", { nullsFirst: false }),
  ]);
  // Guardião: somente a própria equipe (RLS já restringe a lista).
  const eligible = collaborators.filter((c) => c.status !== "inactive" && (profile.role === "supervisor" || c.guardianId === profile.id));
  const qs = questions ?? [];

  return (
    <>
      <PageHeader title="Nova avaliação" description="Configure e envie uma avaliação em poucos passos." />
      <QuizForm
        isSupervisor={profile.role === "supervisor"}
        categories={categories.map((c) => ({ id: c.id, name: c.name, available: qs.filter((q) => q.category_id === c.id).length }))}
        questions={qs.map((q) => ({ id: q.id, code: q.code, statement: q.statement, categoryId: q.category_id, topic: q.topic, difficulty: q.difficulty }))}
        standardCount={qs.filter((q) => q.in_standard_set).length}
        collaborators={eligible.map((c) => ({ id: c.id, name: c.fullName, guardianName: c.guardianName, status: c.status }))}
        defaults={{
          passingScore: settings.passingScore,
          maxAttempts: settings.defaultMaxAttempts,
          deadlineDate: todayInBrasilia(settings.defaultDueDays),
          preselected: colaborador && eligible.some((c) => c.id === colaborador) ? [colaborador] : [],
        }}
      />
    </>
  );
}
