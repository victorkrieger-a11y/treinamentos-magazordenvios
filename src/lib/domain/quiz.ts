/** Tipos do conteúdo da tentativa entregue ao navegador (SEM gabarito). */
export type AttemptOption = { id: string; label: string; text: string };
export type AttemptQuestion = {
  answer_id: string;
  position: number;
  statement: string;
  category: string;
  selected_option_id: string | null;
  options: AttemptOption[];
};
export type AttemptPayload = {
  attempt_id: string;
  assignment_id: string;
  status: "in_progress" | "completed" | "abandoned";
  attempt_number: number;
  started_at: string;
  due_at: string | null;
  quiz: { title: string; description: string | null; allow_incomplete: boolean; max_attempts: number };
  questions: AttemptQuestion[];
};

export type ReviewItem = {
  position: number;
  statement: string;
  category: string;
  topic: string;
  difficulty: "facil" | "media" | "dificil";
  explanation: string;
  study_tip: string | null;
  is_correct: boolean;
  selected_option_id: string | null;
  options: { id: string; label: string; text: string; is_correct: boolean; explanation: string | null }[];
};

export function countUnanswered(answers: Record<string, string | null>, questions: { answer_id: string }[]) {
  return questions.filter((q) => !answers[q.answer_id]).length;
}
