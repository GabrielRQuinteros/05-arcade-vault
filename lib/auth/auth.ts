import { betterAuth } from "better-auth";
import { haveIBeenPwned, jwt, username } from "better-auth/plugins";
import { pool } from "@/lib/db";
import { getAuthEnv } from "./env";
import {
  USERNAME_MAX,
  USERNAME_MIN,
  candidateFromEmail,
  candidateFromLogin,
  ensureUniqueUsername,
} from "./username";

// Solo servidor. Nunca importar desde componentes cliente.
const env = getAuthEnv();

// Pool compartido (lib/db.ts): Better Auth y las puntuaciones usan las mismas conexiones.

async function isUsernameTaken(name: string): Promise<boolean> {
  const { rowCount } = await pool.query(
    'select 1 from public."user" where username = $1 limit 1',
    [name],
  );
  return (rowCount ?? 0) > 0;
}

export const auth = betterAuth({
  database: pool,
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
  },
  socialProviders: {
    // El username único se resuelve aquí (no en databaseHooks): el hook del
    // plugin username corre antes que los del usuario y rechazaría un duplicado.
    google: {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      mapProfileToUser: async (p) => ({
        username: await ensureUniqueUsername(
          candidateFromEmail(p.email),
          isUsernameTaken,
        ),
      }),
    },
    github: {
      clientId: env.GITHUB_CLIENT_ID,
      clientSecret: env.GITHUB_CLIENT_SECRET,
      mapProfileToUser: async (p) => ({
        username: await ensureUniqueUsername(
          candidateFromLogin(p.login),
          isUsernameTaken,
        ),
      }),
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 días
    updateAge: 60 * 60 * 24, // renovación deslizante, máx. 1 vez/día
    cookieCache: { enabled: true, maxAge: 60 * 5, strategy: "jwt" },
  },
  // SPEC 13: rate limit por IP en la tabla public."rateLimit" (la memoria es por
  // instancia y en serverless casi no limita). `enabled` queda en el default:
  // solo en producción. Resto de rutas: default global (100 / 10 s).
  rateLimit: {
    storage: "database",
    customRules: {
      "/sign-up/email": { window: 3600, max: 3 },
      "/sign-in/email": { window: 60, max: 5 },
      "/sign-in/username": { window: 60, max: 5 },
    },
  },
  account: {
    // Sin vinculación: cada método (contraseña, Google, GitHub) es una cuenta aparte.
    accountLinking: { enabled: false },
  },
  plugins: [
    username({
      minUsernameLength: USERNAME_MIN,
      maxUsernameLength: USERNAME_MAX,
      usernameValidator: (u) => /^[a-zA-Z0-9_]+$/.test(u),
    }),
    jwt(),
    // SPEC 13: rechaza contraseñas filtradas en el signup (k-anonymity, solo 5 chars del SHA-1).
    // Si la API de HIBP no responde, el signup falla con 500 (fail-closed).
    haveIBeenPwned(),
  ],
});
