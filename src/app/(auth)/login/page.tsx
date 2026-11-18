import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Entrar" };

const MESSAGES: Record<string, string> = {
  link: "O link utilizado é inválido ou expirou. Solicite um novo acesso.",
  sessao: "Sua sessão expirou ou sua conta não está ativa. Entre novamente.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; erro?: string }> }) {
  const { next, erro } = await searchParams;
  return (
    <div>
      <h1 className="text-2xl font-bold text-mz-chumbo">Acessar plataforma</h1>
      <p className="mb-6 mt-1 text-sm text-muted-foreground">Entre com o e-mail e a senha cadastrados pelo seu supervisor.</p>
      {erro && MESSAGES[erro] && (
        <p className="mb-4 rounded-lg border border-mz-yellow/50 bg-mz-yellow-soft px-3 py-2 text-sm text-mz-yellow-text" role="status">{MESSAGES[erro]}</p>
      )}
      <LoginForm next={next} />
      <p className="mt-8 text-center text-xs text-muted-foreground">Não possui acesso? Solicite ao supervisor da operação.</p>
    </div>
  );
}
