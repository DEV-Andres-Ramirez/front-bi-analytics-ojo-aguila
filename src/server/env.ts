import "server-only";
import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  DATABASE_SSL: z.stringbool().default(true),
  /** PEM de la CA del servidor. Si existe, el TLS verifica el certificado. Admite saltos de línea escritos como "\n". */
  DATABASE_CA_CERT: z
    .string()
    .transform((pem) => pem.replaceAll("\\n", "\n").trim() || undefined)
    .optional(),
  DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(50).default(5),
  ACCESS_TOKEN: z.string().min(8, "ACCESS_TOKEN debe tener al menos 8 caracteres"),
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET debe tener al menos 32 caracteres"),
  SESSION_TTL_HOURS: z.coerce.number().int().min(1).max(24 * 30).default(12),
});

export type ServerEnv = z.infer<typeof envSchema>;

let cached: ServerEnv | null = null;

/** Variables de entorno del servidor validadas (lazy: no rompe `next build` si faltan). */
export function getEnv(): ServerEnv {
  if (cached) return cached;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(`Variables de entorno inválidas:\n${z.prettifyError(parsed.error)}`);
  }
  cached = parsed.data;
  return cached;
}
