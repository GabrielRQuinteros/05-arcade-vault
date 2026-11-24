# SPEC 11 — Controles táctiles para jugar en móvil

> **Status:** Implemented
> **Depends on:** SPEC 05, SPEC 07, SPEC 08, SPEC 09, SPEC 10
> **Date:** 2026-11-23
> **Objective:** Agregar al reproductor una sección de controles táctiles común (D-pad + botones A/B) bajo el canvas, visible tras el primer toque, que maneje Asteroids, Tetris, Bloque Buster y Snake despachando eventos de teclado sintéticos, con un HUD compacto que deje todo visible en vertical.

## Why this spec exists

SPEC 05, 08, 09 y 10 dejaron fuera, de forma explícita, "controles táctiles / soporte móvil jugable". Hoy los 4 juegos solo escuchan teclado en `window` (Bloque Buster además mouse sobre el canvas), así que en un teléfono se ven pero no se pueden jugar.

La decisión central es **no tocar los motores**: cada `input.ts` ya mapea `e.code` → acción. Un control táctil que despache `KeyboardEvent` sintéticos con el mismo `code` hace jugables los 4 juegos sin cambiar `GameSnapshot`, `GameHandle`, `GameCanvasProps` ni ningún `engine.ts`. La única excepción es el arrastre del paddle de Bloque Buster, que vive en su `input.ts`.

## Scope

**In:**

- Sección de controles táctiles debajo del `.crt` en `components/player.tsx`, igual para los 4 juegos registrados: D-pad a la izquierda y botones `A` y `B` a la derecha.
- D-pad único con deslizamiento: la dirección (↑ ↓ ← →) sale de la posición del dedo respecto al centro, con zona muerta central. Deslizar a otra dirección suelta la anterior y pulsa la nueva sin levantar el dedo.
- Mapeo común: D-pad = `ArrowUp`/`ArrowDown`/`ArrowLeft`/`ArrowRight`; `A` = `Space`; `B` = acción secundaria según el juego (ver Data model). Si el juego no tiene acción secundaria, `B` se ve atenuado y no despacha nada.
- Eventos de teclado sintéticos (`keydown`/`keyup`) despachados en `window`, con el mismo `code` que la tecla física.
- Auto-repeat como el teclado: al mantener pulsado el D-pad o un botón, `keydown` inicial y luego `keydown` con `repeat: true` tras 170 ms, cada 50 ms, hasta soltar (`keyup`).
- Multitouch: D-pad y botones se usan a la vez (p. ej. girar + disparar en Asteroids), cada uno con su propio puntero capturado.
- Liberación segura: `keyup` de todo lo pulsado al soltar, al cancelar el puntero, al perder la captura, al ocultar la pestaña, al perder el foco la ventana y al desmontar.
- Detección "al primer toque": un listener global marca `sessionStorage["av_touch"] = "1"` al primer `pointerdown` con `pointerType === "touch"` en cualquier página. El reproductor muestra los controles si la marca existe o en cuanto llega ese primer toque.
- Los controles solo se muestran para juegos registrados en `GAME_COMPONENTS`; el reproductor simulado no los muestra.
- Bloquear scroll, zoom por doble toque, selección de texto, menú contextual y resaltado de toque sobre la sección de controles.
- HUD compacto en pantallas estrechas (`max-width: 600px`): stats y botones PAUSA / FIN / SALIR más chicos, menos padding en `.av-player`, `.crt` y `.crt-bottom`, para que HUD + CRT + controles quepan en 390×844 sin scroll.
- Bloque Buster: arrastrar el dedo sobre el canvas mueve el paddle, y un toque sin arrastre lanza la pelota (igual que el clic).
- Solo orientación vertical como objetivo de diseño. En horizontal la sección funciona igual, sin layout propio.

**Out of scope (for future specs):**

- Layout dedicado para horizontal y aviso de "gira el dispositivo".
- Controles superpuestos sobre el canvas.
- Etiquetas de botón por juego (FUEGO, CAÍDA…): los botones muestran solo `A` y `B`.
- Gestos sobre el canvas (swipe) en Asteroids, Tetris y Snake.
- Vibración (`navigator.vibrate`).
- Pantalla completa (Fullscreen API) y bloqueo de orientación.
- Botón de pausa en la sección táctil: la pausa sigue en el HUD.
- Toggle manual para mostrar/ocultar los controles y persistencia en `localStorage`.
- Configuración de mapeo o de tamaño de botones por el usuario.
- Gamepad físico (Gamepad API).
- Pausa automática al ocultar la pestaña.
- Cambios en `GameSnapshot`, `GameHandle`, `GameCanvasProps` o en cualquier `engine.ts`.
- Cambios en `input.ts` de Asteroids, Tetris y Snake.
- Rediseño del HUD en escritorio.

## Layout del reproductor en móvil (vertical)

```
┌─ .player-hud compacto ─────────────────────┐
│ JUGADOR  PUNTUACIÓN  VIDAS  NIVEL          │
│ INVITADO 1.250       ♥♥♥    03             │
│ [PAUSA] [FIN] [SALIR]                      │
└────────────────────────────────────────────┘
┌─ .crt > .crt-screen (canvas 4:3) ──────────┐
│                                            │
│                 canvas                     │
│                                            │
└────────────────────────────────────────────┘
┌─ .touch-controls ──────────────────────────┐
│      ▲                                     │
│   ◀  ·  ▶                    (B)           │
│      ▼                            (A)      │
└────────────────────────────────────────────┘
```

- `.touch-controls` va **fuera** del `.crt`, debajo de `.crt-bottom`.
- D-pad: cruz de ~144×144 px a la izquierda. Botones: círculos de ~64 px a la derecha, `B` arriba-izquierda y `A` abajo-derecha (disposición diagonal de gamepad).
- Estética neón del vault: borde `--cyan`, glow al pulsar, letras en `font-pixel`. `B` deshabilitado con opacidad reducida.
- En escritorio sin toque no cambia nada: ni sección de controles ni HUD compacto por encima de 600 px.

## Data model

### Detección táctil (`lib/touch.ts`, cliente)

```ts
export const TOUCH_STORAGE_KEY = "av_touch"; // sessionStorage, valor "1"
export const TOUCH_EVENT = "av:touch"; // CustomEvent en window al detectar el primer toque

/** true si el dispositivo ya se detectó como táctil en esta pestaña. */
export function useTouchMode(): boolean; // useSyncExternalStore, snapshot de servidor = false
```

- `useSyncExternalStore` con snapshot de servidor `false`: el HTML inicial nunca incluye los controles y no hay mismatch de hidratación.
- Si `sessionStorage` lanza (modo privado restringido), el modo táctil vive solo en memoria durante la página.

### Detector global (`components/touch-detector.tsx`, cliente)

Componente sin UI (`return null`) montado una vez en `app/layout.tsx`. Escucha `pointerdown` en `window` (`passive: true`); con el primer `pointerType === "touch"` guarda la marca, despacha `TOUCH_EVENT` y quita el listener. Si la marca ya existía al montar, no registra el listener.

### Mapeo por juego (`games/touch-bindings.ts`)

```ts
export type TouchBindings = {
  /** `code` que despacha B; null = B atenuado e inactivo. */
  b: string | null;
};

export const DPAD_CODES = {
  up: "ArrowUp",
  down: "ArrowDown",
  left: "ArrowLeft",
  right: "ArrowRight",
} as const;
export const A_CODE = "Space";

export const TOUCH_BINDINGS: Record<string, TouchBindings> = {
  asteroids: { b: "KeyW" }, // impulso (code distinto de ArrowUp: ambos pueden estar sostenidos)
  tetris: { b: "KeyX" }, // rotar
  "bloque-buster": { b: null },
  snake: { b: null },
};
```

| Juego         | ▲          | ▼          | ◀ ▶    | A (`Space`)              | B                |
| ------------- | ---------- | ---------- | ------ | ------------------------ | ---------------- |
| Asteroids     | impulso    | — (ignora) | girar  | disparar / reiniciar     | impulso (`KeyW`) |
| Tetris        | rotar      | soft drop  | mover  | hard drop / reiniciar    | rotar (`KeyX`)   |
| Bloque Buster | — (ignora) | — (ignora) | paddle | lanzar / reiniciar       | —                |
| Snake         | girar      | girar      | girar  | reiniciar (en game over) | —                |

Las teclas que un juego no mapea se despachan igual y su `input.ts` las ignora, como con el teclado físico.

### Componente (`components/touch-controls.tsx`, cliente)

```ts
type Props = { bindings: TouchBindings };
export function TouchControls({ bindings }: Props): JSX.Element;
```

- Evento despachado: `new KeyboardEvent(type, { code, key, bubbles: true, cancelable: true, repeat })` sobre `window`. `key` = `"ArrowUp"`, `" "`, `"w"`, `"x"`, etc.
- Constantes: `REPEAT_DELAY_MS = 170`, `REPEAT_INTERVAL_MS = 50`, `DPAD_DEAD_ZONE = 0.2` (fracción del radio del D-pad).
- D-pad: dirección dominante por eje (`|dx| > |dy|` → horizontal). Dentro de la zona muerta no hay dirección pulsada.
- Estado interno: `Map<pointerId, code>` de lo pulsado y un temporizador de repetición por puntero. Todo se limpia con `releaseAll()`.
- Eventos de puntero con `setPointerCapture`; `pointerup`, `pointercancel` y `lostpointercapture` sueltan. `visibilitychange` (oculta), `blur` y el cleanup del efecto llaman `releaseAll()`.
- `onContextMenu` → `preventDefault`. Los botones son `<button type="button">` con `aria-label` (`"Arriba"`, `"Botón A"`…) y `tabIndex={-1}` para no robar el foco del teclado.
- Estado visual `.on` en la dirección/botón pulsado.

### Cambio en `games/bloque-buster/input.ts`

- `mousemove` → `pointermove` sobre el canvas (cubre mouse, toque y lápiz) con el mismo cálculo de `mouseX` lógico.
- `click` → detección de toque/clic con `pointerdown` + `pointerup`: lanza si el puntero se movió menos de `TAP_SLOP_PX = 10` px (en píxeles de pantalla). Así arrastrar el paddle con el dedo no lanza la pelota y el clic de mouse sigue igual.
- `games/bloque-buster/bloque-buster-canvas.tsx`: `touchAction: "none"` en el estilo del canvas, para que arrastrar no desplace la página.

### Integración en `components/player.tsx`

```tsx
const touch = useTouchMode();
// ...
{
  touch && !simulated && (
    <TouchControls bindings={TOUCH_BINDINGS[game.id] ?? { b: null }} />
  );
}
```

Va justo después del cierre de `.crt`. El resto del reproductor (guardado, pausa, FIN, modal simulado) no cambia.

### CSS (`app/globals.css`)

- Nuevas clases: `.touch-controls`, `.dpad`, `.dpad .dir` (`up`/`down`/`left`/`right`), `.tbtn` (`.a`, `.b`), estado `.on` y `[disabled]`.
- `.touch-controls`: `touch-action: none`, `user-select: none`, `-webkit-user-select: none`, `-webkit-touch-callout: none`, `-webkit-tap-highlight-color: transparent`.
- `@media (max-width: 600px)`: HUD compacto (`.player-hud`, `.hud-stat`, `.hud-actions .btn`), menor margen/padding en `.av-player`, `.crt` y `.crt-bottom`.
- `@media (prefers-reduced-motion: reduce)`: sin transición en `.on`.

### Archivos tras esta spec

- `lib/touch.ts` (nuevo) — clave, evento y `useTouchMode()`
- `components/touch-detector.tsx` (nuevo, cliente)
- `app/layout.tsx` (modificado) — monta `<TouchDetector />`
- `games/touch-bindings.ts` (nuevo) — códigos del D-pad, `A` y `B` por juego
- `components/touch-controls.tsx` (nuevo, cliente)
- `components/player.tsx` (modificado) — renderiza `<TouchControls>`
- `app/globals.css` (modificado) — estilos de controles y HUD compacto
- `games/bloque-buster/input.ts` (modificado) — pointer events y toque sin arrastre
- `games/bloque-buster/bloque-buster-canvas.tsx` (modificado) — `touchAction: "none"`

Sin cambios en Supabase, `games/types.ts`, `games/registry.ts`, ningún `engine.ts` ni `input.ts` de Asteroids, Tetris y Snake.

## Implementation plan

1. Crear `lib/touch.ts` y `components/touch-detector.tsx`; montar `<TouchDetector />` en `app/layout.tsx`. Manual: en Playwright con `hasTouch`, tocar cualquier página deja `sessionStorage.av_touch === "1"`; en escritorio con mouse no se crea.
2. Crear `games/touch-bindings.ts` con `DPAD_CODES`, `A_CODE` y `TOUCH_BINDINGS` para los 4 juegos.
3. Crear `components/touch-controls.tsx`, parte de botones: `A` y `B` con captura de puntero, `keydown`/`keyup` sintéticos, auto-repeat, `B` deshabilitado si `bindings.b` es `null`, `releaseAll()` en blur/visibilidad/cleanup.
4. Completar `touch-controls.tsx` con el D-pad: dirección por posición, zona muerta, deslizamiento entre direcciones y auto-repeat.
5. Estilos de `.touch-controls`, `.dpad` y `.tbtn` en `app/globals.css` con la estética neón y los bloqueos de scroll/zoom/selección. Renderizar `<TouchControls>` en `components/player.tsx` cuando `useTouchMode()` y el juego está registrado. Manual: Snake y Tetris jugables con toque en 390×844.
6. HUD compacto y paddings reducidos en `@media (max-width: 600px)`. Manual: en 390×844 HUD, CRT y controles caben sin scroll.
7. Bloque Buster: `pointermove` + toque sin arrastre en `games/bloque-buster/input.ts` y `touchAction: "none"` en su canvas. Manual: arrastrar mueve el paddle sin lanzar; un toque lanza; con mouse, mover y clic siguen igual.

## Acceptance criteria

- [ ] `npm run build`, `npx tsc --noEmit` y `npx eslint app components lib games` terminan sin errores.
- [ ] `git diff main --stat` no incluye `games/types.ts`, `games/registry.ts`, ningún `engine.ts` ni `games/{asteroids,tetris,snake}/input.ts`.
- [ ] En escritorio (sin toque, 1280×800), `/juegos/<id>/jugar` de los 4 juegos no muestra `.touch-controls` y el HUD se ve igual que en `main`.
- [ ] `/juegos/<id>/jugar` no muestra errores ni warnings de hidratación en la consola, con y sin `av_touch` en `sessionStorage`.
- [ ] En un contexto táctil (Playwright `hasTouch`, 390×844), tocar la Home y luego entrar a `/juegos/snake/jugar` muestra `.touch-controls` sin necesidad de tocar otra vez.
- [ ] En un contexto táctil sin la marca, entrar directo a `/juegos/snake/jugar` no muestra controles; el primer toque en la página los muestra.
- [ ] Un juego no registrado (p. ej. `/juegos/gloton/jugar`) no muestra `.touch-controls` aunque exista la marca.
- [ ] En 390×844 con controles visibles y scroll en 0, el borde inferior de `.touch-controls` queda dentro del viewport y no hay scroll horizontal.
- [ ] La sección muestra el D-pad a la izquierda y `A`/`B` a la derecha; en Bloque Buster y Snake `B` está atenuado y `disabled`.
- [ ] Tocar `A` despacha `keydown` y `keyup` con `code: "Space"` en `window` (verificable con un listener en la consola).
- [ ] Mantener `◀` en Tetris mueve la pieza una vez y, pasados ~170 ms, sigue moviéndose hasta soltar.
- [ ] Deslizar el dedo de `▶` a `▲` sin levantarlo en Snake gira la serpiente hacia arriba.
- [ ] Soltar el dedo en la zona muerta del D-pad no deja ninguna dirección pulsada.
- [ ] Asteroids: mantener `◀` y a la vez tocar `A` repetidas veces gira la nave y dispara; `B` y `▲` dan impulso.
- [ ] Tetris: `▲` y `B` rotan, `▼` hace soft drop, `A` hace hard drop.
- [ ] Bloque Buster: `◀`/`▶` mueven el paddle y `A` lanza la pelota.
- [ ] Bloque Buster: arrastrar el dedo sobre el canvas mueve el paddle, no desplaza la página y no lanza la pelota; un toque sin arrastre la lanza.
- [ ] Bloque Buster con mouse en escritorio: mover el mouse mueve el paddle y el clic lanza, igual que antes.
- [ ] En game over, `A` reinicia la partida en los 4 juegos.
- [ ] Con PAUSA activa, el D-pad y `A` no mueven nada; al reanudar, no hay acciones acumuladas aplicadas de golpe.
- [ ] Mantener pulsado cualquier control no abre el menú contextual, no selecciona texto y no hace zoom; doble toque sobre los controles no hace zoom.
- [ ] Mantener `◀` y cambiar de pestaña: al volver, la nave/pieza/paddle no sigue moviéndose sola.
- [ ] Mantener `◀` y pulsar SALIR: en `/juegos/<id>` no queda ninguna tecla "pegada" y Espacio desplaza la página normalmente.
- [ ] Con sesión, el game over en móvil envía exactamente 1 `POST /api/scores` y muestra la línea de estado de SPEC 07.

## Decisions

- **Yes:** un solo esquema de control para los 4 juegos. Decisión del usuario: "que sea igual para todos los juegos".
- **Yes:** sección de controles debajo del canvas, fuera del CRT. Decisión del usuario (canvas arriba, controles abajo).
- **No:** controles superpuestos sobre el canvas. Taparían parte del juego en una pantalla ya chica.
- **Yes:** D-pad + 2 botones `A`/`B`. Decisión del usuario.
- **Yes:** D-pad a la izquierda, botones a la derecha. Convención de gamepad; decisión del usuario.
- **Yes:** `A` = `Space` en todos; `B` = secundaria (`KeyW` impulso en Asteroids, `KeyX` rotar en Tetris), atenuado donde no aplica. Decisión del usuario.
- **No:** etiquetas por juego en los botones. Se eligió mapeo genérico `A`/`B`.
- **Yes:** `KeyW` y no `ArrowUp` para `B` en Asteroids. Si `▲` y `B` están sostenidos a la vez, soltar uno no corta el impulso del otro.
- **Yes:** eventos de teclado sintéticos en `window`. Decisión del usuario: cero cambios en motores, `input.ts` y contrato común.
- **No:** API táctil en cada `input.ts` y prop nueva en `GameCanvasProps`. Toca los 4 juegos y el contrato de SPEC 05 sin ganancia funcional.
- **Yes:** auto-repeat 170 ms / 50 ms con `repeat: true`. Decisión del usuario; Tetris necesita repetición para mover y Snake/Bloque Buster ya ignoran `repeat`.
- **Yes:** D-pad único con deslizamiento y zona muerta. Decisión del usuario; clave para Snake.
- **No:** 4 botones independientes en el D-pad.
- **Yes:** detección al primer toque. Decisión del usuario.
- **No:** media query `pointer: coarse`. Descartada por el usuario.
- **Yes:** marca en `sessionStorage` + listener global en el layout. Decisión del usuario: el toque en JUGAR ya cuenta antes de entrar al reproductor.
- **No:** `localStorage` permanente ni re-detección por partida.
- **Yes:** `useSyncExternalStore` con snapshot de servidor `false`. Evita mismatch de hidratación con `cacheComponents`.
- **Yes:** HUD compacto en `max-width: 600px`. Decisión del usuario; objetivo verificable: todo visible en 390×844 sin scroll.
- **Yes:** solo vertical como objetivo. Decisión del usuario.
- **Yes:** bloquear scroll/zoom/selección/menú contextual solo en la sección de controles (y en el canvas de Bloque Buster). Decisión del usuario; el resto de la página se desplaza normal.
- **Yes:** arrastre del paddle en Bloque Buster con pointer events. Decisión del usuario; único cambio en un `input.ts`.
- **Yes:** toque sin arrastre (< 10 px) para lanzar en lugar de `click`. Evita lanzar la pelota al terminar un arrastre.
- **No:** vibración y pantalla completa. No elegidos por el usuario.
- **Yes:** pausa solo en el HUD. El usuario pidió "un par de botones"; PAUSA ya está en el HUD.
- **Yes:** `tabIndex={-1}` en los controles táctiles. No interfieren con el foco ni con Espacio sobre botones del HUD.

## Risks

| Risk                                                                    | Mitigation                                                                                                |
| ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Tecla "pegada" si se pierde el `pointerup` (cambio de pestaña, SALIR)   | `releaseAll()` en `pointercancel`, `lostpointercapture`, `blur`, `visibilitychange` y cleanup; criterios. |
| Algún `input.ts` depende de propiedades que el evento sintético no trae | Se despachan `code`, `key`, `repeat`, `bubbles` y `cancelable`; los `input.ts` actuales solo leen esas.   |
| Mismatch de hidratación por leer `sessionStorage` en render             | `useSyncExternalStore` con snapshot de servidor `false`; criterio en consola.                             |
| Doble toque hace zoom o el arrastre desplaza la página                  | `touch-action: none` en controles y en el canvas de Bloque Buster.                                        |
| El fin de un arrastre en Bloque Buster lanza la pelota                  | Lanzar solo si el puntero se movió < 10 px entre `pointerdown` y `pointerup`.                             |
| `sessionStorage` no disponible                                          | `try/catch`; el modo táctil vive en memoria durante la página.                                            |
| HUD + CRT + controles no caben en 390×844                               | Paddings reducidos bajo 600 px; criterio medido con Playwright.                                           |
| Multitouch: un dedo suelta lo que pulsa otro                            | Estado por `pointerId`; cada puntero solo suelta su propio `code`.                                        |
| Laptop táctil muestra controles en escritorio                           | Aceptado: es la semántica de "al primer toque". No afecta al teclado.                                     |

## What is **not** in this spec

- Layout horizontal dedicado.
- Controles sobre el canvas y gestos swipe.
- Etiquetas de botón por juego.
- Vibración y pantalla completa.
- Pausa en la sección táctil.
- Toggle manual y persistencia permanente.
- Mapeo configurable o Gamepad API.
- Pausa automática por visibilidad.
- Cambios en el contrato común de juegos, motores o `input.ts` de Asteroids, Tetris y Snake.
- Rediseño del HUD en escritorio.

Cada uno, si se hace, va en su propio spec.
