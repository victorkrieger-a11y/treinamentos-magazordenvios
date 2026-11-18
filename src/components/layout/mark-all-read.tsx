"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { markNotificationsRead } from "@/server/actions/notifications";

export function MarkAllRead() {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button variant="outline" size="sm" disabled={pending} onClick={() => start(async () => { await markNotificationsRead(); router.refresh(); })}>
      {pending ? <Loader2 className="animate-spin" /> : <CheckCheck />} Marcar todas como lidas
    </Button>
  );
}
