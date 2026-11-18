import {
  Activity,
  BarChart3,
  ClipboardList,
  History,
  LayoutDashboard,
  Library,
  ListChecks,
  Settings,
  ShieldCheck,
  Target,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { UserRole } from "@/lib/auth/roles";

export type NavItem = { href: string; label: string; icon: LucideIcon };

export const NAV: Record<UserRole, NavItem[]> = {
  supervisor: [
    { href: "/painel", label: "Painel geral", icon: LayoutDashboard },
    { href: "/colaboradores", label: "Colaboradores", icon: Users },
    { href: "/guardioes", label: "Guardiões", icon: ShieldCheck },
    { href: "/avaliacoes", label: "Avaliações", icon: ClipboardList },
    { href: "/perguntas", label: "Banco de perguntas", icon: Library },
    { href: "/relatorios", label: "Relatórios", icon: BarChart3 },
    { href: "/atividades", label: "Atividades", icon: Activity },
    { href: "/configuracoes", label: "Configurações", icon: Settings },
  ],
  guardian: [
    { href: "/painel", label: "Painel da equipe", icon: LayoutDashboard },
    { href: "/colaboradores", label: "Minha equipe", icon: Users },
    { href: "/avaliacoes", label: "Avaliações", icon: ClipboardList },
    { href: "/perguntas", label: "Banco de perguntas", icon: Library },
    { href: "/relatorios", label: "Resultados", icon: BarChart3 },
    { href: "/atividades", label: "Atividades", icon: Activity },
  ],
  collaborator: [
    { href: "/painel", label: "Meu painel", icon: LayoutDashboard },
    { href: "/minhas-avaliacoes", label: "Minhas avaliações", icon: ListChecks },
    { href: "/historico", label: "Histórico", icon: History },
    { href: "/meu-desempenho", label: "Meu desempenho", icon: Target },
  ],
};
