import type { PrivateStorage } from "@/modules/files/storage/storage";
import { localPrivateStorage } from "@/modules/files/storage/local-storage";

export function privateStorage(): PrivateStorage {
  const provider = (process.env.FILE_STORAGE_PROVIDER || "local").toLowerCase();
  if (provider === "local") return localPrivateStorage;
  if (provider === "s3") throw new Error("S3_FILE_STORAGE_NOT_CONFIGURED");
  throw new Error("FILE_STORAGE_PROVIDER_INVALID");
}

export function privateFileMaxBytes() {
  const value = Number(process.env.FILE_MAX_BYTES || 10 * 1024 * 1024);
  if (!Number.isInteger(value) || value <= 0 || value > 50 * 1024 * 1024) throw new Error("FILE_MAX_BYTES_INVALID");
  return value;
}
