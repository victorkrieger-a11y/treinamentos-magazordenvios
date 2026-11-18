import { Brand } from "@/components/brand/brand";
import { MobileNav } from "@/components/layout/mobile-nav";
import { NotificationBell } from "@/components/layout/notification-bell";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { UserMenu } from "@/components/layout/user-menu";
import { ROLE_LABELS } from "@/lib/auth/roles";
import { requireSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireSession();
  const supabase = await createClient();
  if (profile.status === "invited") await supabase.rpc("touch_last_access");

  const [{ data: notifications }, { count: unread }] = await Promise.all([
    supabase.from("notifications").select("id, title, message, link, created_at, read_at").order("visible_at", { ascending: false }).limit(8),
    supabase.from("notifications").select("id", { count: "exact", head: true }).is("read_at", null),
  ]);

  return (
    <div className="min-h-dvh bg-background">
      <a href="#conteudo" className="sr-only z-50 rounded bg-white px-3 py-2 focus:not-sr-only focus:fixed focus:left-3 focus:top-3">
        Pular para o conteúdo
      </a>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r bg-sidebar lg:flex">
        <div className="flex h-16 items-center border-b px-5">
          <Brand />
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          <SidebarNav role={profile.role} />
        </div>
        <div className="border-t px-5 py-3 text-[11px] text-mz-gray">Ferramenta interna · Magazord Envios</div>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-2 border-b bg-white/90 px-4 backdrop-blur supports-[backdrop-filter]:bg-white/75 sm:px-6">
          <MobileNav role={profile.role} />
          <Brand compact className="lg:hidden" />
          <p className="hidden text-sm font-semibold text-mz-chumbo md:block lg:hidden">Treinamentos Magazord Envios</p>
          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            <NotificationBell
              unread={unread ?? 0}
              items={(notifications ?? []).map((n) => ({ id: n.id, title: n.title, message: n.message, link: n.link, createdAt: n.created_at, read: !!n.read_at }))}
            />
            <UserMenu name={profile.full_name} email={profile.email} roleLabel={ROLE_LABELS[profile.role]} />
          </div>
        </header>
        <main id="conteudo" className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
