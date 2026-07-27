import { moduleRegistry } from "./module-registry";

export function duplicateModuleKeys() {
  const seen = new Set<string>();
  const duplicates: string[] = [];

  for (const entry of moduleRegistry) {
    if (seen.has(entry.key)) {
      duplicates.push(entry.key);
      continue;
    }

    seen.add(entry.key);
  }

  return duplicates;
}
