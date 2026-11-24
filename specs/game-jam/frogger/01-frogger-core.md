# SPEC — Frogger: juego core jugable en el reproductor

> **Status:** Implemented
> **Depends on:** SPEC 05, SPEC 07, SPEC 11
> **Date:** 2026-11-24
> **Objective:** Crear un juego propio de cruzar carretera y río en canvas puro, renombrar el placeholder `ranaria` → `frogger` en el código y en Supabase y montarlo en `/juegos/frogger/jugar` con el patrón de SPEC 05, guardando puntuaciones reales como los demás juegos.

## Why this spec exists

Es el quinto juego real de la plataforma. Se adapta por completo al contrato existente: el juego se ajusta a la aplicación, no al revés. No se crean rutas, tablas, columnas, colores ni tipos nuevos; no se toca `GameSnapshot`, `GameHandle`, `GameCanvasProps`, `components/player.tsx` ni `.player-hud`.

El juego ya figura en el catálogo como placeholder `id: "ranaria"` / `title: "RANARIA"` (cover `cover-rana`, color `green`) y en Supabase como fila `ranaria` (verificado el 2026-11-24: `playable = false`, `plays_count = 6400`, 12 marcas demo en `best_scores`). Se renombra a `frogger` con el mismo procedimiento que `caida` → `tetris` (SPEC 08) y `serpentina` → `snake` (SPEC 10).

No hay código de referencia ni assets: todo se dibuja con primitivas canvas.

## Scope

**In:**

- Renombrar `ranaria` → `frogger` en `lib/games.ts`: `id: "frogger"`, `title: "FROGGER"`, `short` y `long` nuevos (ver Data model). `cat: "ARCADE"`, `cover: "cover-rana"` y `color: "green"` no cambian. "Ranaria" → "Frogger" en la actividad de ejemplo de `components/home.tsx`.
- Renombrar la fila `ranaria` → `frogger` en `public.games` con `title = 'FROGGER'` y `playable = true`, conservando `category` y `plays_count` y moviendo sus marcas de `best_scores`, en una sola migración.
- Juego en TypeScript estricto en `games/frogger/` (`constants.ts`, `lanes.ts`, `input.ts`, `engine.ts`, `frogger-canvas.tsx`), sin variables globales.
- Canvas lógico estándar 800×600 escalado con `devicePixelRatio`. Dentro, el tablero de 16×14 celdas de 40 px (640×560) centrado horizontalmente (`x = 80`) y pegado abajo (`y = 40`); la franja superior de 40 px y los márgenes laterales son para el HUD propio.
- Mapa por filas del tablero (0 = arriba):
  - fila 0: 5 bocas destino de 2 columnas cada una (columnas 1–2, 4–5, 7–8, 10–11, 13–14); el resto de la fila es seto letal.
  - filas 1–6: río (6 carriles).
  - fila 7: mediana segura.
  - filas 8–12: carretera (5 carriles).
  - fila 13: base de inicio segura.
- Carretera: coches (1 celda) y camiones (2–3 celdas), sentidos alternos, velocidad propia por carril, loop horizontal continuo (al salir por un borde reaparecen por el opuesto) con huecos atravesables. Contacto = muerte.
- Río: troncos (2–4 celdas) y grupos de tortugas (2–3), sentidos alternos, loop continuo. La rana solo sobrevive sobre un tronco o tortuga visible y es arrastrada por él. En 2 de los carriles de tortugas, cada grupo alterna 6 s visible / 1,5 s sumergido (con desfase por grupo y parpadeo el último 1 s antes de sumergirse); sumergido no da soporte.
- Rana: saltos discretos de 1 celda en 4 direcciones con animación de 120 ms; un salto por pulsación (se ignora `repeat`), buffer de 1 dirección mientras salta. No puede salir por los bordes laterales ni por abajo de la fila 13. En el río su posición horizontal puede quedar fraccionaria (arrastre); colisiones y bocas se evalúan por el centro de la rana.
- Muerte por: (a) vehículo, (b) agua, (c) tortuga que se sumerge bajo ella, (d) ser arrastrada fuera del tablero por un borde lateral, (e) temporizador agotado, (f) llegar a fila 0 fuera de una boca o a una boca ya ocupada.
- Temporizador por intento: `max(8, 15 − (level − 1))` s; se reinicia al morir y al ocupar una boca.
- 3 vidas. Al morir con vidas restantes: estado `"dead"` 1 s (rana marcada, mundo sigue) y respawn en fila 13, columna central. Al perder la última: `"gameover"`.
- Puntaje: +10 por cada fila nueva alcanzada hacia arriba en el intento actual (se reinicia al morir y al ocupar boca); +50 al ocupar boca + `ceil(segundos restantes) × 10`; +200 al llenar las 5 bocas.
- Ronda completa (5 bocas): bocas se vacían, `level + 1`, carriles se reconstruyen, todas las velocidades ×1,15 por nivel (`base × 1.15^(level − 1)`).
- Inicio y reinicio: rótulo `LISTO` 1 s con la rana quieta en la base; el tráfico ya se mueve.
- HUD propio en canvas (solo valores del juego, como Snake): barra de tiempo en la franja superior (verde → amarillo → rojo) con segundos, y contador `BOCAS n/5`. Score, vidas y nivel van solo en el HUD React vía `onSnapshot`.
- Overlay `GAME OVER` / `ESPACIO PARA REINICIAR` dentro del canvas, sin puntaje.
- Controles: flechas y WASD saltan; Espacio reinicia en game over; P y Esc → `onTogglePause`.
- Botones del reproductor iguales a los otros juegos: PAUSA, FIN / JUGAR DE NUEVO y SALIR (vía `GameHandle`).
- Guardado automático al entrar en game over con sesión y CTA para invitados: se reutiliza tal cual el flujo de SPEC 07 en `components/player.tsx`.
- Registrar `frogger` en `games/registry.ts` y en `games/touch-bindings.ts` (`{ b: null }`: D-pad salta, A reinicia).

**Out of scope (for future specs):**

- Sonido y música.
- Sprites bitmap.
- Animaciones de muerte elaboradas (explosiones, partículas).
- Mosca bonus en bocas, cocodrilos, nutrias, serpientes en la mediana.
- Rutas, tablas, columnas, colores de tema o tipos nuevos; cambios en `GameSnapshot`, `GameHandle`, `GameCanvasProps`, `components/player.tsx` o `.player-hud`.
- Cambiar `cat`, `cover` o `color` en `lib/games.ts`, o la portada CSS `.cover-rana`.
- Redirección de `/juegos/ranaria` a `/juegos/frogger`.
- Ajustes de layout móvil más allá de la entrada en `TOUCH_BINDINGS` (los revisa `mobile-porter` al terminar).
- Pausa automática al ocultar la pestaña.

## Layout de la pantalla de juego

```
800×600 (canvas lógico)
┌────────────────────────────────────────────┐ y=0
│  BOCAS 2/5      [████████████░░░░] 11s     │ franja HUD propio (40 px)
├──────┬──────────────────────────────┬──────┤ y=40
│      │ ▓▓ ⌂⌂ ▓ ⌂⌂ ▓ ⌂⌂ ▓ ⌂⌂ ▓ ⌂⌂ ▓▓ │ fila 0 bocas
│      │ ~~ río (6 carriles) ~~       │      │ filas 1–6
│ 80px │ ── mediana segura ──         │ 80px │ fila 7
│      │ ▬ carretera (5 carriles) ▬   │      │ filas 8–12
│      │ ── base ── 🐸 ──             │      │ fila 13
└──────┴──────────────────────────────┴──────┘ y=600
        x=80                      x=720
```

## Data model

Sin cambios de esquema (no hay que regenerar `database.types.ts`).

### Migración `rename_ranaria_to_frogger`

```sql
insert into public.games (id, title, category, playable, plays_count)
select 'frogger', 'FROGGER', category, true, plays_count
from public.games where id = 'ranaria';

update public.best_scores set game_id = 'frogger' where game_id = 'ranaria';

delete from public.games where id = 'ranaria';
```

### Entrada en `lib/games.ts`

```ts
{
  id: "frogger",
  title: "FROGGER",
  short: "Cruza la carretera y el río sin convertirte en papilla.",
  long: "Guía a tu rana a través de una carretera repleta de coches y un río de troncos y tortugas flotantes. Llena las cinco bocas del otro lado para completar la ronda; cada nivel acelera el tráfico y acorta el tiempo. Tres vidas y mucho asfalto por delante.",
  cat: "ARCADE",
  cover: "cover-rana",
  color: "green",
}
```

### Tipos internos (`games/frogger/`, no exportados fuera del juego)

```ts
type Direction = "up" | "down" | "left" | "right";
type EntityKind = "car" | "truck" | "log" | "turtle";
interface Entity {
  x: number; // en celdas, puede ser fraccionario
  width: number; // en celdas
  kind: EntityKind;
  diveOffset?: number; // desfase del ciclo de inmersión (s); solo tortugas que se sumergen
}
interface Lane {
  row: number;
  speed: number; // celdas/s, ya escalado por nivel
  dir: 1 | -1;
  entities: Entity[];
  dives: boolean;
}
interface Frog {
  x: number; // celdas (fraccionario en el río)
  row: number;
  jump: { dir: Direction; t: number } | null; // t en ms, 0..120
}
```

Snapshot: `{ score, lives, level, state }` con `state` = `"playing" | "dead" | "gameover"`, emitido solo al cambiar.

## Implementation plan

1. **Renombre `ranaria` → `frogger`** — aplicar la migración con `mcp__supabase__apply_migration`; actualizar `lib/games.ts` y `components/home.tsx`.
   Verificación: `select * from games where id in ('ranaria','frogger')` devuelve solo `frogger` con `playable = true`; sus 12 marcas aparecen en `/juegos/frogger` y en `/salon?juego=frogger`.

2. **`games/frogger/constants.ts`** — dimensiones (`COLS = 16`, `ROWS = 14`, `CELL = 40`, `BOARD_X = 80`, `BOARD_Y = 40`, canvas 800×600), filas de zonas, columnas de bocas, tiempos (`JUMP_MS = 120`, `DEAD_MS = 1000`, `READY_MS = 1000`, ciclo de tortugas), puntajes, factor de velocidad 1,15 y paleta neón con hex copiados de `globals.css`.

3. **`games/frogger/lanes.ts`** — `buildLanes(level): Lane[]` con tabla fija de los 11 carriles (fila, tipo, sentido, velocidad base en celdas/s, entidades y huecos). Velocidades base: carretera 2,25–6 celdas/s, río 1,5–4,5 celdas/s; huecos ≥ 2 celdas en carretera y ≥ 1 en río; 2 carriles de tortugas con `dives = true`.
   Verificación: cada carril tiene ≥ 2 entidades y huecos.

4. **`games/frogger/input.ts`** — listener `keydown`/`keyup` en `window` (flechas + WASD → dirección pendiente; Espacio; P/Esc), ignora `e.repeat`, `preventDefault` en teclas de juego, `dispose()` que quita listeners.

5. **`games/frogger/engine.ts`** — clase motor con loop rAF, `dt` cap 50 ms:
   - `update(dt)` (no corre si `paused`, sí dibuja): mover entidades con wrap; estados `ready`/`playing`/`dead`/`gameover`; iniciar y completar saltos; arrastre en el río; resolver celda (`checkRoad`, `getSupport` con tortugas sumergidas = sin soporte, bordes, `checkGoal`); temporizador; puntaje; `completeRound()`; `killFrog()`.
   - `draw()`: fondos por zona, vehículos (coches con ruedas, camiones con cabina), troncos con vetas, tortugas (visibles, parpadeo, sumergidas como contorno tenue), bocas con borde dorado y rana dentro si ocupada, rana (cuerpo green con glow, ojos, patas extendidas durante el salto), HUD propio de la franja superior, rótulo `LISTO` y overlay `GAME OVER`.
   - Emitir snapshot solo cuando cambie; `endGame()` y `restart()` para `GameHandle`.

6. **`games/frogger/frogger-canvas.tsx`** — client component que implementa `GameCanvasProps` como los otros juegos (monta canvas con DPR, crea/destruye motor en `useEffect`, propaga `paused`, expone `GameHandle` vía `ref`).

7. **Registro** — `frogger: FroggerCanvas` en `games/registry.ts` y `frogger: { b: null }` en `games/touch-bindings.ts`.

8. **Verificación final** — `npx tsc --noEmit`, `npm run lint` y `npm run build` sin errores; prueba visual con Playwright en `/juegos/frogger/jugar`; ninguna ruta existente devuelve 500.

## Acceptance criteria

- [ ] No existe la fila `ranaria`; la fila `frogger` existe con `title = 'FROGGER'`, `playable = true` y el `plays_count` anterior, y conserva las 12 marcas demo.
- [ ] La card FROGGER aparece en `/biblioteca` con `cover-rana` y su detalle `/juegos/frogger` muestra el top 10.
- [ ] `/juegos/frogger/jugar` carga el juego real (no el simulado) sin errores de consola.
- [ ] El tablero 640×560 se ve centrado en el canvas 800×600 con bocas, río, mediana, carretera y base diferenciados.
- [ ] Tras `LISTO`, la rana está en la base, columna central.
- [ ] Cada pulsación de dirección salta exactamente 1 celda con animación de 120 ms; mantener la tecla no encadena saltos.
- [ ] La rana no sale por los laterales ni por debajo de la base.
- [ ] Vehículos, troncos y tortugas se mueven en loop y reaparecen por el lado opuesto.
- [ ] Las tortugas de los carriles que se sumergen alternan 6 s visibles / 1,5 s sumergidas con aviso previo de 1 s.
- [ ] La rana muere por vehículo, agua, tortuga sumergida, arrastre fuera del tablero, tiempo agotado, seto o boca ocupada.
- [ ] Al morir con vidas restantes, el HUD React muestra vidas − 1, `state = "dead"` 1 s y respawn en la base.
- [ ] Ocupar una boca libre la marca y suma 50 + bonus de tiempo; avanzar filas nuevas suma 10 cada una.
- [ ] Llenar las 5 bocas suma 200, vacía las bocas, sube el nivel, acelera los carriles y acorta el temporizador.
- [ ] La barra de tiempo y `BOCAS n/5` se dibujan en la franja superior del canvas; score, vidas y nivel solo en el HUD React.
- [ ] PAUSA y P/Esc congelan el juego y REANUDAR lo reanuda (fuente de verdad: estado React).
- [ ] FIN fuerza game over; JUGAR DE NUEVO y Espacio reinician desde cero.
- [ ] En game over con sesión se guarda la mejor marca (POST `/api/scores`, una vez por partida) y aparece en `/juegos/frogger` y `/salon?juego=frogger`; un invitado ve la CTA a `/auth`.
- [ ] `TOUCH_BINDINGS.frogger` existe y el D-pad táctil hace saltar a la rana.
- [ ] `npx tsc --noEmit`, `npm run lint` y `npm run build` pasan; ninguna ruta existente devuelve 500.

## Decisions

- **Sí: el juego se adapta a la aplicación, no al revés.** Razón: decisión del usuario. Se reutilizan rutas `/juegos/[id]/jugar`, contrato `GameCanvasProps`/`onSnapshot`, guardado por `POST /api/scores` con sesión, tabla `games` sin columnas nuevas y paleta existente.
- **Sí: renombrar `ranaria` → `frogger`** en código y BD, moviendo `best_scores`. Razón: decisión del usuario; evita dos juegos de rana en el catálogo. Mismo procedimiento que SPEC 08 y 10.
- **Sí: color `green`** (el que ya tenía `ranaria`). Razón: no se amplía el tipo `Game` ni el tema por un juego; reemplaza la opción `lime` planteada antes.
- **Sí: tablero 640×560 centrado en el canvas estándar 800×600.** Razón: decisión del usuario; conserva la grilla 16×14 de 40 px sin tocar el CRT del reproductor.
- **Sí: HUD propio solo con valores del juego (tiempo, bocas).** Razón: convención del repo; score, vidas y nivel ya los muestra el HUD React.
- **Sí: estado `"dead"` 1 s entre vidas.** Razón: usa el valor existente de `GameSnapshot` y da feedback de la muerte sin animaciones elaboradas.
- **Sí: primitivas canvas sin sprites.** Razón: no hay assets; sin dependencias de carga.
- **Sí: movimiento discreto en celdas con salto de 120 ms; posición horizontal fraccionaria solo por arrastre en el río.** Razón: mecánica canónica y colisiones simples por centro de la rana.
- **Sí: ciclo de inmersión lento (6 s visibles / 1,5 s sumergidas, aviso 1 s).** Razón: ajuste del usuario tras probar; con 3 s visibles los carriles de arriba eran casi imposibles de cruzar.
- **Sí: 3 vidas, tortugas que se sumergen, temporizador por intento y 5 bocas.** Razón: mecánicas base del género.
- **Sí: entrada en `TOUCH_BINDINGS` (`b: null`).** Razón: requisito de SPEC 11 para todo juego nuevo; el resto del ajuste móvil lo audita `mobile-porter`.
- **No: play-page propia, modal de nombre con `localStorage`, insert directo con `user_id: null`, `next/dynamic`.** Razón: el reproductor y el flujo de SPEC 07 ya resuelven todo eso.
- **No: mosca bonus, cocodrilos ni animaciones de muerte elaboradas.** Razón: van en la spec secundaria.
