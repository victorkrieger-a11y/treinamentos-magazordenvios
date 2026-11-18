import { describe, expect, it } from "vitest";
import { admin, anon, as, assignmentFor, createQuiz, ids } from "./helpers";

describe("RLS e permissões dos três perfis", () => {
  it("anônimo não acessa nenhum dado", async () => {
    const c = anon();
    const { data: q } = await c.from("questions").select("id");
    const { data: p } = await c.from("profiles").select("id");
    expect(q ?? []).toHaveLength(0);
    expect(p ?? []).toHaveLength(0);
    const { error } = await c.rpc("create_quiz", { p: { title: "x", mode: "standard", collaborator_ids: [] } });
    expect(error).not.toBeNull();
  });

  it("supervisor visualiza todos os colaboradores", async () => {
    const sup = await as("supervisor");
    const { data } = await sup.from("profiles").select("id").eq("role", "collaborator");
    const all = data!.map((r) => r.id);
    for (const k of ["colab1", "colab2", "colab3", "colab4"]) expect(all).toContain(ids()[k]);
  });

  it("guardião visualiza somente os colaboradores vinculados", async () => {
    const g1 = await as("guardiao1");
    const { data } = await g1.from("profiles").select("id").eq("role", "collaborator");
    const visible = data!.map((r) => r.id);
    expect(visible).toContain(ids().colab1);
    expect(visible).toContain(ids().colab2);
    expect(visible).not.toContain(ids().colab3);
    expect(visible).not.toContain(ids().colab4);
  });

  it("colaborador visualiza somente o próprio perfil entre colaboradores", async () => {
    const c1 = await as("colab1");
    const { data } = await c1.from("profiles").select("id, role");
    const collaborators = data!.filter((r) => r.role === "collaborator").map((r) => r.id);
    expect(collaborators).toEqual([ids().colab1]);
  });

  it("colaborador não acessa banco de perguntas nem gabarito", async () => {
    const c1 = await as("colab1");
    const { data: q } = await c1.from("questions").select("id");
    const { data: o } = await c1.from("question_options").select("id, is_correct");
    const { data: qq } = await c1.from("quiz_questions").select("snapshot");
    expect(q).toHaveLength(0);
    expect(o).toHaveLength(0);
    expect(qq).toHaveLength(0);
  });

  it("guardião acessa o banco de perguntas (somente leitura)", async () => {
    const g1 = await as("guardiao1");
    const { data } = await g1.from("questions").select("id").eq("in_standard_set", true);
    expect(data!.length).toBeGreaterThanOrEqual(30);
    const { error } = await g1.from("questions").update({ statement: "alterado indevidamente" }).eq("code", "Q01");
    const { data: after } = await admin().from("questions").select("statement").eq("code", "Q01").single();
    expect(error ?? after!.statement !== "alterado indevidamente").toBeTruthy();
    expect(after!.statement).not.toBe("alterado indevidamente");
  });

  it("escritas diretas nas tabelas são bloqueadas para usuários", async () => {
    const c1 = await as("colab1");
    const { error: e1 } = await c1.from("quiz_attempts").insert({ assignment_id: ids().colab1, collaborator_id: ids().colab1, attempt_number: 1, total_questions: 1 });
    expect(e1).not.toBeNull();
    const { error: e2 } = await c1.from("profiles").update({ role: "supervisor" }).eq("id", ids().colab1);
    const { data: me } = await admin().from("profiles").select("role").eq("id", ids().colab1).single();
    expect(e2 ?? true).toBeTruthy();
    expect(me!.role).toBe("collaborator");
    const sup = await as("supervisor");
    const { error: e3 } = await sup.from("audit_logs").delete().gt("id", 0);
    expect(e3).not.toBeNull();
  });

  it("provisionamento de contas não é acessível a usuários autenticados", async () => {
    const sup = await as("supervisor");
    const { error } = await sup.rpc("provision_profile", { p: { id: ids().colab1, role: "supervisor" } });
    expect(error).not.toBeNull();
  });

  it("guardião não envia avaliação para colaborador de outra equipe", async () => {
    const g1 = await as("guardiao1");
    await expect(createQuiz(g1, [ids().colab3])).rejects.toThrow(/própria equipe/);
  });

  it("guardião envia avaliação para a própria equipe", async () => {
    const g1 = await as("guardiao1");
    const quizId = await createQuiz(g1, [ids().colab1, ids().colab2]);
    const { data } = await admin().from("quiz_assignments").select("collaborator_id, assigned_by").eq("quiz_id", quizId);
    expect(data).toHaveLength(2);
    expect(data!.every((a) => a.assigned_by === ids().guardiao1)).toBe(true);
  });

  it("colaborador não envia avaliações nem altera configurações", async () => {
    const c1 = await as("colab1");
    await expect(createQuiz(c1, [ids().colab1])).rejects.toThrow(/permissão/);
    const { error } = await c1.rpc("update_settings", { p: { passing_score: 10 } });
    expect(error?.message).toMatch(/permissão/);
  });

  it("guardião não altera configurações globais nem vínculos", async () => {
    const g1 = await as("guardiao1");
    const { error } = await g1.rpc("update_settings", { p: { passing_score: 10 } });
    expect(error?.message).toMatch(/permissão/);
    const { error: e2 } = await g1.rpc("assign_guardian", { p_collaborator: ids().colab3, p_guardian: ids().guardiao1 });
    expect(e2?.message).toMatch(/permissão/);
  });

  it("guardião não vê tentativas de colaboradores de outra equipe", async () => {
    const sup = await as("supervisor");
    const quizId = await createQuiz(sup, [ids().colab3]);
    const c3 = await as("colab3");
    const { data: attemptId } = await c3.rpc("start_attempt", { p_assignment_id: await assignmentFor(quizId, ids().colab3) });
    const g1 = await as("guardiao1");
    const g2 = await as("guardiao2");
    const { data: seen1 } = await g1.from("quiz_attempts").select("id").eq("id", attemptId!);
    const { data: seen2 } = await g2.from("quiz_attempts").select("id").eq("id", attemptId!);
    expect(seen1).toHaveLength(0);
    expect(seen2).toHaveLength(1);
    const c1 = await as("colab1");
    const { data: seenByPeer } = await c1.from("quiz_attempts").select("id").eq("id", attemptId!);
    expect(seenByPeer).toHaveLength(0);
  });

  it("colaborador não inicia avaliação de outro colaborador", async () => {
    const sup = await as("supervisor");
    const quizId = await createQuiz(sup, [ids().colab2]);
    const c1 = await as("colab1");
    const { error } = await c1.rpc("start_attempt", { p_assignment_id: await assignmentFor(quizId, ids().colab2) });
    expect(error?.message).toMatch(/não encontrada/);
  });
});
