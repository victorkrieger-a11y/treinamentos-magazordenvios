"use client";

import { useTransition } from "react";
import { Loader2, PlayCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { startAttempt } from "@/server/actions/attempts";

export function StartButton({ assignmentId, label }: { assignmentId: string; label: string }) {
  const [pending, start] = useTransition();
  return (
    <Button
      size="lg"
      className="h-11 px-6 font-semibold"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await startAttempt(assignmentId);
          if (res && !res.ok) toast.error(res.error);
        })
      }
    >
      {pending ? <Loader2 className="animate-spin" /> : <PlayCircle />} {label}
    </Button>
  );
}
