import type { UserRole } from "@/lib/types";

const DASHBOARD_ROUTES: Record<UserRole, string> = {
  employee: "/dashboard/employee",
  team_lead: "/dashboard/team-lead",
  hr: "/dashboard/hr",
  super_admin: "/dashboard/admin",
};

const ROLE_LABELS: Record<UserRole, string> = {
  employee: "Employee",
  team_lead: "Team Lead",
  hr: "HR",
  super_admin: "Admin",
};

export function isAdmin(role: UserRole) {
  return role === "super_admin";
}

export function canManageUsers(role: UserRole) {
  return role === "super_admin" || role === "hr";
}

export function canManageMeetings(role: UserRole) {
  return role === "super_admin" || role === "hr";
}

export function canManageClientMeetings(role: UserRole) {
  return role === "super_admin" || role === "team_lead";
}

export function canManageSalary(role: UserRole) {
  return role === "super_admin" || role === "hr";
}

export function canManageDepartments(role: UserRole) {
  return role === "super_admin" || role === "hr";
}

export function canManageLeave(role: UserRole) {
  return role === "super_admin" || role === "hr" || role === "team_lead";
}

export function canFinalizeLeave(role: UserRole) {
  return role === "super_admin" || role === "hr";
}

export function getHomeRoute(role: UserRole) {
  return DASHBOARD_ROUTES[role] || "/dashboard/employee";
}

export function formatRoleLabel(role: UserRole) {
  return ROLE_LABELS[role] || role;
}