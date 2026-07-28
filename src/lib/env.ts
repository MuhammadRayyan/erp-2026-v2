import { z } from "zod";

const optionalCredential = z.preprocess((value) => value === "" ? undefined : value, z.string().min(1).optional());
const optionalSecret = z.preprocess((value) => value === "" ? undefined : value, z.string().min(32).optional());

const environmentSchema = z.object({
  DATABASE_URL: z.string().url().or(z.string().startsWith("postgresql://")),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.string().url(),
  APP_URL: z.string().url(),
  SMTP_HOST: z.string().min(1).optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(1025),
  SMTP_SECURE: z.stringbool().default(false),
  SMTP_USER: optionalCredential,
  SMTP_PASSWORD: optionalCredential,
  EMAIL_FROM: z.string().min(3).default("ERP 2026 <no-reply@localhost>"),
  OUTBOX_WORKER_SECRET: optionalSecret,
  OUTBOX_BATCH_SIZE: z.coerce.number().int().min(1).max(50).default(10),
  OUTBOX_POLL_SECONDS: z.coerce.number().int().min(2).max(300).default(5),
  FILE_STORAGE_PROVIDER: z.enum(["local", "s3"]).default("local"),
  FILE_STORAGE_ROOT: z.string().min(1).default("./storage/private"),
  FILE_MAX_BYTES: z.coerce.number().int().positive().max(50 * 1024 * 1024).default(10 * 1024 * 1024),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

export type AppEnvironment = z.infer<typeof environmentSchema>;

export function parseEnvironment(values: Record<string, string | undefined>): AppEnvironment {
  return environmentSchema.parse(values);
}
