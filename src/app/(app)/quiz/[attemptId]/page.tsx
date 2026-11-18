import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { QuizRunner } from "@/components/quiz/quiz-runner";
import { requireSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import type { AttemptPayload } from "@/lib/domain/quiz";
import { uuid } from "@/lib/validation/common";

export const metadata: Metadata = { title: "Avaliação em andamento" };
export const dynamic = "force-dynamic";

export default async function QuizPage({ params }: { params: Promise<{ attemptId: string }> }) {
  await requireSession(["collaborator"]);
  const { attemptId } = await params;
  if (!uuid.safeParse(attemptId).success) notFound();
  const supabase = await createClient();
  await supabase.rpc("expire_overdue");
  const { data, error } = await supabase.rpc("get_attempt", { p_attempt_id: attemptId });
  if (error || !data) notFound();
  const payload = data as unknown as AttemptPayload;
  if (payload.status === "completed") redirect(`/resultado/${attemptId}`);
  if (payload.status === "abandoned") redirect("/minhas-avaliacoes");
  return <QuizRunner data={payload} />;
}
