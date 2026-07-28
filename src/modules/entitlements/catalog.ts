export const booleanFeatureKeys = [
  "core.dashboard",
  "core.settings",
  "parties.core",
  "catalog.core",
  "files.core",
  "users.manage",
  "sales.core",
  "purchases.core",
  "banking.core",
  "accounting.core",
  "inventory.core",
  "projects.core",
  "reports.core",
] as const;

export const limitFeatureKeys = ["limit.businesses", "limit.users"] as const;

export type BooleanFeatureKey = (typeof booleanFeatureKeys)[number];
export type LimitFeatureKey = (typeof limitFeatureKeys)[number];
export type FeatureKey = BooleanFeatureKey | LimitFeatureKey;

export const INTERNAL_UNLIMITED_PLAN_KEY = "internal-unlimited";
