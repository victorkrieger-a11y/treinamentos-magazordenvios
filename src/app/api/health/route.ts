import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Verificação simples de disponibilidade (sem dados sensíveis). */
export function GET() {
  return NextResponse.json({ status: "ok" });
}
