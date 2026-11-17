import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import { getSupabaseEnv } from "./env";

/**
 * Cliente de Supabase para el navegador (Client Components).
 * `createBrowserClient` reutiliza una única instancia, así que llamarlo varias veces es seguro.
 */
export function createClient(): SupabaseClient<Database> {
  const { url, publishableKey } = getSupabaseEnv();
  return createBrowserClient<Database>(url, publishableKey);
}
