# SPEC 04 — Integración inicial con Supabase

> **Status:** Implemented
> **Depends on:** SPEC 03
> **Date:** 2026-11-17
> **Objective:** Preparar el proyecto para usar Supabase creando los clientes de navegador y servidor con `@supabase/ssr`, validación de env vars y tipos `Database`, sin crear tablas ni consultas.

## Why this spec exists

Las próximas specs (auth, puntuaciones, salón de la fama) van a leer y escribir en Supabase. Esta spec deja la base lista y verificada: clientes tipados y env vars validadas y documentadas, sin decidir todavía ningún esquema de datos.

Las dependencias `@supabase/ssr` y `@supabase/supabase-js` ya están instaladas, y `.env.local` ya tiene `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` y `SUPABASE_DB_PASSWORD`. `.env.example` todavía no las documenta.

## Scope

**In:**

- Documentar en `.env.example` las claves `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` y `SUPABASE_DB_PASSWORD`, sin valores.
- `lib/supabase/env.ts`: lectura y validación con Zod de URL y publishable key.
- `lib/supabase/database.types.ts`: tipos `Database` generados con la tool `generate_typescript_types` del MCP Supabase (schema `public` vacío).
- `lib/supabase/client.ts`: cliente de navegador (`createBrowserClient<Database>`).
- `lib/supabase/server.ts`: cliente de servidor (`createServerClient<Database>`) con `cookies()` de `next/headers`.

**Out of scope (for future specs):**

- Tablas, migraciones, RLS y cualquier consulta a la BD.
- Autenticación (login, registro, sesión) y `proxy.ts` para refrescar sesión.
- Cliente admin con secret key / service role.
- Storage, Realtime, Edge Functions.
- Script npm o Supabase CLI para regenerar tipos.
- Usar `SUPABASE_DB_PASSWORD` desde la app (queda solo para CLI/migraciones).
- Cambios de UI.
- Cualquier endpoint o ruta pública que permita a los clientes comprobar si Supabase / la BD está activa. Los chequeos de salud de la BD son internos y nunca se exponen.

## Data model

Sin tablas ni persistencia nueva.

Env vars (`.env.example`, versionado, se agrega al final):

```bash
# Supabase: https://supabase.com/dashboard/project/_/settings/api
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=

# Password de la BD. Solo para Supabase CLI / migraciones; la app no la lee.
SUPABASE_DB_PASSWORD=
```

`lib/supabase/env.ts`:

```ts
// Esquema Zod
const supabaseEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
});

type SupabaseEnv = { url: string; publishableKey: string };

// Lanza Error("Supabase env vars faltantes o inválidas: <claves>") si falla.
function getSupabaseEnv(): SupabaseEnv;
```

Las variables se leen como `process.env.NEXT_PUBLIC_SUPABASE_URL` y `process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` de forma literal (no `process.env[key]`), para que Next las inline en el bundle del navegador.

`lib/supabase/client.ts`:

```ts
export function createClient(): SupabaseClient<Database>; // createBrowserClient
```

`lib/supabase/server.ts`:

```ts
export async function createClient(): Promise<SupabaseClient<Database>>; // createServerClient + await cookies()
// setAll en try/catch: en Server Components no se pueden escribir cookies; se ignora.
```

Archivos tras esta spec:

- `lib/supabase/env.ts` (nuevo)
- `lib/supabase/database.types.ts` (nuevo, generado)
- `lib/supabase/client.ts` (nuevo)
- `lib/supabase/server.ts` (nuevo)
- `.env.example` (modificado)

## Implementation plan

1. Agregar a `.env.example` el bloque Supabase del modelo de datos. Verificar que `.env.local` tiene las 3 claves con valor (sin imprimir los valores) y que `git status` no muestra `.env.local`.
2. Leer la skill `supabase` y, en `node_modules/next/dist/docs/01-app/`, la guía de `cookies()`. Revisar la guía de `@supabase/ssr` para Next (patrón `getAll`/`setAll`).
3. Crear `lib/supabase/env.ts` con `supabaseEnvSchema` y `getSupabaseEnv()`.
4. Generar los tipos con `mcp__supabase__generate_typescript_types` y guardarlos en `lib/supabase/database.types.ts` sin editar. Confirmar que no hay tablas (`list_tables` vacío en `public`); si existen, se generan igual pero no se usan.
5. Crear `lib/supabase/client.ts` y `lib/supabase/server.ts` tipados con `Database` y usando `getSupabaseEnv()`. `npx tsc --noEmit` pasa.
6. Correr `npm run build`, `npx eslint app components lib` y `npx prettier --check lib app`.

## Acceptance criteria

- [X] `.env.example` contiene `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` y `SUPABASE_DB_PASSWORD` sin valores reales.
- [X] `git status` no muestra `.env.local`.
- [X] Existen `lib/supabase/env.ts`, `lib/supabase/client.ts`, `lib/supabase/server.ts` y `lib/supabase/database.types.ts`.
- [X] Ambos clientes están tipados con `Database` y obtienen URL y key solo vía `getSupabaseEnv()`.
- [X] Ningún archivo nuevo lee `SUPABASE_DB_PASSWORD`.
- [X] No se creó ninguna tabla, migración ni política en el proyecto Supabase (`list_migrations` sin cambios).
- [X] No hay llamadas `.from(...)`, `.rpc(...)` ni SQL en el código.
- [X] `npx tsc --noEmit`, `npx eslint app components lib` y `npm run build` terminan sin errores.
- [X] No existe ninguna ruta (ej. `/api/salud/...`) que exponga a los clientes el estado de Supabase / la BD.

## Decisions

- **Yes:** clientes de navegador y servidor con `@supabase/ssr`. Decisión del usuario: base para las próximas specs.
- **No:** `proxy.ts` de refresco de sesión. Sin auth sería código muerto; va con la spec de autenticación.
- **No:** cliente admin con secret key. Ninguna feature lo necesita todavía y amplía la superficie de riesgo.
- **Yes:** carpeta `lib/supabase/`. Agrupa clientes, env y tipos; sigue la convención de la guía oficial.
- **Yes:** validación de env vars con Zod en `getSupabaseEnv()`. Decisión del usuario: error claro si faltan, coherente con SPEC 03.
- **No:** `process.env.X!` directo. Falla con errores crípticos dentro de supabase-js.
- **Yes:** tipos `Database` generados por MCP en `lib/supabase/database.types.ts`. Decisión del usuario: clientes tipados desde ya, sin dependencia nueva.
- **No:** Supabase CLI + script npm para tipos. Requiere login y una dependencia más; puede agregarse cuando haya migraciones.
- **No:** endpoint público de salud (`GET /api/salud/supabase`). Decisión del usuario (revisada durante la implementación): ningún cliente debe poder saber si la BD está activa usando rutas de la app; los chequeos de salud de la BD son internos y no se exponen. Los clientes se validan por tipos y build.
- **Yes:** `SUPABASE_DB_PASSWORD` documentada en `.env.example` pero no leída por la app. Solo la usará el CLI/migraciones.

## Risks

| Risk                                                     | Mitigation                                                                                      |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `SUPABASE_DB_PASSWORD` filtrada al cliente o al repo     | Sin prefijo `NEXT_PUBLIC_`, ningún archivo la lee; `.env.local` ignorado; criterio lo verifica. |
| Env vars no inlineadas en el navegador                   | `env.ts` las lee con acceso literal `process.env.NEXT_PUBLIC_...`.                              |
| `cookies().set` lanza en Server Components               | `setAll` envuelto en try/catch, como indica la guía de `@supabase/ssr`.                         |
| Tipos generados desactualizados tras futuras migraciones | Cada spec que cree tablas regenera `database.types.ts`.                                         |

## What is **not** in this spec

- Tablas, migraciones, RLS y consultas.
- Autenticación y `proxy.ts`.
- Cliente admin.
- Storage, Realtime, Edge Functions.
- Script de regeneración de tipos.
- Endpoints públicos de salud de la BD (los chequeos de salud son internos).

Cada uno, si se hace, va en su propio spec.
