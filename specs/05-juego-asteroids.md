# SPEC 05 — Juego Asteroids jugable en el reproductor

> **Status:** Approved
> **Depends on:** SPEC 01, SPEC 02
> **Date:** 2026-11-17
> **Objective:** Portar a TypeScript el juego de `references/started-games/02-asteroids/` y montarlo como canvas dentro del reproductor `/juegos/asteroids/jugar`. Los valores comunes a cualquier juego (puntuación, vidas, nivel) se muestran únicamente en el HUD React existente (`.player-hud`), sincronizados con el motor. Los valores propios de Asteroids (contador del triple disparo) se quedan dentro del canvas.

## Why this spec exists

Es el primer juego real de la plataforma. Hasta ahora el reproductor (`components/player.tsx`, SPEC 01) solo simula puntaje. Esta spec define cómo un juego canvas autónomo convive con la UI Next.js sin romperla: el reproductor existente es la prioridad y el juego se adapta a él.

El patrón (motor sin globales + componente canvas + registro por id) es la base para los próximos juegos (Tetris, Arkanoid en `references/started-games/`).

Además, el juego hoy figura como `id: "rocas"` / `title: "ROCAS"` en `lib/games.ts`. El nombre correcto es **Asteroids** (igual que la referencia `02-asteroids`), así que se renombra en todo el código.

## Scope

**In:**

- Renombrar `rocas` → `asteroids` en todo el código Next.js: id, título `ASTEROIDS`, clase de portada `.cover-asteroids` y "Rocas" → "Asteroids" en la actividad de ejemplo de la Home.
- Port del juego a TypeScript estricto en `games/asteroids/`, separado por entidad, sin variables globales.
- Toda la mecánica del original: rotación, propulsión con inercia y drag, disparo con cooldown, espacio toroidal, asteroides que se parten (3 → 2 → 1), partículas, 3 vidas, invencibilidad con parpadeo al reaparecer, niveles con `3 + nivel` asteroides.
- Power-up de triple disparo igual al original (15% de drop, garantizado a la 5ª destrucción, uno por nivel, dura 5 s, desaparece a los 12 s).
- Paleta neón del vault dentro del canvas (mismas formas vectoriales).
- Valores comunes (puntuación, vidas, nivel) solo en `.player-hud`; valores propios del juego (`3x N.Ns`) solo en el canvas. Ver "Layout de la pantalla de juego".
- Overlay GAME OVER dentro del canvas, sin puntaje: el puntaje final se lee en el HUD de arriba.
- Resolución lógica fija 800×600, canvas escalado por CSS al `.crt-screen` (ya es 4:3) y nítido con `devicePixelRatio`.
- Controles: flechas y WASD (rotar / propulsar), Espacio (disparar y reiniciar en game over), P y Esc (pausa).
- Bloqueo del scroll solo para las teclas del juego mientras el canvas está montado.
- Botones del reproductor: PAUSA pausa el motor; FIN fuerza game over; en game over FIN pasa a "JUGAR DE NUEVO".
- Registro `games/registry.ts` (id → componente). Los juegos no registrados siguen con el reproductor simulado actual.

**Out of scope (for future specs):**

- Guardar puntuaciones (ni en `av_scores` ni en Supabase). El modal FIN DEL JUEGO no aparece para Asteroids.
- Controles táctiles / soporte móvil jugable.
- Pausa automática al ocultar la pestaña.
- Sonido y música.
- OVNIs (el texto `long` los menciona, pero no se implementan).
- Cambiar los textos `short` / `long` del juego.
- Portar Tetris, Arkanoid u otros juegos.
- Carga diferida (`next/dynamic`) de los juegos registrados.

## Layout de la pantalla de juego

`/juegos/asteroids/jugar` mantiene la estructura actual de `components/player.tsx`, con dos zonas apiladas:

```
┌─ ARRIBA: .player-hud (React) ─────────────────────────────────────────────┐
│ JUGADOR   PUNTUACIÓN   VIDAS   NIVEL               [PAUSA] [FIN] [SALIR]  │
│ INVITADO  1.250        ♥ ♥ ♥   02                                         │
└───────────────────────────────────────────────────────────────────────────┘
┌─ ABAJO: .crt > .crt-screen (canvas) ──────────────────────────────────────┐
│ 3x  4.2s*                                                                 │
│         △        ○            ○        ← juego + valores propios del juego│
│    ○                    ·  ·                                              │
│                                                                           │
└───────────────────────────────────────────────────────────────────────────┘
  SEÑAL OK · ASTEROIDS · CRT-83 · 60 HZ · CARGA · 1MB   (.crt-bottom, sin cambios)
```

\* Solo se dibuja mientras el triple disparo está activo.

**Regla general (aplica a todos los juegos futuros):** `.player-hud` solo muestra valores que cualquier juego puede compartir: puntuación, vidas y nivel. Todo valor propio de un juego (power-ups, temporizadores, munición, etc.) lo dibuja el propio juego dentro de su canvas y nunca pasa al HUD React. Así el HUD de arriba no se sobrecarga y `GameSnapshot` sigue siendo genérico.

**Arriba — `.player-hud` (React):** el único lugar donde se ven los valores comunes.

| Stat       | Origen                                        | Formato                           |
| ---------- | --------------------------------------------- | --------------------------------- |
| Jugador    | sin cambios (`user?.name ?? "INVITADO"`)      | sin cambios                       |
| Puntuación | `snapshot.score`                              | `fmt(score)`, como hoy            |
| Vidas      | `snapshot.lives`                              | `♥` por vida, `—` con 0, como hoy |
| Nivel      | `snapshot.level` (no la fórmula `score/2500`) | 2 dígitos (`01`), como hoy        |

**`.player-hud` queda visualmente idéntico al actual:** los mismos 4 stats y los mismos 3 botones (PAUSA / FIN / SALIR), en el mismo orden y con las mismas clases y estilos. No se agregan, quitan ni reordenan stats, botones ni opciones. Solo cambian los datos (reales en vez de simulados) y el comportamiento de los botones existentes, descrito en el paso 8: FIN muestra "JUGAR DE NUEVO" en game over y PAUSA se deshabilita.

**Abajo — canvas dentro de `.crt-screen`:** el campo de juego (nave, asteroides, balas, power-up, partículas), el contador del triple disparo y, en game over, el overlay.

- **No se dibujan en el canvas** los valores comunes: no se porta `drawLifeIcon()` y de `drawHUD()` se eliminan `SCORE` y `NIVEL`, así que no aparecen `SCORE`, `NIVEL` ni los iconos de vida.
- **Sí se dibuja** el contador `3x  N.Ns` en la esquina superior izquierda (`x = 14`, `y = 26`, `15px monospace`, `--green`), solo mientras `ship.tripleShot > 0`. Como `SCORE` ya no ocupa esa esquina, el contador sube de `y = 46` a `y = 26`.
- La etiqueta `3x` del power-up recogible también se mantiene.
- El overlay GAME OVER muestra el título `GAME OVER` y el subtítulo `ESPACIO PARA REINICIAR`, sin el `PUNTAJE: N` del original, porque el puntaje es un valor común y se lee arriba.

**Sincronización:** el motor es la única fuente de verdad de la partida. Cada vez que cambia `score`, `lives`, `level` o `state`, emite `onSnapshot`, y el reproductor renderiza el HUD de arriba a partir del último snapshot. El reproductor no calcula ni simula valores para juegos registrados.

## Data model

Sin persistencia nueva. Cambio en `lib/games.ts`:

```ts
{
  id: "asteroids",           // antes "rocas"
  title: "ASTEROIDS",        // antes "ROCAS"
  short: "Pulveriza asteroides en gravedad cero.",  // sin cambios
  long: "...",                // sin cambios (incluye la frase de OVNIs)
  cat: "SHOOTER",
  cover: "cover-asteroids",  // antes "cover-rocas"
  color: "yellow",
  best: 41200,
  plays: "15.6K",
}
```

Contrato común de juegos (`games/types.ts`):

```ts
type GameSnapshot = {
  score: number;
  lives: number;
  level: number;
  state: "playing" | "dead" | "gameover";
}; // solo campos comunes a cualquier juego; nada específico de Asteroids

type GameHandle = {
  endGame(): void; // fuerza game over
  restart(): void; // nueva partida: score 0, lives 3, level 1
};

type GameCanvasProps = {
  paused: boolean; // fuente de verdad: estado React del reproductor
  onSnapshot: (s: GameSnapshot) => void; // solo cuando algún campo cambia, no por frame
  onTogglePause: () => void; // P / Esc dentro del juego
  ref?: React.Ref<GameHandle>; // React 19: ref como prop
};
```

Registro (`games/registry.ts`):

```ts
const GAME_COMPONENTS: Record<string, React.ComponentType<GameCanvasProps>> = {
  asteroids: AsteroidsCanvas,
};
```

Motor (`games/asteroids/engine.ts`):

```ts
class AsteroidsEngine {
  constructor(canvas: HTMLCanvasElement, cb: { onSnapshot; onTogglePause });
  start(): void; // listeners de teclado + requestAnimationFrame
  pause(): void; // detiene update; descarta pulsaciones pendientes
  resume(): void; // reinicia lastTime para evitar salto de dt
  endGame(): void;
  restart(): void;
  destroy(): void; // cancelAnimationFrame + quita listeners
}
```

Constantes portadas sin cambios de valor (`games/asteroids/constants.ts`): `W = 800`, `H = 600`, `RADII = [0, 16, 30, 50]`, `SPEEDS = [0, 85, 55, 32]`, `POINTS = [0, 100, 50, 20]`, `POWERUP_DROP_CHANCE = 0.15`, `POWERUP_DURATION = 5`, `POWERUP_TTL = 12`, `TRIPLE_SPREAD = 0.18`, cap de `dt` 0.05 s.

Paleta del canvas (hex copiados de las variables de `app/globals.css`):

| Elemento                 | Color                   |
| ------------------------ | ----------------------- |
| Nave                     | `#00f5ff` (`--cyan`)    |
| Asteroides               | `#ff006e` (`--magenta`) |
| Balas y llama            | `#f5ff00` (`--yellow`)  |
| Power-up y contador `3x` | `#00ff88` (`--green`)   |
| Partículas               | `--magenta` con alpha   |
| Título GAME OVER         | `#ff006e` (`--magenta`) |
| Subtítulo GAME OVER      | `#e6e9ff` (`--ink`)     |

Glow con `shadowBlur` solo en nave, asteroides y power-up (no en partículas). Fuente del canvas (etiqueta del power-up, contador `3x` y overlay): `monospace`, como el original.

Mapa de teclas:

| Acción                           | Teclas                                  |
| -------------------------------- | --------------------------------------- |
| Rotar izquierda / derecha        | `ArrowLeft`/`KeyA`, `ArrowRight`/`KeyD` |
| Propulsar                        | `ArrowUp`/`KeyW`                        |
| Disparar / reiniciar (game over) | `Space`                                 |
| Pausa (toggle)                   | `KeyP`, `Escape`                        |

`preventDefault` se aplica a esas teclas salvo que el foco esté en `input`, `textarea` o un elemento `contentEditable`. P/Esc no hacen nada en game over. Con el juego pausado solo responden P/Esc.

Archivos tras esta spec:

- `games/types.ts` (nuevo)
- `games/registry.ts` (nuevo)
- `games/asteroids/constants.ts` (nuevo)
- `games/asteroids/utils.ts` (nuevo) — `wrap`, `dist`, `rand`, `randInt`
- `games/asteroids/input.ts` (nuevo) — teclas sostenidas, `pressed()` de un frame, attach/detach
- `games/asteroids/entities/bullet.ts`, `asteroid.ts`, `power-up.ts`, `ship.ts`, `particle.ts` (nuevos) — `update(dt)`, `draw(ctx)`, flag `dead`
- `games/asteroids/engine.ts` (nuevo)
- `games/asteroids/asteroids-canvas.tsx` (nuevo, cliente)
- `components/player.tsx` (modificado)
- `lib/games.ts`, `app/globals.css`, `components/home.tsx` (modificados por el renombre)

Rutas tras esta spec:

- `/juegos/asteroids`, `/juegos/asteroids/jugar` — nuevas (reemplazan a `/juegos/rocas*`)
- `/juegos/rocas`, `/juegos/rocas/jugar` — 404
- Resto sin cambios.

## Implementation plan

1. Renombrar en `lib/games.ts` (`id`, `title`, `cover`), en `app/globals.css` (`.cover-rocas`, `::after`, `::before` → `.cover-asteroids`) y en `components/home.tsx` (`g: "Rocas"` → `g: "Asteroids"`). Manual: `/juegos/asteroids` muestra el detalle con su portada; `/juegos/rocas` da 404.
2. Crear `games/types.ts` y `games/registry.ts` con `GAME_COMPONENTS` vacío. En `components/player.tsx`, buscar `GAME_COMPONENTS[game.id]`; si no existe, mantener intacto el comportamiento simulado actual. Manual: todos los juegos se ven igual que antes.
3. Crear `games/asteroids/constants.ts`, `utils.ts` e `input.ts` (mapa de teclas, `pressed()`, `preventDefault` condicionado, `attach()`/`detach()`).
4. Crear las entidades `bullet.ts`, `asteroid.ts`, `particle.ts` y `power-up.ts`, portadas de `game.js` con `draw(ctx)` recibiendo el contexto y la paleta neón.
5. Crear `ship.ts` (lee `Input` en vez de `keys` global; propulsión, drag, cooldown, triple disparo, parpadeo).
6. Crear `engine.ts`: estado, `initGame`/`nextLevel`/`killShip`, colisiones, lógica del power-up, `draw` del campo de juego y del overlay GAME OVER más el contador `3x  N.Ns` en `(14, 26)`; sin `SCORE`, `NIVEL`, iconos de vida (no portar `drawLifeIcon`) ni puntaje en el overlay. Loop con cap de `dt`, `pause`/`resume`/`endGame`/`restart`/`destroy` y emisión de `onSnapshot` solo cuando cambian `score`, `lives`, `level` o `state`.
7. Crear `asteroids-canvas.tsx` (`"use client"`): canvas a `width: 100%; height: 100%`, buffer `800·dpr × 600·dpr` con `setTransform(dpr, …)`, motor creado en `useEffect` y destruido en el cleanup, prop `paused` → `pause()`/`resume()`, `useImperativeHandle` para `GameHandle`. Registrarlo en `GAME_COMPONENTS`. Manual: `/juegos/asteroids/jugar` es jugable dentro del CRT.
8. Cablear `components/player.tsx` para juegos registrados: el componente reemplaza `.game-arena` dentro de `.crt-screen`; `.player-hud` muestra Puntuación, Vidas y Nivel desde el último `GameSnapshot` (sin el intervalo simulado ni la fórmula de nivel), sin stats nuevos; Jugador sin cambios; PAUSA y P/Esc alternan el mismo estado `paused` y muestran el overlay EN PAUSA existente; FIN llama `endGame()`; con `state === "gameover"` el botón FIN muestra "JUGAR DE NUEVO" y llama `restart()`, y PAUSA queda deshabilitado; el modal FIN DEL JUEGO no se abre.

## Acceptance criteria

- [ ] `npm run build` termina sin errores y genera `/juegos/asteroids` y `/juegos/asteroids/jugar`; no genera rutas `rocas`.
- [ ] `/juegos/rocas` y `/juegos/rocas/jugar` devuelven 404.
- [ ] `grep -rE "\"rocas\"|ROCAS|Rocas|cover-rocas" app components lib games` no devuelve resultados (la palabra "rocas" en el texto `long` se mantiene).
- [ ] En `/biblioteca`, el filtro SHOOTER muestra exactamente INVASORES y ASTEROIDS, con la portada de asteroids visible.
- [ ] La Home muestra "Asteroids" en la actividad en vivo.
- [ ] `npx tsc --noEmit` y `npx eslint app components lib games` no reportan errores.
- [ ] `/juegos/asteroids/jugar` no muestra errores ni warnings de hidratación en la consola.
- [ ] El canvas ocupa todo el `.crt-screen` en 4:3 y con `devicePixelRatio` 2 su `width` es 1600 y su `height` 1200.
- [ ] En ancho 375px no hay scroll horizontal en `/juegos/asteroids/jugar`.
- [ ] Flechas y A/D rotan la nave; ↑ y W la propulsan; Espacio dispara.
- [ ] Pulsar flechas, WASD o Espacio durante la partida no desplaza la página.
- [ ] La nave, los asteroides, las balas y el power-up se dibujan en cyan, magenta, amarillo y verde respectivamente.
- [ ] El canvas no muestra puntaje, nivel ni iconos de vida en ningún momento de la partida.
- [ ] `.player-hud` muestra solo Jugador, Puntuación, Vidas y Nivel con el mismo estilo que hoy (ningún stat propio de Asteroids), y solo los botones PAUSA / FIN / SALIR; comparado con `/juegos/caida/jugar`, no tiene elementos nuevos.
- [ ] Destruir un asteroide grande suma 20 en Puntuación de `.player-hud`, uno mediano 50 y uno pequeño 100.
- [ ] Un asteroide grande se parte en 2 medianos y un mediano en 2 pequeños; uno pequeño no se parte.
- [ ] Al chocar, Vidas en `.player-hud` pierde un `♥`; la nave reaparece en el centro parpadeando 3 s sin poder morir.
- [ ] Al destruir todos los asteroides, Nivel en `.player-hud` sube (`01` → `02`) y aparecen `3 + nivel` asteroides grandes.
- [ ] Si no apareció antes, el power-up `3x` aparece al destruir el 5º asteroide del nivel; al recogerlo, el canvas muestra `3x  N.Ns` en verde arriba a la izquierda, descontando de 5.0 a 0, cada disparo lanza 3 balas, y al llegar a 0 el contador desaparece. `.player-hud` no cambia por el power-up.
- [ ] PAUSA, P y Esc congelan el juego (nada se mueve) y muestran EN PAUSA; volver a pulsarlos reanuda sin que los objetos salten de posición.
- [ ] Con el juego en pausa, Espacio no dispara al reanudar.
- [ ] FIN muestra el overlay GAME OVER en el canvas, el botón cambia a "JUGAR DE NUEVO" y PAUSA queda deshabilitado.
- [ ] Al perder las 3 vidas aparece en el canvas el overlay `GAME OVER` / `ESPACIO PARA REINICIAR` (sin puntaje), y `.player-hud` conserva el puntaje final y muestra Vidas `—`.
- [ ] En game over, tanto Espacio como "JUGAR DE NUEVO" reinician: `.player-hud` muestra Puntuación 0, `♥ ♥ ♥` y Nivel 01, y el canvas no muestra contador `3x`.
- [ ] Ningún flujo de Asteroids abre el modal FIN DEL JUEGO ni escribe en `localStorage["av_scores"]`.
- [ ] Tras SALIR a `/juegos/asteroids`, pulsar Espacio desplaza la página normalmente (no quedan listeners) y volver a jugar empieza una partida nueva.
- [ ] `/juegos/caida/jugar` mantiene el puntaje simulado, PAUSA/FIN y el modal FIN DEL JUEGO como antes.

## Decisions

- **Yes:** renombrar `rocas` → `asteroids` en id, título, clase de portada y Home. Decisión del usuario: el juego se llama Asteroids, mismo nombre que `references/started-games/02-asteroids/` para mantener la correlación con el juego de referencia (id, carpeta `games/asteroids/`, componente y ruta).
- **No:** mantener `/juegos/rocas` como redirección. No hay usuarios ni enlaces externos todavía.
- **Yes:** mantener `short` y `long` sin cambios. Decisión del usuario, aunque `long` menciona OVNIs que no existen.
- **Yes:** los rankings de ejemplo de `/juegos/asteroids` cambian. `seededScores` usa `id.length` como semilla; es dato de ejemplo.
- **No:** editar SPEC 01 (su criterio menciona ROCAS). Es histórico; el renombre queda registrado aquí.
- **Yes:** canvas dentro del CRT del reproductor actual. Decisión del usuario: priorizar el código Next.js existente; el juego se adapta a él.
- **No:** página propia a pantalla completa para el juego.
- **Yes:** TypeScript modular sin globales (motor + entidades por archivo). Permite crear y destruir el juego al navegar y escala a otros juegos.
- **No:** cargar `game.js` en `/public` con `<Script>`. Globales, sin tipos y sin cleanup.
- **Yes:** carpeta `games/` en la raíz con `games/registry.ts` (id → componente). Evita `if` por id en el reproductor y no choca con `lib/games.ts`.
- **No:** `next/dynamic` para los juegos. Con un solo juego no compensa; se revisa cuando haya varios.
- **Yes:** los valores comunes (puntuación, vidas, nivel) solo en `.player-hud`, sincronizados vía `onSnapshot`; se quitan del canvas (`SCORE`, `NIVEL`, iconos de vida). Decisión del usuario.
- **No:** duplicar valores comunes en canvas y HUD React.
- **Yes:** los valores propios de un juego (aquí el contador `3x N.Ns`) se quedan en el canvas. Decisión del usuario: el HUD de arriba solo tiene valores compartibles entre juegos, para no sobrecargarlo.
- **No:** stat TRIPLE en `.player-hud`, ni campos específicos de un juego en `GameSnapshot`.
- **Yes:** overlay GAME OVER en el canvas sin `PUNTAJE: N`. El puntaje es un valor común y ya se ve arriba.
- **Yes:** `onSnapshot` solo cuando cambian `score`, `lives`, `level` o `state`. Evita un re-render de React por frame.
- **Yes:** `paused` vive en React y el motor la recibe por prop. Botón y teclas comparten una única fuente de verdad.
- **Yes:** overlay GAME OVER dentro del canvas, sin modal ni guardado. Decisión del usuario; el guardado de puntuaciones va en otra spec.
- **No:** guardar en `av_scores` ni en Supabase en esta spec.
- **Yes:** FIN fuerza game over y pasa a "JUGAR DE NUEVO"; Espacio también reinicia. Decisión del usuario.
- **Yes:** paleta neón con hex copiados de `globals.css`. Decisión del usuario; leer las variables CSS en runtime agrega complejidad sin beneficio.
- **Yes:** `shadowBlur` solo en nave, asteroides y power-up. Glow en partículas cuesta rendimiento.
- **Yes:** fuente `monospace` en el canvas. Evita esperar a que cargue la fuente pixel del sitio.
- **Yes:** 800×600 lógico escalado y nítido con `devicePixelRatio`. `.crt-screen` ya es 4:3.
- **No:** controles táctiles. Decisión del usuario: solo teclado; móvil va en otra spec.
- **Yes:** WASD además de flechas y P/Esc para pausa. Decisión del usuario.
- **No:** pausa automática al ocultar la pestaña. Decisión del usuario; el cap de `dt` a 50 ms ya evita saltos.
- **Yes:** bloquear scroll solo para teclas del juego y fuera de inputs. Decisión del usuario.
- **Yes:** power-up de triple disparo igual al original. Decisión del usuario.

## Risks

| Risk                                                       | Mitigation                                                                                                                     |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| StrictMode monta el efecto dos veces en dev (doble loop)   | `destroy()` en el cleanup cancela el RAF y quita listeners; el segundo montaje crea un motor nuevo.                            |
| Listeners de teclado o RAF vivos tras navegar              | Mismo `destroy()`; criterio verifica que Espacio vuelve a desplazar la página tras SALIR.                                      |
| Re-render de React a 60 fps                                | `onSnapshot` solo emite cambios; el loop no toca estado React.                                                                 |
| Se porta `drawHUD()` completo por inercia                  | Paso 6 indica qué se conserva (`3x`) y qué no (`SCORE`, `NIVEL`, vidas); un criterio verifica el canvas.                       |
| Salto de posiciones al reanudar tras una pausa larga       | `resume()` reinicia `lastTime`; además el cap de `dt` a 0.05 s.                                                                |
| Disparo o reinicio "en cola" pulsado durante la pausa      | `pause()` descarta `justPressed`; con pausa solo responden P/Esc.                                                              |
| `preventDefault` rompe la escritura en inputs de la página | Se omite si el foco está en `input`, `textarea` o `contentEditable`.                                                           |
| Canvas borroso en pantallas HiDPI                          | Buffer escalado por `devicePixelRatio` y `setTransform`; criterio mide `canvas.width`.                                         |
| Enlaces o datos que sigan apuntando a `rocas`              | Paso 1 cubre los 3 archivos encontrados con grep; criterio repite el grep de identificadores sobre `app components lib games`. |

## What is **not** in this spec

- Guardado de puntuaciones (localStorage o Supabase) y modal de fin para Asteroids.
- Controles táctiles y soporte móvil jugable.
- Pausa automática por visibilidad de pestaña.
- Sonido.
- OVNIs.
- Cambios en `short` / `long`.
- Otros juegos (Tetris, Arkanoid…).
- Carga diferida de juegos.

Cada uno, si se hace, va en su propio spec.
