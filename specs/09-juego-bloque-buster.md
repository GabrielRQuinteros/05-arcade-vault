# SPEC 09 — Juego Bloque Buster jugable en el reproductor

> **Status:** Approved
> **Depends on:** SPEC 05, SPEC 07
> **Date:** 2026-11-20
> **Objective:** Portar a TypeScript el rompebloques de `references/started-games/04-arkanoid/` como el juego `bloque-buster` en `/juegos/bloque-buster/jugar`, con el patrón de SPEC 05, y guardar puntuaciones reales como Asteroids y Tetris.

## Why this spec exists

Es el tercer juego real de la plataforma y la tercera reutilización del patrón de SPEC 05 (motor sin globales + componente canvas + registro por id). Hay tres diferencias con los juegos anteriores, y esta spec fija cómo se resuelven sin tocar el contrato común:

- **El original termina en el nivel 5 con un estado `win`**, que no existe en `GameSnapshot`. Aquí los 5 niveles se repiten en bucle y la velocidad sube hasta un tope.
- **El original usa sprites y sonidos.** Aquí todo se dibuja en el canvas con la paleta neón, incluida la explosión de los bloques.
- **Es el primer juego con mouse.** Solo el canvas escucha el mouse. El teclado sigue el criterio de Asteroids.

**No se renombra.** El juego ya figura en el catálogo como `id: "bloque-buster"` / `title: "BLOQUE BUSTER"` y en Supabase como fila `bloque-buster` (`playable = false`, `plays_count = 12400`, 12 marcas demo de SPEC 07). Se conserva el nombre original de la plataforma, y la carpeta de referencia `04-arkanoid` solo es el origen del código.

## Scope

**In:**

- Port del juego a TypeScript estricto en `games/bloque-buster/`, sin variables globales.
- Física idéntica a la referencia:
  - Rebote en las paredes izquierda, derecha y superior.
  - Rebote en el paddle: solo invierte `vy` y conserva `vx`.
  - Colisión AABB con bloques: 1 bloque por frame, invierte siempre `vy`.
- Los 5 niveles de `levels.js` portados sin cambios de patrón.
- Bucle de niveles: al vaciar un nivel se carga el siguiente. Tras el 5 vuelve al patrón 1, pero el contador `level` sigue subiendo (6, 7…).
- Velocidad: `min(1.1^(level - 1), 2.5)` sobre la base `vx = 200`, `vy = -300` px/s.
- Saque: la pelota espera sobre el paddle y lo sigue hasta que se pulsa Espacio o se hace clic en el canvas. Esto pasa al empezar, tras perder una vida y al cambiar de nivel.
- Puntuación del original: 10 puntos por bloque.
- Vidas: 3. Al perder la pelota se resta 1 vida; con 0 vidas, game over.
- Explosión de bloques como efecto dibujado en el canvas (150 ms, fade + escala en el color del bloque).
- Resolución lógica 800×600 y paleta neón del vault. Los 7 colores del original se mapean a 4 neones.
- Textos en el canvas: `ESPACIO PARA LANZAR` mientras la pelota espera, y el overlay `GAME OVER` / `ESPACIO PARA REINICIAR` sin puntaje.
- Controles:
  - Teclado: ←/→ y A/D mueven el paddle (sostenidas), Espacio lanza y reinicia en game over, P y Esc pausan.
  - Mouse: mover sobre el canvas mueve el paddle y el clic lanza.
- Botones del reproductor iguales a Asteroids: PAUSA, FIN / JUGAR DE NUEVO y SALIR.
- Guardado automático de la puntuación al entrar en game over con sesión, y CTA para invitados. Se reutiliza tal cual el flujo de SPEC 07 en `components/player.tsx`.
- Fila `bloque-buster` de `public.games` con `playable = true`, conservando `plays_count` y las 12 marcas demo.
- Registrar `bloque-buster` en `games/registry.ts`.

**Out of scope (for future specs):**

- Renombrar el juego o cambiar `title`, `short`, `long`, `cover` o `color` en `lib/games.ts`.
- Sonido y música.
- Spritesheet y cualquier asset en `public/`.
- Selector de nivel en el overlay de pausa del original.
- Pantalla de victoria (`¡Completaste el juego!`): el bucle la reemplaza.
- Ángulo de rebote según el punto de impacto en el paddle y corrección del golpe lateral contra bloques.
- Power-ups, bloques de varios golpes, bloques indestructibles y enemigos.
- Rótulo `NIVEL N` al cambiar de nivel.
- Clic para reiniciar en game over.
- Ocultar el cursor sobre el canvas y pointer lock.
- Controles táctiles / soporte móvil jugable.
- Pausa automática al ocultar la pestaña.
- Cambios en `GameSnapshot`, `GameHandle`, `GameCanvasProps` o `.player-hud`.
- Carga diferida (`next/dynamic`) de los juegos registrados.

## Data model

### `lib/games.ts`

Sin cambios. La entrada existente ya es la correcta:

```ts
{ id: "bloque-buster", title: "BLOQUE BUSTER", cat: "ARCADE", cover: "cover-bricks", color: "cyan", /* short y long sin cambios */ }
```

### Migración Supabase `bloque_buster_playable`

Aplicada con `mcp__supabase__apply_migration`. La fila ya existe (verificado el 2026-11-20: `playable = false`, `plays_count = 12400`, 12 marcas en `best_scores`):

```sql
update public.games set playable = true where id = 'bloque-buster';
```

Sin cambios de esquema: `lib/supabase/database.types.ts` no se regenera.

### Contrato común (`games/types.ts`)

Sin cambios. El estado `"dead"` de `GameSnapshot` no se usa: perder una vida deja la pelota esperando sobre el paddle con `state = "playing"`.

### Constantes (`games/bloque-buster/constants.ts`)

Portadas sin cambios de valor, salvo `SPEED_STEP` y `MAX_SPEED_FACTOR`, que son nuevas:

```ts
export const W = 800;
export const H = 600;
export const PADDLE = { y: 560, w: 81, h: 14, speed: 400 } as const; // speed en px/s
export const BALL_SIZE = 16; // caja AABB 16×16
export const BASE_VX = 200; // px/s
export const BASE_VY = -300; // px/s
export const BLOCK_COLS = 10;
export const BLOCK_ROWS = 6;
export const BLOCK_W = 64;
export const BLOCK_H = 24;
export const BLOCKS_ORIGIN_X = 80; // (W - BLOCK_COLS * BLOCK_W) / 2
export const BLOCKS_ORIGIN_Y = 80;
export const POINTS_PER_BLOCK = 10;
export const INITIAL_LIVES = 3;
export const EXPLOSION_MS = 150;
export const SPEED_STEP = 1.1; // factor por nivel
export const MAX_SPEED_FACTOR = 2.5; // se alcanza en el nivel 11
export const PADDLE_HIT_TOLERANCE = 8; // px bajo el paddle que aún cuentan como golpe (original)
export const MAX_DT = 0.05; // s
export const MAX_SUBSTEP = 1 / 120; // s
// speedFactor(level) = Math.min(SPEED_STEP ** (level - 1), MAX_SPEED_FACTOR)
```

Los niveles 1–5 dan los mismos factores que el original (1.00, 1.10, 1.21, 1.33, 1.46).

### Niveles (`games/bloque-buster/levels.ts`)

```ts
type BlockColor = "cyan" | "magenta" | "yellow" | "green";
type LevelBlock = { col: number; row: number; color: BlockColor };
export const LEVELS: LevelBlock[][]; // 5 patrones
// layout del nivel n = LEVELS[(n - 1) % LEVELS.length]
```

- Los 5 patrones del original sin cambios: grilla completa, pirámide, ajedrez, filas con huecos y marco + cruz.
- Mapeo de colores del original al portar: `cyan` → `cyan`, `yellow` → `yellow`, `green` → `green`, y `magenta` / `red` / `hotpink` / `gray` → `magenta`.
- La velocidad ya no vive en cada nivel. Sale de `speedFactor(level)`.

### Estado del motor

```ts
type Paddle = { x: number; y: number; w: number; h: number };
type Ball = {
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
  vy: number;
};
type Block = {
  x: number;
  y: number;
  w: number;
  h: number;
  color: BlockColor;
  alive: boolean;
};
type Explosion = {
  x: number;
  y: number;
  w: number;
  h: number;
  color: BlockColor;
  elapsed: number;
}; // elapsed en ms
```

Estado interno de `BloqueBusterEngine`:

- `paddle`, `ball`, `blocks`, `explosions`
- `score`, `lives`, `level`
- `state: "playing" | "gameover"`
- `serving: boolean`: la pelota espera sobre el paddle
- `paused`, `lastTime`, `rafId`, `lastSnapshot`

Convenciones:

- Origen arriba a la izquierda y velocidades en px/s.
- Mientras `serving` es `true`: `ball.x = paddle.x + (paddle.w - ball.w) / 2`, `ball.y = paddle.y - ball.h`.
- Al lanzar: `vx = BASE_VX × factor` (hacia la derecha) y `vy = BASE_VY × factor` (hacia arriba), como el saque del original.
- Al cambiar de nivel, el paddle conserva su posición, como en el original.

### Paleta del canvas (hex copiados de `app/globals.css`)

| Elemento                   | Color                                                                                                 |
| -------------------------- | ----------------------------------------------------------------------------------------------------- |
| Paddle                     | `#00f5ff` (`--cyan`) con glow                                                                         |
| Pelota                     | `#f5ff00` (`--yellow`) con glow                                                                       |
| Bloques                    | `cyan` / `magenta` / `yellow` / `green` según `levels.ts`: `#00f5ff`, `#ff006e`, `#f5ff00`, `#00ff88` |
| Explosión                  | color del bloque, alpha 1 → 0                                                                         |
| Hint `ESPACIO PARA LANZAR` | `#8a8fb5` (`--ink-dim`)                                                                               |
| Título GAME OVER           | `#ff006e` (`--magenta`)                                                                               |
| Subtítulo GAME OVER        | `#e6e9ff` (`--ink`)                                                                                   |
| Fondo                      | `#000`                                                                                                |

Forma y efectos:

- Bloque: relleno con 1 px de margen por lado y franja superior blanca al 12% de 4 px. Sin glow.
- Paddle: rectángulo redondeado de 81×14.
- Pelota: círculo de radio 8 centrado en su caja 16×16. La colisión sigue siendo AABB.
- Explosión: el rectángulo del bloque escala de 1 a 1.3 desde su centro mientras su alpha baja de 1 a 0 en `EXPLOSION_MS`.
- Glow (`shadowBlur`) solo en paddle y pelota.
- Fuente del canvas: `monospace`.

### Motor (`games/bloque-buster/engine.ts`)

```ts
class BloqueBusterEngine {
  constructor(canvas: HTMLCanvasElement, cb: { onSnapshot; onTogglePause });
  start(): void; // listeners (teclado en window, mouse en el canvas) + requestAnimationFrame
  pause(): void; // congela la física; descarta pulsaciones y clics pendientes
  resume(): void; // reinicia lastTime para evitar saltos
  endGame(): void; // state "gameover", lives 0
  restart(): void; // nivel 1, score 0, lives 3, serving true, paddle centrado
  destroy(): void; // cancelAnimationFrame + quita listeners
}
```

- `onSnapshot` solo se emite cuando cambia `score`, `lives`, `level` o `state`.
- Por frame: `dt = min(dt, MAX_DT)`. Luego la física avanza en sub-pasos de como máximo `MAX_SUBSTEP`. Las reglas de colisión del original se aplican dentro de cada sub-paso.
- Vaciar un nivel: `level + 1`, carga el layout `(level - 1) % 5`, vacía `explosions` y pasa a `serving = true`.
- Perder la pelota (`ball.y > H`): `lives - 1`. Si quedan vidas, `serving = true`; si no, `state = "gameover"`.

### Input (`games/bloque-buster/input.ts`)

| Acción                   | Entrada                                 | Repetición del teclado |
| ------------------------ | --------------------------------------- | ---------------------- |
| Mover paddle (sostenido) | `ArrowLeft`/`KeyA`, `ArrowRight`/`KeyD` | n/a (estado `held`)    |
| Mover paddle             | `mousemove` sobre el canvas             | —                      |
| Lanzar                   | `Space`, `click` sobre el canvas        | ignora `e.repeat`      |
| Reiniciar (game over)    | `Space`                                 | ignora `e.repeat`      |
| Pausa (toggle)           | `KeyP`, `Escape`                        | ignora `e.repeat`      |

- Teclado en `window`.
- `preventDefault` en `keydown` y `keyup` de esas teclas, salvo si el foco está en `input`, `textarea` o `contentEditable`. Es el mismo criterio que `games/asteroids/input.ts`.
- Mouse:
  - Solo `mousemove` y `click` sobre el canvas.
  - La X del ratón se escala con `canvas.getBoundingClientRect()` a coordenadas lógicas (`× W / rect.width`).
  - El paddle se centra en esa X y se limita a `[0, W - paddle.w]`, como en el original.
- Con pausa solo responden P/Esc: el paddle no se mueve y los clics no se registran.
- En game over solo responde Espacio. P/Esc no hacen nada, y el clic y el mouse se ignoran.
- Clase propia `Input` con `held`, `justPressed`, `mouseX: number | null` y `clicked`, y métodos `attach(canvas)` / `detach()` / `clear()`.

### Archivos tras esta spec

- `games/bloque-buster/constants.ts` (nuevo): constantes, `speedFactor` y paleta
- `games/bloque-buster/levels.ts` (nuevo): `LEVELS` con los colores ya mapeados
- `games/bloque-buster/input.ts` (nuevo): teclado + mouse, attach/detach
- `games/bloque-buster/engine.ts` (nuevo)
- `games/bloque-buster/bloque-buster-canvas.tsx` (nuevo, cliente)
- `games/registry.ts` (modificado)
- Supabase: migración `bloque_buster_playable`

`components/player.tsx`, `lib/games.ts` y `games/types.ts` no cambian.

### Rutas tras esta spec

- `/juegos/bloque-buster/jugar`: pasa del reproductor simulado al juego real.
- `/juegos/bloque-buster` y `/salon?juego=bloque-buster`: sin cambios de ruta. Las marcas nuevas se suman a las 12 demo.

## Implementation plan

1. Aplicar la migración `bloque_buster_playable`. Manual: `select playable from public.games where id = 'bloque-buster'` devuelve `true`. `/juegos/bloque-buster/jugar` sigue con el reproductor simulado.
2. Crear `games/bloque-buster/constants.ts` (constantes, `speedFactor`, `PALETTE`) y `games/bloque-buster/levels.ts` (5 patrones con los colores mapeados).
3. Crear `games/bloque-buster/input.ts`:
   - teclado con `held` / `justPressed`, filtro de `e.repeat` y `preventDefault` condicionado
   - mouse con `mouseX` escalado y `clicked`
   - `attach(canvas)` / `detach()` / `clear()`
4. Crear `games/bloque-buster/engine.ts`, parte lógica:
   - estado e `initGame`, carga de nivel por `(level - 1) % 5`
   - saque con `serving`, movimiento del paddle por teclado y mouse
   - física del original con sub-pasos: paredes, paddle con tolerancia de 8 px, AABB de 1 bloque por frame
   - explosiones, bucle de niveles, velocidad con tope, pérdida de vida y game over
   - `pause` / `resume` / `endGame` / `restart` / `destroy` y emisión de `onSnapshot` solo con cambios
5. Completar `engine.ts`, parte de dibujo:
   - fondo, bloques con margen y franja, explosiones con fade + escala
   - paddle y pelota con glow
   - hint `ESPACIO PARA LANZAR` mientras `serving`
   - overlay `GAME OVER` / `ESPACIO PARA REINICIAR`
   - sin puntaje, nivel ni vidas
6. Crear `games/bloque-buster/bloque-buster-canvas.tsx` (`"use client"`), copiando el patrón de `asteroids-canvas.tsx`:
   - buffer `800·dpr × 600·dpr`
   - motor creado en `useEffect` y destruido en el cleanup
   - `paused` → `pause()`/`resume()`
   - `useImperativeHandle` para `GameHandle`
   - `aria-label="Bloque Buster"`

   Registrar `"bloque-buster": BloqueBusterCanvas` en `GAME_COMPONENTS`. Manual: `/juegos/bloque-buster/jugar` es jugable y al terminar con sesión aparece la línea de guardado de SPEC 07.

## Acceptance criteria

- [ ] `npm run build` termina sin errores y genera `/juegos/bloque-buster/jugar`.
- [ ] `npx tsc --noEmit` y `npx eslint app components lib games` no reportan errores.
- [ ] `git diff --stat main` no muestra cambios en `lib/games.ts`, `games/types.ts`, `components/player.tsx` ni `app/globals.css`.
- [ ] En Supabase, la fila `bloque-buster` tiene `playable = true` y `title = 'BLOQUE BUSTER'`, y `select count(*) from public.best_scores where game_id = 'bloque-buster'` devuelve al menos 12.
- [ ] `games/bloque-buster/` no referencia ningún archivo de imagen ni de audio, y no se agregan archivos a `public/`.
- [ ] `/juegos/bloque-buster/jugar` no muestra errores ni warnings de hidratación en la consola.
- [ ] Con `devicePixelRatio` 2, el `width` del canvas es 1600 y su `height` es 1200.
- [ ] En ancho 375px no hay scroll horizontal en `/juegos/bloque-buster/jugar`.
- [ ] Al empezar, el nivel 01 muestra la grilla completa de 10×6 bloques y la pelota quieta sobre el paddle, con el texto `ESPACIO PARA LANZAR`.
- [ ] Mientras la pelota espera, mover el paddle (teclado o mouse) la arrastra con él.
- [ ] Espacio lanza la pelota hacia arriba a la derecha y el texto `ESPACIO PARA LANZAR` desaparece; mantener Espacio pulsado no tiene más efecto.
- [ ] Un clic sobre el canvas lanza la pelota igual que Espacio.
- [ ] ←/→ y A/D mueven el paddle de forma continua mientras están pulsadas, y el paddle no sale del canvas.
- [ ] Mover el mouse sobre el canvas centra el paddle bajo el cursor (limitado a los bordes), también con el canvas escalado por el `.crt-screen`.
- [ ] La pelota rebota en las paredes izquierda, derecha y superior.
- [ ] Al tocar el paddle, la pelota sube con la misma velocidad horizontal que traía, sin importar en qué parte del paddle golpee.
- [ ] Al tocar un bloque, el bloque desaparece con una explosión breve de su color, la pelota invierte su dirección vertical y Puntuación sube exactamente 10.
- [ ] El nivel 01 dibuja sus filas en magenta, amarillo, cyan, magenta, magenta y verde (de arriba abajo).
- [ ] Al vaciar el nivel 01, Nivel pasa a `02`, aparece la pirámide y la pelota vuelve a esperar sobre el paddle.
- [ ] Tras vaciar el nivel 05, Nivel pasa a `06` y aparece de nuevo la grilla completa, con la pelota más rápida que en el nivel 05.
- [ ] La velocidad de la pelota deja de aumentar a partir del nivel 11 (factor 2.5).
- [ ] Al caer la pelota bajo el paddle, Vidas baja de `♥♥♥` a `♥♥` y la pelota vuelve a esperar sobre el paddle sin que los bloques cambien.
- [ ] El canvas no muestra puntaje, nivel ni vidas en ningún momento.
- [ ] `.player-hud` muestra solo Jugador, Puntuación, Vidas y Nivel y los botones PAUSA / FIN / SALIR. Comparado con `/juegos/asteroids/jugar`, no tiene elementos nuevos.
- [ ] Pulsar flechas, A/D, Espacio, P o Esc durante la partida no desplaza la página.
- [ ] PAUSA, P y Esc congelan el juego y muestran EN PAUSA. Durante la pausa, ni el teclado ni el mouse mueven el paddle, y un clic no lanza la pelota.
- [ ] Al reanudar tras una pausa larga, la pelota sigue desde donde estaba sin saltar.
- [ ] Al perder la última vida, el canvas muestra `GAME OVER` / `ESPACIO PARA REINICIAR` sin puntaje, Vidas muestra `—`, el botón FIN cambia a "JUGAR DE NUEVO" y PAUSA queda deshabilitado.
- [ ] En game over, un clic en el canvas no reinicia.
- [ ] FIN durante la partida produce el mismo game over.
- [ ] En game over, tanto Espacio como "JUGAR DE NUEVO" reinician: nivel 01 con la grilla completa, Puntuación 0, Vidas `♥♥♥` y la pelota esperando sobre el paddle.
- [ ] Con sesión iniciada, el game over envía exactamente 1 `POST /api/scores` con `gameId: "bloque-buster"`, responde 200 y muestra la línea de estado de SPEC 07.
- [ ] Como invitado, el game over no envía nada y muestra el CTA a `/auth`.
- [ ] Una marca nueva aparece en `/salon?juego=bloque-buster` y en el panel de `/juegos/bloque-buster` tras recargar.
- [ ] Tras SALIR a `/juegos/bloque-buster`, pulsar Espacio desplaza la página normalmente y volver a jugar empieza una partida nueva.
- [ ] `/juegos/asteroids/jugar` y `/juegos/tetris/jugar` siguen funcionando igual, y un juego no registrado (p. ej. `/juegos/serpentina/jugar`) mantiene el reproductor simulado.

## Decisions

- **Yes:** mantener `bloque-buster` / "BLOQUE BUSTER" sin renombrar. Decisión del usuario; es el nombre original de la plataforma y evita tocar catálogo, portada, Home y FK en Supabase.
- **No:** renombrar el juego según la carpeta de referencia. Descartado; la carpeta `04-arkanoid` solo es el origen del código.
- **Yes:** activar la fila existente con un `update` de `playable`, conservando `plays_count` y las 12 marcas demo. Evita un ranking vacío y mantiene el seed de SPEC 07.
- **Yes:** física de rebote idéntica a la referencia (el paddle solo invierte `vy`, `vx` constante). Decisión del usuario.
- **No:** ángulo según el punto de impacto en el paddle. Decisión del usuario.
- **Yes:** colisión con bloques del original (AABB, 1 por frame, siempre invierte `vy`). Decisión del usuario, aunque los golpes laterales no reboten en horizontal.
- **Yes:** niveles en bucle tras el 5 con `level` creciente. Decisión del usuario; reemplaza el estado `win`, que no cabe en `GameSnapshot`, y permite partidas largas para el ranking.
- **No:** pantalla de victoria tras el nivel 5. Rompería el contrato genérico y cortaría la puntuación.
- **Yes:** velocidad `min(1.1^(level-1), 2.5)`. Decisión del usuario; conserva la progresión del original en los niveles 1–5 y evita que la pelota atraviese el paddle en niveles altos.
- **No:** velocidad sin tope. A ×3.8 (nivel 15) la pelota recorre más que la ventana de golpe del paddle en un frame.
- **Yes:** sub-pasos de física de como máximo 1/120 s. No cambian las reglas de rebote. Solo garantizan que la ventana del paddle (14 + 8 px) no se salte con `dt` grandes y velocidad máxima.
- **Yes:** saque con la pelota sobre el paddle hasta Espacio o clic. Decisión del usuario; cambia el original (que sale solo) para dar control al jugador al empezar, al perder vida y al cambiar de nivel.
- **Yes:** control con mouse además del teclado. Decisión del usuario; igual que el original.
- **Yes:** el clic lanza, pero no reinicia en game over. Decisión del usuario; evita reinicios accidentales al hacer clic tras perder.
- **Yes:** listeners de mouse solo en el canvas y no en `window`. El mouse sobre el HUD o fuera del juego no debe mover el paddle.
- **Yes:** explosión dibujada en el canvas (fade + escala, 150 ms). Decisión del usuario; sustituye los 4 frames del spritesheet sin assets.
- **Yes:** mapear los 7 colores del original a 4 neones (`red` / `hotpink` / `gray` → magenta). Decisión del usuario; conserva los patrones de `levels.js` con la paleta del vault.
- **No:** colores por fila en ciclo ignorando `levels.js`. Pierde la identidad visual de cada nivel.
- **Yes:** el único texto propio en el canvas es `ESPACIO PARA LANZAR`, además del overlay de game over. Decisión del usuario; puntaje, vidas y nivel ya están en `.player-hud`.
- **No:** rótulo `NIVEL N` en el canvas. Decisión del usuario.
- **Yes:** glow solo en paddle y pelota. 60 bloques con `shadowBlur` por frame cuestan rendimiento; mismo criterio que Tetris.
- **Yes:** `state` interno `"playing" | "gameover"` más el flag `serving`; `"dead"` no se usa. Perder una vida no tiene animación ni espera propia.
- **Yes:** `input.ts` propio con teclado + mouse. El `Input` de Asteroids tiene un mapa de teclas fijo y no maneja mouse.
- **No:** compartir `input.ts` entre juegos. Con tres juegos y entradas distintas, no compensa abstraer.
- **Yes:** sin carpeta `entities/`. Paddle, pelota, bloques y explosiones son objetos planos que el motor actualiza y dibuja.
- **Yes:** Espacio reinicia en game over, además de JUGAR DE NUEVO. Igual que Asteroids y Tetris.
- **Yes:** guardado de puntuación sin tocar `components/player.tsx`. SPEC 07 ya lo hace para cualquier juego registrado; solo falta `playable = true`.
- **Yes:** invariantes de SPEC 05/07:
  - canvas sin assets
  - `.player-hud` fijo
  - `GameSnapshot` genérico
  - motor sin globales
  - hex copiados de `globals.css`
  - id consistente en `lib/games.ts`, `games/registry.ts` y `public.games`

## Risks

| Risk                                                                      | Mitigation                                                                                                        |
| ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Pelota atraviesa el paddle o un bloque con `dt` grande y velocidad máxima | Tope de velocidad ×2.5 + sub-pasos de ≤ 1/120 s (≤ 6.25 px verticales por sub-paso a 750 px/s).                   |
| Coordenadas del mouse desalineadas porque el canvas se escala con CSS     | Escalar con `getBoundingClientRect()` en cada `mousemove`; criterio específico con el `.crt-screen`.              |
| Golpe lateral contra un bloque deja la pelota "dentro" de otro bloque     | Es el comportamiento del original (decisión del usuario); 1 bloque por frame limita el efecto a rebotes visibles. |
| Salto de la pelota al reanudar tras una pausa larga                       | `resume()` reinicia `lastTime`; `dt` además limitado por `MAX_DT`.                                                |
| Clics o teclas pendientes durante la pausa se aplican al reanudar         | `pause()` llama a `input.clear()`; con pausa solo se procesan P/Esc.                                              |
| Catálogo y BD desalineados (`playable = false`)                           | El paso 1 aplica la migración primero; `/api/scores` devolvería 404 `GAME_NOT_PLAYABLE` si fallara.               |
| StrictMode duplica motor/listeners en dev                                 | `destroy()` en el cleanup quita teclado y mouse, igual que Asteroids.                                             |
| Doble envío de score en la transición a game over                         | Ya cubierto por `sentRef` de SPEC 07; `lives` y `state` cambian en el mismo snapshot.                             |

## What is **not** in this spec

- Renombrar el juego o cambiar su entrada en `lib/games.ts`.
- Sonido, spritesheet y assets.
- Selector de nivel en pausa.
- Pantalla de victoria.
- Ángulo de rebote variable y corrección del golpe lateral.
- Power-ups, bloques multigolpe o indestructibles y enemigos.
- Rótulo de nivel en el canvas.
- Clic para reiniciar, ocultar el cursor y pointer lock.
- Controles táctiles y móvil.
- Pausa automática por visibilidad.
- Cambios en el contrato común de juegos o en `.player-hud`.
- Carga diferida de juegos.

Cada uno, si se hace, va en su propio spec.
