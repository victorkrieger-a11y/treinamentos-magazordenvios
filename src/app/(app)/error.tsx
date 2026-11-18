"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => console.error(error), [error]);
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 py-20 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-mz-red-soft text-mz-red"><AlertTriangle className="size-6" /></span>
      <h1 className="text-lg font-bold text-mz-chumbo">Não foi possível carregar esta página</h1>
      <p className="text-sm text-muted-foreground">Ocorreu um erro inesperado. Tente novamente; se persistir, informe o código abaixo ao suporte interno.</p>
      {error.digest && <code className="rounded bg-muted px-2 py-1 text-xs">{error.digest}</code>}
      <Button onClick={reset}><RotateCcw /> Tentar novamente</Button>
    </div>
  );
}
