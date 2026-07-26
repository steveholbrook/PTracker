import type { Permission, ProjectRole } from "@/types/domain";

const permissions: Record<ProjectRole, Permission[]> = {
  ADMIN: [
    "CREATE_PROJECT",
    "MANAGE_ACCESS",
    "EDIT_SETTINGS",
    "EDIT_POAP",
    "LOAD_FORECAST",
    "EDIT_ACTUALS",
    "FI_UPLOAD",
    "CREATE_INVOICE",
    "APPROVE_INVOICE",
    "VIEW_INTERNAL_RATES",
  ],
  PROJECT_MANAGER: [
    "EDIT_SETTINGS",
    "EDIT_POAP",
    "LOAD_FORECAST",
    "EDIT_ACTUALS",
    "FI_UPLOAD",
    "CREATE_INVOICE",
    "VIEW_INTERNAL_RATES",
  ],
  DELIVERY_LEAD: ["EDIT_POAP", "VIEW_INTERNAL_RATES"],
  FINANCE_REVIEWER: [
    "CREATE_INVOICE",
    "APPROVE_INVOICE",
    "VIEW_INTERNAL_RATES",
  ],
  INTERNAL_VIEWER: ["VIEW_INTERNAL_RATES"],
  CUSTOMER_VIEWER: [],
};

export function can(role: ProjectRole | undefined, permission: Permission) {
  return role ? permissions[role].includes(permission) : false;
}

export function roleLabel(role: ProjectRole) {
  return role
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

