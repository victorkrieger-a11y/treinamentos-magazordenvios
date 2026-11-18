import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PasswordForm } from "./password-form";

export const metadata: Metadata = { title: "Definir senha" };

export default async function SetPasswordPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?erro=link");
  const { data: profile } = await supabase.from("profiles").select("full_name, status").eq("id", user.id).maybeSingle();
  if (!profile || profile.status === "inactive") redirect("/login?erro=sessao");
  const first = profile.status === "invited";

  return (
    <div>
      <h1 className="text-2xl font-bold text-mz-chumbo">{first ? "Primeiro acesso" : "Definir nova senha"}</h1>
      <p className="mb-6 mt-1 text-sm text-muted-foreground">
        {first ? `Olá, ${profile.full_name.split(" ")[0]}! Crie sua senha para acessar a plataforma.` : "Escolha uma nova senha de acesso."}
      </p>
      <PasswordForm />
    </div>
  );
}
