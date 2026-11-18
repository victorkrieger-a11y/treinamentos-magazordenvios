"use client";

import { useEffect } from "react";
import { toast } from "sonner";

/** Exibe uma mensagem (toast) vinda de um redirecionamento. */
export function FlashMessage({ tone, message }: { tone: "success" | "danger" | "info"; message: string }) {
  useEffect(() => {
    if (tone === "success") toast.success(message);
    else if (tone === "danger") toast.error(message);
    else toast.info(message);
  }, [tone, message]);
  return null;
}
