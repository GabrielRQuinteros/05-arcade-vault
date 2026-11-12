# SPEC 01 — Pantallas visuales del portal

> **Status:** Draft
> **Depends on:** —
> **Date:** 2026-11-12
> **Objective:** Implementar en Next.js las cinco pantallas de `references/templates/` (biblioteca, detalle, reproductor, acceso y salón de la fama) como UI estática con datos de ejemplo, sin lógica de juegos.

## Why this spec exists

Spec escrita a posteriori: el código ya estaba implementado cuando se redactó. Documenta lo construido para que los siguientes specs (juegos, persistencia, auth real) partan de una base explícita.

## Scope

**In:**

- Pantalla Biblioteca con búsqueda por nombre y filtro por categoría.
- Pantalla Detalle de juego con estadísticas y ranking de ejemplo.
- Pantalla Reproductor con HUD simulado, pausa, fin de juego y guardado de puntuación.
- Pantalla Acceso con pestañas iniciar sesión / crear cuenta e ingreso como invitado.
- Pantalla Salón de la Fama con podio y tabla por juego.
- Barra de navegación (con menú móvil) y pie de página compartidos.
- Sesión simulada guardada en `localStorage`.
- Datos de ejemplo de 8 juegos y puntuaciones generadas con semilla.

**Out of scope (for future specs):**

- Lógica real de cualquier juego (el reproductor solo simula puntaje).
- Backend, base de datos o autenticación real (Google/GitHub son botones sin acción).
- Rankings reales; las puntuaciones mostradas son ficticias.
- Lectura de las puntuaciones guardadas en `av_scores` desde el salón o el detalle.
- Rediseño visual: se respeta `references/templates/styles.css`, ya integrado en `app/globals.css`.

## Data model

```ts
// lib/games.ts
type Game = {
  id: string; // slug de URL, ej. "bloque-buster"
  title: string;
  short: string;
  long: string;
  cat: string; // "ARCADE" | "PUZZLE" | "SHOOTER" | "VERSUS"
  cover: string; // clase CSS, ej. "cover-bricks"
  color: "cyan" | "magenta" | "yellow" | "green";
  best: number;
  plays: string;
};
type ScoreRow = { rank: number; name: string; score: number; date: string };
```

Persistencia en `localStorage`:

- `av_user`: `{ name: string }` — sesión simulada.
- `av_scores`: `{ game, score, name, at }[]` — puntuaciones guardadas desde el reproductor (solo escritura).

Rutas:

- `/` — Biblioteca
- `/juegos/[id]` — Detalle
- `/juegos/[id]/jugar` — Reproductor
- `/auth` — Acceso
- `/salon` — Salón de la Fama

## Implementation plan

1. Crear `lib/games.ts` con `GAMES`, `CATS`, `seededScores`, `getGame` y `fmt`.
2. Crear `components/session.tsx` (contexto de sesión sobre `localStorage`) y `components/nav.tsx`.
3. Montar nav, sesión y pie en `app/layout.tsx`.
4. Crear `components/library.tsx` y usarlo en `app/page.tsx`.
5. Crear `app/juegos/[id]/page.tsx` con `generateStaticParams`.
6. Crear `components/player.tsx` y `app/juegos/[id]/jugar/page.tsx`.
7. Crear `app/auth/page.tsx`.
8. Crear `app/salon/page.tsx`.

## Acceptance criteria

- [ ] `npm run build` termina sin errores y genera `/`, `/auth`, `/salon` y las 8 rutas de detalle y jugar.
- [ ] `npx tsc --noEmit` y `npx eslint app components lib` no reportan errores.
- [ ] Buscar "caída" en la biblioteca muestra solo la tarjeta CAÍDA; una búsqueda sin coincidencias muestra "NO HAY RESULTADOS".
- [ ] Elegir la categoría SHOOTER muestra exactamente INVASORES y ROCAS.
- [ ] Clic en una tarjeta o en su botón JUGAR navega a `/juegos/<id>`.
- [ ] `/juegos/inexistente` devuelve 404.
- [ ] En el reproductor, PAUSA detiene el puntaje y muestra "EN PAUSA"; REANUDAR lo retoma.
- [ ] FIN abre el modal con la puntuación final; GUARDAR PUNTUACIÓN escribe en `av_scores` y muestra "PUNTUACIÓN GUARDADA".
- [ ] Entrar en `/auth` con usuario "kai" muestra "KAI" en la barra y vuelve a `/`; el nombre sigue tras recargar.
- [ ] Con sesión iniciada, el salón muestra la fila "TU MEJOR MARCA"; sin sesión no aparece.
- [ ] En ancho móvil aparece el botón ≡ y abre el panel de menú.

## Decisions

- **Yes:** rutas reales de App Router en lugar del router por hash del template. Permiten enlaces compartibles y respetan el stack.
- **No:** `#hash` con estado serializado. Era un recurso del prototipo con React por CDN.
- **Yes:** `generateStaticParams` en las rutas de juego. Con `cacheComponents` evita envolver `params` en Suspense.
- **Yes:** sesión con `useSyncExternalStore` sobre `localStorage`. Evita errores de hidratación sin `setState` en un effect.
- **Yes:** reutilizar `app/globals.css` sin cambios, ya que contiene todo el CSS del template.
- **Yes:** componentes cliente solo donde hay interacción (biblioteca, reproductor, nav, auth, salón); el detalle es componente servidor.
- **No:** Tailwind para estas pantallas. El template ya tiene su CSS completo y mezclar ambos duplicaría estilos.
- **No:** implementar los juegos. Cada juego irá en su propio spec.
- **Yes:** `Link` en lugar de `<a onClick>` para navegación, con clase `btn` donde el template usaba botón.

## Risks

| Risk                                                | Mitigation                                                                               |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `localStorage` bloqueado (modo privado)             | Lecturas y escrituras en `try/catch`; la app funciona sin sesión persistente.            |
| Cambios de Next 16 respecto a lo conocido           | Se verificó con `next build`; la guía de `cacheComponents` está en `node_modules/next/dist/docs/`. |
| Puntuaciones ficticias confundidas con datos reales | Quedan fuera de alcance; un spec de backend las reemplazará.                             |

## What is **not** in this spec

- Lógica de los 8 juegos.
- Autenticación real o proveedores OAuth.
- Backend y rankings reales.
- Mostrar en la UI las puntuaciones guardadas por el jugador.

Cada uno, si se hace, va en su propio spec.
