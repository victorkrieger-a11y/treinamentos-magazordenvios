import { expect, test } from "@playwright/test";
import { login } from "./helpers";

test.describe("Permissões por perfil", () => {
  test("colaborador não acessa áreas administrativas", async ({ page }) => {
    await login(page, "colab1");
    await expect(page.getByRole("heading", { name: /Olá, Carlos/ })).toBeVisible();
    const nav = page.getByRole("navigation", { name: "Navegação principal" });
    await expect(nav.getByRole("link", { name: "Colaboradores" })).toHaveCount(0);
    for (const path of ["/colaboradores", "/guardioes", "/avaliacoes/nova", "/perguntas", "/relatorios", "/configuracoes"]) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/painel\?erro=permissao/);
    }
    const csv = await page.request.get("/api/relatorios/csv");
    expect(csv.status()).toBe(403);
  });

  test("guardião vê somente a própria equipe e não acessa gestão global", async ({ page }) => {
    await login(page, "guardiao1");
    await expect(page.getByRole("heading", { name: "Painel da equipe" })).toBeVisible();
    await page.goto("/colaboradores");
    await expect(page.getByRole("heading", { name: "Minha equipe" })).toBeVisible();
    const table = page.getByRole("table", { name: "Lista de colaboradores" });
    await expect(table.getByText("Carlos Colaborador")).toBeVisible();
    await expect(table.getByText("Camila Colaboradora")).toBeVisible();
    await expect(table.getByText("Caio Colaborador")).toHaveCount(0);
    await expect(table.getByText("Clara Colaboradora")).toHaveCount(0);
    for (const path of ["/guardioes", "/configuracoes"]) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/painel\?erro=permissao/);
    }
  });

  test("guardião não abre o perfil de colaborador de outra equipe", async ({ page }) => {
    await login(page, "guardiao2");
    const { ids } = await import("./helpers");
    await page.goto(`/colaboradores/${ids().colab1}`);
    await expect(page.getByRole("heading", { name: "Página não encontrada" })).toBeVisible();
    await expect(page.getByText("Carlos Colaborador")).toHaveCount(0);
  });

  test("supervisor visualiza toda a equipe", async ({ page }) => {
    await login(page, "supervisor");
    await page.goto("/colaboradores");
    const table = page.getByRole("table", { name: "Lista de colaboradores" });
    for (const n of ["Carlos Colaborador", "Camila Colaboradora", "Caio Colaborador", "Clara Colaboradora"]) {
      await expect(table.getByText(n)).toBeVisible();
    }
  });
});
