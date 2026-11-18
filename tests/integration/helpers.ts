import { config } from "dotenv";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { inject } from "vitest";
import type { Database } from "../../src/types/database";

config({ path: ".env.local", quiet: true });

export type Client = SupabaseClient<Database>;
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const ids = () => inject("ids");

export function anon(): Client {
  return createClient<Database>(url, anonKey, { auth: { persistSession: false } });
}

export function admin(): Client {
  return createClient<Database>(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
}

const cache = new Map<string, Client>();
export async function as(user: "supervisor" | "guardiao1" | "guardiao2" | "colab1" | "colab2" | "colab3" | "colab4"): Promise<Client> {
  if (cache.has(user)) return cache.get(user)!;
  const c = anon();
  const { error } = await c.auth.signInWithPassword({ email: `${user}@teste.local`, password: inject("password") });
  if (error) throw new Error(`login ${user}: ${error.message}`);
  cache.set(user, c);
  return c;
}

type Snapshot = { options: { id: string; label: string; is_correct: boolean }[] };

/** Gabarito da avaliação (lido como supervisor — colaboradores não têm acesso). */
export async function answerKey(quizId: string) {
  const sup = await as("supervisor");
  const { data, error } = await sup.from("quiz_questions").select("id, snapshot").eq("quiz_id", quizId);
  if (error) throw error;
  const key = new Map<string, { correct: string; wrong: string }>();
  for (const row of data!) {
    const snap = row.snapshot as unknown as Snapshot;
    key.set(row.id, {
      correct: snap.options.find((o) => o.is_correct)!.id,
      wrong: snap.options.find((o) => !o.is_correct)!.id,
    });
  }
  return key;
}

export async function createQuiz(
  by: Client,
  collaboratorIds: string[],
  extra: Record<string, unknown> = {},
): Promise<string> {
  const { data, error } = await by.rpc("create_quiz", {
    p: { title: `Teste ${Date.now()} ${Math.random().toString(36).slice(2, 6)}`, mode: "standard", collaborator_ids: collaboratorIds, ...extra },
  });
  if (error) throw new Error(error.message);
  return data!;
}

export async function assignmentFor(quizId: string, collaboratorId: string) {
  const { data } = await admin().from("quiz_assignments").select("id").eq("quiz_id", quizId).eq("collaborator_id", collaboratorId).single();
  return data!.id;
}

/** Responde uma tentativa acertando exatamente `correctCount` questões. */
export async function answerAttempt(c: Client, attemptId: string, quizId: string, correctCount: number) {
  const key = await answerKey(quizId);
  const { data: rows } = await admin().from("attempt_answers").select("id, quiz_question_id, position").eq("attempt_id", attemptId).order("position");
  let i = 0;
  for (const row of rows!) {
    const k = key.get(row.quiz_question_id)!;
    const option = i < correctCount ? k.correct : k.wrong;
    const { error } = await c.rpc("save_answer", { p_attempt_id: attemptId, p_answer_id: row.id, p_option_id: option });
    if (error) throw new Error(error.message);
    i++;
  }
}
