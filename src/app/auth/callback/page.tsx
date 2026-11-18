"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

const OTP_TYPES: EmailOtpType[] = ["invite", "recovery", "email", "magiclink", "signup"];

function safeNext(v: string | null) {
  return v && v.startsWith("/") && !v.startsWith("//") ? v : "/definir-senha";
}

/**
 * Conclui convites e recuperações de senha em qualquer formato de link do
 * Supabase Auth:
 *  - template padrão (fluxo implícito): #access_token=…&refresh_token=…
 *  - PKCE: ?code=…
 *  - template próprio: ?token_hash=…&type=…
 */
function Callback() {
  const params = useSearchParams();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let done = false;
    // Nunca deixa a pessoa presa nesta tela.
    const timeout = window.setTimeout(() => {
      if (!done) setFailed(true);
    }, 20000);
    const supabase = createClient();
    const next = safeNext(params.get("next"));
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));

    async function run() {
      if (hash.get("error") || params.get("error")) throw new Error("link");
      const accessToken = hash.get("access_token");
      const refreshToken = hash.get("refresh_token");
      if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
        if (error) throw error;
        return;
      }
      const code = params.get("code");
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) throw error;
        return;
      }
      const tokenHash = params.get("token_hash");
      const type = params.get("type") as EmailOtpType | null;
      if (tokenHash && type && OTP_TYPES.includes(type)) {
        const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
        if (error) throw error;
        return;
      }
      throw new Error("link");
    }

    run()
      .then(() => {
        done = true;
        // Navegação completa: remove os tokens da URL (replace não guarda
        // histórico) e garante que o servidor receba os cookies da sessão.
        window.location.replace(next);
      })
      .catch(() => {
        done = true;
        window.location.replace("/login?erro=link");
      });
    return () => window.clearTimeout(timeout);
  }, [params]);

  if (failed) {
    return (
      <div className="grid max-w-sm gap-3 text-center" role="alert">
        <p className="text-sm font-semibold text-mz-chumbo">Não foi possível validar seu acesso.</p>
        <p className="text-xs text-muted-foreground">O link pode ter expirado ou já ter sido utilizado. Solicite um novo link ao supervisor ou use a recuperação de senha.</p>
        <Link href="/recuperar-senha" className="text-sm font-medium text-mz-red-strong hover:underline">Solicitar novo link</Link>
      </div>
    );
  }

  return (
    <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground" role="status">
      <Loader2 className="size-4 animate-spin" /> Validando seu acesso...
    </p>
  );
}

export default function AuthCallbackPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4">
      <Suspense>
        <Callback />
      </Suspense>
    </main>
  );
}
