import Link from "next/link";
import { SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-background px-4 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-muted text-mz-gray-dark"><SearchX className="size-6" /></span>
      <h1 className="text-lg font-bold text-mz-chumbo">Página não encontrada</h1>
      <p className="max-w-sm text-sm text-muted-foreground">O conteúdo não existe ou você não tem permissão para acessá-lo.</p>
      <Button asChild><Link href="/painel">Voltar ao painel</Link></Button>
    </div>
  );
}
