# SPEC 02 — Página de inicio (Home)

> **Status:** Accepted
> **Depends on:** SPEC 01
> **Date:** 2026-11-14
> **Objective:** Implementar en `/` la landing de `references/templates/home-about/home.jsx` y mover la Biblioteca a `/biblioteca`.

## Why this spec exists

El template `home-about` agrega una landing que pasa a ser la página principal. Eso desplaza la Biblioteca de `/` (SPEC 01) y obliga a revisar todos los enlaces que asumían que `/` era la Biblioteca.

## Scope

**In:**

- Página Home en `/` con las secciones del template, en este orden: hero con silhouettes flotantes, "¿POR QUÉ ARCADE VAULT?", "JUEGOS DISPONIBLES AHORA", estadísticas, "ACTIVIDAD EN VIVO", "PRECIOS" y CTA final.
- Textos copiados literalmente del template, incluidos "12+ JUEGOS", "Arkanoid, Tetris, Snake" y los jugadores y puntuaciones de ejemplo.
- Mini-rail con los primeros 6 juegos de `GAMES` (`lib/games.ts`). Cada tarjeta enlaza a `/juegos/<id>`.
- Biblioteca movida de `/` a `/biblioteca`, sin cambios funcionales.
- Link "Inicio" en el nav (escritorio y panel móvil), activo solo en `/`.
- Logo del nav enlaza a `/`.
- Link "Biblioteca" del nav enlaza a `/biblioteca` y queda activo en `/biblioteca` y `/juegos/*`.
- Botones "VOLVER AL VAULT" (detalle y reproductor) y "VOLVER A LA BIBLIOTECA" (salón) enlazan a `/biblioteca`.
- Animación `.reveal` con IntersectionObserver, igual al template.
- Con `prefers-reduced-motion: reduce`, `.reveal` se muestra sin animar y las silhouettes no flotan.
- Todo el CSS nuevo de `references/templates/home-about/styles.css` añadido a `app/globals.css`, incluidos los bloques de About y Gamepad.

**Out of scope (for future specs):**

- Página About / "Acerca de" y su formulario de contacto (SPEC 03).
- Link "Acerca de" en el nav.
- Usar el CSS de Gamepad en algún componente; solo se agrega a `globals.css`.
- Datos reales en "ACTIVIDAD EN VIVO", "TOP JUGADORES" y estadísticas.
- Abrir `/auth` directamente en la pestaña CREAR CUENTA.
- Adaptar los textos del template (cantidad real de juegos, quitar marcas de terceros).

## Data model

Esta feature no introduce estructuras de datos nuevas ni persistencia. Reutiliza `Game` y `GAMES` de SPEC 01.

Las filas de ejemplo de la home son constantes locales de `components/home.tsx`:

```ts
type Feature = { i: "GAMEPAD" | "FREE" | "TROPHY" | "ROCKET"; t: string; d: string; c: "cyan" | "magenta" | "yellow" | "green" };
type Stat = { n: string; u: string; s: string };
type Tick = { p: string; g: string; s: number; t: string; c: "cyan" | "magenta" | "yellow" | "green" };
type TopRow = { r: number; p: string; s: number };
```

Rutas tras esta spec:

- `/` — Home (nuevo)
- `/biblioteca` — Biblioteca (antes en `/`)
- `/juegos/[id]`, `/juegos/[id]/jugar`, `/auth`, `/salon` — sin cambios de ruta

Destinos de los CTAs de la home:

| Botón                                         | Destino          |
| --------------------------------------------- | ---------------- |
| EXPLORAR JUEGOS, VER TODOS LOS JUEGOS, INSERTAR MONEDA | `/biblioteca`    |
| CREAR CUENTA, EMPEZAR GRATIS                  | `/auth`          |
| VER SALÓN                                     | `/salon`         |
| Tarjeta del mini-rail                         | `/juegos/<id>`   |

## Implementation plan

1. Añadir a `app/globals.css` las líneas 930–1147 y 1150–1725 de `references/templates/home-about/styles.css` (el diff con `references/templates/styles.css` es solo aditivo). Agregar al final un bloque `@media (prefers-reduced-motion: reduce)` que deje `.reveal` visible sin transición y anule la animación de `.home-silos .silo`. La app sigue igual porque nadie usa aún esas clases.
2. Crear `app/biblioteca/page.tsx`, que renderiza `<Library />`. Manual: `/biblioteca` muestra la biblioteca; `/` sigue igual.
3. Cambiar `href="/"` por `href="/biblioteca"` en `app/juegos/[id]/page.tsx` (VOLVER AL VAULT), `components/player.tsx` (VOLVER AL VAULT) y `app/salon/page.tsx` (VOLVER A LA BIBLIOTECA). La redirección después del login en `app/auth/page.tsx` sigue yendo a `/`.
4. Crear `components/reveal.tsx` (componente cliente sin UI) que, al montarse, observa los `.reveal` del documento y les añade `in`, como `useReveal` del template.
5. Crear `components/home.tsx` (componente servidor) con hero, silhouettes y sección "¿POR QUÉ ARCADE VAULT?", que incluye `FeatureIcon`. Los botones del template pasan a `Link` con las mismas clases `btn`.
6. Añadir a `components/home.tsx` el mini-rail (`GAMES.slice(0, 6)`, cada `mini-card` como `Link` a `/juegos/<id>`), estadísticas y "ACTIVIDAD EN VIVO" con los datos de ejemplo literales.
7. Añadir a `components/home.tsx` "PRECIOS" (tarjeta y FAQ) y el CTA final. Montar `<Reveal />`.
8. Reemplazar `app/page.tsx` para que renderice `<Home />`.
9. Actualizar `components/nav.tsx`: logo a `/`, link "Inicio" a `/` (activo si `pathname === "/"`), y "Biblioteca" a `/biblioteca` (activo en `/biblioteca` y `/juegos/*`), tanto en escritorio como en el panel móvil.
10. (Agregado durante la implementación) Corregir el desborde horizontal del nav en móvil (≤840px): menos `gap`, logo en dos líneas fijo, botón de sesión compacto en ≤480px/≤360px con elipsis como último recurso. El template original tiene el mismo desborde (396px a 375px).

## Acceptance criteria

- [ ] `npm run build` termina sin errores y genera `/`, `/biblioteca`, `/auth`, `/salon` y las 8 rutas de detalle y jugar.
- [ ] `npx tsc --noEmit` y `npx eslint app components lib` no reportan errores.
- [ ] `/` muestra el título "EL ARCADE / CLÁSICO ESTÁ / DE VUELTA" y las secciones // 01 a // 04 más "¿LISTO PARA JUGAR?".
- [ ] El mini-rail muestra exactamente 6 tarjetas, empezando por BLOQUE BUSTER.
- [ ] Clic en una tarjeta del mini-rail navega a `/juegos/<id>`.
- [ ] EXPLORAR JUEGOS, VER TODOS LOS JUEGOS e INSERTAR MONEDA navegan a `/biblioteca`.
- [ ] CREAR CUENTA y EMPEZAR GRATIS navegan a `/auth`; VER SALÓN navega a `/salon`.
- [ ] `/biblioteca` conserva búsqueda y filtro: buscar "caída" deja solo CAÍDA.
- [ ] En el nav, "Inicio" está activo en `/` y "Biblioteca" está activo en `/biblioteca` y `/juegos/bloque-buster`.
- [ ] El logo del nav navega a `/`.
- [ ] El panel móvil (≡) incluye "Inicio" y "Biblioteca" con los mismos destinos.
- [ ] VOLVER AL VAULT (detalle y reproductor) y VOLVER A LA BIBLIOTECA (salón) navegan a `/biblioteca`.
- [ ] Iniciar sesión en `/auth` redirige a `/`.
- [ ] Al hacer scroll, cada sección `.reveal` pasa a opacidad 1.
- [ ] Con reduced-motion emulado, las secciones `.reveal` son visibles sin scroll y las silhouettes no se mueven.
- [ ] En ancho 375px no hay scroll horizontal en `/`.
- [ ] La consola del navegador no muestra errores de hidratación en `/`.

## Decisions

- **Yes:** solo Home en esta spec. About trae un formulario con estados propios y va en SPEC 03.
- **Yes:** Biblioteca en `/biblioteca`. La landing es la puerta de entrada, y la ruta en español sigue la convención de `/salon` y `/juegos`.
- **No:** Biblioteca en `/juegos`. Es más consistente con `/juegos/[id]`, pero se prefirió un nombre explícito.
- **No:** Home en `/inicio`. Dejaría la landing fuera de la página principal.
- **Yes:** textos literales del template, incluidos "12+" y marcas de terceros. Decisión del usuario: fidelidad al diseño. Adaptarlos queda para otra spec.
- **Yes:** copiar todo el CSS nuevo, incluidos About y Gamepad. Deja `globals.css` alineado con el template y evita otro merge de CSS en SPEC 03.
- **Yes:** después del login se va a `/` (Home). Los botones de "volver" van a `/biblioteca` porque su texto habla del vault o de la biblioteca.
- **No:** `/auth?tab=registro`. Con `cacheComponents`, `useSearchParams` obliga a envolver la página de acceso en Suspense; no compensa por ahora.
- **Yes:** Home como componente servidor y un `Reveal` cliente aparte. Solo el observer necesita JS; el resto se renderiza en el servidor.
- **Yes:** `Link` en lugar de `button onClick={navigate}`, igual que en SPEC 01.
- **Yes:** respetar `prefers-reduced-motion`. Es un bloque CSS chico y evita contenido invisible o movimiento forzado.
- **No:** Tailwind para la home. Se mantiene el CSS del template, como en SPEC 01.
- **Yes:** corregir en esta spec el desborde del nav a 375px (venía del template y afectaba a todas las rutas). Decisión del usuario durante la implementación.

## Risks

| Risk                                                       | Mitigation                                                                                               |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Enlaces que siguen apuntando a `/` pensando en la Biblioteca | El paso 3 lista todos los `href="/"` actuales (encontrados con grep); el criterio de "volver" los verifica. |
| `.reveal` deja secciones invisibles si el JS falla         | Las secciones siguen en el DOM; con reduced-motion se muestran siempre. Se acepta el resto del caso degradado. |
| Choque de nombres entre el CSS nuevo y el existente        | El diff es solo aditivo; verificar visualmente `/biblioteca`, `/salon` y `/auth` después del paso 1.       |
| Marcas de terceros en el texto ("Arkanoid, Tetris")        | Aceptado por decisión del usuario; queda anotado para una spec de copy.                                  |

## What is **not** in this spec

- Página About, formulario de contacto y link "Acerca de".
- Componentes que usen el CSS de Gamepad.
- Datos reales de actividad, ranking o estadísticas.
- Pestaña de registro preseleccionada en `/auth`.
- Cambios en los textos del template.

Cada uno, si se hace, va en su propio spec.
