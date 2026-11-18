import { expect, type Page } from "@playwright/test";
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local", quiet: true });

export const password = () => process.env.E2E_PASSWORD!;
export const ids = () => JSON.parse(process.env.E2E_IDS ?? "{}") as Record<string, string>;
export const admin = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

export async function login(page: Page, user: string, pass = password()) {
  await page.goto("/login");
  await page.getByLabel("E-mail corporativo").fill(`${user}@teste.local`);
  await page.getByLabel("Senha", { exact: true }).fill(pass);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/painel/);
  await page.waitForLoadState("networkidle");
}

const MAILPIT = "http://127.0.0.1:54324/api/v1";

/** Busca o link de confirmação no último e-mail enviado ao destinatário (Mailpit local). */
export async function lastEmailLink(to: string): Promise<string> {
  for (let i = 0; i < 30; i++) {
    const res = await fetch(`${MAILPIT}/search?query=${encodeURIComponent(`to:${to}`)}&limit=1`);
    const data = (await res.json()) as { messages?: { ID: string }[] };
    if (data.messages?.length) {
      const msg = (await (await fetch(`${MAILPIT}/message/${data.messages[0].ID}`)).json()) as { HTML: string };
      const href = msg.HTML.match(/href="([^"]*auth\/confirm[^"]*)"/)?.[1];
      if (href) return href.replace(/&amp;/g, "&");
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`E-mail para ${to} não encontrado no Mailpit`);
}

export async function clearMailbox() {
  await fetch(`${MAILPIT}/messages`, { method: "DELETE" });
}
