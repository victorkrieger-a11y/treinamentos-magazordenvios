import { expect, test } from "@playwright/test";
import { admin, clearMailbox, ids, lastEmailLink, login } from "./helpers";

test.describe.serial("Gestão de colaboradores e guardiões", () => {
  const stamp = Date.now();
  const email = `novo.${stamp}@teste.local`;
  const name = `Nova Colaboradora ${stamp}`;
  const newPassword = `Nova${stamp}x1`;

  test.afterAll(async () => {
    const { data } = await admin().from("profiles").select("id").eq("email", email).maybeSingle();
    if (data) await admin().auth.admin.updateUserById(data.id, { ban_duration: "876000h" });
  });

  test("supervisor cadastra colaborador com guardião (convite por e-mail)", async ({ page }) => {
    await clearMailbox();
    await login(page, "supervisor");
    await page.goto("/colaboradores");
    await page.getByRole("button", { name: "Novo colaborador" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Nome completo").fill(name);
    await dialog.getByLabel("E-mail corporativo").fill(email);
    await dialog.getByRole("combobox", { name: "Guardião responsável" }).click();
    await page.getByRole("option", { name: "Gustavo Guardião" }).click();
    await dialog.getByLabel("Cargo ou função").fill("Analista de suporte");
    await dialog.getByRole("button", { name: "Enviar convite" }).click();
    await expect(page.getByText(`Convite enviado para ${email}`)).toBeVisible();
    await expect(page.getByRole("table", { name: "Lista de colaboradores" }).getByText(name)).toBeVisible();

    const { data } = await admin().from("profiles").select("role, status, created_by").eq("email", email).single();
    expect(data).toMatchObject({ role: "collaborator", status: "invited" });
  });

  test("e-mail duplicado é recusado", async ({ page }) => {
    await login(page, "supervisor");
    await page.goto("/colaboradores");
    await page.getByRole("button", { name: "Novo colaborador" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Nome completo").fill("Duplicado Teste");
    await dialog.getByLabel("E-mail corporativo").fill(email);
    await dialog.getByRole("button", { name: "Enviar convite" }).click();
    await expect(dialog.getByRole("alert").first()).toContainText("Já existe um usuário com este e-mail");
  });

  test("primeiro acesso pelo link do convite", async ({ page }) => {
    const link = await lastEmailLink(email);
    await page.goto(link);
    await expect(page).toHaveURL(/\/definir-senha/);
    await expect(page.getByRole("heading", { name: "Primeiro acesso" })).toBeVisible();
    await page.getByLabel("Nova senha").fill(newPassword);
    await page.getByLabel("Confirmar senha").fill(newPassword);
    await page.getByRole("button", { name: "Salvar senha e acessar" }).click();
    await expect(page).toHaveURL(/\/painel/);
    await expect(page.getByRole("heading", { name: /Olá, Nova!/ })).toBeVisible();
    const { data } = await admin().from("profiles").select("status").eq("email", email).single();
    expect(data!.status).toBe("active");
  });

  test("guardião vinculado passa a ver a nova colaboradora", async ({ page }) => {
    await login(page, "guardiao1");
    await page.goto("/colaboradores");
    await expect(page.getByRole("table", { name: "Lista de colaboradores" }).getByText(name)).toBeVisible();
  });

  test("supervisor desvincula, edita e desativa; acesso é bloqueado e histórico preservado", async ({ page, browser }) => {
    await login(page, "supervisor");
    await page.goto("/guardioes");
    await expect(page.getByRole("link", { name: "Gustavo Guardião" })).toBeVisible();
    await page.goto(`/guardioes/${ids().guardiao1}`);
    await page.getByRole("button", { name: `Desvincular ${name}` }).click();
    await expect(page.getByText("Colaborador desvinculado.")).toBeVisible();

    const { data: created } = await admin().from("profiles").select("id").eq("email", email).single();
    await page.goto(`/colaboradores/${created!.id}`);
    await page.getByRole("button", { name: "Editar" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Cargo ou função").fill("Analista pleno");
    await dialog.getByRole("combobox", { name: "Status" }).click();
    await page.getByRole("option", { name: "Inativo" }).click();
    await dialog.getByRole("button", { name: "Salvar" }).click();
    await expect(page.getByText("Dados atualizados.")).toBeVisible();

    const ctx = await browser.newContext();
    const p2 = await ctx.newPage();
    await p2.goto("/login");
    await p2.getByLabel("E-mail corporativo").fill(email);
    await p2.getByLabel("Senha", { exact: true }).fill(newPassword);
    await p2.getByRole("button", { name: "Entrar" }).click();
    await expect(p2.getByText("E-mail ou senha inválidos.")).toBeVisible();
    await expect(p2).toHaveURL(/\/login/);
    await ctx.close();

    const { data: logs } = await admin().from("audit_logs").select("action").eq("subject_user_id", (await admin().from("profiles").select("id").eq("email", email).single()).data!.id);
    const actions = logs!.map((l) => l.action);
    expect(actions).toEqual(expect.arrayContaining(["user_created", "guardian_linked", "guardian_unlinked", "user_deactivated"]));
  });
});
