import "server-only";
import { Pool } from "pg";
import { getAuthEnv } from "./auth/env";

// Pool único de Postgres (Supabase) para toda la app: Better Auth y puntuaciones.
// DATABASE_URL apunta al transaction pooler de Supabase (puerto 6543).
// En dev se reutiliza entre recargas (HMR) para no abrir conexiones de más.
const globalForDb = globalThis as unknown as { pgPool?: Pool };

export const pool: Pool =
  globalForDb.pgPool ??
  new Pool({ connectionString: getAuthEnv().DATABASE_URL });

if (process.env.NODE_ENV !== "production") globalForDb.pgPool = pool;
