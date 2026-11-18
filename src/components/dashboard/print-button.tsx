"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Impressão / "Salvar como PDF" do navegador (base para exportação em PDF). */
export function PrintButton() {
  return <Button variant="outline" onClick={() => window.print()}><Printer /> Imprimir / PDF</Button>;
}
