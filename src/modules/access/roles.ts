export const businessCapabilities = [
  "dashboard.view",
  "parties.view",
  "parties.manage",
  "catalog.view",
  "catalog.manage",
  "sales.view",
  "sales.manage",
  "purchases.view",
  "purchases.manage",
  "banking.view",
  "banking.manage",
  "accounting.view",
  "accounting.manage",
  "inventory.view",
  "inventory.manage",
  "projects.view",
  "projects.manage",
  "reports.view",
  "settings.view",
  "settings.manage",
  "users.manage",
] as const;

export type BusinessCapability = (typeof businessCapabilities)[number];

export type BusinessRoleDefinition = {
  key: string;
  label: string;
  description: string;
  capabilities: readonly BusinessCapability[];
};

const allCapabilities = businessCapabilities;

export const businessRoles: readonly BusinessRoleDefinition[] = [
  { key: "business.owner", label: "Business Owner", description: "Full business access, including users and settings.", capabilities: allCapabilities },
  { key: "business.admin", label: "Business Administrator", description: "Operational administration without ownership transfer authority.", capabilities: allCapabilities },
  {
    key: "business.accountant",
    label: "Accountant",
    description: "Accounting, banking, reports, purchases, sales, parties, and catalog visibility.",
    capabilities: ["dashboard.view", "parties.view", "catalog.view", "sales.view", "purchases.view", "banking.view", "banking.manage", "accounting.view", "accounting.manage", "inventory.view", "projects.view", "reports.view", "settings.view"],
  },
  {
    key: "business.sales",
    label: "Sales User",
    description: "Sales and customer workflow access without accounting administration.",
    capabilities: ["dashboard.view", "parties.view", "parties.manage", "catalog.view", "sales.view", "sales.manage", "inventory.view", "projects.view", "reports.view"],
  },
  {
    key: "business.purchases",
    label: "Purchasing User",
    description: "Supplier, catalog, and purchase workflow access.",
    capabilities: ["dashboard.view", "parties.view", "parties.manage", "catalog.view", "catalog.manage", "purchases.view", "purchases.manage", "inventory.view", "projects.view", "reports.view"],
  },
  { key: "business.inventory", label: "Inventory User", description: "Stock, item, and warehouse operations.", capabilities: ["dashboard.view", "parties.view", "catalog.view", "catalog.manage", "inventory.view", "inventory.manage", "sales.view", "purchases.view", "reports.view"] },
  { key: "business.project-manager", label: "Project Manager", description: "Project and job delivery with related commercial visibility.", capabilities: ["dashboard.view", "parties.view", "parties.manage", "catalog.view", "projects.view", "projects.manage", "sales.view", "purchases.view", "inventory.view", "reports.view"] },
  { key: "business.technician", label: "Technician / Field User", description: "Assigned project and service work access.", capabilities: ["dashboard.view", "parties.view", "catalog.view", "projects.view", "projects.manage", "inventory.view"] },
  {
    key: "business.viewer",
    label: "Viewer",
    description: "Read-only operational and reporting access.",
    capabilities: ["dashboard.view", "parties.view", "catalog.view", "sales.view", "purchases.view", "banking.view", "accounting.view", "inventory.view", "projects.view", "reports.view", "settings.view"],
  },
] as const;

const roleByKey = new Map(businessRoles.map((role) => [role.key, role]));

export function getBusinessRole(roleKey: string) {
  return roleByKey.get(roleKey) ?? null;
}

export function hasBusinessCapability(roleKey: string, capability: BusinessCapability) {
  return getBusinessRole(roleKey)?.capabilities.includes(capability) ?? false;
}
