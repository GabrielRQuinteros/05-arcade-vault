# SPEC 12 — Rendimiento de Frogger (render del canvas y renders de React)

> **Status:** Implemented
> **Depends on:** SPEC 05, SPEC 07, SPEC 11, game-jam/frogger/01-frogger-core
> **Date:** 2026-11-25
> **Objective:** Eliminar los FPS bajos y tirones de Frogger cacheando su fondo y sus entidades con glow en canvas offscreen sin cambiar su aspecto, y revisar los renders de React de la página de juego corrigiéndolos solo si superan un umbral medido.

## Why this spec exists

Frogger va con FPS bajos y tirones mientras se juega. SPEC 05, 08, 09 y 10 limitaron `shadowBlur` por rendimiento (glow solo en 1–3 elementos). Frogger no siguió ese criterio: `engine.ts` aplica `shadowBlur` en cada frame a ~55 elementos (34 caparazones de tortuga, 9 autos, 6 cabinas de camión, 5 bocas, la rana y las ranas en bocas). En móvil (dpr 2–3) cada glow cuesta proporcionalmente más píxeles.

Además, cada frame redibuja todo el fondo estático: zonas, ~96 curvas de olas del río, líneas punteadas de carretera, seto y bocas.

La decisión central del canvas es **conservar el look idéntico**: en lugar de quitar el glow (criterio de Tetris/Snake/Bloque Buster), cada entidad se dibuja una sola vez con su glow en un canvas offscreen y luego se copia con `drawImage` en cada frame.

Por el lado de React: cada `onSnapshot` del motor hace `setSnapshot` en `GamePlayer` y re-renderiza el reproductor entero (HUD, `FroggerCanvas`, `TouchControls`, overlays). `onSnapshot` y `togglePause` se recrean en cada render. El proyecto no usa React Compiler. No hay evidencia de que esto cause los tirones, así que la spec **mide primero y corrige solo si se supera el umbral**.

## Scope

**In:**

Canvas de Frogger:

- Medición base de FPS de Frogger antes de tocar código (ver Procedimiento de medición).
- Nuevo módulo `games/frogger/render-cache.ts` con la caché de render del motor.
- Fondo estático cacheado en un canvas offscreen de 800×600 lógicos a resolución `dpr`: fondo negro, seto, río y olas, mediana, base, carretera y líneas punteadas, cajas de las 5 bocas con su glow y borde del tablero.
- Sprites pre-renderizados (con glow incluido) para: auto (por color y sentido), camión (por ancho y sentido), tronco (por ancho), tortuga emergida (por sentido), tortuga sumergida, rana (por orientación, salto y escala).
- Sprites creados de forma perezosa (al primer uso) y guardados en un `Map` por clave.
- `engine.ts` dibuja fondo y entidades con `drawImage` desde la caché. El parpadeo de tortugas en aviso se aplica con `globalAlpha = 0.35` sobre el sprite emergido.
- Las funciones de dibujo actuales (`drawCar`, `drawTruck`, `drawLog`, `drawTurtles`, `drawFrog`, `drawZones`, `drawGoals`) se mueven a `render-cache.ts` como funciones que reciben un `ctx`, para dibujar los sprites con exactamente las mismas formas y colores.
- `dpr` del motor derivado de `canvas.width / W` (sin cambiar la firma del constructor ni `frogger-canvas.tsx`).

Renders de React:

- Revisión de commits de React en toda la página `/juegos/frogger/jugar` mientras se juega: layout (`TouchDetector`, `SessionProvider`, `Nav`, footer) y `GamePlayer` (HUD, `FroggerCanvas`, `TouchControls`, overlays).
- Medición con `<Profiler>` de React temporal, en un build de producción con profiling, automatizada con Playwright.
- Si se supera el umbral (ver Data model), corregir en `components/player.tsx`, `components/touch-controls.tsx` u otros componentes de la página los renders que lo provocan, sin cambiar el contrato común. Si no se supera, no se cambia código de React y se registra el resultado.
- El `<Profiler>` y su componente auxiliar se quitan antes de cerrar la spec; no se commitean.

Registro:

- Medición final con los mismos procedimientos y registro de todos los resultados (antes/después) en una sección `## Mediciones` añadida al final de esta spec al implementarla.

**Out of scope (for future specs):**

- Rendimiento del canvas de Asteroids, Tetris, Bloque Buster y Snake (auditoría o fixes de sus motores).
- Medir los renders de React con otros juegos. Los fixes en el reproductor alcanzan a todos, pero se miden solo con Frogger.
- CSS del CRT (`.crt-screen::after` con `mix-blend-mode`, viñeta, `box-shadow`).
- Activar React Compiler (`reactCompiler` en `next.config.ts`).
- `<Profiler>` permanente o logging de renders en desarrollo.
- Script de medición commiteado (`scripts/perf-*.mjs`): los procedimientos viven en esta spec.
- Overlay de FPS en pantalla o modo debug.
- Lag de input (no reportado como síntoma).
- Reacción a cambios de `devicePixelRatio` en caliente (mover la ventana a otro monitor, zoom del navegador).
- `OffscreenCanvas` en Web Worker o render fuera del hilo principal.
- Cambios en reglas, velocidades, carriles o puntuación de Frogger.
- Cambios en `GameSnapshot`, `GameHandle`, `GameCanvasProps`, `input.ts`, `lanes.ts` o `touch-bindings.ts`.
- Cambios visuales intencionales (nuevos efectos, paleta, sprites de imagen) en el canvas o en el reproductor.

## Data model

### Caché de render (`games/frogger/render-cache.ts`, cliente)

```ts
/** Sprite pre-renderizado; `pad` = margen lógico alrededor para que el glow no se recorte. */
export interface Sprite {
  canvas: ImageBitmap; // tamaño físico = (w + 2·pad)·dpr × (h + 2·pad)·dpr
  w: number; // ancho lógico de la entidad (px)
  h: number; // alto lógico de la entidad (px)
  pad: number; // px lógicos
}

export class FroggerRenderCache {
  constructor(dpr: number); // construye `background` en el acto
  readonly background: ImageBitmap; // 800×600 lógicos · dpr
  car(color: number, dir: 1 | -1): Sprite;
  truck(width: number, dir: 1 | -1): Sprite;
  log(width: number): Sprite;
  turtle(dir: 1 | -1): Sprite; // emergida, 1 tortuga (1 celda)
  turtleSubmerged(): Sprite; // anillo con alpha 0.25
  frog(facing: Direction, jumping: boolean, scale: number): Sprite;
}
```

Claves del `Map` interno: strings, por ejemplo `car:1:-1`, `truck:3:-1`, `log:4`, `turtle:1`, `turtle-sub`, `frog:up:1:1`.

Convenciones:

- Cada sprite se dibuja una vez con `setTransform(dpr, 0, 0, dpr, pad·dpr, pad·dpr)` en su canvas propio. Origen del sprite = esquina superior izquierda de la entidad.
- `pad` ≥ 2 × `shadowBlur` del elemento (o 2 px si no tiene glow).
- En el frame: `ctx.drawImage(s.canvas, x − s.pad, y − s.pad, s.w + 2·s.pad, s.h + 2·s.pad)` en coordenadas lógicas (el `ctx` del motor ya tiene la transformación `dpr`).
- Rana: sprite centrado; se dibuja en `cx − s.w/2`, `cy − s.h/2`. Un sprite por cada combinación usada (4 orientaciones × salto sí/no × escala 1; orientación `down` × escala 0.8 para bocas).
- Cada sprite y el fondo se pintan en un `OffscreenCanvas` y se congelan con `transferToImageBitmap()` (síncrono). Ver Decisions: sustituye a `document.createElement("canvas")`.
- La caché vive en la instancia del motor; `restart()` la reutiliza. Se libera con el motor.

### Cambios en `games/frogger/engine.ts`

- Nuevo campo `private readonly cache: FroggerRenderCache`, creado en el constructor con `dpr = canvas.width / W`.
- `draw()`: `drawImage(cache.background, 0, 0, W, H)` sustituye a fill de fondo, `drawZones()`, cajas de `drawGoals()` y `strokeRect` del borde.
- Siguen dibujándose en vivo cada frame: franja superior (BOCAS, barra y segundos de TIEMPO), marca de muerte, LISTO y GAME OVER. Ninguno usa más de un `shadowBlur` por frame.
- Ranas en bocas ocupadas y rana del jugador: `drawImage` de `cache.frog(...)`.
- Se mantienen el `clip` del tablero y el descarte de entidades fuera de pantalla de `drawLane`.

### Profiler temporal de React (no se commitea)

`components/render-profiler.tsx` (cliente, temporal): envuelve sus `children` en `<Profiler id={id} onRender={...}>` y acumula cada commit en `window`:

```ts
// Registro por commit, leído por Playwright con browser_evaluate.
type RenderSample = {
  id: "app" | "player";
  phase: "mount" | "update" | "nested-update";
  actualDuration: number; // ms
  commitTime: number; // ms
};
// window.__avRenders: RenderSample[]
// window.__avSnapshots: number  — contador de llamadas a onSnapshot en GamePlayer (temporal)
```

Ubicación durante la medición:

- `id="app"`: en `app/layout.tsx`, envolviendo `<SessionProvider>` (cubre `Nav`, `main` y footer).
- `id="player"`: en `app/juegos/[id]/jugar/page.tsx`, envolviendo `<GamePlayer>`.
- Contador `__avSnapshots`: una línea temporal en `onSnapshot` de `components/player.tsx`.

### Umbral de renders de React

Se mide en dos escenarios tras el fin de LISTO, 10 s cada uno:

- **Reposo:** sin input. Ningún campo de `GameSnapshot` cambia.
- **Activo:** `ArrowUp` cada 400 ms vía `browser_press_key` (la rana avanza, puntúa, muere y reaparece).

Se considera que React **supera el umbral** si se cumple cualquiera de estas condiciones:

- Reposo: algún commit de `app` o `player` (> 0 commits).
- Activo: commits de `player` > `__avSnapshots` (hay commits que no vienen de un cambio de snapshot).
- Activo: commits de `app` > 0 (el layout se re-renderiza por la partida).
- Cualquier escenario: algún commit con `actualDuration` > 4 ms (con CPU 4× lenta).

Si se supera, se corrige la causa concreta medida (por ejemplo: callbacks estables con `useCallback` o refs, `memo` en `TouchControls` u overlays, aislar el HUD del canvas) y se vuelve a medir hasta no superarlo. Las técnicas concretas se eligen según la causa; ninguna se aplica preventivamente.

### Archivos tras esta spec

```
games/frogger/
  render-cache.ts   (nuevo)
  engine.ts         (modificado: draw vía caché)
components/player.tsx, components/touch-controls.tsx  (solo si se supera el umbral de React)
specs/12-rendimiento-frogger.md  (sección Mediciones añadida al implementar)
```

`components/render-profiler.tsx` y los cambios temporales en `app/layout.tsx`, `app/juegos/[id]/jugar/page.tsx` y `onSnapshot` no quedan en el diff final.

## Implementation plan

1. Medir la línea base de FPS con el procedimiento de medición (sin cambios de código). Guardar capturas del canvas en estado inicial y con tortugas en aviso y sumergidas como referencia visual.
2. Crear `components/render-profiler.tsx` y colocar los `<Profiler>` y el contador temporales. Medir la línea base de React (reposo y activo) y anotar si supera el umbral y qué componentes hacen commit.
3. Crear `render-cache.ts` con `FroggerRenderCache`, `Sprite` y solo `background` (mover ahí `drawZones` y las cajas de `drawGoals` como funciones con `ctx`). En `engine.ts`, instanciar la caché y dibujar el fondo con un `drawImage`. Verificar visualmente contra las capturas.
4. Añadir sprites `car`, `truck` y `log` (mover `drawCar`, `drawTruck`, `drawLog`). `drawLane` usa `drawImage` para esos tipos.
5. Añadir sprites `turtle` y `turtleSubmerged` (mover `drawTurtles`, dibujando una tortuga por sprite). `drawLane` dibuja cada tortuga del grupo con su sprite; el aviso aplica `globalAlpha = 0.35` en la fase de parpadeo.
6. Añadir sprite `frog` (mover `drawFrog`). Rana del jugador y ranas en bocas usan `drawImage`.
7. Solo si el paso 2 superó el umbral: corregir la causa medida en los componentes de la página y volver a medir React hasta no superarlo. Si no lo superó, este paso no cambia código.
8. Medir de nuevo FPS y React con los mismos procedimientos, comparar capturas y escribir la sección `## Mediciones` al final de esta spec. Quitar `render-profiler.tsx`, los `<Profiler>` y el contador temporales.

## Procedimiento de medición

Común a ambas mediciones, vía Playwright MCP (`browser_run_code_unsafe`), en Chromium:

- App en build de producción con profiling de React: `next build --profile` y `npm run start`.
- Página `/juegos/frogger/jugar`, viewport 390×844, `deviceScaleFactor: 3`, `hasTouch: true`.
- CDP: `Emulation.setCPUThrottlingRate` con `rate: 4`.
- Esperar 2 s (fin de LISTO) antes de empezar a medir.
- Repetir 3 veces y tomar la mediana.

**FPS:** durante 10 s sin input, contar frames con un bucle `requestAnimationFrame` inyectado en la página y registrar el intervalo entre frames. Resultado: FPS medio = frames / 10 s; tirones = % de intervalos > 33 ms.

**React:** vaciar `window.__avRenders` y `window.__avSnapshots`, ejecutar el escenario (reposo o activo) durante 10 s y leer ambos con `browser_evaluate`. Resultado por escenario: commits de `app`, commits de `player`, llamadas a `onSnapshot`, `actualDuration` máxima y media.

## Acceptance criteria

Canvas:

- [x] FPS medio final ≥ 55 en el procedimiento de medición (390×844, dpr 3, CPU 4× lenta).
- [x] Frames con intervalo > 33 ms ≤ 5% en el procedimiento de medición.
- [x] `shadowBlur` no aparece en `engine.ts` salvo en marca de muerte, LISTO y GAME OVER.
- [x] `drawLane` no llama a `arc`, `roundRect`, `fillRect` ni `stroke` para entidades: solo `drawImage`.
- [x] `draw()` no redibuja zonas, olas, líneas de carretera, cajas de bocas ni borde: un solo `drawImage` del fondo.
- [x] Captura del canvas antes/después en estado inicial: mismas formas, colores y glow, sin diferencias visibles a simple vista.
- [x] Tortugas en aviso siguen parpadeando a 100 ms y las sumergidas se ven como anillo tenue, igual que antes.
- [x] El glow de autos, cabinas de camión, tortugas, bocas y rana no aparece recortado en los bordes del sprite.
- [x] En escritorio (dpr 1) y en móvil (dpr 3) los sprites se ven nítidos, sin borrosidad por escalado.
- [ ] Reglas sin cambios: colisiones, arrastre en el río, puntuación, tiempo y niveles se comportan igual que antes (partida manual de al menos 2 niveles). Pendiente: partida manual.
- [x] `restart()` y Espacio tras GAME OVER no recrean la caché ni generan errores.

React:

- [x] Reposo final: 0 commits de `app` y de `player`.
- [x] Activo final: commits de `player` ≤ llamadas a `onSnapshot`, y 0 commits de `app`. Los commits de `app` son los mismos anidados de `player`; 0 commits solo de layout.
- [x] Ningún commit final con `actualDuration` > 4 ms en ninguno de los dos escenarios. Aceptado por el usuario con excepción: el commit de game over (7–11 ms, una vez por partida, juego detenido) y picos sueltos por ruido del throttling. Los commits de snapshot en juego tienen mediana ≈ 1,4 ms (ver Mediciones).
- [ ] Si hubo fixes de React: HUD (puntuación, vidas, nivel), PAUSA/REANUDAR, FIN/JUGAR DE NUEVO, guardado de puntuación al game over y controles táctiles se comportan igual que antes en Frogger y en al menos otro juego registrado. Verificado en Frogger y Tetris en escritorio; falta probar los controles táctiles en móvil.
- [x] `GameSnapshot`, `GameHandle` y `GameCanvasProps` sin cambios.
- [x] `components/render-profiler.tsx`, los `<Profiler>` y el contador `__avSnapshots` no están en el diff final.

General:

- [x] La sección `## Mediciones` de esta spec registra línea base y resultado final de FPS y de React (ambos escenarios), y si React superó el umbral y qué se corrigió.
- [x] `npm run lint` y `npm run build` sin errores. Los 33 problemas que reporta `npm run lint` están todos en `references/` (sin tocar).
- [x] Sin errores en consola al jugar en `/juegos/frogger/jugar`.

## Decisions

- **Yes:** canvas solo de Frogger. Decisión del usuario; otros motores en otra spec si hace falta.
- **No:** auditar o tocar los motores de los otros 4 juegos. Ya siguen el criterio de glow limitado (SPEC 05/08/09/10).
- **Yes:** sprites pre-renderizados con glow incluido. Decisión del usuario: mismo look, coste por frame de un `drawImage`.
- **No:** quitar el glow de entidades masivas. Cambia el look; el usuario pidió fidelidad idéntica.
- **No:** reducir `shadowBlur` en vivo. Mejora parcial y también altera el look.
- **Yes:** fondo estático cacheado en offscreen. Decisión del usuario.
- **Yes:** caché a resolución `dpr` derivada de `canvas.width / W`. Nitidez en HiDPI sin cambiar constructor ni `frogger-canvas.tsx`.
- **Yes:** sprites perezosos en `Map` por clave. Solo se crean las combinaciones usadas; nuevos niveles o anchos no requieren lista fija.
- **Yes:** parpadeo de aviso como `globalAlpha` sobre el sprite emergido. Evita un sprite extra; la diferencia en el solape cabeza/caparazón no es visible.
- **No:** `document.createElement("canvas")` como fuente de `drawImage`. Era la decisión original. Al implementarla, el A/B en Chrome headless mostró regresión: ~29 FPS con sprites en `<canvas>` contra ~59 del motor original. Con fuente y destino en backends distintos (GPU/software), copiar de un canvas a otro fuerza transferencias en cada frame.
- **Yes:** `OffscreenCanvas` + `transferToImageBitmap()` (desvío respecto de la versión aprobada, aplicado al implementar y aceptado por el usuario). El `ImageBitmap` es inmutable y el navegador lo cachea como textura: ~60 FPS en el mismo A/B. Requiere Safari 16.4+, Chrome 69+ y Firefox 105+. No se usan workers.
- **No:** `OffscreenCanvas` en worker. Sobredimensionado para el problema.
- **Yes:** cajas de bocas y borde del tablero dentro del fondo cacheado. Son estáticos; solo las ranas en bocas cambian.
- **Yes:** franja superior (BOCAS, TIEMPO) en vivo. Cambia cada frame y no usa glow.
- **Yes:** revisar los renders de React en esta spec. Pedido del usuario tras la primera versión.
- **Yes:** `<Profiler>` temporal medido con Playwright. Decisión del usuario; automatizable y no deja código de diagnóstico.
- **No:** React DevTools Profiler manual. No automatizable con Playwright ni repetible.
- **No:** `<Profiler>` permanente en desarrollo. Deja código de diagnóstico en el repo.
- **Yes:** revisar la página completa (layout + reproductor). Decisión del usuario: todo lo que puede hacer commit mientras se juega.
- **Yes:** corregir React solo si supera el umbral. Decisión del usuario; evita memoización preventiva sin evidencia.
- **Yes:** umbral = 0 commits en reposo, commits de `player` ≤ snapshots, 0 commits de `app` en partida, ningún commit > 4 ms. Distingue renders necesarios (cambio de HUD) de los sobrantes, y 4 ms con CPU 4× lenta deja margen en un frame de 16,7 ms.
- **Yes:** se permite tocar `player.tsx` y `touch-controls.tsx` sin cambiar el contrato común. Decisión del usuario; afecta a todos los juegos, por eso se verifica también otro juego registrado.
- **No:** activar React Compiler. Cambio global de build que excede esta spec.
- **Yes:** medir en build de producción con `next build --profile`. En dev, StrictMode y el modo desarrollo inflan duraciones y FPS.
- **Yes:** medición con Playwright + CPU throttle 4× en 390×844 dpr 3. Decisión del usuario; caso móvil es el más exigente.
- **Yes:** umbrales ≥ 55 FPS medio y ≤ 5% frames > 33 ms. Uno mide fluidez media y el otro los tirones reportados.
- **Yes:** criterio "ningún commit > 4 ms" dado por cumplido con excepción del commit de game over y del ruido del throttling. Decisión del usuario tras ver las mediciones.
- **No:** script de medición commiteado. Decisión del usuario; el repo no tiene tests y el procedimiento queda en la spec.
- **No:** CSS del CRT. Decisión del usuario: afecta a todos los juegos; si la medición lo señala, otra spec.
- **No:** reaccionar a cambios de `dpr` en caliente. `frogger-canvas.tsx` ya fija el tamaño una vez al montar.

## Risks

| Risk                                                                 | Mitigation                                                                                                                                      |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Glow recortado en el borde del sprite                                | `pad` ≥ 2 × `shadowBlur`. Criterio de aceptación visual específico.                                                                             |
| Sprites borrosos por escalado                                        | Canvas offscreen a `dpr` y `drawImage` con tamaño lógico exacto.                                                                                |
| Posiciones de entidades fraccionarias (subpíxel) suavizan los bordes | Igual que hoy con el dibujo vectorial; si se nota, redondear `x` a píxel físico solo al dibujar (sin tocar la física).                          |
| Headless Chromium no reproduce el móvil real                         | Medición relativa antes/después con el mismo procedimiento; la mediana de 3 corridas reduce ruido.                                              |
| Tras el fix la meta no se alcanza por el CSS del CRT                 | Registrarlo en `## Mediciones` y abrir otra spec para el reproductor; el CRT queda fuera de esta.                                               |
| Memoria de la caché (fondo 2400×1800 a dpr 3 ≈ 17 MB)                | Aceptable; un solo fondo por instancia y se libera al desmontar el motor.                                                                       |
| `next build --profile` no disponible o distinto en Next 16           | Consultar `node_modules/next/dist/docs/` antes de medir. Si no existe, medir React en `npm run dev` y tratar las duraciones como cota superior. |
| `<Profiler>` en `app/layout.tsx` (Server Component)                  | Se usa vía `render-profiler.tsx` (cliente) que recibe `children`; no cambia qué es servidor o cliente.                                          |
| Fixes en `player.tsx` rompen otro juego o el guardado de puntuación  | Criterio de aceptación: verificar HUD, pausa, FIN, guardado y táctil en Frogger y en otro juego registrado.                                     |
| Olvidar quitar el profiler temporal                                  | Paso 8 explícito y criterio de aceptación sobre el diff final.                                                                                  |

## What is **not** in this spec

- Rendimiento del canvas de Asteroids, Tetris, Bloque Buster o Snake.
- Medir renders de React con otros juegos.
- Cambios en el CSS del CRT.
- React Compiler.
- `<Profiler>` permanente, script de medición commiteado u overlay de FPS.
- Lag de input.
- Reacción a cambios de `devicePixelRatio` en caliente.
- Workers / `OffscreenCanvas` fuera del hilo principal.
- Cambios de reglas, carriles o look de Frogger.
- Cambios en el contrato común (`GameSnapshot`, `GameHandle`, `GameCanvasProps`).

Cada uno de esos, si llega, va en su propia spec.

## Mediciones

Fecha: 2026-11-25. Build `next build --profile` + `next start`, Playwright (Chromium headed de Playwright MCP), 390×844, dpr 3, CPU 4× lenta, 10 s por escenario, mediana de 3 corridas.

### FPS (reposo, sin input)

| Versión                                            | FPS medio | Frames > 33 ms | JS por frame (rAF) |
| -------------------------------------------------- | --------- | -------------- | ------------------ |
| Línea base (motor original)                        | 45,8      | 0,2 %          | 4,5 ms             |
| Final (fondo + sprites `ImageBitmap`, HUD aislado) | 56,7      | 0,5 %          | 4,0 ms             |

Notas:

- El Chromium headed es ruidoso entre sesiones: con el mismo código hubo corridas sueltas de 24 a 115 FPS, por oclusión de la ventana y frecuencia de la pantalla. Por eso se hizo además un A/B en Chrome headless (`channel: "chrome"`), mismas condiciones, con el motor intercambiado en el mismo build:
  - Motor original: 57,5 / 59,5 FPS (dos tandas), ≤ 1,4 % de tirones.
  - Sprites en `<canvas>` (diseño aprobado): 43,7 / 28,7 FPS, 10–64 % de tirones. **Regresión.**
  - Sprites en `ImageBitmap` (final): 60,4 FPS, ≤ 0,6 % de tirones (techo de 60 Hz de headless).
- El JS por frame casi no cambia: el costo de Frogger estaba en raster/composición (glow), no en JS.

### React

| Escenario | Métrica                                          | Línea base | Final                        |
| --------- | ------------------------------------------------ | ---------- | ---------------------------- |
| Reposo    | commits `app` / `player`                         | 0 / 0      | 0 / 0                        |
| Activo    | commits `player` / llamadas `onSnapshot`         | 9 / 9      | 9 / 9                        |
| Activo    | commits solo de layout (`app` sin `player`)      | 0          | 0                            |
| Activo    | `actualDuration` máx. (mediana de corridas)      | 5,5 ms     | 9,3 ms (commit de game over) |
| Activo    | `actualDuration` de commits de snapshot en juego | 0,4–6,3 ms | 0,9–5,2 ms (mediana ≈ 1,4)   |

- El Profiler `app` envuelve al de `player`, así que reporta los mismos commits anidados. Se midió aparte que ningún commit de `app` ocurre sin uno de `player`: el layout no se re-renderiza por la partida.
- La línea base **superó el umbral** (commits > 4 ms). Con Profilers anidados se vio que cada snapshot re-renderizaba todo `GamePlayer`: cuerpo, HUD, canvas y controles.
- Fixes aplicados en `components/player.tsx` (contrato común sin cambios):
  - `GameView` memoizado con callbacks estables (`togglePause` con `useCallback`; `onSnapshot` estable que delega por ref al handler del último render).
  - `TouchControls` memoizado, con bindings por defecto constantes.
  - Snapshot del motor en un store externo (`useSyncExternalStore`). Solo `HudStats` se suscribe a todos los campos; `GamePlayer` se re-renderiza solo cuando cambia `gameOver`.
- Resultado: los commits de snapshot ya solo renderizan `HudStats` (mediana ≈ 1,4 ms). **No se cumple** "ningún commit > 4 ms":
  - El commit de game over (una vez por partida, con el juego detenido) monta la línea de guardado y cambia los botones: 7,7–11,1 ms.
  - Con CPU throttling de CDP, commits idénticos varían hasta 10× (0,4 ↔ 4,2 ms), así que hay picos sueltos por ruido.
