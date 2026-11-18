"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Link2, Loader2, Unlink } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { assignGuardian } from "@/server/actions/users";

/** Adicionar colaborador à equipe do guardião. */
export function AddToTeam({ guardianId, candidates }: { guardianId: string; candidates: { id: string; fullName: string; currentGuardian: string | null }[] }) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={value} onValueChange={setValue}>
        <SelectTrigger className="h-9 w-[280px]" aria-label="Selecionar colaborador para vincular"><SelectValue placeholder="Selecionar colaborador" /></SelectTrigger>
        <SelectContent>
          {candidates.length === 0 && <div className="px-3 py-2 text-xs text-muted-foreground">Todos os colaboradores já estão nesta equipe.</div>}
          {candidates.map((c) => (
            <SelectItem key={c.id} value={c.id}>{c.fullName}{c.currentGuardian ? ` (atual: ${c.currentGuardian})` : ""}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        size="sm"
        className="h-9"
        disabled={!value || pending}
        onClick={() =>
          start(async () => {
            const res = await assignGuardian({ collaboratorId: value, guardianId });
            if (res.ok) { toast.success(res.message ?? "Vinculado."); setValue(""); router.refresh(); }
            else toast.error(res.error);
          })
        }
      >
        {pending ? <Loader2 className="animate-spin" /> : <Link2 />} Vincular
      </Button>
    </div>
  );
}

export function UnlinkButton({ collaboratorId, name }: { collaboratorId: string; name: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={pending}
      aria-label={`Desvincular ${name}`}
      onClick={() =>
        start(async () => {
          const res = await assignGuardian({ collaboratorId, guardianId: null });
          if (res.ok) { toast.success(res.message ?? "Desvinculado."); router.refresh(); }
          else toast.error(res.error);
        })
      }
    >
      {pending ? <Loader2 className="animate-spin" /> : <Unlink />} Desvincular
    </Button>
  );
}
