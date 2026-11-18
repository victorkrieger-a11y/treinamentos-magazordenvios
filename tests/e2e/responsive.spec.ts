import { expect, test } from "@playwright/test";
import { login } from "./helpers";

test("navegação responsiva e ausência de rolagem horizontal no celular", async ({ page }) => {
  await login(page, "supervisor");
  for (const path of ["/painel", "/colaboradores", "/avaliacoes/nova", "/relatorios"]) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `rolagem horizontal em ${path}`).toBeLessThanOrEqual(1);
  }
  await page.getByRole("button", { name: "Abrir menu" }).click();
  await page.getByRole("dialog").getByRole("link", { name: "Guardiões" }).click();
  await expect(page).toHaveURL(/\/guardioes/);
});
