import type { BusinessCapability } from "@/modules/access/roles";

export type ModuleGroup = "work" | "finance" | "operations" | "insights" | "settings";

export type ErpModule = {
  key: string;
  label: string;
  group: ModuleGroup;
  href: string;
  description: string;
  entitlement: string;
  permission: BusinessCapability;
  phase: number;
  status: "foundation" | "planned";
};

export const moduleRegistry: readonly ErpModule[] = [
  { key: "dashboard", label: "Dashboard", group: "work", href: "/business/dashboard", description: "Business position and work queues", entitlement: "core.dashboard", permission: "dashboard.view", phase: 1, status: "foundation" },
  { key: "parties", label: "Customers & Suppliers", group: "work", href: "/business/parties", description: "Shared parties, contacts, addresses, and commercial roles", entitlement: "parties.core", permission: "parties.view", phase: 3, status: "foundation" },
  { key: "catalog", label: "Items & Services", group: "work", href: "/business/catalog", description: "Products, services, units, prices, and default classifications", entitlement: "catalog.core", permission: "catalog.view", phase: 3, status: "foundation" },
  { key: "sales", label: "Sales", group: "work", href: "/business/sales", description: "Quote-to-cash workflows", entitlement: "sales.core", permission: "sales.view", phase: 7, status: "planned" },
  { key: "purchases", label: "Purchases", group: "work", href: "/business/purchases", description: "Procure-to-pay workflows", entitlement: "purchases.core", permission: "purchases.view", phase: 8, status: "planned" },
  { key: "banking", label: "Banking", group: "finance", href: "/business/banking", description: "Cash, statements, and reconciliation", entitlement: "banking.core", permission: "banking.view", phase: 9, status: "planned" },
  { key: "accounting", label: "Accounting", group: "finance", href: "/business/accounting", description: "Ledger, periods, VAT, and reports", entitlement: "accounting.core", permission: "accounting.view", phase: 5, status: "planned" },
  { key: "inventory", label: "Inventory", group: "operations", href: "/business/inventory", description: "Stock, valuation, and movement control", entitlement: "inventory.core", permission: "inventory.view", phase: 11, status: "planned" },
  { key: "projects", label: "Projects & Jobs", group: "operations", href: "/business/projects", description: "Projects, jobs, costs, and completion", entitlement: "projects.core", permission: "projects.view", phase: 12, status: "planned" },
  { key: "reports", label: "Reports", group: "insights", href: "/business/reports", description: "Financial and operational insights", entitlement: "reports.core", permission: "reports.view", phase: 16, status: "planned" },
  { key: "settings", label: "Business Settings", group: "settings", href: "/business/settings", description: "Business identity and configuration", entitlement: "core.settings", permission: "settings.view", phase: 4, status: "foundation" },
] as const;

export function modulesByGroup(group: ModuleGroup) {
  return moduleRegistry.filter((module) => module.group === group);
}
