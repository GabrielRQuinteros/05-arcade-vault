# SPEC 08 — Juego Tetris jugable en el reproductor

> **Status:** Implemented
> **Depends on:** SPEC 05, SPEC 07
> **Date:** 2026-11-19
> **Objective:** Portar a TypeScript el juego de `references/started-games/03-tetris/`, renombrar `caida` → `tetris` en el código y en Supabase y montarlo en `/juegos/tetris/jugar` con el patrón de SPEC 05, guardando puntuaciones reales como Asteroids.

## Why this spec exists

Es el segundo juego real de la plataforma y la primera reutilización del patrón de SPEC 05 (motor sin globales + componente canvas + registro por id). Tetris no encaja de forma natural en ese patrón en dos puntos, y esta spec fija cómo se resuelven sin tocar el contrato común:

- **No tiene vidas**, pero `GameSnapshot` y `.player-hud` siempre muestran Vidas.
- **Su campo es vertical (1:2)**, pero `.crt-screen` es 4:3.

Además, el juego ya figura en el catálogo como `id: "caida"` / `title: "CAÍDA"` y en Supabase como fila `caida` (con `playable = false` y 12 marcas demo de SPEC 07). Igual que `rocas` → `asteroids` en SPEC 05, se renombra al nombre de la referencia (`03-tetris`).

## Scope

**In:**

- Renombrar `caida` → `tetris` en el código Next.js: id, título `TETRIS`, clase de portada `.cover-tetro` → `.cover-tetris` y "Caída" → "Tetris" en la actividad de ejemplo de la Home.
- Renombrar la fila `caida` → `tetris` en `public.games` con `playable = true`, conservando `plays_count` y moviendo sus 12 marcas demo de `best_scores`.
- Port del juego a TypeScript estricto en `games/tetris/`, sin variables globales.
- Las 7 piezas estándar I, O, T, S, Z, J, L con sorteo uniforme. La pieza "tuerca" del original no se porta.
- Mecánica del original: rotación horaria con wall kicks `[0, -1, 1, -2, 2]`, caída automática por intervalo, soft drop, hard drop, ghost piece, limpieza de líneas, niveles cada 10 líneas y aceleración.
- Puntuación del original: `LINE_SCORES × nivel`, +1 por fila de soft drop y +2 por celda de hard drop.
- Vidas: el motor emite `lives = 1` durante la partida y `lives = 0` en game over.
- Resolución lógica 800×600: tablero 300×600 centrado y paneles laterales dentro del canvas: LÍNEAS a la izquierda y SIGUIENTE a la derecha.
- Paleta neón del vault, un color por tipo de pieza.
- Overlay GAME OVER dentro del canvas, sin puntaje.
- Controles: flechas y WASD, Espacio (hard drop, y reiniciar en game over), P y Esc (pausa). Repetición nativa del teclado para mover y para soft drop.
- Botones del reproductor iguales a Asteroids: PAUSA, FIN / JUGAR DE NUEVO y SALIR.
- Guardado automático de la puntuación al entrar en game over con sesión, y CTA para invitados. Se reutiliza tal cual el flujo de SPEC 07 en `components/player.tsx`.
- Registrar `tetris` en `games/registry.ts`.

**Out of scope (for future specs):**

- Pieza "tuerca" (8ª pieza del original).
- Hold piece, bolsa de 7, SRS, rotación antihoraria, lock delay, T-spins, combos y cola de varias piezas siguientes.
- DAS/ARR propio: se usa la repetición del teclado del sistema operativo.
- Leyenda de controles dentro del canvas.
- Toggle de tema claro/oscuro y `localStorage["tetris-theme"]` del original.
- Sonido y música.
- Controles táctiles / soporte móvil jugable.
- Pausa automática al ocultar la pestaña.
- Cambiar los textos `short` / `long` del juego.
- Redirección de `/juegos/caida` a `/juegos/tetris`.
- Cambios en `GameSnapshot`, `GameHandle`, `GameCanvasProps` o `.player-hud`.
- Carga diferida (`next/dynamic`) de los juegos registrados.
- Portar Arkanoid u otros juegos.

## Layout de la pantalla de juego

`/juegos/tetris/jugar` mantiene la estructura de `components/player.tsx` definida en SPEC 05:

```
┌─ ARRIBA: .player-hud (React, sin cambios) ────────────────────────────────┐
│ JUGADOR   PUNTUACIÓN   VIDAS   NIVEL               [PAUSA] [FIN] [SALIR]  │
│ INVITADO  1.250        ♥       02                                         │
└───────────────────────────────────────────────────────────────────────────┘
┌─ ABAJO: .crt > .crt-screen (canvas 800×600 lógico) ───────────────────────┐
│                 ┌──────────────────────┐                                  │
│     LÍNEAS      │                      │        SIGUIENTE                 │
│       12        │   tablero 10×20      │        ┌──────┐                  │
│                 │   (300×600, x=250)   │        │ ▇▇▇  │                  │
│                 │   ghost + pieza      │        │  ▇   │                  │
│                 │                      │        └──────┘                  │
│                 └──────────────────────┘                                  │
└───────────────────────────────────────────────────────────────────────────┘
```

**Regla general de SPEC 05 (se mantiene):** `.player-hud` solo muestra Puntuación, Vidas y Nivel desde `GameSnapshot`. Los valores propios de Tetris (LÍNEAS y SIGUIENTE) solo se dibujan en el canvas.

**Arriba — `.player-hud`:** sin cambios de código ni de estilo.

| Stat       | Origen           | Valor en Tetris                           |
| ---------- | ---------------- | ----------------------------------------- |
| Puntuación | `snapshot.score` | puntaje del motor                         |
| Vidas      | `snapshot.lives` | `1` jugando (`♥`), `0` en game over (`—`) |
| Nivel      | `snapshot.level` | `floor(lines / 10) + 1`, 2 dígitos (`01`) |

**Abajo — canvas:**

- Tablero 300×600 en `x = 250`, `y = 0`, con grid de líneas finas y borde.
- Panel izquierdo centrado en `x = 125`: etiqueta `LÍNEAS` y debajo el número de líneas.
- Panel derecho centrado en `x = 675`: etiqueta `SIGUIENTE` y debajo un recuadro de 4×4 celdas de 30 px con la siguiente pieza centrada.
- **No se dibujan** puntaje, nivel ni vidas en el canvas.
- Overlay GAME OVER sobre el tablero: título `GAME OVER` y subtítulo `ESPACIO PARA REINICIAR`, sin puntaje.

## Data model

### Cambio en `lib/games.ts`

```ts
{
  id: "tetris",          // antes "caida"
  title: "TETRIS",       // antes "CAÍDA"
  short: "...",           // sin cambios
  long: "...",            // sin cambios
  cat: "PUZZLE",
  cover: "cover-tetris", // antes "cover-tetro"
  color: "magenta",
}
```

### Migración Supabase `tetris_rename_playable`

Aplicada con `mcp__supabase__apply_migration`. La FK `best_scores_game_id_fkey` no tiene `ON UPDATE CASCADE`, así que el renombre es insertar, mover y borrar, en una sola migración:

```sql
insert into public.games (id, title, category, playable, plays_count, created_at)
select 'tetris', 'TETRIS', category, true, plays_count, created_at
from public.games where id = 'caida';

update public.best_scores set game_id = 'tetris' where game_id = 'caida';

delete from public.games where id = 'caida';
```

Sin cambios de esquema: `lib/supabase/database.types.ts` no se regenera.

### Contrato común (`games/types.ts`)

Sin cambios de forma. Solo se corrige el comentario de `GameHandle.restart()` ("score 0, lives 3, level 1") por uno genérico ("nueva partida con los valores iniciales del juego"), porque Tetris reinicia con `lives = 1`.

### Constantes (`games/tetris/constants.ts`)

Portadas sin cambios de valor:

```ts
export const W = 800;
export const H = 600;
export const COLS = 10;
export const ROWS = 20;
export const BLOCK = 30;
export const BOARD_X = 250; // (W - COLS * BLOCK) / 2
export const LINE_SCORES = [0, 100, 300, 500, 800] as const;
export const KICKS = [0, -1, 1, -2, 2] as const;
// dropInterval(level) = Math.max(100, 1000 - (level - 1) * 90) ms
// level = Math.floor(lines / 10) + 1
```

### Piezas y tablero

```ts
type Cell = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7; // 0 vacío, 1–7 = I O T S Z J L
type Shape = Cell[][];
type Board = Cell[][]; // ROWS × COLS
type Piece = { type: Exclude<Cell, 0>; shape: Shape; x: number; y: number };
```

- `PIECES`: las 7 matrices del original (I 4×4, O 2×2, el resto 3×3).
- Spawn: `x = floor(COLS / 2) - floor(ancho / 2)`, `y = 0`. Si colisiona al aparecer → game over.

### Paleta del canvas (hex copiados de `app/globals.css`)

| Elemento                     | Color                                    |
| ---------------------------- | ---------------------------------------- |
| I, J                         | `#00f5ff` (`--cyan`)                     |
| T, Z                         | `#ff006e` (`--magenta`)                  |
| O, L                         | `#f5ff00` (`--yellow`)                   |
| S                            | `#00ff88` (`--green`)                    |
| Ghost                        | color de la pieza con alpha 0.2          |
| Grid del tablero             | `rgba(255, 255, 255, 0.06)` (`--line-2`) |
| Borde del tablero            | `rgba(0, 245, 255, 0.18)` (`--line`)     |
| Etiquetas LÍNEAS / SIGUIENTE | `#8a8fb5` (`--ink-dim`)                  |
| Valor de LÍNEAS              | `#e6e9ff` (`--ink`)                      |
| Título GAME OVER             | `#ff006e` (`--magenta`)                  |
| Subtítulo GAME OVER          | `#e6e9ff` (`--ink`)                      |
| Fondo                        | `#000`                                   |

Bloque: relleno con 1 px de margen y franja superior blanca al 12% de 4 px, como el original. Glow (`shadowBlur`) solo en la pieza que cae, no en los bloques fijos. Fuente del canvas: `monospace`.

### Motor (`games/tetris/engine.ts`)

```ts
class TetrisEngine {
  constructor(canvas: HTMLCanvasElement, cb: { onSnapshot; onTogglePause });
  start(): void; // listeners de teclado + requestAnimationFrame
  pause(): void; // congela la caída; descarta acciones en cola
  resume(): void; // reinicia lastTime y dropAccum para evitar caídas en salto
  endGame(): void; // state "gameover", lives 0
  restart(): void; // tablero vacío, score 0, lines 0, level 1, lives 1
  destroy(): void; // cancelAnimationFrame + quita listeners
}
```

Estado interno: `board`, `current`, `next`, `score`, `lines`, `level`, `state`, `dropInterval`, `dropAccum`, `lastTime`. `onSnapshot` solo se emite cuando cambia `score`, `lives`, `level` o `state`. El estado `"dead"` de `GameSnapshot` no se usa.

### Mapa de teclas (`games/tetris/input.ts`)

| Acción                            | Teclas                                  | Repetición del teclado |
| --------------------------------- | --------------------------------------- | ---------------------- |
| Mover izquierda / derecha         | `ArrowLeft`/`KeyA`, `ArrowRight`/`KeyD` | sí                     |
| Rotar (horario)                   | `ArrowUp`/`KeyW`, `KeyX`                | no                     |
| Soft drop                         | `ArrowDown`/`KeyS`                      | sí                     |
| Hard drop / reiniciar (game over) | `Space`                                 | no                     |
| Pausa (toggle)                    | `KeyP`, `Escape`                        | no                     |

- Cada `keydown` encola una acción, y el motor vacía la cola en el siguiente frame. Las teclas marcadas "no" ignoran los eventos con `e.repeat === true`.
- `preventDefault` en `keydown` y `keyup` de esas teclas, salvo si el foco está en `input`, `textarea` o `contentEditable` (mismo criterio que `games/asteroids/input.ts`).
- Con pausa solo responden P/Esc. En game over solo responde Espacio, y P/Esc no hacen nada.

### Archivos tras esta spec

- `lib/games.ts`, `app/globals.css`, `components/home.tsx` (modificados por el renombre)
- `games/types.ts` (modificado: solo el comentario de `restart`)
- `games/tetris/constants.ts` (nuevo) — constantes y paleta
- `games/tetris/pieces.ts` (nuevo) — `PIECES`, `randomPiece()`, `rotateCW()`
- `games/tetris/board.ts` (nuevo) — `createBoard()`, `collide()`, `merge()`, `clearLines()`, sin estado propio
- `games/tetris/input.ts` (nuevo) — cola de acciones, attach/detach
- `games/tetris/engine.ts` (nuevo)
- `games/tetris/tetris-canvas.tsx` (nuevo, cliente)
- `games/registry.ts` (modificado)
- Supabase: migración `tetris_rename_playable`

`components/player.tsx` no cambia: ya trata cualquier juego registrado como real y ya envía la puntuación (SPEC 07).

### Rutas tras esta spec

- `/juegos/tetris`, `/juegos/tetris/jugar` — nuevas (reemplazan a `/juegos/caida*`)
- `/juegos/caida`, `/juegos/caida/jugar` — 404
- `/salon?juego=tetris` — nueva pestaña (reemplaza a `?juego=caida`)

## Implementation plan

1. Renombrar en `lib/games.ts` (`id`, `title`, `cover`), en `app/globals.css` (`.cover-tetro` y `::after` → `.cover-tetris`) y en `components/home.tsx` (`g: "Caída"` → `g: "Tetris"`). En el mismo paso, aplicar la migración `tetris_rename_playable`, para que catálogo y BD no queden desalineados. Manual: `/juegos/tetris` muestra el detalle con su portada y el top 10 demo; `/juegos/caida` da 404; `/juegos/tetris/jugar` sigue con el reproductor simulado.
2. Crear `games/tetris/constants.ts` y `games/tetris/pieces.ts` (7 piezas, `randomPiece`, `rotateCW`).
3. Crear `games/tetris/board.ts` con `createBoard`, `collide`, `merge` y `clearLines` (devuelve las líneas limpiadas) como funciones puras sobre `Board`.
4. Crear `games/tetris/input.ts`: mapa de teclas, cola de acciones, filtro de `e.repeat` por acción, `preventDefault` condicionado, `attach()`/`detach()`/`clear()`.
5. Crear `games/tetris/engine.ts`, parte lógica: estado, spawn, movimiento, rotación con kicks, soft/hard drop, lock (merge + clear + spawn), puntuación, nivel, `dropInterval`, game over por colisión al aparecer, `pause`/`resume`/`endGame`/`restart`/`destroy` y emisión de `onSnapshot` solo con cambios (`lives` 1 → 0 en game over).
6. Completar `engine.ts`, parte de dibujo: fondo, grid y borde del tablero en `BOARD_X`, bloques fijos, ghost, pieza actual con glow, panel LÍNEAS, panel SIGUIENTE y overlay GAME OVER / ESPACIO PARA REINICIAR. Sin puntaje, nivel ni vidas.
7. Crear `games/tetris/tetris-canvas.tsx` (`"use client"`), copiando el patrón de `asteroids-canvas.tsx`: buffer `800·dpr × 600·dpr`, motor creado en `useEffect` y destruido en el cleanup, `paused` → `pause()`/`resume()`, `useImperativeHandle` para `GameHandle` y `aria-label="Tetris"`. Registrar `tetris: TetrisCanvas` en `GAME_COMPONENTS` y corregir el comentario de `restart` en `games/types.ts`. Manual: `/juegos/tetris/jugar` es jugable y al terminar con sesión aparece la línea de guardado de SPEC 07.

## Acceptance criteria

- [ ] `npm run build` termina sin errores y genera `/juegos/tetris` y `/juegos/tetris/jugar`; no genera rutas `caida`.
- [ ] `/juegos/caida` y `/juegos/caida/jugar` devuelven 404.
- [ ] `grep -rE "\"caida\"|CAÍDA|Caída|cover-tetro" app components lib games` no devuelve resultados.
- [ ] `npx tsc --noEmit` y `npx eslint app components lib games` no reportan errores.
- [ ] En Supabase, `public.games` no tiene fila `caida`; `tetris` tiene `title = 'TETRIS'`, `playable = true` y el `plays_count` que tenía `caida` (31800 antes de jugar).
- [ ] `select count(*) from public.best_scores where game_id = 'tetris'` devuelve 12 y para `'caida'` devuelve 0.
- [ ] En `/biblioteca`, el filtro PUZZLE muestra TETRIS con su portada visible.
- [ ] La Home muestra "Tetris" en la actividad en vivo.
- [ ] `/juegos/tetris/jugar` no muestra errores ni warnings de hidratación en la consola.
- [ ] Con `devicePixelRatio` 2, el `width` del canvas es 1600 y su `height` es 1200.
- [ ] En ancho 375px no hay scroll horizontal en `/juegos/tetris/jugar`.
- [ ] El canvas muestra el tablero centrado, `LÍNEAS` a la izquierda y `SIGUIENTE` con la próxima pieza a la derecha.
- [ ] La pieza que aparece después de fijar una coincide con la que mostraba `SIGUIENTE`.
- [ ] Solo aparecen las 7 piezas estándar (nunca la tuerca 3×3 con hueco).
- [ ] I y J se dibujan en cyan, T y Z en magenta, O y L en amarillo y S en verde; el ghost se ve debajo de la pieza con el mismo color y transparente.
- [ ] El canvas no muestra puntaje, nivel ni vidas en ningún momento.
- [ ] `.player-hud` muestra solo Jugador, Puntuación, Vidas y Nivel y los botones PAUSA / FIN / SALIR; comparado con `/juegos/asteroids/jugar`, no tiene elementos nuevos.
- [ ] Durante la partida, Vidas muestra un único `♥`; en game over muestra `—`.
- [ ] ←/→ y A/D mueven la pieza una columna; mantenerlas pulsadas la sigue moviendo con la repetición del teclado.
- [ ] ↑, W y X rotan en sentido horario; mantener ↑ pulsada rota una sola vez.
- [ ] Una pieza pegada a la pared rota si un desplazamiento de 1 o 2 columnas la deja libre.
- [ ] ↓ y S bajan la pieza una fila y suman 1 a Puntuación por fila.
- [ ] Espacio suelta la pieza hasta el ghost y suma 2 por fila recorrida; mantener Espacio pulsado suelta una sola pieza.
- [ ] Pulsar flechas, WASD o Espacio durante la partida no desplaza la página.
- [ ] En nivel 01, limpiar 1 línea suma 100 y limpiar 4 a la vez suma 800 (sin contar puntos de drop).
- [ ] Cada línea limpiada incrementa `LÍNEAS` en el canvas y las filas superiores bajan.
- [ ] Al llegar a 10 líneas, Nivel en `.player-hud` pasa de `01` a `02` y la caída automática es más rápida.
- [ ] PAUSA, P y Esc congelan el juego y muestran EN PAUSA; al reanudar, la pieza no salta filas.
- [ ] Las teclas pulsadas durante la pausa no mueven la pieza al reanudar.
- [ ] Cuando una pieza nueva no cabe al aparecer, el canvas muestra `GAME OVER` / `ESPACIO PARA REINICIAR` sin puntaje, el botón FIN cambia a "JUGAR DE NUEVO" y PAUSA queda deshabilitado.
- [ ] FIN durante la partida produce el mismo game over.
- [ ] En game over, tanto Espacio como "JUGAR DE NUEVO" reinician: tablero vacío, `LÍNEAS` 0, Puntuación 0, Vidas `♥` y Nivel 01.
- [ ] Con sesión iniciada, el game over envía exactamente 1 `POST /api/scores` con `gameId: "tetris"`, responde 200 y muestra la línea de estado de SPEC 07.
- [ ] Como invitado, el game over no envía nada y muestra el CTA a `/auth`.
- [ ] Una marca nueva de Tetris aparece en `/salon?juego=tetris` y en el panel de `/juegos/tetris` tras recargar.
- [ ] Tras SALIR a `/juegos/tetris`, pulsar Espacio desplaza la página normalmente y volver a jugar empieza una partida nueva.
- [ ] `/juegos/asteroids/jugar` sigue funcionando igual, y un juego no registrado (p. ej. `/juegos/serpentina/jugar`) mantiene el reproductor simulado.

## Decisions

- **Yes:** renombrar `caida` → `tetris` en id, título, portada, Home y Supabase. Decisión del usuario; mismo criterio que `rocas` → `asteroids` en SPEC 05 (correlación con `references/started-games/03-tetris/`).
- **Yes:** conservar las 12 marcas demo y el `plays_count` de `caida` en `tetris`. Evita un ranking vacío y mantiene el seed de SPEC 07.
- **Yes:** renombre en BD con insert + update + delete en una sola migración. La FK no tiene `ON UPDATE CASCADE`; borrar `caida` primero eliminaría las marcas en cascada.
- **No:** agregar `ON UPDATE CASCADE` a la FK. Cambio de esquema innecesario para un renombre puntual.
- **No:** redirección de `/juegos/caida`. No hay usuarios ni enlaces externos, como en SPEC 05.
- **No:** editar SPEC 07 (su seed y su criterio mencionan `caida`). Es histórico; el renombre queda registrado aquí.
- **Yes:** mantener `short` y `long` sin cambios. Decisión del usuario; ya describen la mecánica.
- **Yes:** `lives = 1` jugando y `0` en game over. Decisión del usuario: el HUD sigue igual y `—` coincide con el game over.
- **No:** `lives = 0` siempre. El HUD mostraría `—` durante toda la partida.
- **No:** agregar campos a `GameSnapshot` u ocultar Vidas para Tetris. Rompe el contrato genérico de SPEC 05.
- **No:** portar la pieza "tuerca". Decisión del usuario: solo las 7 estándar.
- **Yes:** color por tipo de pieza con la paleta neón (I/J cyan, T/Z magenta, O/L amarillo, S verde). Decisión del usuario: conserva la identidad de cada pieza con solo 4 neones.
- **No:** color por rol (pieza actual / bloques fijos). Se lee peor.
- **Yes:** glow solo en la pieza que cae. Hasta 200 bloques con `shadowBlur` por frame cuestan rendimiento.
- **Yes:** 800×600 lógico con tablero 300×600 centrado. Mantiene `BLOCK = 30` del original y llena el `.crt-screen` 4:3 sin deformar.
- **Yes:** paneles LÍNEAS y SIGUIENTE en el canvas. Decisión del usuario: son valores propios del juego (regla de SPEC 05).
- **No:** leyenda de controles en el canvas. Decisión del usuario.
- **Yes:** etiquetas `LÍNEAS` y `SIGUIENTE` en español. La UI del sitio está en español; `GAME OVER` se mantiene por consistencia con Asteroids.
- **Yes:** repetición nativa del teclado para mover y para soft drop. Decisión del usuario: igual que el original y sin código extra.
- **No:** DAS/ARR propio.
- **Yes:** rotación, hard drop, pausa y reinicio ignoran `e.repeat`. Mantener Espacio no debe soltar varias piezas ni reiniciar en cuanto llega el game over.
- **Yes:** `input.ts` propio con cola de acciones por `keydown`. El `Input` de Asteroids ignora siempre la repetición, y Tetris la necesita para mover.
- **No:** compartir `input.ts` entre juegos. Con dos juegos y semánticas distintas no compensa abstraer.
- **Yes:** Espacio reinicia en game over, además de JUGAR DE NUEVO. Decisión del usuario; igual que Asteroids.
- **Yes:** `board.ts` con funciones puras y sin carpeta `entities/`. Tetris no tiene entidades con `update`/`draw`/`dead`.
- **Yes:** guardado de puntuación sin tocar `components/player.tsx`. SPEC 07 ya lo hace para cualquier juego registrado; solo falta `playable = true`.
- **Yes:** invariantes de SPEC 05/07: canvas sin assets, `.player-hud` fijo, `GameSnapshot` genérico, motor sin globales, hex copiados de `globals.css` e id consistente en `lib/games.ts`, `games/registry.ts` y `public.games`.

## Risks

| Risk                                                              | Mitigation                                                                                           |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Borrar `caida` antes de mover las marcas las elimina en cascada   | Orden fijo insert → update → delete en una sola migración; un criterio cuenta 12 marcas en `tetris`. |
| Catálogo y BD desalineados (id `tetris` en código, `caida` en BD) | El paso 1 hace ambos cambios juntos; `/api/scores` devolvería 404 `GAME_NOT_PLAYABLE` si fallara.    |
| Hard drop o reinicio múltiple al mantener Espacio                 | Espacio ignora `e.repeat`; criterio específico.                                                      |
| Caída en salto al reanudar tras una pausa larga                   | `resume()` reinicia `lastTime` y `dropAccum`.                                                        |
| Acciones encoladas durante la pausa se aplican al reanudar        | `pause()` vacía la cola; con pausa solo se encolan P/Esc.                                            |
| StrictMode duplica motor/listeners en dev                         | `destroy()` en el cleanup, igual que Asteroids.                                                      |
| Doble envío de score en la transición a game over                 | Ya cubierto por `sentRef` de SPEC 07; `lives` y `state` cambian en el mismo snapshot.                |
| Grid y glow caros por frame                                       | Grid con un único `stroke()` por frame; `shadowBlur` solo en la pieza activa.                        |
| Restos de `caida` en el código                                    | Criterio con `grep` sobre `app components lib games`.                                                |

## What is **not** in this spec

- Pieza "tuerca".
- Hold, bolsa de 7, SRS, lock delay, T-spins, combos y cola de varias piezas.
- DAS/ARR propio.
- Leyenda de controles en el canvas.
- Tema claro/oscuro del original.
- Sonido.
- Controles táctiles y móvil.
- Pausa automática por visibilidad.
- Cambios en `short` / `long`.
- Redirección de `/juegos/caida`.
- Cambios en el contrato común de juegos o en `.player-hud`.
- Carga diferida de juegos.
- Otros juegos (Arkanoid…).

Cada uno, si se hace, va en su propio spec.
