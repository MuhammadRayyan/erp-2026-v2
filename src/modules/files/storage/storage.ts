export type PrivateStorage = {
  provider: "LOCAL" | "S3";
  write(key: string, bytes: Uint8Array): Promise<void>;
  read(key: string): Promise<Uint8Array>;
  delete(key: string): Promise<void>;
};
