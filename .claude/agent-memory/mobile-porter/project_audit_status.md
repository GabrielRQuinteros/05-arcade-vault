---
name: project-audit-status
description: Estado de auditorías móviles por juego (fecha, resultado) y hallazgos recurrentes del reproductor
metadata:
  type: project
---

Auditorías SPEC 11:

- frogger — 2026-11-24 — ok sin cambios (`b: null`, D-pad 1 salto por pulsación, motor ignora `repeat`). 390×844 cabe sin scroll; 375×667 scroll vertical solo por footer.

Hallazgos recurrentes:

- Error dev en consola en TODOS los `/juegos/<id>/jugar`: "Next.js encountered URL data during prerendering" (`params` fuera de `<Suspense>` en la page, instant-shell). Pre-existente, no hidratación, fuera de alcance (`app/` page). **How to apply:** no atribuirlo al juego auditado; reportarlo como pendiente si sigue.
- Texto propio dibujado en canvas (800 lógicos → ~350 px en 390) queda ~0.44×; legibilidad depende del motor, no se corrige aquí.

Tips de Playwright:

- `touchscreen.tap` en y≈20 pega en el nav y navega: tocar el canvas para disparar la detección.
- D-pad sostenido/deslizado: CDP `Input.dispatchTouchEvent` (touchStart/Move/End). Mezclar con `p.touchscreen.tap` mientras hay un toque CDP activo falla: usar `el.click()` vía evaluate.
- Contextos nuevos con `browser.newContext` no tienen la sesión logueada → partidas de prueba como invitado, sin guardar scores.
- Variables `globalThis` no persisten entre llamadas a `browser_run_code_unsafe`: todo en un solo script.
