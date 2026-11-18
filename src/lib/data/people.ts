import "server-only";

import type { ServerSupabase } from "@/lib/supabase/server";

export type GuardianRecord = {
  id: string;
  fullName: string;
  email: string;
  status: "invited" | "active" | "inactive";
  jobTitle: string | null;
  createdAt: string;
  lastAccessAt: string | null;
};

export async function loadGuardians(supabase: ServerSupabase): Promise<GuardianRecord[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, email, status, job_title, created_at, last_access_at")
    .eq("role", "guardian")
    .order("full_name");
  if (error) throw new Error(error.message);
  return (data ?? []).map((g) => ({
    id: g.id,
    fullName: g.full_name,
    email: g.email,
    status: g.status,
    jobTitle: g.job_title,
    createdAt: g.created_at,
    lastAccessAt: g.last_access_at,
  }));
}
