# SPEC 07 — Leaderboard y puntuaciones en Supabase

> **Status:** Implemented
> **Depends on:** SPEC 04, SPEC 05, SPEC 06
> **Date:** 2026-11-19
> **Objective:** Crear en Supabase las tablas `games` y `best_scores` como fuente de verdad del Salón de la Fama, del panel lateral de cada juego y de las stats "Mejor global"/"Partidas", y hacer que Asteroids guarde automáticamente la mejor marca del jugador logueado al terminar la partida.

## Why this spec exists

Hoy todos los rankings son mock: `seededScores()` en `lib/games.ts` genera filas pseudoaleatorias para `/salon` y para el panel "MEJORES PUNTUACIONES" de `/juegos/[id]`, y `best`/`plays` son números fijos. Asteroids (SPEC 05) termina sin guardar nada.

SPEC 06 dejó jugadores reales (Better Auth) en el Postgres de Supabase, así que ya se puede asociar cada marca a un `user`. Esta spec reemplaza los mocks de puntuación por datos reales y conecta el primer juego jugable.

## Scope

**In:**

- Tabla `games` mínima (id, título, categoría, jugable, contador de partidas) con los 8 juegos de `lib/games.ts`. Solo Asteroids queda `playable = true`.
- Tabla `best_scores`: una fila por (jugador, juego) con la mejor marca. Upsert solo si supera.
- RLS activo sin policies en ambas tablas; acceso solo desde servidor vía el `Pool` de `pg` (`DATABASE_URL`).
- Seed demo: 17 usuarios ficticios (lista `PLAYERS` sin `PX_KAI`) en `user`, sin `account`, y 12 marcas demo por juego (los 8, incluido Asteroids).
- `POST /api/scores`: valida sesión Better Auth, guarda la marca si supera la anterior e incrementa `plays_count` del juego.
- Asteroids: al entrar en `gameover` (por perder vidas o por FIN) envía la puntuación automáticamente si hay sesión; línea de estado bajo el HUD. Invitado: no se envía nada y se muestra CTA a `/auth`.
- `/salon` pasa a Server Component con pestañas por `?juego=`; top 12 real, podio real y fila "TU MEJOR MARCA" con rango real.
- `/juegos/[id]`: panel lateral con top 10 real; "Mejor global" y "Partidas" reales.
- `/biblioteca`: "Mejor global" de cada tarjeta real.
- Estados vacíos cuando un juego no tiene marcas.
- Eliminar `seededScores`, `ScoreRow`, `PLAYERS`, `best` y `plays` de `lib/games.ts`.
- Regenerar `lib/supabase/database.types.ts`.

**Out of scope (for future specs):**

- Historial de partidas (cada partida jugada). Solo se guarda la mejor marca.
- Mover el catálogo (textos, portada, color) a la BD: `lib/games.ts` sigue siendo el catálogo de UI.
- Anti-cheat real (firma de partidas, validación en servidor de la jugada) y rate limiting.
- Guardar puntuaciones de los juegos simulados: el modal FIN DEL JUEGO y `localStorage["av_scores"]` del reproductor simulado no cambian.
- Contar partidas de invitados.
- Cache de lecturas (`'use cache'`, `cacheTag`): las lecturas son siempre dinámicas.
- Actividad en vivo de la Home (sigue mock).
- Perfil de jugador / historial personal / borrar marcas.
- Realtime (actualización del ranking sin recargar).

## Data model

### Tablas (schema `public`)

Migración `scores_init` aplicada con `mcp__supabase__apply_migration`:

```sql
create table public.games (
  id          text primary key,                    -- slug, igual a Game.id de lib/games.ts
  title       text not null,
  category    text not null,                       -- ARCADE | PUZZLE | SHOOTER | VERSUS
  playable    boolean not null default false,      -- solo los juegos con motor real aceptan scores
  plays_count bigint not null default 0 check (plays_count >= 0),
  created_at  timestamptz not null default now()
);

create table public.best_scores (
  user_id     text not null references public."user"(id) on delete cascade,
  game_id     text not null references public.games(id) on delete cascade,
  score       integer not null check (score >= 0),
  achieved_at timestamptz not null default now(),
  primary key (user_id, game_id)
);

-- Ranking por juego: mayor score primero; empate → quien lo logró antes.
create index best_scores_ranking_idx
  on public.best_scores (game_id, score desc, achieved_at asc);

alter table public.games enable row level security;
alter table public.best_scores enable row level security;
-- Sin policies: la Data API (publishable key) no puede leer ni escribir.
-- La app accede con el rol postgres vía DATABASE_URL, que no está sujeto a RLS.
```

El tipo de `user_id` se confirma contra la columna `"user".id` real (Better Auth la crea como `text`) antes de aplicar.

### Seed demo

Migración `scores_demo_seed` (separada de `scores_init` para poder revertirla sola):

- `games`: los 8 juegos de `lib/games.ts` con `id`, `title`, `category = cat`, `playable = (id = 'asteroids')` y `plays_count` = valor mock actual de `plays`:

  | id            | plays_count |
  | ------------- | ----------- |
  | bloque-buster | 12400       |
  | caida         | 31800       |
  | serpentina    | 9100        |
  | gloton        | 27200       |
  | invasores     | 18000       |
  | asteroids     | 15600       |
  | ranaria       | 6400        |
  | duelo-pixel   | 4200        |

- `user`: 17 filas con los nombres de `PLAYERS` excepto `PX_KAI` (`NEONFOX`, `Z3R0COOL`, …). Por cada uno: `id` = `demo_<username>`, `username` = minúsculas, `displayUsername` y `name` = username, `email` = `<username>@demo.arcadevault.local`, `emailVerified = false`. Sin filas en `account`: no pueden iniciar sesión.
- `best_scores`: 12 filas por juego (12 usuarios demo distintos). La marca #1 de cada juego es el valor mock actual de `best` (28450, 184220, 7820, 96400, 54190, 41200, 18900, 24); las siguientes descienden. `achieved_at` entre `2026-01-01` y `2026-11-18`. Los valores exactos se fijan literalmente en el SQL (sin `random()`), para que el seed sea reproducible.
- Limpieza documentada en un comentario de la migración: `delete from public."user" where email like '%@demo.arcadevault.local';` (borra en cascada sus `best_scores`).

### Acceso a BD (solo servidor)

- `lib/db.ts` (nuevo): exporta el `Pool` de `pg` único (`getAuthEnv().DATABASE_URL`), con `import "server-only"`. `lib/auth/auth.ts` pasa a importarlo en vez de crear el suyo.
- `lib/scores.ts` (nuevo, `server-only`): todas las consultas.

```ts
export type LeaderboardRow = {
  rank: number;         // 1-based, según (score desc, achieved_at asc)
  name: string;         // username en MAYÚSCULAS
  score: number;
  date: string;         // dd/mm/yyyy (es-ES, timeZone UTC)
};

export type UserBest = { rank: number; score: number; date: string } | null;

export type GameStats = { best: number | null; plays: number };

getTopScores(gameId: string, limit: number): Promise<LeaderboardRow[]>;
getUserBest(gameId: string, userId: string): Promise<UserBest>;     // rango global real
getGameStats(gameId: string): Promise<GameStats>;                   // best = top 1, plays = plays_count
getAllBests(): Promise<Record<string, number | null>>;              // biblioteca: 1 query para los 8 juegos
submitScore(userId: string, gameId: string, score: number): Promise<SubmitResult>;
```

`submitScore` corre en una transacción:

```sql
update public.games set plays_count = plays_count + 1 where id = $2 and playable;
-- 0 filas → el juego no existe o no es jugable (no se inserta nada)
insert into public.best_scores (user_id, game_id, score)
values ($1, $2, $3)
on conflict (user_id, game_id) do update
  set score = excluded.score, achieved_at = now()
  where best_scores.score < excluded.score;
-- luego lee la marca vigente del usuario y su rango
```

Score `0` incrementa `plays_count`; crea la fila solo si el usuario no tenía marca (queda con 0).

### Endpoint `POST /api/scores`

Sigue la convención de route handlers del proyecto (Zod `safeParse`, `NextResponse.json`, `StatusCodes.*`, cuerpo `ServerResponse<T>` con `createServerResponse`).

```ts
// lib/scores-schema.ts (compartible cliente/servidor)
export const submitScoreSchema = z.object({
  gameId: z.string().min(1).max(64),
  score: z.number().int().min(0).max(10_000_000),
});

export type SubmitResult = {
  isRecord: boolean; // true si la marca nueva superó la anterior (o es la primera)
  best: number; // mejor marca vigente del usuario en ese juego
  rank: number; // rango global de esa mejor marca
};
```

| Caso                                      | Status                              | `message`           |
| ----------------------------------------- | ----------------------------------- | ------------------- |
| OK                                        | `StatusCodes.OK`                    | `null`              |
| Sin sesión Better Auth                    | `StatusCodes.UNAUTHORIZED`          | `UNAUTHORIZED`      |
| Body inválido (Zod)                       | `StatusCodes.BAD_REQUEST`           | `INVALID_BODY`      |
| `gameId` inexistente o `playable = false` | `StatusCodes.NOT_FOUND`             | `GAME_NOT_PLAYABLE` |
| Error de BD                               | `StatusCodes.INTERNAL_SERVER_ERROR` | `INTERNAL_ERROR`    |

La sesión se lee con `auth.api.getSession({ headers: await headers() })`; el `userId` sale de la sesión, nunca del body.

### Cambios en `lib/games.ts`

- Se eliminan `best`, `plays` del tipo `Game` y de los 8 objetos.
- Se eliminan `PLAYERS`, `ScoreRow` y `seededScores`.
- Se agrega `fmtPlays(n: number): string` → `12400` → `12.4K`, `999` → `999`, `1250000` → `1.3M` (mismo formato que los mock actuales).

### Archivos tras esta spec

- `lib/db.ts` (nuevo)
- `lib/scores.ts` (nuevo, solo servidor)
- `lib/scores-schema.ts` (nuevo)
- `app/api/scores/route.ts` (nuevo)
- `lib/auth/auth.ts` (modificado: usa el pool de `lib/db.ts`)
- `lib/games.ts` (modificado)
- `lib/supabase/database.types.ts` (regenerado, con comentario "Estado actual" actualizado)
- `app/salon/page.tsx` (modificado: Server Component)
- `components/hall-of-fame.tsx` (nuevo si hace falta separar la parte de UI; sin estado cliente salvo lo imprescindible)
- `app/juegos/[id]/page.tsx` (modificado)
- `app/biblioteca/page.tsx` y `components/library.tsx` (modificados: `bests` por prop)
- `components/player.tsx` (modificado: envío y línea de estado)
- `app/globals.css` (modificado: `.save-status`, estados vacíos)

Rutas tras esta spec:

- `POST /api/scores` — nueva.
- `/salon?juego=<id>` — nuevo search param; sin él o con id inválido muestra el primer juego de `GAMES`.
- Resto sin cambios.

## UI

### Línea de estado del guardado (`/juegos/asteroids/jugar`)

Elemento `.save-status` entre `.player-hud` y `.crt`, visible solo con `snapshot.state === "gameover"`. `.player-hud` no cambia (SPEC 05).

| Situación                         | Texto                                                       | Color       |
| --------------------------------- | ----------------------------------------------------------- | ----------- |
| Con sesión, enviando              | `▸ GUARDANDO PUNTUACIÓN...`                                 | `--ink-dim` |
| Con sesión, `isRecord`            | `▸ ¡NUEVO RÉCORD! · RANGO #NN`                              | `--yellow`  |
| Con sesión, no supera             | `▸ PUNTUACIÓN REGISTRADA · TU RÉCORD: N`                    | `--cyan`    |
| Con sesión, error (red o 5xx/4xx) | `▸ NO SE PUDO GUARDAR LA PUNTUACIÓN`                        | `--magenta` |
| Invitado                          | `▸ INICIA SESIÓN PARA GUARDAR TU PUNTUACIÓN` (link `/auth`) | `--magenta` |

- El envío ocurre **una sola vez por partida**, en la transición a `gameover` (perder la última vida o FIN), con el `score` del snapshot de ese momento. Un `ref` evita duplicados (StrictMode, re-renders).
- `restart()` (Espacio o JUGAR DE NUEVO) oculta la línea y rearma el envío para la partida siguiente. Si la petición anterior sigue en curso, su resultado se descarta.
- Sin reintentos automáticos.
- Estilo: `--pixel`, tamaño de `.toast-saved`, prefijo `▸`, sin hex nuevos.

### `/salon`

- Server Component. Lee `searchParams.juego` y la sesión en servidor (dentro de `Suspense` si `cacheComponents` lo exige).
- Pestañas `.chip` = `<Link href="/salon?juego=<id>">`, misma apariencia; la activa conserva `.active`.
- Podio: top 3 real. Slot sin marca → nombre `—`, score `—`, sin fecha.
- Tabla: top 12 real con las mismas clases (`top1/2/3`, animación escalonada).
- Sin marcas: en lugar de la tabla, una fila `▸ SIN PUNTUACIONES TODAVÍA` (`--ink-faint`, `--pixel`).
- Con sesión:
  - Si el usuario está en el top 12: su fila lleva además la clase `.you` (amarillo) y no se agrega fila aparte.
  - Si tiene marca fuera del top 12: `▸ TU MEJOR MARCA EN <JUEGO>` + fila `.you` con rango real, nombre, score y fecha.
  - Si no tiene marca: `▸ AÚN NO TIENES MARCA EN <JUEGO>` (sin fila de datos).
- Sin sesión: no se muestra nada de "tu marca" (como hoy).

### `/juegos/[id]`

- Panel lateral "MEJORES PUNTUACIONES": top 10 real, mismo markup (`.lb-row`, fecha bajo el nombre). Sin marcas → `▸ SIN PUNTUACIONES TODAVÍA`.
- "Mejor global": `fmt(best)` o `—` si no hay marcas.
- "Partidas": `fmtPlays(plays_count)`.
- Los datos dinámicos se renderizan dentro de `Suspense` con fallback que conserva el alto (ej. filas `···`), para que `generateStaticParams` y el shell estático sigan funcionando con `cacheComponents`.

### `/biblioteca`

- La página obtiene `getAllBests()` en servidor y la pasa a `Library` como `bests: Record<string, number | null>`. La tarjeta muestra `fmt(best)` o `—`.

### Coherencia visual

- Cargar `/frontend-design` antes de tocar UI (obligatorio por `CLAUDE.md`) y usarlo para extender la estética actual, no para proponer una nueva.
- Solo variables, fuentes (`--pixel`, `--mono`), clases y keyframes existentes de `app/globals.css`. Sin hex ni librerías nuevas. Clases nuevas (`.save-status`, `.lb-empty`) junto a las de su sección.

## Implementation plan

1. Leer las skills `supabase` y `supabase-postgres-best-practices`, y en `node_modules/next/dist/docs/01-app/` las guías de `cacheComponents`/datos dinámicos (`connection()`, `Suspense`, `searchParams`) y de Route Handlers. Confirmar el tipo de `"user".id` con `list_tables`.
2. Aplicar la migración `scores_init` (tablas, índice, RLS). Verificar con `list_tables` y correr `get_advisors` (security y performance): sin alertas nuevas.
3. Aplicar `scores_demo_seed`. Verificar con `execute_sql`: 8 juegos (solo asteroids jugable), 17 usuarios `@demo.arcadevault.local`, 96 filas en `best_scores`, ningún usuario `px_kai`. Regenerar `lib/supabase/database.types.ts` y actualizar su comentario "Estado actual".
4. Crear `lib/db.ts` y hacer que `lib/auth/auth.ts` use ese pool. Manual: login/registro siguen funcionando.
5. Crear `lib/scores-schema.ts` y `lib/scores.ts` (`getTopScores`, `getUserBest`, `getGameStats`, `getAllBests`, `submitScore`). `npx tsc --noEmit` pasa.
6. Crear `app/api/scores/route.ts` con la tabla de respuestas. Manual con `curl`/navegador: 401 sin sesión, 400 body inválido, 404 con `caida`, 200 con `asteroids`.
7. Cargar `/frontend-design`. Migrar `/juegos/[id]` (panel top 10, Mejor global, Partidas) y `/biblioteca` (bests por prop) a datos reales con `Suspense`. Manual: los valores coinciden con el seed.
8. Reescribir `/salon` como Server Component con `?juego=`, podio, tabla, estados vacíos y lógica de "tu marca".
9. Cablear `components/player.tsx`: envío único en la transición a `gameover` para juegos registrados, línea `.save-status` con los 5 estados, rearme en `restart()`. Manual: partida con sesión aparece en salón y panel; partida invitado muestra CTA.
10. Eliminar `best`, `plays`, `PLAYERS`, `ScoreRow`, `seededScores` de `lib/games.ts`, agregar `fmtPlays`, y limpiar imports.
11. Correr `npx tsc --noEmit`, `npx eslint app components lib games`, `npx prettier --check app components lib` y `npm run build`.

## Acceptance criteria

- [ ] En Supabase existen `games` y `best_scores` en `public`, con RLS activo y sin policies; `get_advisors` (security) no reporta alertas nuevas sobre ellas.
- [ ] `best_scores` tiene PK `(user_id, game_id)`, FK a `"user"(id)` y a `games(id)` con `on delete cascade`, y el índice `best_scores_ranking_idx`.
- [ ] Un `select` a `games` o `best_scores` con la publishable key vía Data API devuelve 0 filas o error de permisos.
- [ ] `games` tiene 8 filas con los ids de `lib/games.ts`; solo `asteroids` tiene `playable = true`; `plays_count` coincide con la tabla del seed.
- [ ] Hay 17 usuarios con email `@demo.arcadevault.local`, ninguno con `username = 'px_kai'`, y ninguno tiene filas en `account`.
- [ ] Cada juego tiene 12 filas demo en `best_scores` y su marca #1 es el valor mock anterior de `best`.
- [ ] `lib/supabase/database.types.ts` incluye `games` y `best_scores`.
- [ ] `POST /api/scores` sin sesión responde 401 con `{ ok: false, status: 401, data: null, message: "UNAUTHORIZED" }`.
- [ ] Con sesión: `score: -1`, `score: 1.5`, `score: "100"` o sin `gameId` responden 400 `INVALID_BODY`; `gameId: "caida"` o `"no-existe"` responden 404 `GAME_NOT_PLAYABLE`, y en ambos casos `plays_count` no cambia.
- [ ] Con sesión y `{ gameId: "asteroids", score: 500 }` sin marca previa: 200, `data.isRecord = true`, `data.best = 500`, se crea la fila y `plays_count` sube 1.
- [ ] Enviar luego `score: 300`: 200, `isRecord = false`, `best = 500`, la fila no cambia (ni `achieved_at`) y `plays_count` sube 1.
- [ ] Enviar luego `score: 900`: `isRecord = true`, `best = 900`, `achieved_at` se actualiza.
- [ ] El `userId` guardado es el de la sesión aunque el body incluya otro campo `userId`.
- [ ] Con sesión, perder las 3 vidas en Asteroids envía exactamente 1 `POST /api/scores` (verificado en la pestaña Network, también en dev con StrictMode) y muestra `▸ GUARDANDO PUNTUACIÓN...` seguido del resultado.
- [ ] Pulsar FIN durante la partida también envía 1 POST con el puntaje del momento.
- [ ] Superar la marca muestra `▸ ¡NUEVO RÉCORD! · RANGO #NN` en amarillo; no superarla muestra `▸ PUNTUACIÓN REGISTRADA · TU RÉCORD: N` en cyan.
- [ ] Con la red cortada (DevTools offline) al llegar a game over se muestra `▸ NO SE PUDO GUARDAR LA PUNTUACIÓN`.
- [ ] JUGAR DE NUEVO o Espacio ocultan la línea; la siguiente partida vuelve a enviar 1 POST al terminar.
- [ ] Como invitado, el game over no envía ningún POST y muestra `▸ INICIA SESIÓN PARA GUARDAR TU PUNTUACIÓN` con link a `/auth`.
- [ ] `.player-hud` no cambia respecto de SPEC 05 (mismos stats y botones).
- [ ] `/juegos/caida/jugar` mantiene el reproductor simulado, el modal FIN DEL JUEGO y `av_scores` como antes, y no llama a `/api/scores`.
- [ ] Tras un récord nuevo, recargar `/salon?juego=asteroids` y `/juegos/asteroids` muestra la marca nueva en la posición correcta sin reiniciar el servidor.
- [ ] `/salon` sin parámetro y `/salon?juego=xyz` muestran el primer juego de `GAMES`; cada pestaña navega a `/salon?juego=<id>` y conserva el estilo `.chip`/`.active`.
- [ ] En `/salon`, el podio y la tabla muestran los datos de `best_scores` ordenados por score desc y, en empate, por `achieved_at` asc; cada jugador aparece una sola vez.
- [ ] Con sesión y marca dentro del top 12, la fila del usuario se resalta como `.you` y no aparece fila extra; con marca fuera del top 12 aparece la fila "TU MEJOR MARCA" con su rango real; sin marca aparece `▸ AÚN NO TIENES MARCA EN <JUEGO>`.
- [ ] Borrando temporalmente las marcas de un juego (o en un juego sin filas), `/salon` muestra podio con `—` y `▸ SIN PUNTUACIONES TODAVÍA`, y el panel de `/juegos/<id>` muestra `▸ SIN PUNTUACIONES TODAVÍA` y "Mejor global" `—`, sin errores.
- [ ] `/juegos/[id]` muestra 10 filas reales, "Mejor global" = top 1 de la BD y "Partidas" = `fmtPlays(plays_count)` (ej. `15.6K` para asteroids antes de jugar).
- [ ] Cada tarjeta de `/biblioteca` muestra el mejor global real del juego.
- [ ] `grep -rn "seededScores\|ScoreRow\|PLAYERS\|\.best\b\|\.plays\b" app components lib` no devuelve resultados.
- [ ] Ningún archivo de cliente importa `lib/db.ts` ni `lib/scores.ts`.
- [ ] El CSS agregado no contiene colores hex ni `rgb()` nuevos.
- [ ] `/salon`, `/juegos/asteroids` y `/biblioteca` no muestran errores de hidratación ni de `cacheComponents` en consola.
- [ ] En ancho 375px no hay scroll horizontal en `/salon`, `/juegos/asteroids` ni `/juegos/asteroids/jugar`.
- [ ] `npx tsc --noEmit`, `npx eslint app components lib games` y `npm run build` terminan sin errores.

## Decisions

- **Yes:** tabla `games` mínima (id, title, category, playable, plays_count) como FK de scores; `lib/games.ts` sigue como catálogo de UI. Decisión del usuario.
- **No:** mover todo el catálogo a la BD. Cambiaría biblioteca, home y `generateStaticParams`; merece su propia spec.
- **Yes:** `best_scores` con una fila por (jugador, juego) y upsert solo si supera. Decisión del usuario.
- **No:** guardar todas las partidas. Se pierde historial a cambio de una tabla simple.
- **Yes:** ranking con una entrada por jugador; empate → quien lo logró antes (`achieved_at asc`). Decisión del usuario.
- **Yes:** acceso solo desde servidor con el `Pool` de `pg` y RLS sin policies. Decisión del usuario: los usuarios son de Better Auth y RLS no puede identificarlos; mismo patrón que SPEC 06.
- **No:** cliente Supabase con policy `select` pública + secret key para escribir. Agrega una env var y otro camino de acceso.
- **Yes:** un único `Pool` compartido en `lib/db.ts`. Evita duplicar conexiones contra el pooler.
- **Yes:** guardado automático al entrar en game over (incluye FIN) con línea de estado bajo el HUD. Decisión del usuario.
- **No:** modal FIN DEL JUEGO con botón GUARDAR para Asteroids.
- **Yes:** `.save-status` fuera de `.player-hud`. SPEC 05 fija el HUD como idéntico; la línea solo aparece en game over.
- **Yes:** invitado no guarda y ve CTA a `/auth`. Decisión del usuario.
- **Yes:** seed demo en BD para que todos los juegos tengan ranking. Decisión del usuario.
- **Yes:** usuarios demo reales en `user` (sin `account`, email `@demo.arcadevault.local`) para que el modelo no tenga casos especiales. Decisión del usuario; se borran con un `delete` por dominio.
- **No:** columna `player_name` con `user_id` nulo para demo.
- **Yes:** seed sin `PX_KAI`. Decisión del usuario: el criterio de SPEC 06 registra `px_kai` y chocaría con el username único.
- **Yes:** seed con valores literales y marca #1 = antiguo `best` mock. Reproducible y sin saltos visuales respecto de hoy.
- **Yes:** seed en migración separada (`scores_demo_seed`). Se puede revertir sin tocar el esquema.
- **Yes:** "Mejor global" real y contador `plays_count` real en `games`. Decisión del usuario.
- **Yes:** `plays_count` cuenta solo partidas con sesión (cada POST válido, haya récord o no); arranca con los valores mock. Decisión del usuario.
- **No:** contar partidas de invitados. Requeriría un endpoint público abusable.
- **Yes:** validación básica (entero 0..10.000.000, juego jugable). Decisión del usuario; el anti-cheat real queda como riesgo aceptado.
- **No:** rate limiting en esta spec.
- **Yes:** lecturas siempre dinámicas dentro de `Suspense`. Decisión del usuario.
- **No:** `'use cache'` + `cacheTag` con invalidación en el POST.
- **Yes:** `/salon?juego=<id>` como Server Component, 1 consulta por vista. Decisión del usuario: URL compartible.
- **No:** traer el top de los 8 juegos en cada request.
- **Yes:** fila "tu marca" con rango real; resaltado en el top sin duplicar; mensaje si no hay marca. Decisión del usuario.
- **Yes:** tops de 12 (salón) y 10 (detalle), como hoy. Decisión del usuario.
- **Yes:** `userId` siempre desde la sesión del servidor, nunca del body.
- **Yes:** fechas formateadas en servidor con `timeZone: "UTC"`. Evita diferencias servidor/cliente.

## Risks

| Risk                                                                       | Mitigation                                                                                                           |
| -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| El cliente puede enviar cualquier score (sin anti-cheat)                   | Riesgo aceptado: tope 10.000.000, solo usuarios logueados, solo juegos jugables. Anti-cheat en otra spec.            |
| Doble envío por StrictMode o re-render en la transición a game over        | `ref` de "ya enviado" por partida, rearmado solo en `restart()`; criterio verifica 1 POST en dev.                    |
| Carrera entre dos envíos del mismo usuario                                 | `on conflict ... where best_scores.score < excluded.score` es atómico; el mayor siempre gana.                        |
| Tablas expuestas por la Data API                                           | RLS sin policies en la misma migración; criterio prueba `select` con la publishable key; `get_advisors`.             |
| `cacheComponents` rompe el build por datos dinámicos fuera de `Suspense`   | Paso 1 lee la guía; datos dinámicos en componentes envueltos en `Suspense`; criterio de `npm run build` sin errores. |
| Usuarios demo confundidos con reales o bloqueando usernames                | Dominio `@demo.arcadevault.local`, ids `demo_*`, sin `account`; `delete` documentado en la migración.                |
| Agotar conexiones al tener dos pools                                       | Un único `Pool` en `lib/db.ts` usado por Better Auth y por `lib/scores.ts`.                                          |
| `lib/db.ts` o `lib/scores.ts` importados en cliente filtran `DATABASE_URL` | `import "server-only"` en ambos; criterio verifica imports.                                                          |
| Tipo de `"user".id` distinto de `text`                                     | Paso 1 lo confirma con `list_tables` antes de aplicar la migración.                                                  |

## What is **not** in this spec

- Historial de partidas.
- Catálogo de juegos en BD.
- Anti-cheat y rate limiting.
- Guardado para juegos simulados y cambios en el modal FIN DEL JUEGO / `av_scores`.
- Partidas de invitados.
- Cache de lecturas.
- Actividad en vivo de la Home.
- Perfil e historial personal.
- Realtime.

Cada uno, si se hace, va en su propio spec.
