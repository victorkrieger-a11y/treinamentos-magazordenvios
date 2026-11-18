"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { assignGuardian } from "@/server/actions/users";

const NONE = "__none__";

/** Vincula/desvincula o guardião de um colaborador (somente supervisor). */
export function GuardianLinkSelect({ collaboratorId, guardianId, guardians, label = "Guardião responsável" }: { collaboratorId: string; guardianId: string | null; guardians: { id: string; fullName: string }[]; label?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <div className="flex items-center gap-2">
      <Select
        value={guardianId ?? NONE}
        disabled={pending}
        onValueChange={(v) =>
          start(async () => {
            const res = await assignGuardian({ collaboratorId, guardianId: v === NONE ? null : v });
            if (res.ok) toast.success(res.message ?? "Vínculo atualizado.");
            else toast.error(res.error);
            router.refresh();
          })
        }
      >
        <SelectTrigger className="h-8 min-w-[200px]" aria-label={label}><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>Sem guardião</SelectItem>
          {guardians.map((g) => <SelectItem key={g.id} value={g.id}>{g.fullName}</SelectItem>)}
        </SelectContent>
      </Select>
      {pending && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
    </div>
  );
}
