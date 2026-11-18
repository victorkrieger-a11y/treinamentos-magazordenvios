import { randomBytes } from "node:crypto";
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { DEV_USERS, seedDevUsers } from "../../scripts/dev-seed-users";

/** Usuários de teste locais com senha aleatória por execução (sem senhas fixas no código). */
export default async function globalSetup() {
  config({ path: ".env.local", quiet: true });
  const password = `E${randomBytes(12).toString("hex")}7`;
  const ids = await seedDevUsers(password);
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  for (const u of DEV_USERS) {
    await admin.auth.admin.updateUserById(ids[u.key], { password, ban_duration: "none" });
    await admin.from("profiles").update({ status: "active" }).eq("id", ids[u.key]);
  }
  process.env.E2E_PASSWORD = password;
  process.env.E2E_IDS = JSON.stringify(ids);
}
