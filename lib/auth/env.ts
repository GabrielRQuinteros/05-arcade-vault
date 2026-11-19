import { z } from "zod";

const authEnvSchema = z.object({
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.url(),
  DATABASE_URL: z.string().regex(/^postgres(ql)?:\/\//),
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  GITHUB_CLIENT_ID: z.string().min(1),
  GITHUB_CLIENT_SECRET: z.string().min(1),
});

export type AuthEnv = z.infer<typeof authEnvSchema>;

/**
 * Lee y valida las env vars de Better Auth. Solo servidor: contienen secretos
 * (firma de sesión, password de la BD, secretos OAuth). Lanza si faltan o son inválidas.
 */
export function getAuthEnv(): AuthEnv {
  const result = authEnvSchema.safeParse({
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
    BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
    DATABASE_URL: process.env.DATABASE_URL,
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID,
    GITHUB_CLIENT_SECRET: process.env.GITHUB_CLIENT_SECRET,
  });

  if (!result.success) {
    const keys = [
      ...new Set(result.error.issues.map((issue) => String(issue.path[0]))),
    ];
    throw new Error(`Auth env vars faltantes o inválidas: ${keys.join(", ")}`);
  }

  return result.data;
}
