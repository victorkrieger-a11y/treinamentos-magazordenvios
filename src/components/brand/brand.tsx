import Image from "next/image";
import { cn } from "@/lib/utils";

export function Brand({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <Image src="/brand/simbolo.svg" alt="Magazord" width={32} height={32} className="size-8 shrink-0" priority />
      {!compact && (
        <div className="leading-tight">
          <p className="font-display text-[11px] font-semibold uppercase tracking-[0.14em] text-mz-red">Treinamentos</p>
          <p className="text-sm font-bold text-mz-chumbo">Magazord Envios</p>
        </div>
      )}
    </div>
  );
}
