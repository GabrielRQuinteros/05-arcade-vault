# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Arcade Vault: plataforma online de juegos arcade para jugar y competir por puntos (UI en español, estética neón/CRT). Spec-driven: cada feature = `specs/NN-slug.md` (`/spec`) implementada con `/spec-impl` en branch `spec-NN-slug` → PR a `main`. README en español.

Specs implementadas (01–10): pantallas visuales, home, about + contacto (Resend), setup Supabase, Asteroids, auth (Better Auth), leaderboard/scores, Tetris, Bloque Buster (Arkanoid), Snake. Leer la spec relevante antes de tocar un área: sección `Decisions` registra decisiones del usuario (no re-litigar).

## Commands

- `npm run dev` / `build` / `start`
- `npm run lint` (ESLint 9 + `eslint-config-next` + `eslint-config-prettier`)
- `npm run format` (Prettier: semi, double quotes, trailingComma all)
- Sin tests automatizados; verificación visual con Playwright (MCP / `playwright-cli` skill).

## Stack / gotchas

- Next.js 16.4.6, React 19.3, Tailwind 4.3 (via `@tailwindcss/turbopack` loader rule en `next.config.ts`, no PostCSS), TypeScript strict, Zod 4.
- **Next.js tiene breaking changes vs. training data.** Per `AGENTS.md`, leer la guía en `node_modules/next/dist/docs/` antes de escribir código; respetar deprecations.
- `next.config.ts`: `cacheComponents`, `partialPrefetching`, `experimental.agentFeedback`. Con `cacheComponents`, todo dato de request (`headers()`, `searchParams`, sesión, BD) va dentro de `<Suspense>`; lecturas de BD usan `connection()` (siempre dinámicas, sin `'use cache'`).
- App Router only. Tipos globales `LayoutProps<"/">` / `PageProps<"/ruta/[id]">` (sin import). React 19: `ref` como prop.
- `AGENTS.md` lo reescribe `next dev`; commitearlo, no borrarlo.
- Alias `@/*` → raíz.

## Estructura

- `app/` rutas: `/` home, `/biblioteca`, `/juegos/[id]` (detalle + top 10), `/juegos/[id]/jugar` (reproductor), `/salon?juego=<id>` (salón de la fama, top 12 + "tu marca"), `/acerca` (about + contacto), `/auth`.
- `app/api/`: `auth/[...all]` (Better Auth handler), `contacto` (POST → Resend, honeypot `website`), `scores` (POST guarda puntuación).
- `components/`: UI cliente/servidor (`nav`, `home`, `library`, `player`, `auth-form`, `user-menu`, `session` = `SessionProvider`/`useSession`, `reveal`, …).
- `lib/`: `games.ts` (catálogo UI `GAMES`, `getGame`, `fmt`), `db.ts` (Pool `pg` único, server-only), `scores.ts` (queries server-only), `scores-schema.ts` (Zod compartido cliente/servidor), `contact.ts`, `server-response.ts`, `auth/*`, `supabase/*`.
- `games/`: juegos reales en canvas (ver abajo).
- `references/`: `templates/` (diseño JSX/CSS original de la UI), `started-games/` (juegos de referencia a portar: `02-asteroids`, `03-tetris`, `04-arkanoid`), `snake/snake-assets/`. Solo lectura, salvo `games-seggestions-todo.md` (historial de sugerencias, lo mantiene el agente `game-planner`).
- `public/games/<id>/`: assets de juegos (hoy solo `snake/fruits.png`).

## Convenciones de API (route handlers)

Validar body con Zod (`safeParse`), responder `NextResponse.json(createServerResponse<T>(ok, status, data, message), { status })` con `StatusCodes` de `http-status-codes`. `message` = código de error tipado (ej. `ScoreErrorCode`, `ContactErrorCode`). Body JSON inválido → 400. Env vars validadas con Zod en un `getXEnv()` que lanza listando las keys faltantes.

## Auth (SPEC 06)

- Better Auth (`lib/auth/auth.ts`, server-only) sobre el Pool compartido; plugins `username` + `jwt`. Email/password (8–128) + OAuth Google y GitHub.
- Username único 3–10 `[a-z0-9_]`; en OAuth se deriva de email/login con sufijo numérico (`lib/auth/username.ts`, resuelto en `mapProfileToUser`).
- Cliente: `lib/auth/auth-client.ts` (mismo origen). Sesión en servidor: `auth.api.getSession({ headers: await headers() })`.

## Base de datos (Supabase)

- Supabase Postgres, proyecto vía MCP `supabase` (`.mcp.json`). Migraciones con `mcp__supabase__apply_migration`; tras cambios de esquema regenerar `lib/supabase/database.types.ts` (y re-agregar sus comentarios manuales).
- Tablas: Better Auth (`user`, `session`, `account`, `verification`, `jwks`) + `games` (id, title, category, playable, plays_count) + `best_scores` (1 fila por usuario+juego, upsert solo si supera; ranking `score desc, achieved_at asc`).
- **Todas con RLS activo y sin policies.** La app accede solo desde servidor por `DATABASE_URL` (Pool `pg`, transaction pooler 6543), no por la Data API. `lib/supabase/{client,server}.ts` existen pero no se usan para estos datos.
- `userId` siempre desde la sesión, nunca del body. Fechas formateadas en servidor (`es-ES`, `UTC`).
- Usuarios demo seed: email `@demo.arcadevault.local`.
- Renombrar un juego (ej. `caida`→`tetris`, `serpentina`→`snake`): FK sin `ON UPDATE CASCADE` → insertar fila nueva, mover `best_scores`, borrar vieja, en una migración; marcar `playable = true`.

## Juegos (patrón SPEC 05)

- Cada juego en `games/<id>/`: `engine.ts` (clase motor, loop rAF, `dt` cap 50 ms), `input.ts`, `constants.ts`, entidades/niveles, y `<id>-canvas.tsx` (client component que implementa `GameCanvasProps` de `games/types.ts`).
- Registrar en `games/registry.ts` (`GAME_COMPONENTS`, id → componente); juegos no registrados usan el reproductor simulado. El id debe coincidir con `lib/games.ts` y la fila en `games` de Supabase.
- Canvas lógico 800×600 escalado con `devicePixelRatio`, dentro del CRT de `components/player.tsx`. Fuente `monospace`; paleta neón con hex copiados de `globals.css`.
- HUD React (`.player-hud`) muestra solo valores comunes (`GameSnapshot`: score, lives, level, state) vía `onSnapshot`, emitido solo cuando cambian (no por frame). Valores propios del juego se dibujan en el canvas; no agregarlos a `GameSnapshot`.
- `paused` vive en React (prop); P/Esc → `onTogglePause`. `GameHandle` (`endGame`, `restart`) vía ref. FIN fuerza game over; Espacio reinicia. Teclado (flechas + WASD); táctil (SPEC 11) vía `<TouchControls>` que despacha teclas sintéticas en `window` — cada juego nuevo necesita entrada en `games/touch-bindings.ts`.
- Al entrar en `gameover` el reproductor hace POST `/api/scores` una vez por partida; invitado ve CTA a `/auth`.
- Assets: excepción iniciada en Snake (`public/games/snake/`, atlas tipado en `sprites.ts`, precarga + fallback a primitivas).
- Nuevo juego: `@game-planner` (elige qué juego) → `/add-game` → genera descripción → `/spec` → `/spec-impl-game` (= `/spec-impl` + lanza `@mobile-porter` al terminar).

## UI / theming

- Tema en `app/globals.css`: vars `--bg`, `--ink`, `--cyan`, `--magenta`, `--yellow`, `--green`, `--gold`/`--silver`/`--bronze`, expuestas a Tailwind vía `@theme inline` (`bg-cyan`, `font-pixel`, `font-mono`). Mucho CSS por clases (`.player-hud`, `.crt-screen`, `cover-*`) portado de `references/templates/styles.css`.
- Fuentes `next/font/google`: Press Start 2P (pixel), JetBrains Mono, Courier Prime. `lang="es"`. Textos UI en MAYÚSCULAS estilo arcade.

## Env vars

Ver `.env.example`: `RESEND_API_KEY`, `CONTACT_TO_EMAIL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_DB_PASSWORD` (solo CLI), `BETTER_AUTH_SECRET` (≥32), `BETTER_AUTH_URL`, `DATABASE_URL`, `GOOGLE_CLIENT_ID/SECRET`, `GITHUB_CLIENT_ID/SECRET`. Nunca commitear `.env.local`.

## Tooling Claude

- Hook `PostToolUse` (Write|Edit) en `.claude/hooks/format-lint.mjs`: Prettier en `.ts/.tsx/.md`, `eslint --fix` en TS. Si falla bloquea (exit 2): corregir el error reportado.
- `specs/.spec-config.yml`: `AutoCreateBranch: true`, `AutoCommitSteps: false` (no commitear pasos automáticamente).
- Skills del proyecto (`skills-lock.json`, `.agents/skills/`, `.claude/skills/`): `spec`, `spec-impl` (Klerith/fernando-skills), `frontend-design`, `ui-ux-pro-max`, `supabase`, `supabase-postgres-best-practices`, `playwright-cli`, `add-game` (propia), `spec-impl-game` (propia: lee y sigue `.agents/skills/spec-impl/SKILL.md` fases 1–4, luego lanza `mobile-porter` y relaya su reporte).
- Agente `.claude/agents/game-planner.md`: decide qué juego agregar (diversidad de categorías, factibilidad canvas 2D, reconoce clásicos). Memoria persistente `memory: project` → `.claude/agent-memory/game-planner/` (commitear); historial en `references/games-seggestions-todo.md`.
- Agente `.claude/agents/game-jam.md`: tema + juego → 2 specs completos (formato SPEC 05/08/09/10 o ejemplos dados) en `specs/game-jam/<game-id>/`. Se detiene y pregunta ante dudas de alto impacto; Supabase solo lectura. Memoria en `.claude/agent-memory/game-jam/`.
- Agente `.claude/agents/mobile-porter.md`: audita y corrige el reproductor `/juegos/<id>/jugar` en navegador móvil (390×844, Playwright `hasTouch`) según SPEC 11: `TOUCH_BINDINGS`, controles táctiles, HUD compacto. No toca motores ni contrato común; pregunta si el fix lo requiere. No commitea. Memoria en `.claude/agent-memory/mobile-porter/`.
- Capturas/logs de Playwright en `.playwright-mcp/` y `.playwright-cli/` (gitignored).

## SKILLS

- Usa siempre la skill /frontend-design cuando tengas que diseñar/implementar interfaces de usuario.
- Usa /supabase y /supabase-postgres-best-practices antes de cambios de esquema, migraciones o queries.
- Usa el agente `game-planner` cuando se pidan ideas o qué juego agregar a continuación (antes de /add-game).
- Para implementar la spec de un juego usa /spec-impl-game (lanza `mobile-porter` al final). Usa el agente `mobile-porter` directamente cuando se pida revisar/portar juegos a móvil.
- Usa /add-game para preparar un juego nuevo antes de /spec.
