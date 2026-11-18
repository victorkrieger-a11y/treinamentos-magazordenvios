import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { buildReport, reportToCsv, type ReportParams } from "@/lib/data/reports";
import { todayInBrasilia } from "@/lib/domain/format";

export const dynamic = "force-dynamic";

/** Exportação CSV do relatório (mesmos filtros da página; dados limitados pelo RLS). */
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session || session.profile.role === "collaborator") {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }
  const params = Object.fromEntries(request.nextUrl.searchParams.entries()) as ReportParams;
  const supabase = await createClient();
  const report = await buildReport(supabase, params);
  return new NextResponse(reportToCsv(report.rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="relatorio-treinamentos-${todayInBrasilia()}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
