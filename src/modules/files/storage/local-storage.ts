import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { PrivateStorage } from "@/modules/files/storage/storage";

function rootPath() {
  return path.resolve(process.env.FILE_STORAGE_ROOT || "./storage/private");
}

function resolveKey(key: string) {
  const root = rootPath();
  const target = path.resolve(root, key);
  if (target !== root && !target.startsWith(`${root}${path.sep}`)) throw new Error("FILE_STORAGE_KEY_INVALID");
  return { root, target };
}

export const localPrivateStorage: PrivateStorage = {
  provider: "LOCAL",
  async write(key, bytes) {
    const { target } = resolveKey(key);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, bytes, { flag: "wx", mode: 0o600 });
  },
  async read(key) {
    const { target } = resolveKey(key);
    return readFile(target);
  },
  async delete(key) {
    const { target } = resolveKey(key);
    await rm(target, { force: true });
  },
};
