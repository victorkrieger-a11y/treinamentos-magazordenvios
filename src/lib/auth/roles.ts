import type { Database } from "@/types/database";

export type UserRole = Database["public"]["Enums"]["user_role"];
export type UserStatus = Database["public"]["Enums"]["user_status"];

export const ROLE_LABELS: Record<UserRole, string> = {
  supervisor: "Supervisor",
  guardian: "Guardião",
  collaborator: "Colaborador",
};

export const USER_STATUS_LABELS: Record<UserStatus, string> = {
  invited: "Convidado",
  active: "Ativo",
  inactive: "Inativo",
};

export const STAFF_ROLES: UserRole[] = ["supervisor", "guardian"];

export function isStaff(role: UserRole) {
  return role === "supervisor" || role === "guardian";
}

/**
 * Mapa de rotas protegidas por perfil. Usado pelo layout para bloquear acesso
 * (além do RLS no banco e das validações nas Server Actions).
 */
export const ROUTE_ACCESS: { prefix: string; roles: UserRole[] }[] = [
  { prefix: "/colaboradores", roles: ["supervisor", "guardian"] },
  { prefix: "/guardioes", roles: ["supervisor"] },
  { prefix: "/avaliacoes", roles: ["supervisor", "guardian"] },
  { prefix: "/perguntas", roles: ["supervisor", "guardian"] },
  { prefix: "/relatorios", roles: ["supervisor", "guardian"] },
  { prefix: "/configuracoes", roles: ["supervisor"] },
  { prefix: "/atividades", roles: ["supervisor", "guardian"] },
  { prefix: "/minhas-avaliacoes", roles: ["collaborator"] },
  { prefix: "/quiz", roles: ["collaborator"] },
  { prefix: "/historico", roles: ["collaborator"] },
  { prefix: "/meu-desempenho", roles: ["collaborator"] },
];

export function canAccessPath(role: UserRole, path: string) {
  const rule = ROUTE_ACCESS.find((r) => path === r.prefix || path.startsWith(`${r.prefix}/`));
  return !rule || rule.roles.includes(role);
}
