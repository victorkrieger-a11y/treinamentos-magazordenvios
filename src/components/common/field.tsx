import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/** Campo de formulário com label, dica e mensagem de erro acessível. */
export function Field({ id, label, error, hint, required, children, className }: { id: string; label: string; error?: string; hint?: React.ReactNode; required?: boolean; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("grid gap-1.5", className)}>
      <Label htmlFor={id} className="text-xs font-semibold text-mz-chumbo">
        {label}
        {required && <span className="text-mz-red" aria-hidden> *</span>}
      </Label>
      {children}
      {hint && !error && <p id={`${id}-hint`} className="text-xs text-muted-foreground">{hint}</p>}
      {error && <p id={`${id}-error`} role="alert" className="text-xs font-medium text-mz-red-strong">{error}</p>}
    </div>
  );
}
