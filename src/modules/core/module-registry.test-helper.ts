import { moduleRegistry } from "./module-registry";

export function duplicateModuleKeys() {
  const seen = new Set<string>();
  return moduleRegistry.map((module) => module.key).filter((key) => (seen.has(key) ? true : (seen.add(key), false)));
}
