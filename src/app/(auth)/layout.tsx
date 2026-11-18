import { Brand } from "@/components/brand/brand";
import { CheckCircle2 } from "lucide-react";

const POINTS = [
  "Avaliações com correção automática e gabarito protegido",
  "Acompanhamento da evolução de cada colaborador",
  "Identificação dos assuntos que precisam de reforço",
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative hidden overflow-hidden bg-mz-chumbo p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div aria-hidden className="absolute -right-24 -top-24 size-80 rounded-full bg-mz-red/90" />
        <div aria-hidden className="absolute -bottom-32 -left-20 size-72 rounded-full border-[28px] border-white/5" />
        <div className="relative flex items-center gap-3">
          <Brand compact />
          <span className="text-sm font-semibold tracking-wide">Magazord Envios</span>
        </div>
        <div className="relative max-w-md">
          <p className="font-display text-sm font-semibold uppercase tracking-[0.2em] text-mz-yellow">Treinamentos</p>
          <h1 className="mt-3 text-3xl font-bold leading-tight">Formação de analistas preparados para atender com qualidade e segurança.</h1>
          <ul className="mt-8 grid gap-3 text-sm text-white/80">
            {POINTS.map((p) => (
              <li key={p} className="flex items-start gap-2.5">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-mz-green" aria-hidden />
                {p}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-white/50">Acesso restrito à equipe Magazord Envios.</p>
      </aside>
      <main className="flex items-center justify-center bg-background px-4 py-10 sm:px-8">
        <div className="w-full max-w-sm">
          <Brand className="mb-8 lg:hidden" />
          {children}
        </div>
      </main>
    </div>
  );
}
