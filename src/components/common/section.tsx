import { cn } from "@/lib/utils";

export function Section({
  title,
  description,
  actions,
  children,
  className,
  contentClassName,
  id,
}: {
  title?: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
  id?: string;
}) {
  return (
    <section id={id} aria-labelledby={title && id ? `${id}-title` : undefined} className={cn("min-w-0 rounded-xl border bg-card shadow-[0_1px_2px_rgba(56,56,56,0.04)]", className)}>
      {(title || actions) && (
        <header className="flex flex-wrap items-start justify-between gap-3 border-b px-5 py-4">
          <div className="min-w-0">
            {title && <h2 id={id ? `${id}-title` : undefined} className="text-sm font-semibold text-mz-chumbo">{title}</h2>}
            {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={cn("p-5", contentClassName)}>{children}</div>
    </section>
  );
}
