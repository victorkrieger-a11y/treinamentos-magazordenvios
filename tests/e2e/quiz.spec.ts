import { expect, test, type Page } from "@playwright/test";
import { admin, ids, login } from "./helpers";

async function createQuizViaUi(page: Page, title: string, collaborator: string) {
  await page.goto("/avaliacoes/nova");
  await page.getByLabel("Nome da avaliação").fill(title);
  await page.getByLabel("Descrição").fill("Avaliação padrão com as 30 questões oficiais.");
  await page.getByRole("list", { name: "Colaboradores" }).getByText(collaborator).click();
  await page.getByRole("button", { name: "Enviar avaliação" }).click();
  await expect(page).toHaveURL(/\/avaliacoes\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
}

test.describe.serial("Avaliação de ponta a ponta", () => {
  const title = `Treinamento inicial E2E ${Date.now()}`;

  test("supervisor envia a avaliação padrão", async ({ page }) => {
    await login(page, "supervisor");
    await createQuizViaUi(page, title, "Clara Colaboradora");
    await expect(page.getByText("30 questões").first()).toBeVisible();
  });

  test("colaborador recebe, responde, recarrega sem perder progresso e finaliza", async ({ page }) => {
    await login(page, "colab4");
    await expect(page.getByText(title).first()).toBeVisible();
    await page.getByRole("link", { name: "Notificações" }).or(page.getByRole("button", { name: /Notificações/ })).first().click();
    await expect(page.getByText(`Nova avaliação: ${title}`).first()).toBeVisible();
    await page.keyboard.press("Escape");

    await page.goto("/minhas-avaliacoes");
    await page.waitForLoadState("networkidle");
    const card = page.locator("article", { hasText: title });
    const startLink = card.getByRole("link", { name: /Iniciar avaliação/ });
    const href = await startLink.getAttribute("href");
    expect(href).toMatch(/^\/minhas-avaliacoes\/[0-9a-f-]{36}$/);
    await page.goto(href!);
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: "Iniciar avaliação" }).click();
    await expect(page).toHaveURL(/\/quiz\//);

    // O HTML entregue ao navegador não contém o gabarito.
    const html = await page.content();
    expect(html).not.toContain("is_correct");
    expect(html).not.toContain("study_tip");

    await expect(page.getByText("Questão 1 de 30")).toBeVisible();
    for (let i = 0; i < 5; i++) {
      await page.getByRole("radio").first().click();
      await expect(page.getByText("Resposta salva")).toBeVisible();
      await page.getByRole("button", { name: "Próxima" }).click();
    }
    await page.reload();
    await expect(page.getByText("5/30")).toBeVisible();

    // Responde as demais pelo teclado (tecla 2 = alternativa B)
    for (let i = 0; i < 30; i++) {
      await page.getByRole("button", { name: `Questão ${i + 1}`, exact: false }).first().click();
      if ((await page.getByRole("radio", { checked: true }).count()) === 0) {
        await page.keyboard.press("2");
        await expect(page.getByRole("radio", { checked: true })).toHaveCount(1);
      }
    }
    await expect(page.getByText("30/30")).toBeVisible();

    await page.getByRole("button", { name: "Finalizar avaliação" }).click();
    await expect(page.getByText("Tem certeza de que deseja finalizar sua avaliação?")).toBeVisible();
    await page.getByRole("button", { name: "Confirmar e finalizar" }).click();
    await expect(page).toHaveURL(/\/resultado\//);
    await expect(page.getByText(/de 100/)).toBeVisible();

    // A nota exibida é a gravada no banco pelo servidor
    const attemptId = page.url().split("/resultado/")[1].split("?")[0];
    const { data } = await admin().from("quiz_attempts").select("score, correct_answers, status").eq("id", attemptId).single();
    expect(data!.status).toBe("completed");
    const shown = (data!.score as number).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    await expect(page.getByRole("img", { name: `Nota ${shown} de 100` })).toBeVisible();
    await expect(page.getByText(`${data!.correct_answers} acertos`)).toBeVisible();

    // Revisão com gabarito e explicações liberada após a conclusão
    await expect(page.getByRole("heading", { name: "Revisão das respostas" })).toBeVisible();
    await expect(page.getByText("Explicação", { exact: false }).first()).toBeVisible();

    // Voltar à página do quiz redireciona para o resultado (não é possível responder de novo)
    await page.goto(`/quiz/${attemptId}`);
    await expect(page).toHaveURL(new RegExp(`/resultado/${attemptId}`));

    // Histórico
    await page.goto("/historico");
    await expect(page.getByText(title)).toBeVisible();
  });

  test("supervisor acompanha o resultado no perfil e nos relatórios (CSV)", async ({ page }) => {
    await login(page, "supervisor");
    await page.goto(`/colaboradores/${ids().colab4}`);
    await expect(page.getByRole("heading", { name: "Clara Colaboradora" })).toBeVisible();
    await expect(page.getByText("Pontos de melhoria")).toBeVisible();
    await expect(page.getByRole("table", { name: "Histórico de avaliações" }).getByText(title)).toBeVisible();

    await page.goto(`/relatorios?colaborador=${ids().colab4}`);
    await expect(page.getByText("Questões com maior índice de erro")).toBeVisible();
    const res = await page.request.get(`/api/relatorios/csv?colaborador=${ids().colab4}`);
    expect(res.status()).toBe(200);
    const csv = await res.text();
    expect(csv).toContain("Colaborador;Guardião;Avaliação");
    expect(csv).toContain(title);
  });

  test("guardião envia avaliação personalizada para a própria equipe", async ({ page }) => {
    await login(page, "guardiao1");
    await page.goto("/avaliacoes/nova");
    await page.getByLabel("Nome da avaliação").fill(`Reforço equipe ${Date.now()}`);
    await page.getByText("Avaliação personalizada").click();
    await page.getByLabel(/Ocorrências/).fill("3");
    await page.getByLabel(/^Prazos/).fill("2");
    await page.getByRole("button", { name: "Toda a equipe" }).click();
    const checked = page.getByRole("list", { name: "Colaboradores" }).getByRole("checkbox", { checked: true });
    expect(await checked.count()).toBeGreaterThanOrEqual(2);
    await page.getByRole("button", { name: "Enviar avaliação" }).click();
    await expect(page).toHaveURL(/\/avaliacoes\/[0-9a-f-]{36}$/);
    await expect(page.getByText("5 questões").first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Carlos Colaborador" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Camila Colaboradora" })).toBeVisible();
  });

  test("colaborador não acessa resultado de outro colaborador", async ({ page }) => {
    const { data } = await admin().from("quiz_attempts").select("id").eq("collaborator_id", ids().colab4).eq("status", "completed").limit(1).single();
    await login(page, "colab1");
    await page.goto(`/resultado/${data!.id}`);
    await expect(page.getByRole("heading", { name: "Página não encontrada" })).toBeVisible();
    await expect(page.getByText("Clara Colaboradora")).toHaveCount(0);
  });
});
