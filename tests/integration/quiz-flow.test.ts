import { describe, expect, it } from "vitest";
import { admin, answerAttempt, answerKey, as, assignmentFor, createQuiz, ids } from "./helpers";

type AttemptPayload = {
  questions: { answer_id: string; position: number; statement: string; options: { id: string; label: string; text: string }[] }[];
};

describe("Fluxo completo da avaliação", () => {
  it("envio, recebimento, randomização, persistência, correção e histórico", async () => {
    const sup = await as("supervisor");
    const c1 = await as("colab1");
    const quizId = await createQuiz(sup, [ids().colab1], { show_feedback: true });

    // Recebimento + notificação
    const assignmentId = await assignmentFor(quizId, ids().colab1);
    const { data: mine } = await c1.from("quiz_assignments").select("id, status").eq("id", assignmentId);
    expect(mine).toEqual([{ id: assignmentId, status: "pending" }]);
    const { data: notes } = await c1.from("notifications").select("type, entity_id").eq("entity_id", assignmentId);
    expect(notes).toEqual([{ type: "quiz_assigned", entity_id: assignmentId }]);

    // Início (idempotente: retomar não cria nova tentativa)
    const { data: attemptId, error } = await c1.rpc("start_attempt", { p_assignment_id: assignmentId });
    expect(error).toBeNull();
    const { data: again } = await c1.rpc("start_attempt", { p_assignment_id: assignmentId });
    expect(again).toBe(attemptId);

    // Conteúdo SEM gabarito
    const { data: payload } = await c1.rpc("get_attempt", { p_attempt_id: attemptId! });
    const raw = JSON.stringify(payload);
    expect(raw).not.toMatch(/is_correct/);
    expect(raw).not.toMatch(/explanation/);
    expect(raw).not.toMatch(/study_tip/);
    const attempt = payload as unknown as AttemptPayload;
    expect(attempt.questions).toHaveLength(30);
    expect(attempt.questions.every((q) => q.options.length === 4)).toBe(true);
    expect(attempt.questions.every((q) => q.options.map((o) => o.label).join("") === "ABCD")).toBe(true);

    // Randomização: ordem das questões e das alternativas gravadas
    const { data: rows } = await admin()
      .from("attempt_answers")
      .select("position, option_order, quiz_question:quiz_questions(question_order, snapshot)")
      .eq("attempt_id", attemptId!)
      .order("position");
    const presentedOrder = rows!.map((r) => r.quiz_question!.question_order);
    expect(presentedOrder).not.toEqual([...presentedOrder].sort((a, b) => a - b));
    const shuffledOptions = rows!.filter((r) => {
      const original = (r.quiz_question!.snapshot as { options: { id: string }[] }).options.map((o) => o.id);
      return JSON.stringify(original) !== JSON.stringify(r.option_order);
    });
    expect(shuffledOptions.length).toBeGreaterThan(0);

    // Gabarito bloqueado antes da conclusão
    const { error: reviewErr } = await c1.rpc("get_attempt_review", { p_attempt_id: attemptId! });
    expect(reviewErr?.message).toMatch(/somente após a conclusão/);

    // Resposta inválida (alternativa de outra questão) é rejeitada
    const [q1, q2] = attempt.questions;
    const { error: badOpt } = await c1.rpc("save_answer", { p_attempt_id: attemptId!, p_answer_id: q1.answer_id, p_option_id: q2.options[0].id });
    expect(badOpt?.message).toMatch(/inválida/);

    // Persistência: 24 acertos
    await answerAttempt(c1, attemptId!, quizId, 24);
    const { data: persisted } = await c1.rpc("get_attempt", { p_attempt_id: attemptId! });
    expect((persisted as unknown as AttemptPayload).questions.every((q) => (q as unknown as { selected_option_id: string | null }).selected_option_id)).toBe(true);

    // Colaborador não consegue gravar a própria nota
    await c1.from("quiz_attempts").update({ score: 100 }).eq("id", attemptId!);
    const { data: stillOpen } = await admin().from("quiz_attempts").select("score, status").eq("id", attemptId!).single();
    expect(stillOpen).toEqual({ score: null, status: "in_progress" });

    // Finalização concorrente/duplicada → uma única nota
    const results = await Promise.all([
      c1.rpc("finalize_attempt", { p_attempt_id: attemptId! }),
      c1.rpc("finalize_attempt", { p_attempt_id: attemptId! }),
    ]);
    for (const r of results) {
      expect(r.error).toBeNull();
      expect(r.data).toMatchObject({ score: 80, correct_answers: 24, total_questions: 30 });
    }
    const { data: attempts } = await admin().from("quiz_attempts").select("status, score, correct_answers, incorrect_answers, duration_seconds, completed_at").eq("assignment_id", assignmentId);
    expect(attempts).toHaveLength(1);
    expect(attempts![0]).toMatchObject({ status: "completed", score: 80, correct_answers: 24, incorrect_answers: 6 });
    expect(attempts![0].duration_seconds).toBeGreaterThanOrEqual(0);

    const { data: assignment } = await admin().from("quiz_assignments").select("status, completed_at").eq("id", assignmentId).single();
    expect(assignment!.status).toBe("completed");

    // Resultado imutável
    const { error: lateSave } = await c1.rpc("save_answer", { p_attempt_id: attemptId!, p_answer_id: q1.answer_id, p_option_id: q1.options[0].id });
    expect(lateSave?.message).toMatch(/finalizada/);
    const { error: adminTamper } = await admin().from("quiz_attempts").update({ score: 100 }).eq("id", attemptId!);
    expect(adminTamper?.message).toMatch(/não podem ser alteradas/);

    // Limite de tentativas
    const { error: retry } = await c1.rpc("start_attempt", { p_assignment_id: assignmentId });
    expect(retry?.message).toMatch(/todas as tentativas/);

    // Gabarito liberado após conclusão
    const { data: review } = await c1.rpc("get_attempt_review", { p_attempt_id: attemptId! });
    const items = review as unknown as { is_correct: boolean; explanation: string; options: { is_correct: boolean }[] }[];
    expect(items).toHaveLength(30);
    expect(items.filter((i) => i.is_correct)).toHaveLength(24);
    expect(items.every((i) => i.options.filter((o) => o.is_correct).length === 1 && i.explanation.length > 0)).toBe(true);

    // Histórico + tentativa oficial + notificação ao remetente
    const { data: official } = await c1.from("official_attempts").select("id, score").eq("assignment_id", assignmentId);
    expect(official).toEqual([{ id: attemptId, score: 80 }]);
    const { data: senderNote } = await sup.from("notifications").select("type").eq("entity_id", attemptId!);
    expect(senderNote).toEqual([{ type: "quiz_completed" }]);
    const { data: logs } = await sup.from("audit_logs").select("action").eq("entity_id", attemptId!);
    expect(logs!.map((l) => l.action).sort()).toEqual(["attempt_completed", "attempt_started"]);
  });

  it("calcula as notas da tabela de referência (30 questões)", async () => {
    const sup = await as("supervisor");
    const c2 = await as("colab2");
    const cases: [number, number][] = [[30, 100], [27, 90], [24, 80], [21, 70], [15, 50], [0, 0]];
    const quizId = await createQuiz(sup, [ids().colab2], { max_attempts: cases.length });
    const assignmentId = await assignmentFor(quizId, ids().colab2);
    for (const [correct, expected] of cases) {
      const { data: attemptId } = await c2.rpc("start_attempt", { p_assignment_id: assignmentId });
      await answerAttempt(c2, attemptId!, quizId, correct);
      const { data } = await c2.rpc("finalize_attempt", { p_attempt_id: attemptId! });
      expect(data).toMatchObject({ score: expected, correct_answers: correct });
    }
    // Tentativa oficial = melhor nota
    const { data: official } = await c2.from("official_attempts").select("score").eq("assignment_id", assignmentId);
    expect(official).toEqual([{ score: 100 }]);
  });

  it("questões sem resposta contam como erro e podem ser bloqueadas por configuração", async () => {
    const sup = await as("supervisor");
    const c1 = await as("colab1");
    const strict = await createQuiz(sup, [ids().colab1], { allow_incomplete: false });
    const { data: a1 } = await c1.rpc("start_attempt", { p_assignment_id: await assignmentFor(strict, ids().colab1) });
    const { error } = await c1.rpc("finalize_attempt", { p_attempt_id: a1! });
    expect(error?.message).toMatch(/30 pendente/);

    const lenient = await createQuiz(sup, [ids().colab1], { allow_incomplete: true });
    const { data: a2 } = await c1.rpc("start_attempt", { p_assignment_id: await assignmentFor(lenient, ids().colab1) });
    const { data } = await c1.rpc("finalize_attempt", { p_attempt_id: a2! });
    expect(data).toMatchObject({ score: 0, correct_answers: 0 });
    const { data: row } = await admin().from("quiz_attempts").select("unanswered, incorrect_answers").eq("id", a2!).single();
    expect(row).toEqual({ unanswered: 30, incorrect_answers: 30 });
  });

  it("edição de questão não altera avaliações já aplicadas (snapshot)", async () => {
    const sup = await as("supervisor");
    const c1 = await as("colab1");
    const quizId = await createQuiz(sup, [ids().colab1]);
    const assignmentId = await assignmentFor(quizId, ids().colab1);
    const { data: attemptId } = await c1.rpc("start_attempt", { p_assignment_id: assignmentId });
    await answerAttempt(c1, attemptId!, quizId, 30);
    await c1.rpc("finalize_attempt", { p_attempt_id: attemptId! });

    // Supervisor altera Q01 (gabarito C → A) e depois restaura.
    const { data: q } = await admin().from("questions").select("*, question_options(*)").eq("code", "Q01").single();
    const payload = (correct: string) => ({
      id: q!.id, category_id: q!.category_id, topic: q!.topic, statement: q!.statement, difficulty: q!.difficulty,
      explanation: q!.explanation, study_tip: q!.study_tip, in_standard_set: true, is_active: true,
      options: q!.question_options.map((o) => ({ label: o.option_label, text: o.option_text, is_correct: o.option_label === correct, explanation: null })),
    });
    const { error: e1 } = await sup.rpc("save_question", { p: payload("A") });
    expect(e1).toBeNull();
    const { data: review } = await c1.rpc("get_attempt_review", { p_attempt_id: attemptId! });
    expect((review as unknown as { is_correct: boolean }[]).every((i) => i.is_correct)).toBe(true);
    const key = await answerKey(quizId);
    const { data: qq } = await admin().from("quiz_questions").select("id, question_version").eq("quiz_id", quizId).eq("question_id", q!.id).single();
    expect(key.get(qq!.id)!.correct).toBe(q!.question_options.find((o) => o.option_label === "C")!.id);
    await sup.rpc("save_question", { p: payload("C") });
    const { data: after } = await admin().from("questions").select("version").eq("id", q!.id).single();
    expect(after!.version).toBe(qq!.question_version + 2);
  });

  it("valida a questão: exatamente quatro alternativas e uma correta", async () => {
    const sup = await as("supervisor");
    const { data: cat } = await admin().from("categories").select("id").eq("slug", "prazos").single();
    const base = { category_id: cat!.id, topic: "Teste", statement: "Enunciado de teste válido?", difficulty: "facil", explanation: "Explicação de teste." };
    const opts = (n: number, correct: number) => ["A", "B", "C", "D"].slice(0, n).map((l, i) => ({ label: l, text: `Opção ${l}`, is_correct: i < correct }));
    expect((await sup.rpc("save_question", { p: { ...base, options: opts(3, 1) } })).error?.message).toMatch(/quatro alternativas/);
    expect((await sup.rpc("save_question", { p: { ...base, options: opts(4, 2) } })).error?.message).toMatch(/exatamente uma/);
    expect((await sup.rpc("save_question", { p: { ...base, options: opts(4, 0) } })).error?.message).toMatch(/exatamente uma/);
  });

  it("avaliação personalizada por categoria seleciona a quantidade pedida", async () => {
    const sup = await as("supervisor");
    const { data: cats } = await admin().from("categories").select("id, slug").in("slug", ["ocorrencias", "faturamento"]);
    const by = Object.fromEntries(cats!.map((c) => [c.slug, c.id]));
    const quizId = await createQuiz(sup, [ids().colab4], {
      mode: "custom",
      selection: { type: "categories", items: [{ category_id: by.ocorrencias, count: 5 }, { category_id: by.faturamento, count: 2 }] },
    });
    const { data } = await admin().from("quiz_questions").select("snapshot").eq("quiz_id", quizId);
    const names = data!.map((r) => (r.snapshot as { category_name: string }).category_name);
    expect(names.filter((n) => n === "Ocorrências")).toHaveLength(5);
    expect(names.filter((n) => n === "Faturamento")).toHaveLength(2);
    await expect(
      createQuiz(sup, [ids().colab4], { mode: "custom", selection: { type: "categories", items: [{ category_id: by.faturamento, count: 50 }] } }),
    ).rejects.toThrow(/suficientes/);
  });

  it("cancelamento remove a avaliação dos cálculos", async () => {
    const sup = await as("supervisor");
    const c4 = await as("colab4");
    const quizId = await createQuiz(sup, [ids().colab4]);
    const assignmentId = await assignmentFor(quizId, ids().colab4);
    const { data: attemptId } = await c4.rpc("start_attempt", { p_assignment_id: assignmentId });
    const { error } = await sup.rpc("cancel_assignment", { p_assignment_id: assignmentId });
    expect(error).toBeNull();
    const { data: t } = await admin().from("quiz_attempts").select("status").eq("id", attemptId!).single();
    expect(t!.status).toBe("abandoned");
    const { error: e2 } = await c4.rpc("start_attempt", { p_assignment_id: assignmentId });
    expect(e2?.message).toMatch(/cancelada/);
  });

  it("prazo vencido: tentativa aberta é corrigida e pendentes expiram", async () => {
    const sup = await as("supervisor");
    const c3 = await as("colab3");
    const deadline = new Date(Date.now() + 2500).toISOString();
    const quizA = await createQuiz(sup, [ids().colab3], { deadline });
    const quizB = await createQuiz(sup, [ids().colab3], { deadline });
    const { data: attemptId } = await c3.rpc("start_attempt", { p_assignment_id: await assignmentFor(quizA, ids().colab3) });
    await answerAttempt(c3, attemptId!, quizA, 3);
    await new Promise((r) => setTimeout(r, 3000));
    const { error: late } = await c3.rpc("start_attempt", { p_assignment_id: await assignmentFor(quizB, ids().colab3) });
    expect(late?.message).toMatch(/prazo/);
    await c3.rpc("expire_overdue");
    const { data: t } = await admin().from("quiz_attempts").select("status, score, finalized_reason").eq("id", attemptId!).single();
    expect(t).toEqual({ status: "completed", score: 10, finalized_reason: "deadline" });
    const { data: b } = await admin().from("quiz_assignments").select("status").eq("quiz_id", quizB).single();
    expect(b!.status).toBe("expired");
  });

  it("envio agendado só fica visível na data de envio", async () => {
    const sup = await as("supervisor");
    const c4 = await as("colab4");
    const future = new Date(Date.now() + 86400000).toISOString();
    const quizId = await createQuiz(sup, [ids().colab4], { available_from: future });
    const assignmentId = await assignmentFor(quizId, ids().colab4);
    const { data } = await c4.from("quiz_assignments").select("id").eq("id", assignmentId);
    expect(data).toHaveLength(0);
    const { data: n } = await c4.from("notifications").select("id").eq("entity_id", assignmentId);
    expect(n).toHaveLength(0);
  });
});
