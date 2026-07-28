import { createHash, randomUUID } from "node:crypto";
import path from "node:path";

const allowed = new Map([
  [".pdf", ["application/pdf"]],
  [".png", ["image/png"]],
  [".jpg", ["image/jpeg"]],
  [".jpeg", ["image/jpeg"]],
  [".webp", ["image/webp"]],
  [".csv", ["text/csv", "text/plain", "application/vnd.ms-excel"]],
  [".docx", ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/zip"]],
  [".xlsx", ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/zip"]],
] as const);

function startsWith(bytes: Uint8Array, signature: number[]) {
  return signature.every((value, index) => bytes[index] === value);
}

function signatureMatches(extension: string, bytes: Uint8Array) {
  if (extension === ".pdf") return startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d]);
  if (extension === ".png") return startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (extension === ".jpg" || extension === ".jpeg") return startsWith(bytes, [0xff, 0xd8, 0xff]);
  if (extension === ".webp") return startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  if (extension === ".docx" || extension === ".xlsx") return startsWith(bytes, [0x50, 0x4b, 0x03, 0x04]);
  if (extension === ".csv") return !bytes.slice(0, 4096).includes(0);
  return false;
}

export function validatePrivateFile(input: { name: string; contentType: string; bytes: Uint8Array; maxBytes: number }) {
  const extension = path.extname(input.name).toLowerCase();
  const acceptedTypes = allowed.get(extension);
  if (!acceptedTypes) throw new Error("FILE_EXTENSION_NOT_ALLOWED");
  if (input.bytes.byteLength === 0) throw new Error("FILE_EMPTY");
  if (input.bytes.byteLength > input.maxBytes) throw new Error("FILE_TOO_LARGE");
  if (!acceptedTypes.includes(input.contentType as never)) throw new Error("FILE_CONTENT_TYPE_NOT_ALLOWED");
  if (!signatureMatches(extension, input.bytes)) throw new Error("FILE_SIGNATURE_MISMATCH");
  const baseName = path.basename(input.name, extension).replace(/[^a-zA-Z0-9._ -]+/g, "-").trim().slice(0, 100) || "file";
  const safeName = `${baseName}${extension}`;
  return {
    extension: extension.slice(1),
    safeName,
    sha256: createHash("sha256").update(input.bytes).digest("hex"),
  };
}

export function createStorageKey(input: { tenantId: string; businessId: string; extension: string }) {
  const date = new Date().toISOString().slice(0, 10);
  return `${input.tenantId}/${input.businessId}/${date}/${randomUUID()}.${input.extension}`;
}
