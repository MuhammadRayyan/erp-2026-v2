import { moduleRegistry } from "./module-registry";

export function duplicateModuleKeys() {
  const seen = new Set<string>();
  const duplicates: string[] = [];

  for (const module of moduleRegistry) {
    if (seen.has(module.key)) {
      duplicates.push(module.key);
      continue;
    }

    seen.add(module.key);
  }

  return duplicates;
}
