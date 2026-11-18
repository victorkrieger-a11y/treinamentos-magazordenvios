import { expect, test } from "@playwright/test";
import { login } from "./helpers";

test.describe("Autenticação", () => {
  test("login inválido exibe mensagem", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("E-mail corporativo").fill("supervisor@teste.local");
    await page.getByLabel("Senha", { exact: true }).fill("senha-errada-123");
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page.getByText("E-mail ou senha inválidos.")).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test("validação de campos no login", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page.getByText("Informe um e-mail válido.")).toBeVisible();
  });

  test("rota protegida redireciona para o login e volta após autenticar", async ({ page }) => {
    await page.goto("/relatorios");
    await expect(page).toHaveURL(/\/login\?next=%2Frelatorios/);
  });

  test("login válido e logout", async ({ page }) => {
    await login(page, "supervisor");
    await expect(page.getByRole("heading", { name: "Painel geral" })).toBeVisible();
    await page.getByRole("button", { name: "Menu do usuário" }).click();
    await page.getByRole("menuitem", { name: "Sair" }).click();
    await expect(page).toHaveURL(/\/login/);
    await page.goto("/painel");
    await expect(page).toHaveURL(/\/login/);
  });

  test("recuperação de senha não revela se o e-mail existe", async ({ page }) => {
    await page.goto("/recuperar-senha");
    await page.getByLabel("E-mail corporativo").fill("inexistente@teste.local");
    await page.getByRole("button", { name: "Enviar link" }).click();
    await expect(page.getByRole("status")).toContainText("Se o e-mail estiver cadastrado");
  });

  test("cadastro público não existe", async ({ page }) => {
    const res = await page.request.post("http://127.0.0.1:54321/auth/v1/signup", {
      headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, "Content-Type": "application/json" },
      data: { email: "intruso@teste.local", password: "Intruso12345" },
    });
    expect(res.ok()).toBe(false);
  });
});

test("convite com link padrão do Supabase (#access_token) conclui o primeiro acesso", async ({ page }) => {
  const { admin } = await import("./helpers");
  const email = `link.padrao.${Date.now()}@teste.local`;
  const { data, error } = await admin().auth.admin.generateLink({
    type: "invite",
    email,
    options: { redirectTo: "http://localhost:3000/auth/callback?next=/definir-senha" },
  });
  expect(error).toBeNull();
  await admin().rpc("provision_profile", { p: { id: data.user!.id, full_name: "Link Padrão Teste", email, role: "collaborator" } });

  await page.goto(data.properties!.action_link);
  await expect(page).toHaveURL(/\/definir-senha$/, { timeout: 20_000 });
  await expect(page.getByRole("heading", { name: "Primeiro acesso" })).toBeVisible();
  expect(page.url()).not.toContain("access_token");

  await admin().auth.admin.updateUserById(data.user!.id, { ban_duration: "876000h" });
});

test("link de acesso inválido não fica carregando indefinidamente", async ({ page }) => {
  await page.goto("/auth/callback?next=/definir-senha#access_token=invalido&refresh_token=invalido");
  await expect(page).toHaveURL(/\/login\?erro=link/, { timeout: 20_000 });
});
