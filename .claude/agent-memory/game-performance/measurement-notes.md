---
name: measurement-notes
description: Juegos ya medidos (FPS base/final, estado) y trucos/ruido del procedimiento SPEC 12 con Playwright en este equipo
metadata:
  type: project
---

Juegos medidos:

- frogger (2026-11-25): 45,8 → 56,7 FPS, corregido (fondo + sprites `ImageBitmap`, HUD aislado en player.tsx). Sprites en `<canvas>` = regresión (~29 FPS).
- snake (2026-11-25): ~79 FPS, 0,1–0,25 % de tirones, ya cumplía, sin cambios. Informe en `specs/perf/snake.md`. Solo 1 glow (la cabeza).

Trucos y ruido:

- La pantalla del equipo refresca a más de 60 Hz: el headed da 75–140 FPS sin techo, y la 1.ª corrida suele ser un outlier alto.
- Para tener varios contextos en la misma sesión, usar `page.context().browser().newContext({...390x844, dpr 3, hasTouch, isMobile})` dentro de `browser_run_code_unsafe`, y `ctx.newCDPSession(p)` para el throttle.
- JS por frame: envolver `requestAnimationFrame` con `addInitScript` y medir cada callback.
- Al envolver JSX en `app/layout.tsx` con un script de node, ojo con los CRLF: el `replace` de `"<X>\n"` falla. Usar `sed 's|<X>\r\?$|...|'`.
- Para quitar los temporales: `git checkout --` de layout/page/player + borrar `render-profiler.tsx`, y luego `npm run build` sin `--profile`.
- Snake sin input muere a ~2 s. Con giros en cuadrado sigue viva pero casi no puntúa, así que para generar snapshots usar Espacio (muere/reinicia). Esos commits son de game over (excepción aceptada).
- Los commits de cambio de `state` (game over ↔ jugando) miden 4–9 ms con 4×: es la excepción aceptada por el usuario en SPEC 12.
