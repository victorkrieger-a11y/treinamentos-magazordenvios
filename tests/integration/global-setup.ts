import { randomBytes } from "node:crypto";
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { DEV_USERS, seedDevUsers } from "../../scripts/dev-seed-users";

/**
 * Prepara usuários de teste no Supabase LOCAL com uma senha aleatória gerada
 * a cada execução (nenhuma senha fixa no código).
 */
export default async function setup({ provide }: { provide: (key: string, value: unknown) => void }) {
  config({ path: ".env.local", quiet: true });
  const password = `T${randomBytes(12).toString("hex")}9`;
  const ids = await seedDevUsers(password);
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
  for (const u of DEV_USERS) {
    await admin.auth.admin.updateUserById(ids[u.key], { password, ban_duration: "none" });
    await admin.from("profiles").update({ status: "active" }).eq("id", ids[u.key]);
  }
  provide("password", password);
  provide("ids", ids);
}

declare module "vitest" {
  export interface ProvidedContext {
    password: string;
    ids: Record<string, string>;
  }
}
