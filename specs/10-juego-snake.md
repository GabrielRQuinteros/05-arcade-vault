# SPEC 10 — Juego Snake jugable en el reproductor

> **Status:** Implemented
> **Depends on:** SPEC 05, SPEC 07
> **Date:** 2026-11-20
> **Objective:** Crear un juego propio de serpiente en grid con los sprites de frutas de `references/snake/snake-assets/`, renombrar `serpentina` → `snake` en el código y en Supabase y montarlo en `/juegos/snake/jugar` con el patrón de SPEC 05, guardando puntuaciones reales como los demás juegos.

## Why this spec exists

Es el cuarto juego real de la plataforma, pero el primero que rompe dos supuestos de los anteriores:

- **No hay código de referencia.** No existe carpeta en `references/started-games/`. El diseño (grid, velocidades, puntaje, bonus) se definió en esta spec; solo los sprites de frutas vienen de fuera.
- **Es el primer juego con assets.** SPEC 05 fijó "canvas sin assets". Esta spec abre una excepción solo para Snake: una hoja de sprites en `public/games/snake/`, un atlas tipado en TS, precarga antes del loop y fallback a primitivas neón para que el juego nunca quede injugable. Todas las demás invariantes siguen vigentes.

Además, el juego ya figura en el catálogo como `id: "serpentina"` / `title: "SERPENTINA"` y en Supabase como fila `serpentina` (verificado el 2026-11-20: `playable = false`, `plays_count = 9100`, 12 marcas en `best_scores`). Por decisión del usuario se renombra a `snake`, con el mismo procedimiento que `caida` → `tetris` en SPEC 08.

**Origen de los sprites:** `fruits.png` es un rip de Google Snake publicado en spriters-resource (origen comercial). Se integra solo para uso educativo/local, con atribución en `games/snake/sprites.ts`. Del juego original solo se toman las frutas; el nombre, las reglas y el resto del arte son propios.

## Scope

**In:**

- Renombrar `serpentina` → `snake` en el código Next.js: `id`, `title: "SNAKE"`, `long` nuevo, y "Serpentina" → "Snake" en la actividad de ejemplo de la Home. `cover-snake`, `short`, `cat` y `color` no cambian.
- Renombrar la fila `serpentina` → `snake` en `public.games` con `title = 'SNAKE'` y `playable = true`, conservando `plays_count` y moviendo sus 12 marcas demo de `best_scores`.
- Juego en TypeScript estricto en `games/snake/`, sin variables globales.
- Tablero de 30×20 celdas de 25 px. Movimiento por ticks: la serpiente avanza 1 celda por tick, sin invertirse 180°, con buffer de hasta 2 giros.
- Paredes letales (sin wrap-around) y choque con el propio cuerpo = game over.
- 1 vida, como Tetris: `lives = 1` jugando y `0` en game over.
- Fruta normal: siempre hay una, en una celda libre al azar, con un sprite al azar entre 21 frutas. Vale `10 × nivel` y la serpiente crece 1 segmento.
- Fruta bonus (sprite del bol): cada vez que el total de frutas normales comidas llega a un múltiplo de 5, aparece con un 25% de probabilidad (si no hay otra activa). Dura 6 s, parpadea los últimos 2 s y desaparece si no se come. Vale `50 × nivel + 5 × segundos restantes (redondeado hacia arriba)` y crece 1 segmento.
- Niveles: `level = floor(frutas / 5) + 1` (solo cuentan las normales); `tickInterval = max(60, 140 − (level − 1) × 8)` ms.
- Inicio y reinicio: rótulo `LISTO` durante 1 s con la serpiente quieta (largo 3, centro del tablero, mirando a la derecha); luego avanza sola.
- Franja superior del canvas con valores propios del juego: `LONGITUD`, `FRUTAS` y, solo con bonus activa, `BONUS` con segundos y barra.
- Serpiente dibujada con primitivas, toda en green: cabeza más brillante con ojos y glow, cuerpo con alpha decreciente hacia la cola.
- Sprites: copia de `fruits.png` a `public/games/snake/fruits.png`; atlas tipado en `games/snake/sprites.ts` con la fila central de pixel art (22 recortes) y las claves renombradas según el contenido visual; precarga antes del loop; `imageSmoothingEnabled = false`; fruta dibujada con aspect-fit centrada en la celda.
- Fallback sin imagen: fruta normal = círculo magenta con glow, bonus = círculo amarillo.
- Overlay `GAME OVER` / `ESPACIO PARA REINICIAR` dentro del canvas, sin puntaje.
- Controles: flechas y WASD giran; Espacio reinicia en game over; P y Esc pausan.
- Botones del reproductor iguales a los otros juegos: PAUSA, FIN / JUGAR DE NUEVO y SALIR.
- Guardado automático de la puntuación al entrar en game over con sesión, y CTA para invitados. Se reutiliza tal cual el flujo de SPEC 07 en `components/player.tsx`.
- Registrar `snake` en `games/registry.ts`.

**Out of scope (for future specs):**

- Sonido y música.
- Wrap-around, obstáculos o laberintos por nivel.
- Varias vidas y el estado `"dead"`.
- Power-ups distintos de la fruta bonus.
- Filas 1 (vector) y 3 (realistas) de `fruits.png`, y sprites de serpiente.
- Animaciones interpoladas entre celdas (la serpiente salta de celda en celda).
- Leyenda de controles dentro del canvas.
- Controles táctiles / soporte móvil jugable.
- Pausa automática al ocultar la pestaña.
- Cambiar `short`, `cat`, `cover` o `color` en `lib/games.ts`, o la portada CSS `.cover-snake`.
- Redirección de `/juegos/serpentina` a `/juegos/snake`.
- Cambios en `GameSnapshot`, `GameHandle`, `GameCanvasProps` o `.player-hud`.
- Carga diferida (`next/dynamic`) de los juegos registrados.
- Abstraer un cargador de sprites común entre juegos.

## Layout de la pantalla de juego

`/juegos/snake/jugar` mantiene la estructura de `components/player.tsx` definida en SPEC 05:

```
┌─ ARRIBA: .player-hud (React, sin cambios) ────────────────────────────────┐
│ JUGADOR   PUNTUACIÓN   VIDAS   NIVEL               [PAUSA] [FIN] [SALIR]  │
│ INVITADO  1.250        ♥       03                                         │
└───────────────────────────────────────────────────────────────────────────┘
┌─ ABAJO: .crt > .crt-screen (canvas 800×600 lógico) ───────────────────────┐
│     LONGITUD              FRUTAS               BONUS 4.2s                 │
│        14                   11                 ▬▬▬▬▬▬▬▬░░░                │
│ ┌───────────────────────────────────────────────────────────────────────┐ │
│ │                                                                       │ │
│ │        ■■■■■■■●                🍎                                     │ │
│ │                                                                       │ │
│ │                   tablero 30×20 × 25 px (750×500, x=25, y=75)          │ │
│ └───────────────────────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────────────────────┘
```

**Regla general de SPEC 05 (se mantiene):** `.player-hud` solo muestra Puntuación, Vidas y Nivel desde `GameSnapshot`. Los valores propios de Snake (LONGITUD, FRUTAS, BONUS) solo se dibujan en el canvas.

**Arriba — `.player-hud`:** sin cambios de código ni de estilo.

| Stat       | Origen           | Valor en Snake                            |
| ---------- | ---------------- | ----------------------------------------- |
| Puntuación | `snapshot.score` | puntaje del motor                         |
| Vidas      | `snapshot.lives` | `1` jugando (`♥`), `0` en game over (`—`) |
| Nivel      | `snapshot.level` | `floor(frutas / 5) + 1`, 2 dígitos (`01`) |

**Abajo — canvas:**

- Franja superior (`y` 0–75):
  - `LONGITUD` centrado en `x = 125`.
  - `FRUTAS` centrado en `x = 400`.
  - `BONUS` centrado en `x = 675`, solo con bonus activa: segundos restantes con 1 decimal y una barra amarilla de 160×6 px proporcional al tiempo restante.
- Tablero 750×500 en `x = 25`, `y = 75`, con grid de líneas finas y borde.
- `LISTO` centrado sobre el tablero durante la fase de inicio.
- Overlay GAME OVER sobre el tablero: título `GAME OVER` y subtítulo `ESPACIO PARA REINICIAR`, sin puntaje.
- **No se dibujan** puntaje, nivel ni vidas en el canvas.

## Data model

### Cambio en `lib/games.ts`

```ts
{
  id: "snake",           // antes "serpentina"
  title: "SNAKE",        // antes "SERPENTINA"
  short: "Crece sin morder tu propia cola.", // sin cambios
  long: "Una serpiente de luz recorre la grilla devorando frutas pixeladas. Cada bocado la alarga y acelera el pulso. Un giro en falso contra el muro o contra su propia cola y se acabó.",
  cat: "ARCADE",
  cover: "cover-snake",  // sin cambios
  color: "green",
}
```

`components/home.tsx`: `g: "Serpentina"` → `g: "Snake"`.

### Migración Supabase `snake_rename_playable`

Aplicada con `mcp__supabase__apply_migration`. La FK `best_scores_game_id_fkey` no tiene `ON UPDATE CASCADE`, así que el renombre es insertar, mover y borrar, en una sola migración (igual que SPEC 08):

```sql
insert into public.games (id, title, category, playable, plays_count, created_at)
select 'snake', 'SNAKE', category, true, plays_count, created_at
from public.games where id = 'serpentina';

update public.best_scores set game_id = 'snake' where game_id = 'serpentina';

delete from public.games where id = 'serpentina';
```

Sin cambios de esquema: `lib/supabase/database.types.ts` no se regenera.

### Contrato común (`games/types.ts`)

Sin cambios. El estado `"dead"` de `GameSnapshot` no se usa.

### Constantes (`games/snake/constants.ts`)

```ts
export const W = 800;
export const H = 600;
export const COLS = 30;
export const ROWS = 20;
export const CELL = 25;
export const BOARD_X = 25; // (W - COLS * CELL) / 2
export const BOARD_Y = 75; // franja superior de info
export const START_LENGTH = 3;
export const START_DIR = "right";
export const READY_MS = 1000;
export const MAX_QUEUED_TURNS = 2;

export const FRUITS_PER_LEVEL = 5;
export const FRUIT_POINTS = 10; // × level
// tickInterval(level) = Math.max(60, 140 - (level - 1) * 8) ms

export const BONUS_EVERY = 5; // frutas normales
export const BONUS_CHANCE = 0.25;
export const BONUS_MS = 6000;
export const BONUS_BLINK_MS = 2000; // parpadeo en los últimos 2 s
export const BONUS_POINTS = 50; // × level
export const BONUS_POINTS_PER_SEC = 5; // × ceil(segundos restantes)

export const SPRITE_PADDING = 2; // px dentro de la celda (aspect-fit en 21×21)
export const SPRITE_TIMEOUT_MS = 5000; // pasado este tiempo, fallback
```

Posición inicial: cabeza en `(15, 10)`, cuerpo en `(14, 10)` y `(13, 10)`.

### Paleta del canvas (hex copiados de `app/globals.css`)

| Elemento                         | Color                                             |
| -------------------------------- | ------------------------------------------------- |
| Cabeza de la serpiente           | `#00ff88` (`--green`) con glow (`shadowBlur`)     |
| Cuerpo                           | `#00ff88` con alpha de 0.9 (cuello) a 0.35 (cola) |
| Ojos                             | `#000`                                            |
| Fruta fallback                   | `#ff006e` (`--magenta`) con glow                  |
| Bonus fallback, barra y segundos | `#f5ff00` (`--yellow`)                            |
| Grid del tablero                 | `rgba(255, 255, 255, 0.06)` (`--line-2`)          |
| Borde del tablero                | `rgba(0, 245, 255, 0.18)` (`--line`)              |
| Etiquetas LONGITUD/FRUTAS/BONUS  | `#8a8fb5` (`--ink-dim`)                           |
| Valores y `LISTO`                | `#e6e9ff` (`--ink`)                               |
| Título GAME OVER                 | `#ff006e` (`--magenta`)                           |
| Subtítulo GAME OVER              | `#e6e9ff` (`--ink`)                               |
| Sombra del overlay               | `rgba(0, 0, 0, 0.6)`                              |
| Fondo                            | `#000`                                            |

Segmento: cuadrado de 25 px con 2 px de margen y esquinas redondeadas. Glow solo en la cabeza. Fuente del canvas: `monospace`.

### Sprites (`games/snake/sprites.ts`)

```ts
/** Origen: rip de Google Snake (spriters-resource). Uso educativo/local, no comercial. */
export const SNAKE_SHEET = "/games/snake/fruits.png"; // 3790×442, fondo transparente

type Rect = { x: number; y: number; w: number; h: number };
export type FruitKey =
  | "apple"
  | "banana"
  | "pineapple"
  | "grape"
  | "pumpkin"
  | "turnip"
  | "eggplant"
  | "strawberry"
  | "cherry"
  | "carrot"
  | "mushroom"
  | "broccoli"
  | "watermelon"
  | "pepper"
  | "kiwi"
  | "lemon"
  | "orange"
  | "peach"
  | "peanut"
  | "raspberry"
  | "tomato"
  | "bowl";

export const FRUIT_SPRITES: Record<FruitKey, Rect>;
export const NORMAL_FRUITS: readonly FruitKey[]; // las 21 sin "bowl"
export const BONUS_FRUIT: FruitKey = "bowl";
```

- Recortes: los 22 `{x, y, w, h}` de la fila central de `references/snake/snake-assets/sprites.js`, en el mismo orden (`y = 136`, `h = 160`), con las claves renombradas según el contenido visual. En `sprites.js` los nombres están mal: la entrada `banana` (x=34) es la manzana. Al implementar se verifican los recortes dibujando cada sprite: ninguno puede mostrar un trozo del vecino ni quedar cortado. Si alguno falla, se corrige su `x`/`w`.
- Sin `window.SPRITE_ATLAS` ni `sources` global.

### Motor (`games/snake/engine.ts`)

```ts
type Dir = "up" | "down" | "left" | "right";
type Point = { x: number; y: number };

class SnakeEngine {
  constructor(canvas: HTMLCanvasElement, cb: { onSnapshot; onTogglePause });
  start(): void; // listeners + precarga de la hoja; el loop rAF arranca al resolverse
  pause(): void; // congela ticks, LISTO y temporizador de la bonus; vacía la cola de giros
  resume(): void; // reinicia lastTime y tickAccum para evitar ticks en salto
  endGame(): void; // state "gameover", lives 0
  restart(): void; // largo 3 en el centro, dir right, fase LISTO, score 0, frutas 0, level 1, lives 1, sin bonus
  destroy(): void; // cancelAnimationFrame + quita listeners + suelta la imagen
}
```

Estado interno: `segments: Point[]` (cabeza = `[0]`), `dir`, `dirQueue: Dir[]`, `growPending`, `fruit: Point & { key: FruitKey }`, `bonus: (Point & { remainingMs: number }) | null`, `fruitsEaten`, `score`, `level`, `lives`, `state: "playing" | "gameover"`, `readyLeft` (ms de LISTO), `tickAccum`, `lastTime`, `sheet: HTMLImageElement | null`, `destroyed`.

- **Precarga:** `start()` crea el `HTMLImageElement` y espera `onload`, `onerror` o `SPRITE_TIMEOUT_MS`, lo que ocurra primero. Si falla o vence el tiempo, `sheet = null` y se usa el fallback. Si se llamó `destroy()` antes, el loop no arranca.
- **Giro:** al encolar se compara con el último `dir` de la cola (o el actual). Se descarta si es el mismo, si es el opuesto o si la cola ya tiene `MAX_QUEUED_TURNS`.
- **Tick** (cada `tickInterval(level)` ms, solo con `readyLeft = 0`):
  1. Se toma un giro de la cola, si hay.
  2. Se calcula la cabeza nueva. Si sale del tablero → game over.
  3. Si la cabeza nueva choca con un segmento → game over. La cola cuenta solo si `growPending > 0`, porque si no se mueve en este mismo tick.
  4. Se agrega la cabeza. Si `growPending > 0`, se descuenta; si no, se quita la cola.
  5. Fruta: `score += 10 × level`, `fruitsEaten++`, `growPending++`, se recalcula `level` y la fruta reaparece en una celda libre con otro sprite al azar. Si `fruitsEaten % 5 === 0`, no hay bonus activa y `Math.random() < 0.25`, aparece una bonus en otra celda libre.
  6. Bonus: `score += 50 × level + 5 × ceil(remainingMs / 1000)`, `growPending++` y `bonus = null`. No cuenta para `fruitsEaten`.
- **Temporizador de la bonus:** `remainingMs` baja con el `dt` real mientras se juega. No baja en pausa, durante LISTO ni en game over. Al llegar a 0, la bonus desaparece.
- **Sin celdas libres** (serpiente de 600 segmentos): game over.
- `onSnapshot` solo se emite cuando cambia `score`, `lives`, `level` o `state`. `lives` pasa de 1 a 0 en el mismo snapshot que `state = "gameover"`.

### Input (`games/snake/input.ts`)

| Acción                | Teclas                                                                        | Repetición del teclado |
| --------------------- | ----------------------------------------------------------------------------- | ---------------------- |
| Girar                 | `ArrowUp`/`KeyW`, `ArrowDown`/`KeyS`, `ArrowLeft`/`KeyA`, `ArrowRight`/`KeyD` | no                     |
| Reiniciar (game over) | `Space`                                                                       | no                     |
| Pausa (toggle)        | `KeyP`, `Escape`                                                              | no                     |

- Cada `keydown` encola una acción y el motor vacía la cola en el siguiente frame. Todas ignoran los eventos con `e.repeat === true`.
- `preventDefault` en `keydown` y `keyup` de esas teclas, salvo si el foco está en `input`, `textarea` o `contentEditable` (mismo criterio que `games/asteroids/input.ts`).
- Durante LISTO se aceptan giros: se aplican en el primer tick.
- Con pausa solo responden P/Esc. En game over solo responde Espacio, y P/Esc no hacen nada.

### Archivos tras esta spec

- `lib/games.ts`, `components/home.tsx` (modificados por el renombre)
- `public/games/snake/fruits.png` (nuevo, copia de `references/snake/snake-assets/fruits.png`)
- `games/snake/constants.ts` (nuevo) — constantes, `tickInterval()` y paleta
- `games/snake/sprites.ts` (nuevo) — atlas tipado y atribución
- `games/snake/input.ts` (nuevo) — cola de acciones, attach/detach/clear
- `games/snake/engine.ts` (nuevo)
- `games/snake/snake-canvas.tsx` (nuevo, cliente)
- `games/registry.ts` (modificado)
- Supabase: migración `snake_rename_playable`

`components/player.tsx`, `games/types.ts` y `app/globals.css` no cambian.

### Rutas tras esta spec

- `/juegos/snake`, `/juegos/snake/jugar` — nuevas (reemplazan a `/juegos/serpentina*`)
- `/juegos/serpentina`, `/juegos/serpentina/jugar` — 404
- `/salon?juego=snake` — nueva pestaña (reemplaza a `?juego=serpentina`)
- `/games/snake/fruits.png` — asset estático nuevo

## Implementation plan

1. Renombrar en `lib/games.ts` (`id`, `title`, `long`) y en `components/home.tsx` (`"Serpentina"` → `"Snake"`). En el mismo paso, aplicar la migración `snake_rename_playable`, para que catálogo y BD no queden desalineados. Manual: `/juegos/snake` muestra el detalle con su portada y el top 10 demo; `/juegos/serpentina` da 404; `/juegos/snake/jugar` sigue con el reproductor simulado.
2. Copiar `references/snake/snake-assets/fruits.png` a `public/games/snake/fruits.png` y crear `games/snake/sprites.ts` con los 22 recortes renombrados y la atribución. Verificar visualmente cada recorte y corregir `x`/`w` si alguno muestra un vecino o queda cortado. No queda ningún script de verificación en el repo. Manual: `/games/snake/fruits.png` responde 200.
3. Crear `games/snake/constants.ts`: dimensiones, posición inicial, `tickInterval()`, puntajes, bonus, parámetros de sprites y `PALETTE`.
4. Crear `games/snake/input.ts`: mapa de teclas, cola de acciones, filtro de `e.repeat`, `preventDefault` condicionado, `attach()`/`detach()`/`clear()`.
5. Crear `games/snake/engine.ts`, parte lógica: estado, fase LISTO, cola de giros con validación, tick (movimiento, choques con pared y cuerpo, crecimiento), fruta, bonus y su temporizador, puntaje, nivel, `tickInterval`, game over (también sin celdas libres), `pause`/`resume`/`endGame`/`restart`/`destroy` y emisión de `onSnapshot` solo con cambios.
6. Completar `engine.ts`, parte de dibujo y carga: precarga con timeout y fallback, `imageSmoothingEnabled = false`, fondo, franja (LONGITUD, FRUTAS, BONUS con barra), grid y borde del tablero, fruta con aspect-fit, bonus con parpadeo, serpiente (cabeza con ojos y glow, cuerpo con alpha decreciente), `LISTO` y overlay GAME OVER / ESPACIO PARA REINICIAR. Sin puntaje, nivel ni vidas.
7. Crear `games/snake/snake-canvas.tsx` (`"use client"`), copiando el patrón de `tetris-canvas.tsx`: buffer `800·dpr × 600·dpr`, motor creado en `useEffect` y destruido en el cleanup, `paused` → `pause()`/`resume()`, `useImperativeHandle` para `GameHandle` y `aria-label="Snake"`. Registrar `snake: SnakeCanvas` en `GAME_COMPONENTS`. Manual: `/juegos/snake/jugar` es jugable y al terminar con sesión aparece la línea de guardado de SPEC 07.

## Acceptance criteria

- [ ] `npm run build` termina sin errores y genera `/juegos/snake` y `/juegos/snake/jugar`; no genera rutas `serpentina`.
- [ ] `/juegos/serpentina` y `/juegos/serpentina/jugar` devuelven 404.
- [ ] `grep -rniE "serpentina" app components lib games` no devuelve resultados.
- [ ] `npx tsc --noEmit` y `npx eslint app components lib games` no reportan errores.
- [ ] `grep -rn "window\." games/snake` no devuelve resultados (sin `window.SPRITE_ATLAS` ni globales).
- [ ] En Supabase, `public.games` no tiene fila `serpentina`; `snake` tiene `title = 'SNAKE'`, `playable = true` y el `plays_count` que tenía `serpentina` (9100 antes de jugar).
- [ ] `select count(*) from public.best_scores where game_id = 'snake'` devuelve 12 y para `'serpentina'` devuelve 0.
- [ ] En `/biblioteca`, el filtro ARCADE muestra SNAKE con la portada `cover-snake` y el `long` nuevo en su detalle.
- [ ] La Home muestra "Snake" en la actividad en vivo.
- [ ] `GET /games/snake/fruits.png` responde 200 con `content-type: image/png`.
- [ ] `/juegos/snake/jugar` no muestra errores ni warnings de hidratación en la consola.
- [ ] Con `devicePixelRatio` 2, el `width` del canvas es 1600 y su `height` es 1200.
- [ ] En ancho 375px no hay scroll horizontal en `/juegos/snake/jugar`.
- [ ] El canvas muestra la franja con `LONGITUD` y `FRUTAS` y, debajo, el tablero 30×20 con grid y borde.
- [ ] Al empezar se ve `LISTO` 1 s con la serpiente de 3 segmentos quieta en el centro; después avanza sola hacia la derecha.
- [ ] La serpiente es toda verde: la cabeza tiene ojos orientados según la dirección y glow, y el cuerpo se desvanece hacia la cola.
- [ ] Las frutas se dibujan con los sprites pixel art, nítidos (sin suavizado), centrados en su celda y sin trozos de sprites vecinos. Durante una partida aparecen frutas distintas y el bol nunca aparece como fruta normal.
- [ ] Bloqueando `/games/snake/fruits.png` (DevTools → Network → Block request URL), el juego arranca igual y las frutas se ven como círculos magenta (bonus: amarillo).
- [ ] El canvas no muestra puntaje, nivel ni vidas en ningún momento.
- [ ] `.player-hud` muestra solo Jugador, Puntuación, Vidas y Nivel y los botones PAUSA / FIN / SALIR; comparado con `/juegos/tetris/jugar`, no tiene elementos nuevos.
- [ ] Durante la partida, Vidas muestra un único `♥`; en game over muestra `—`.
- [ ] Flechas y WASD giran la serpiente. Pulsar la dirección opuesta a la actual no hace nada.
- [ ] Dos giros rápidos dentro del mismo tick (p. ej. ↑ y ← yendo a la derecha) se aplican en dos ticks seguidos y la serpiente no se muerde.
- [ ] Pulsar flechas, WASD o Espacio durante la partida no desplaza la página.
- [ ] Comer una fruta en nivel 01 suma 10, `FRUTAS` sube 1 y `LONGITUD` sube 1 en el tick siguiente.
- [ ] Con 5 frutas comidas, Nivel pasa de `01` a `02`, la siguiente fruta vale 20 y la serpiente se mueve más rápido.
- [ ] La serpiente puede entrar en la celda que su cola deja libre en ese mismo tick sin morir.
- [ ] Tocar cualquier borde termina la partida (no hay wrap-around).
- [ ] Morderse el cuerpo termina la partida.
- [ ] Cuando aparece la bonus (bol), `BONUS` muestra los segundos y la barra; el bol parpadea los últimos 2 s y desaparece a los 6 s si no se come.
- [ ] Comer la bonus en nivel 01 con 4.x s restantes suma 75 (50 + 5 × 5) y no incrementa `FRUTAS`.
- [ ] PAUSA, P y Esc congelan el juego (serpiente y temporizador de la bonus) y muestran EN PAUSA; al reanudar, la serpiente no avanza varias celdas de golpe.
- [ ] Las teclas pulsadas durante la pausa no giran la serpiente al reanudar.
- [ ] Al morir, el canvas muestra `GAME OVER` / `ESPACIO PARA REINICIAR` sin puntaje, el botón FIN cambia a "JUGAR DE NUEVO" y PAUSA queda deshabilitado.
- [ ] FIN durante la partida produce el mismo game over.
- [ ] En game over, tanto Espacio como "JUGAR DE NUEVO" reinician: `LISTO`, largo 3, `FRUTAS` 0, Puntuación 0, Vidas `♥` y Nivel 01.
- [ ] Con sesión iniciada, el game over envía exactamente 1 `POST /api/scores` con `gameId: "snake"`, responde 200 y muestra la línea de estado de SPEC 07.
- [ ] Como invitado, el game over no envía nada y muestra el CTA a `/auth`.
- [ ] Una marca nueva de Snake aparece en `/salon?juego=snake` y en el panel de `/juegos/snake` tras recargar.
- [ ] Tras SALIR a `/juegos/snake`, pulsar Espacio desplaza la página normalmente y volver a jugar empieza una partida nueva.
- [ ] `/juegos/asteroids/jugar`, `/juegos/tetris/jugar` y `/juegos/bloque-buster/jugar` siguen funcionando igual, y un juego no registrado (p. ej. `/juegos/gloton/jugar`) mantiene el reproductor simulado.

## Decisions

- **Yes:** renombrar `serpentina` → `snake` en id, título, Home y Supabase. Decisión del usuario; mismo procedimiento que `caida` → `tetris` en SPEC 08.
- **No:** mantener el placeholder `serpentina`. El usuario prefirió el nombre del género.
- **Yes:** conservar las 12 marcas demo y el `plays_count` de `serpentina` en `snake`. Evita un ranking vacío y mantiene el seed de SPEC 07.
- **Yes:** renombre en BD con insert + update + delete en una sola migración. La FK no tiene `ON UPDATE CASCADE`; borrar primero eliminaría las marcas en cascada.
- **No:** redirección de `/juegos/serpentina`. No hay usuarios ni enlaces externos, como en SPEC 05 y 08.
- **Yes:** `title: "SNAKE"` y `long` nuevo (frutas pixeladas en lugar de "núcleos magenta"). Decisión del usuario. `short`, `cover`, `cat` y `color` no cambian.
- **Yes:** diseño propio sin referencia: grid 30×20, ticks, bonus y fórmulas definidas en esta spec. De Google Snake solo se toman los sprites de frutas.
- **Yes:** excepción a "canvas sin assets" solo para este juego: `public/games/snake/fruits.png`, atlas tipado en TS, precarga y fallback. Decisión del usuario (pidió construir el juego con esos assets).
- **Yes:** sprites para uso educativo/local con atribución en `sprites.ts`. Decisión del usuario; el origen comercial queda registrado en Risks.
- **Yes:** solo la fila central (pixel art) de `fruits.png`. Encaja con `imageSmoothingEnabled = false` y la estética CRT; las otras dos filas quedan fuera.
- **Yes:** renombrar las claves del atlas según el contenido visual y verificar los recortes. Los nombres de `sprites.js` están desplazados respecto de la imagen.
- **Yes:** copiar el PNG completo (las 3 filas) sin recortar. Recortar la hoja es un paso extra de herramientas; ~580 KB es aceptable.
- **Yes:** fallback a primitivas con timeout de 5 s. El juego nunca queda injugable ni esperando para siempre la imagen.
- **Yes:** 1 vida (`lives = 1` jugando, `0` en game over), como Tetris. Decisión del usuario: snake clásico, un choque termina la partida.
- **No:** 3 vidas con estado `"dead"`. Habría sido el primer uso de `"dead"`; descartado por el usuario.
- **Yes:** paredes letales. Decisión del usuario.
- **No:** wrap-around.
- **Yes:** `level = floor(frutas / 5) + 1` y `tickInterval = max(60, 140 − (level − 1) × 8)` ms (tope en el nivel 11). Decisión del usuario.
- **Yes:** fruta bonus: 25% al llegar a cada múltiplo de 5 frutas normales, 6 s, `50 × nivel + 5 × ceil(segundos restantes)`. Decisión del usuario.
- **Yes:** la bonus también hace crecer 1 segmento y no cuenta para `FRUTAS` ni para el nivel. Así el nivel depende solo de las frutas normales y la bonus es puro puntaje extra.
- **Yes:** `remainingMs` descontado con el `dt` real en lugar de un `expiresAt` absoluto. La pausa congela el temporizador sin cálculos extra.
- **Yes:** `LISTO` 1 s al empezar y al reiniciar; después avanza sola a la derecha. Decisión del usuario.
- **Yes:** Espacio reinicia en game over, además de JUGAR DE NUEVO. Decisión del usuario; igual que los otros juegos.
- **Yes:** serpiente toda green (cabeza más brillante con ojos y glow, cuerpo con alpha decreciente). Decisión del usuario; coincide con el `color` del catálogo.
- **No:** cabeza cyan.
- **Yes:** franja superior con LONGITUD, FRUTAS y BONUS. Decisión del usuario: son valores propios del juego (regla de SPEC 05).
- **Yes:** cola de hasta 2 giros validada contra el último giro encolado. Permite giros rápidos en U sin morderse ni perder entradas.
- **Yes:** todas las teclas ignoran `e.repeat`. Mantener una flecha no debe llenar la cola, ni Espacio reiniciar en cuanto llega el game over.
- **Yes:** `input.ts` propio. Mismo criterio que SPEC 08 y 09: con semánticas distintas no compensa abstraer.
- **Yes:** sin celdas libres = game over. No hay estado de victoria en `GameSnapshot`; el caso es prácticamente inalcanzable.
- **Yes:** glow solo en la cabeza. Hasta 600 segmentos con `shadowBlur` por frame cuestan rendimiento.
- **Yes:** guardado de puntuación sin tocar `components/player.tsx`. SPEC 07 ya lo hace para cualquier juego registrado; solo falta `playable = true`.
- **Yes:** invariantes de SPEC 05/07: `.player-hud` fijo, `GameSnapshot` genérico, motor sin globales, hex copiados de `globals.css` e id consistente en `lib/games.ts`, `games/registry.ts` y `public.games`.

## Risks

| Risk                                                                  | Mitigation                                                                                                       |
| --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Sprites de origen comercial (rip de Google Snake)                     | Uso educativo/local con atribución en `sprites.ts`. Si el proyecto se publica, sustituirlos o pasar al fallback. |
| Recortes del atlas mal etiquetados o desplazados                      | Claves renombradas por contenido visual; verificación de los 22 recortes en el paso 2; criterio específico.      |
| La imagen no carga y el juego se queda en negro                       | Timeout de 5 s + `onerror` → fallback a primitivas; criterio bloqueando la URL.                                  |
| `destroy()` antes de que cargue la imagen deja un loop huérfano       | Flag `destroyed`: si está activo al resolverse la carga, el loop no arranca.                                     |
| Borrar `serpentina` antes de mover las marcas las elimina en cascada  | Orden fijo insert → update → delete en una sola migración; un criterio cuenta 12 marcas en `snake`.              |
| Catálogo y BD desalineados (id `snake` en código, `serpentina` en BD) | El paso 1 hace ambos cambios juntos; `/api/scores` devolvería 404 `GAME_NOT_PLAYABLE` si fallara.                |
| Autocolisión falsa al entrar en la celda que deja la cola             | La cola solo cuenta como obstáculo si `growPending > 0`; criterio específico.                                    |
| Giro en U rápido que muerde el cuello                                 | Validación contra el último giro encolado y 1 giro por tick; criterio específico.                                |
| Ticks en salto al reanudar tras una pausa larga                       | `resume()` reinicia `lastTime` y `tickAccum`.                                                                    |
| Giros encolados durante la pausa se aplican al reanudar               | `pause()` vacía la cola; con pausa solo se encolan P/Esc.                                                        |
| StrictMode duplica motor/listeners en dev                             | `destroy()` en el cleanup, igual que los otros juegos.                                                           |
| Doble envío de score en la transición a game over                     | Ya cubierto por `sentRef` de SPEC 07; `lives` y `state` cambian en el mismo snapshot.                            |
| `dpr` en `setTransform` reactiva el suavizado                         | `imageSmoothingEnabled = false` se fija después de cada `setTransform`/redimensionado.                           |
| Restos de `serpentina` en el código                                   | Criterio con `grep` sobre `app components lib games`.                                                            |

## What is **not** in this spec

- Sonido.
- Wrap-around, obstáculos y laberintos.
- Varias vidas y el estado `"dead"`.
- Power-ups distintos de la bonus.
- Filas 1 y 3 de `fruits.png` y sprites de serpiente.
- Animación interpolada entre celdas.
- Leyenda de controles en el canvas.
- Controles táctiles y móvil.
- Pausa automática por visibilidad.
- Cambios en `short`, `cat`, `cover`, `color` o `.cover-snake`.
- Redirección de `/juegos/serpentina`.
- Cambios en el contrato común de juegos o en `.player-hud`.
- Carga diferida de juegos.
- Cargador de sprites común entre juegos.

Cada uno, si se hace, va en su propio spec.
