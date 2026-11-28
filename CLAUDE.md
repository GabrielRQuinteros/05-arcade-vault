# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Arcade Vault: plataforma online de juegos arcade para jugar y competir por puntos (UI en español, estética neón/CRT). Spec-driven: cada feature = `specs/NN-slug.md` (`/spec`) implementada con `/spec-impl` en branch `spec-NN-slug` → PR a `main`. README en español.

Specs implementadas (01–12): pantallas visuales, home, about + contacto (Resend), setup Supabase, Asteroids, auth (Better Auth), leaderboard/scores, Tetris, Bloque Buster (Arkanoid), Snake, controles táctiles móviles (11), rendimiento de Frogger (12), medidas de seguridad (13: HIBP, rate limit, deny Data API, headers HTTP). Specs de game jam en `specs/game-jam/<game-id>/NN-slug.md` (implementada: `frogger/01-frogger-core` = Frogger). Informes de rendimiento en `specs/perf/<id>.md` (hoy `snake.md`). Leer la spec relevante antes de tocar un área: sección `Decisions` registra decisiones del usuario (no re-litigar).

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
- `components/`: UI cliente/servidor (`nav`, `home`, `library`, `player`, `about`, `contact-form`, `auth-form`, `user-menu`, `session` = `SessionProvider`/`useSession`, `reveal`, `touch-controls` = D-pad + A/B, `touch-detector` = montado en `app/layout.tsx`, marca el primer toque).
- `lib/`: `games.ts` (catálogo UI `GAMES`, `getGame`, `fmt`), `db.ts` (Pool `pg` único, server-only), `scores.ts` (queries server-only), `scores-schema.ts` (Zod compartido cliente/servidor), `contact.ts`, `server-response.ts`, `touch.ts` (marca táctil `sessionStorage["av_touch"]` + evento `av:touch`, hook con `useSyncExternalStore`), `auth/*`, `supabase/*`.
- `games/`: juegos reales en canvas (ver abajo) + comunes `types.ts`, `registry.ts`, `touch-bindings.ts`. Jugables: `asteroids`, `tetris`, `bloque-buster`, `snake`, `frogger`; el resto del catálogo (`gloton`, `invasores`, `duelo-pixel`) usa el reproductor simulado.
- `JUEGOS.md` (raíz): tabla de juegos implementados (id, título, categoría, descripción, color).
- `references/`: `templates/` (diseño JSX/CSS original de la UI), `started-games/` (juegos de referencia a portar: `02-asteroids`, `03-tetris`, `04-arkanoid`), `snake/snake-assets/`. Solo lectura, salvo `games-seggestions-todo.md` (historial de sugerencias, lo mantiene el agente `game-planner`).
- `public/games/<id>/`: assets de juegos (hoy solo `snake/fruits.png`).

## Convenciones de API (route handlers)

Validar body con Zod (`safeParse`), responder `NextResponse.json(createServerResponse<T>(ok, status, data, message), { status })` con `StatusCodes` de `http-status-codes`. `message` = código de error tipado (ej. `ScoreErrorCode`, `ContactErrorCode`). Body JSON inválido → 400. Env vars validadas con Zod en un `getXEnv()` que lanza listando las keys faltantes.

## Auth (SPEC 06)

- Better Auth (`lib/auth/auth.ts`, server-only) sobre el Pool compartido; plugins `username` + `jwt` + `haveIBeenPwned` (SPEC 13: rechaza contraseñas filtradas en el signup → código `PASSWORD_COMPROMISED`, error del campo contraseña; si HIBP no responde, el signup falla con 500). Email/password (8–128) + OAuth Google y GitHub.
- Rate limit (SPEC 13): `rateLimit.storage: "database"` (tabla `rateLimit`), signup 3/h por IP, login email/username 5/min por IP, resto default (100/10 s). Solo activo en producción (`npm run build && npm start`). 429 → `MSG.rateLimit`.
- Supabase Auth no se usa: en su dashboard los signups están deshabilitados (cierra una vía de registro paralela).
- Username único 3–10 `[a-z0-9_]`; en OAuth se deriva de email/login con sufijo numérico (`lib/auth/username.ts`, resuelto en `mapProfileToUser`).
- Cliente: `lib/auth/auth-client.ts` (mismo origen). Sesión en servidor: `auth.api.getSession({ headers: await headers() })`.

## Base de datos (Supabase)

- Supabase Postgres, proyecto vía MCP `supabase` (`.mcp.json`). Migraciones con `mcp__supabase__apply_migration`; tras cambios de esquema regenerar `lib/supabase/database.types.ts` (y re-agregar sus comentarios manuales).
- Tablas: Better Auth (`user`, `session`, `account`, `verification`, `jwks`, `rateLimit`) + `games` (id, title, category, playable, plays_count) + `best_scores` (1 fila por usuario+juego, upsert solo si supera; ranking `score desc, achieved_at asc`).
- **Data API denegada explícitamente (SPEC 13):** todas con RLS activo, `revoke all` a `anon`/`authenticated` y una policy restrictiva `deny_data_api` (`using (false) with check (false)`). Toda tabla nueva en `public` debe llevar lo mismo. El rol `postgres` de `DATABASE_URL` hace bypass de RLS. La app accede solo desde servidor por `DATABASE_URL` (Pool `pg`, transaction pooler 6543), no por la Data API. `lib/supabase/{client,server}.ts` existen pero no se usan para estos datos.
- `userId` siempre desde la sesión, nunca del body. Fechas formateadas en servidor (`es-ES`, `UTC`).
- Usuarios demo seed: email `@demo.arcadevault.local`.
- Renombrar un juego (ej. `caida`→`tetris`, `serpentina`→`snake`, `ranaria`→`frogger`): FK sin `ON UPDATE CASCADE` → insertar fila nueva, mover `best_scores`, borrar vieja, en una migración; marcar `playable = true`.

## Juegos (patrón SPEC 05)

- Cada juego en `games/<id>/`: `engine.ts` (clase motor, loop rAF, `dt` cap 50 ms), `input.ts`, `constants.ts`, entidades/niveles, y `<id>-canvas.tsx` (client component que implementa `GameCanvasProps` de `games/types.ts`).
- Registrar en `games/registry.ts` (`GAME_COMPONENTS`, id → componente); juegos no registrados usan el reproductor simulado. El id debe coincidir con `lib/games.ts` y la fila en `games` de Supabase.
- Canvas lógico 800×600 escalado con `devicePixelRatio`, dentro del CRT de `components/player.tsx`. Fuente `monospace`; paleta neón con hex copiados de `globals.css`.
- HUD React (`.player-hud`) muestra solo valores comunes (`GameSnapshot`: score, lives, level, state) vía `onSnapshot`, emitido solo cuando cambian (no por frame). Valores propios del juego se dibujan en el canvas; no agregarlos a `GameSnapshot`.
- `paused` vive en React (prop); P/Esc → `onTogglePause`. `GameHandle` (`endGame`, `restart`) vía ref. FIN fuerza game over; Espacio reinicia. Teclado (flechas + WASD); táctil (SPEC 11) vía `<TouchControls>` que despacha teclas sintéticas en `window` — cada juego nuevo necesita entrada en `games/touch-bindings.ts`.
- Al entrar en `gameover` el reproductor hace POST `/api/scores` una vez por partida; invitado ve CTA a `/auth`.
- Assets: excepción iniciada en Snake (`public/games/snake/`, atlas tipado en `sprites.ts`, precarga + fallback a primitivas).
- Rendimiento (SPEC 12): `shadowBlur` es caro (sobre todo con dpr 2–3). Limitar el glow a pocos elementos o, para conservar el look, cachear el fondo estático y los sprites con glow en `OffscreenCanvas` → `ImageBitmap` y dibujarlos con `drawImage` (ejemplo: `games/frogger/render-cache.ts`).
- Nuevo juego: `@game-planner` (elige qué juego) → `/add-game` → genera descripción → `/spec` → `/spec-impl-game` (= `/spec-impl` + lanza `@mobile-porter` al terminar).

## UI / theming

- Tema en `app/globals.css`: vars `--bg`, `--ink`, `--cyan`, `--magenta`, `--yellow`, `--green`, `--gold`/`--silver`/`--bronze`, expuestas a Tailwind vía `@theme inline` (`bg-cyan`, `font-pixel`, `font-mono`). Mucho CSS por clases (`.player-hud`, `.crt-screen`, `cover-*`) portado de `references/templates/styles.css`.
- Fuentes `next/font/google`: Press Start 2P (pixel), JetBrains Mono, Courier Prime. `lang="es"`. Textos UI en MAYÚSCULAS estilo arcade.

## Env vars

Ver `.env.example`: `RESEND_API_KEY`, `CONTACT_TO_EMAIL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_DB_PASSWORD` (solo CLI), `BETTER_AUTH_SECRET` (≥32), `BETTER_AUTH_URL`, `DATABASE_URL`, `GOOGLE_CLIENT_ID/SECRET`, `GITHUB_CLIENT_ID/SECRET`. Nunca commitear `.env.local`.

## Tooling Claude

- Hook `PostToolUse` (Write|Edit) en `.claude/hooks/format-lint.mjs` (registrado en `.claude/settings.json`): Prettier en `.ts/.tsx/.mts/.cts/.md/.mdx`, `eslint --fix` en TS. Si falla bloquea (exit 2): corregir el error reportado.
- `specs/.spec-config.yml`: `AutoCreateBranch: true`, `AutoCommitSteps: false` (no commitear pasos automáticamente).
- MCP: `.mcp.json` solo define `supabase`. Las tools `mcp__playwright__*` (usadas por `mobile-porter` y `game-performance`) vienen de la config del usuario, no del repo.
- Capturas/logs de Playwright en `.playwright-mcp/` y `.playwright-cli/` (gitignored).

### Skills del proyecto

- Externas, fijadas en `skills-lock.json` y copiadas en `.agents/skills/<name>/` y `.claude/skills/<name>/`: `spec`, `spec-impl` (Klerith/fernando-skills), `frontend-design` (anthropics/skills), `ui-ux-pro-max` (nextlevelbuilder), `supabase`, `supabase-postgres-best-practices` (supabase/agent-skills).
- `playwright-cli`: solo en `.claude/skills/playwright-cli/` (fuera del lock).
- Propias:
  - `add-game` (`.claude/skills/add-game/SKILL.md`): porta una referencia de `references/started-games/` o diseña desde descripción libre (+ assets opcionales) y genera el argumento para `/spec`. No escribe código ni la spec.
  - `spec-impl-game` (`.claude/skills/spec-impl-game/SKILL.md`): lee y sigue `.agents/skills/spec-impl/SKILL.md` fases 1–4, luego lanza `mobile-porter` y relaya su reporte. `disable-model-invocation: true`: solo se invoca con `/spec-impl-game <NN-spec>`.

### Agentes del proyecto

Definidos en `.claude/agents/<name>.md` (`model: opus`, `memory: project`). Para más detalle (tools, procedimiento, formato de salida) leer el archivo del agente. Memoria persistente en `.claude/agent-memory/<name>/` (commitear).

- `game-planner` (`.claude/agents/game-planner.md`): decide qué juego agregar (diversidad de categorías, factibilidad canvas 2D, reconoce clásicos). Entrega listo para `/add-game`. No escribe código ni specs. Mantiene el historial en `references/games-seggestions-todo.md`.
- `game-jam` (`.claude/agents/game-jam.md`): tema + juego → 2 specs completos (formato SPEC 05/08/09/10 o ejemplos dados) en `specs/game-jam/<game-id>/`. Se detiene y pregunta ante dudas de alto impacto. Supabase solo lectura (`execute_sql`, `list_tables`). Su carpeta de memoria se crea al primer uso.
- `mobile-porter` (`.claude/agents/mobile-porter.md`): audita y corrige el reproductor `/juegos/<id>/jugar` en navegador móvil (390×844, Playwright `hasTouch`) según SPEC 11: `TOUCH_BINDINGS`, controles táctiles, HUD compacto. No toca motores ni contrato común; pregunta si el fix lo requiere. No commitea.
- `game-performance` (`.claude/agents/game-performance.md`): recibe un id de juego. Mide FPS/tirones y renders de React (procedimiento SPEC 12: build `--profile`, Playwright 390×844 dpr 3, CPU 4×). Corrige solo si no cumple las metas (≥55 FPS, ≤5% frames >33 ms, umbral React), con caché de fondo/sprites `ImageBitmap`, sin cambiar look ni reglas. Informa en `specs/perf/<id>.md`. No commitea.

## SKILLS

- Usa siempre la skill /frontend-design cuando tengas que diseñar/implementar interfaces de usuario.
- Usa /supabase y /supabase-postgres-best-practices antes de cambios de esquema, migraciones o queries.
- Usa el agente `game-planner` cuando se pidan ideas o qué juego agregar a continuación (antes de /add-game).
- Usa el agente `game-jam` cuando se pida una game jam o specs de un juego a partir de un tema.
- Para implementar la spec de un juego usa /spec-impl-game (lanza `mobile-porter` al final). Usa el agente `mobile-porter` directamente cuando se pida revisar/portar juegos a móvil.
- Usa el agente `game-performance` (con el id del juego) cuando se reporten FPS bajos/tirones o se pida optimizar un juego.
- Usa /add-game para preparar un juego nuevo antes de /spec.
