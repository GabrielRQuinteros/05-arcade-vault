# Rendimiento — Snake (`/juegos/snake/jugar`)

> **Fecha:** 2026-11-25
> **Procedimiento:** SPEC 12 (`specs/12-rendimiento-frogger.md`)
> **Resultado:** ya cumplía las metas. No se cambió código.

## Condiciones

- Build `next build --profile` + `next start` (puerto 3000).
- Chromium headed de Playwright MCP, contexto 390×844, `deviceScaleFactor: 3`, `hasTouch`, `isMobile`.
- CDP `Emulation.setCPUThrottlingRate` `rate: 4`.
- Espera de 2 s (fin de LISTO, 1 s) antes de medir; 10 s por escenario; 3 corridas, mediana.
- JS por frame: `requestAnimationFrame` envuelto con `addInitScript`, mide la duración de cada callback (motor incluido).

## FPS

| Escenario                                         | FPS medio (corridas)           | Frames > 33 ms | JS por frame (mediana / p95) |
| ------------------------------------------------- | ------------------------------ | -------------- | ---------------------------- |
| Sin input (la serpiente choca a ~2 s → GAME OVER) | 139,5 / 78,9 / 75,1 → **78,9** | **0,25 %**     | —                            |
| Activo (giros cada 400 ms, serpiente viva)        | 78,9 / 84,1 / 74,4 → **78,9**  | **0,13 %**     | 0,3 ms / 2,6 ms              |

- La pantalla del equipo refresca a más de 60 Hz, así que el headed no tiene techo de 60 FPS. La primera corrida (139,5) es ruido del headed. Todas las corridas superan 55 FPS.
- No hizo falta un A/B en headless porque no hubo cambios de motor.

## React

| Escenario                                                | Commits `app` / `player` | `onSnapshot` | Commits solo `app` | `actualDuration` máx.  | Mediana |
| -------------------------------------------------------- | ------------------------ | ------------ | ------------------ | ---------------------- | ------- |
| Reposo (GAME OVER asentado, 10 s)                        | 0 / 0                    | 0            | 0                  | —                      | —       |
| Activo A (giros cada 400 ms)                             | 1 / 1 (mediana)          | 1            | 0                  | 5,6–7,1 ms (game over) | —       |
| Activo B (Espacio + giros cada 400 ms: muere y reinicia) | 5 / 5 (mediana)          | 5            | 0                  | 4,7–9,0 ms             | 2,5 ms  |

- Commits de `player` = llamadas a `onSnapshot` en todas las corridas. Ningún commit de layout por su cuenta.
- Los commits > 4 ms son todos cambios de `state` (`gameover` ↔ `playing`): montan o desmontan la línea de guardado y cambian FIN ↔ JUGAR DE NUEVO. Es la excepción aceptada en SPEC 12, más el ruido del throttling (el mismo tipo de commit va de 0,2 a 4,7 ms). En la prueba la puntuación quedó en 0, así que no hubo commits por cambio de score. Los fixes de SPEC 12 (`HudStats` aislado) ya cubren ese caso.
- **No supera el umbral** fuera de la excepción. No se cambió React.

## Auditoría estática (`games/snake/engine.ts`)

| Chequeo               | Hallazgo                                                                                                                                                         | Coste             |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| `shadowBlur`          | Solo la cabeza (`:578`, blur 14). Con el fallback sin hoja de sprites, también la fruta y la bonus (`:530`), máx. 3 elementos                                    | 1 glow/frame      |
| Fondo estático        | Grilla de 48 líneas en un solo `stroke` + `strokeRect` del borde (`:481-499`), redibujados cada frame                                                            | 1 path/frame      |
| Formas repetidas      | Cuerpo: un `roundRect` + `fill` por segmento con `globalAlpha` variable (`:557-571`); ojos: 2 `arc`                                                              | N segmentos       |
| Allocations           | `drawStrip` crea strings (`String(...)`, `toFixed`) por frame (`:443-454`); `{...}` de ojos y el array `[-1, 1]` (`:592-596`); `drain()` devuelve un array nuevo | menores           |
| Texto                 | 4–6 `fillText` sin glow, sin `measureText`                                                                                                                       | bajo              |
| Lecturas de píxeles   | Ninguna                                                                                                                                                          | —                 |
| `onSnapshot`          | Solo emite si cambia algún campo (`:262-281`)                                                                                                                    | ok                |
| Fuente de `drawImage` | `HTMLImageElement` (PNG 3790×442, recorte 160 px → 21 px) para la fruta y la bonus (`:513`). Es una imagen decodificada, no un `<canvas>`; sin regresión medida  | 1–2/frame         |
| `dt` y loop           | rAF único, se cancela en `destroy()`. **`dt` sin tope de 50 ms** (`:224`); el tick está acotado a uno por frame (`:327-331`), así que no hay salto               | ok en la práctica |

## Fixes aplicados

- Ninguno. La línea base cumple: ≥ 55 FPS, ≤ 5 % de frames > 33 ms, React dentro del umbral salvo la excepción aceptada.

## Pendientes (no necesarios para las metas)

- `dt` sin tope de 50 ms (patrón SPEC 05). Con ticks acotados a uno por frame, el único efecto es que LISTO y el temporizador de la bonus pueden descontar más de 50 ms tras un frame largo. Si se corrige, es un cambio de reglas o temporización, no de rendimiento.
- Las allocations menores de `drawStrip` y de los ojos no aparecen en la medición (JS por frame: 0,3 ms de mediana).
