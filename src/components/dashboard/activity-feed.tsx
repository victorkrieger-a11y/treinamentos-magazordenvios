import { describeActivity, type ActivityLog } from "@/lib/domain/activity";
import { formatDateTime, formatRelative } from "@/lib/domain/format";
import { EmptyState } from "@/components/common/empty-state";
import { Activity } from "lucide-react";
import { cn } from "@/lib/utils";

const DOT = {
  info: "bg-mz-blue",
  success: "bg-mz-green-dark",
  warning: "bg-mz-yellow",
  danger: "bg-mz-red",
  neutral: "bg-mz-gray",
};

export function ActivityFeed({ items }: { items: ActivityLog[] }) {
  if (items.length === 0) return <EmptyState icon={Activity} title="Nenhuma atividade registrada" />;
  return (
    <ol className="relative grid gap-4 before:absolute before:inset-y-1 before:left-[5px] before:w-px before:bg-border">
      {items.map((log) => {
        const d = describeActivity(log);
        return (
          <li key={log.id} className="relative pl-6">
            <span aria-hidden className={cn("absolute left-0 top-1.5 size-[11px] rounded-full ring-4 ring-white", DOT[d.tone])} />
            <p className="text-sm text-mz-chumbo">{d.text}</p>
            <time dateTime={log.createdAt} title={formatDateTime(log.createdAt)} className="text-xs text-muted-foreground">
              {formatRelative(log.createdAt)}
            </time>
          </li>
        );
      })}
    </ol>
  );
}
