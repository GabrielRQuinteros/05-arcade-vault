---
name: add-game
description: Integra un juego nuevo a Arcade Vault desde una referencia en references/started-games/. Analiza el JS de referencia y luego delega al skill /spec para crear la spec completa con su proceso guiado habitual (preguntas, secciones, guardado).
argument-hint: "<game-id> <ref-folder>  — ej: tetris 03-tetris"
allowed-tools: Read, Glob, Grep, Bash(ls:*), Bash(date:*), Skill
---

# /add-game — Análisis de juego + entrega a /spec

## Contexto de sesión

Fecha de hoy:
!`date +%F`

Specs existentes:
!`ls specs/ 2>/dev/null || echo "La carpeta specs/ no existe todavía"`

---

## Propósito

Este skill hace el trabajo técnico de leer y entender el juego de referencia, construye un contexto rico con todo lo encontrado, y luego **invoca el skill `/spec`** para que lleve el proceso de escritura con su flujo habitual (preguntas de clarificación, secciones, guardado). La spec resultante pasa exactamente por el mismo proceso que todas las demás specs del proyecto.

**Este skill no escribe la spec ni código.** Solo prepara el análisis y traspasa el control.

---

## Restricciones del patrón (invariantes para todos los juegos)

Internaliza estas reglas antes de analizar la referencia. Son decisiones ya tomadas en SPEC 05 y SPEC 07; no se renegocian:

- **Canvas-only:** un único `<canvas>` dentro de `.crt-screen`; sin sprites externos, sin sonido, sin archivos en `public/`.
- **HUD React fijo:** `.player-hud` NO cambia nunca — 4 stats (Jugador, Puntuación, Vidas, Nivel) y 3 botones (PAUSA / FIN / SALIR). Valores propios del juego solo en el canvas.
- **`GameSnapshot` genérico:** `{ score, lives, level, state }` donde `state = "playing" | "dead" | "gameover"`. Sin campos específicos del juego.
- **Motor sin globales:** clase exportada con `start/pause/resume/endGame/restart/destroy`.
- **Colores del canvas:** hex copiados de `app/globals.css`, nunca leídos en runtime.
- **Consistencia de IDs:** el `game-id` debe coincidir en `lib/games.ts`, `games/registry.ts` y la columna `id` de `public.games` (Supabase, sembrada en SPEC 07).
- **`playable = true` en Supabase:** necesario para habilitar `/api/scores`. Puede requerir un `UPDATE` si la fila ya existe con `playable = false`, o un `INSERT` si no existe.

---

## Fase A — Análisis técnico

### A1. Validar argumentos

Si `$ARGUMENTS` está vacío, pide al usuario:

- `game-id`: slug único (ej. `tetris`), que coincidirá con el `id` en `lib/games.ts`.
- `ref-folder`: nombre exacto de la carpeta en `references/started-games/` (ej. `03-tetris`).

Verifica que `references/started-games/<ref-folder>/` existe. Si no existe, detente y avisa al usuario.

### A2. Leer el juego de referencia

Lee todos los archivos relevantes:

```
references/started-games/<ref-folder>/
  index.html    ← dimensiones del canvas, scripts cargados
  game.js       ← lógica principal (siempre existe)
  levels.js     ← si existe (niveles externos)
  style.css     ← si existe (colores del original)
```

### A3. Leer el patrón existente

Lee estos archivos para entender qué ya existe en el proyecto:

```
games/types.ts                     ← GameSnapshot, GameHandle, GameCanvasProps
games/registry.ts                  ← cómo se registran los juegos
games/asteroids/constants.ts       ← formato de PALETTE y constantes físicas
games/asteroids/engine.ts          ← estructura del motor (clase, métodos, emitSnapshot)
games/asteroids/asteroids-canvas.tsx  ← patrón del componente canvas
lib/games.ts                       ← tipo Game y array GAMES, entradas actuales
specs/05-juego-asteroids.md        ← spec de referencia (estructura, decisiones, criterios)
```

### A4. Construir el contexto técnico

Extrae y organiza toda la información necesaria para que `/spec` pueda trabajar sin ambigüedades. El contexto debe incluir:

**Dimensiones y resolución:**

- Ancho y alto lógico del canvas (de `index.html` o constantes en `game.js`)

**Entidades del juego:**

- Por cada clase u objeto con lógica propia: nombre, campos de estado, mecánica central, si tiene flag `dead` o equivalente
- Separar las que se portan de las que no (ej. efectos de sonido, sprites)

**Estado de la partida:**

- Variables equivalentes a `score`, `lives`, `level`, `state`
- Cómo transiciona entre estados (inicio, game over, pausa, cambio de nivel)

**Input:**

- Teclas usadas en la referencia → acciones
- Qué teclas agregar (WASD, P/Esc para pausa) según el patrón del proyecto

**Scoring:**

- Cómo se suma el puntaje (eventos, fórmulas, tablas)

**Mecánicas centrales (In):**

- Lista concreta de lo que se porta: colisiones, generación de niveles, power-ups, etc.

**Mecánicas fuera de scope (Out):**

- Sonido, assets externos, red, localStorage, controles táctiles
- Cualquier mecánica del original que no se porta en esta spec

**Decisiones ya tomadas (invariantes del patrón):**

- Canvas-only sin assets, HUD fijo, GameSnapshot genérico, motor sin globales, colores hex

**Propuesta de entrada en `lib/games.ts`:**

- `id`, `title` (mayúsculas), `short`, `long`, `cat`, `cover`, `color`

**Paleta del canvas:**

- Asignar cada elemento visual a un color de la paleta neón: `--cyan #00f5ff`, `--magenta #ff006e`, `--yellow #f5ff00`, `--green #00ff88`, `--ink #e6e9ff`
- Criterio: jugador/nave = cyan; obstáculos/enemigos = magenta; proyectiles/activos = yellow; power-ups = green

---

## Fase B — Invocar /spec

Una vez que tengas el análisis completo de la Fase A, carga y ejecuta el skill `/spec` usando `Skill`:

```
Skill({ skill: "spec", args: "<descripción de una sola oración del juego a integrar>" })
```

La descripción que pasas como args debe ser una sola oración concisa, por ejemplo:

> "Portar Tetris desde `references/started-games/03-tetris/game.js` al motor de Arcade Vault como juego canvas jugable con puntuaciones reales"

**Inmediatamente después de invocar el skill**, provee todo el contexto técnico de la Fase A como respuesta pre-cargada para las fases de `/spec`:

- En la **Fase 1** de `/spec` (entender contexto): el análisis técnico ya responde qué archivos cambian, cuál es el primer paso ejecutable y cuál es el último.
- En la **Fase 2** de `/spec` (preguntas): presenta el análisis como "lo que ya sabemos" antes de que `/spec` pregunte. Muchas preguntas ya tienen respuesta; `/spec` solo necesita preguntar las que quedan abiertas (decisiones del usuario sobre scope, naming, mecánicas opcionales, etc.).
- `/spec` continúa con su **Fase 3** (escritura) y **Fase 4** (guardado) de forma normal.

**El skill `/spec` es el único que escribe y guarda el archivo de la spec.** No interfieras con su flujo de guardado ni dupliques el archivo.

---

## Reglas estrictas

- **No escribas la spec directamente.** El análisis es tuyo; la escritura y el guardado son de `/spec`.
- **No escribas código.** Ni en la Fase A ni al delegar a `/spec`.
- **Si el juego de referencia no existe**, detente inmediatamente y avisa al usuario antes de continuar.
- **Mantén el idioma** de los specs existentes (español en este proyecto).
- **Las restricciones del patrón son invariantes.** No las presentes como opciones en las preguntas de `/spec`; preséntarlas como decisiones ya tomadas para que `/spec` las registre en la sección Decisions.

## Argumento

`$ARGUMENTS` tiene el formato `<game-id> <ref-folder>`. Si viene vacío, pide ambos valores antes de continuar con la Fase A.
