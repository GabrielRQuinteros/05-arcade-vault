---
name: add-game
description: Integra un juego nuevo a Arcade Vault. Dos modos — (1) portar una referencia de references/started-games/, o (2) crear un juego desde una descripción libre. Ambos aceptan opcionalmente una carpeta de assets (sprites, atlas, imágenes). Analiza/diseña el juego y genera la descripción (argumento) lista para pegar en /spec, cubriendo la creación del código del juego y su integración a la app. No escribe código ni la spec.
argument-hint: '<game-id> <ref-folder> [--assets <ruta>]  |  <game-id> --desc "<descripción>" [--assets <ruta>]'
allowed-tools: Read, Glob, Grep, Bash(ls:*), Bash(date:*), Bash(find:*), Bash(file:*), Bash(du:*)
---

# /add-game — Análisis/diseño de juego → descripción para /spec

## Contexto de sesión

Fecha de hoy:
!`date +%F`

Specs existentes:
!`ls specs/ 2>/dev/null || echo "La carpeta specs/ no existe todavía"`

Referencias disponibles:
!`ls references/started-games/ 2>/dev/null || echo "Sin referencias"`

---

## Propósito

Este skill hace el trabajo técnico previo a la spec de un juego nuevo:

- **Modo `ref`:** lee y entiende un juego de referencia existente en `references/started-games/`.
- **Modo `desc`:** diseña un juego nuevo a partir de una descripción del usuario (mecánicas, entidades, scoring, niveles), completando los huecos con propuestas concretas.
- **Assets (opcional, ambos modos):** inspecciona una carpeta de assets y decide cómo integrarlos al motor.

Con todo eso construye la **descripción (argumento) para `/spec`**, que el usuario pega y ejecuta manualmente (`/spec` no es invocable por el modelo: `disable-model-invocation: true`). Esa descripción pide una spec que cubra **ambas cosas**: (1) generar el código del juego (motor, constantes, componente canvas, sprites si hay assets) y (2) integrarlo a Arcade Vault (registro, catálogo, Supabase, puntuaciones). La spec resultante pasa por el mismo proceso guiado que todas las demás.

**Resultado final de este skill = la descripción para `/spec`.** No escribe la spec ni código. La implementación se hace después con `/spec-impl`.

---

## Argumentos y detección de modo

Formatos aceptados en `$ARGUMENTS`:

```
<game-id> <ref-folder> [--assets <ruta>]          → modo ref
<game-id> --desc "<descripción>" [--assets <ruta>] → modo desc
<game-id> "<descripción>" [--assets <ruta>]        → modo desc (si el 2º arg no es una carpeta de referencia)
```

Reglas:

1. Si `$ARGUMENTS` está vacío, pregunta al usuario: `game-id`, si parte de una referencia o de una descripción, y si tiene carpeta de assets.
2. Si el segundo argumento coincide con una carpeta de `references/started-games/` → **modo ref**.
3. Si viene `--desc` o el resto del texto no es una carpeta existente → **modo desc**. Si la descripción tiene menos de ~1 oración útil (ej. solo "un juego de naves"), pide más detalle antes de seguir.
4. `--assets <ruta>` es opcional en ambos modos. Verifica que la ruta existe; si no existe, detente y avisa.
5. Valida `game-id`: slug kebab-case, sin colisión con ids existentes en `lib/games.ts` / `games/registry.ts` (salvo que la fila ya exista en `lib/games.ts` como placeholder no jugable — en ese caso, reutilízala y avísalo).

---

## Restricciones del patrón (invariantes para todos los juegos)

Internaliza estas reglas antes de analizar/diseñar. Son decisiones ya tomadas en SPEC 05 y SPEC 07; no se renegocian:

- **Canvas único:** un único `<canvas>` dentro de `.crt-screen`; sin DOM extra para el juego.
- **Sin assets por defecto:** sin sprites externos, sin sonido, sin archivos en `public/`. **Excepción:** solo si el usuario pasa `--assets` (ver sección "Assets").
- **HUD React fijo:** `.player-hud` NO cambia nunca — 4 stats (Jugador, Puntuación, Vidas, Nivel) y 3 botones (PAUSA / FIN / SALIR). Valores propios del juego solo en el canvas.
- **`GameSnapshot` genérico:** `{ score, lives, level, state }` donde `state = "playing" | "dead" | "gameover"`. Sin campos específicos del juego.
- **Motor sin globales:** clase exportada con `start/pause/resume/endGame/restart/destroy`.
- **Colores del canvas:** hex copiados de `app/globals.css`, nunca leídos en runtime.
- **Consistencia de IDs:** el `game-id` debe coincidir en `lib/games.ts`, `games/registry.ts` y la columna `id` de `public.games` (Supabase, sembrada en SPEC 07).
- **`playable = true` en Supabase:** necesario para habilitar `/api/scores`. Puede requerir un `UPDATE` si la fila ya existe con `playable = false`, o un `INSERT` si no existe.

---

## Fase A — Análisis técnico

### A1. Validar argumentos

Aplica las reglas de "Argumentos y detección de modo". Anuncia en una línea el modo detectado y si hay assets.

### A2. Fuente del juego

**Modo ref** — lee todos los archivos relevantes:

```
references/started-games/<ref-folder>/
  index.html    ← dimensiones del canvas, scripts cargados
  game.js       ← lógica principal (siempre existe)
  levels.js     ← si existe (niveles externos)
  style.css     ← si existe (colores del original)
```

Si la carpeta no existe, detente y avisa.

**Modo desc** — diseña el juego a partir de la descripción:

- Extrae lo que el usuario dijo explícitamente (género, objetivo, controles, condición de derrota, estética).
- Completa lo no dicho con **propuestas concretas y justificadas**, marcadas como `[propuesta]` para que `/spec` las confirme en sus preguntas: resolución lógica, entidades, física/velocidades, progresión de niveles, fórmula de puntaje, vidas iniciales.
- Mantén el alcance de un MVP jugable (una partida completa con game over y puntaje). Lo ambicioso va a "Out" como futuro.
- Diseño propio: si la descripción se parece a un juego comercial concreto, toma el género/mecánica pero usa nombre, niveles y arte propios.
- Usa las specs existentes (`specs/05`, `08`, `09`) como referencia de nivel de detalle: el diseño debe quedar tan concreto como si hubiera un `game.js` detrás.

### A3. Assets (solo si se pasó `--assets`)

1. Lista la carpeta (`find <ruta> -type f`, `du -sh`) y clasifica: imágenes (png/jpg/svg/gif/webp), atlas/mapas de sprites (js/json), audio, fuentes, otros.
2. **Mira las imágenes** con `Read` (es multimodal) para entender qué contienen: personajes, items, tiles, fondos, frames de animación.
3. Lee atlas/mapas (`sprites.js`, `*.json`) y extrae: archivo fuente, nombres de sprites, coordenadas `{x,y,w,h}`, tamaño de la hoja, transparencia.
4. Anota el origen/licencia si aparece (comentarios, README). Si los assets vienen de un juego comercial o de origen desconocido, márcalo como pregunta abierta para `/spec` (uso permitido / solo local).
5. Propón el plan de integración:
   - **Ubicación:** copiar a `public/games/<game-id>/` (rutas servidas como `/games/<game-id>/...`).
   - **Atlas:** convertir el mapa global (`window.SPRITE_ATLAS`, etc.) a un módulo TS tipado en `games/<game-id>/sprites.ts` — sin globales.
   - **Carga:** precarga de `HTMLImageElement` en el motor antes de `start()` (promesa); el loop no arranca hasta tener las imágenes; `destroy()` libera referencias.
   - **Fallback:** si una imagen falla, dibujar la entidad con primitivas de canvas y la paleta neón (el juego nunca queda injugable).
   - **Mapeo:** tabla entidad → sprite(s) usados; sprites del atlas que no se usan van a "Out".
   - **Audio:** si hay audio, NO se integra por defecto; preséntalo como pregunta opcional a `/spec`.
   - Escalado: `imageSmoothingEnabled = false` para pixel art; tamaño de dibujo en unidades lógicas del canvas.
6. Los assets **reemplazan** la regla "sin assets" solo para este juego; todas las demás invariantes siguen vigentes (HUD, snapshot, motor sin globales, etc.).

### A4. Leer el patrón existente

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

En modo desc, lee además la spec más parecida en género a lo descrito (ej. `08-juego-tetris.md` para grid/puzzle, `09-juego-bloque-buster.md` para física de pelota).

### A5. Construir el contexto técnico

Extrae (modo ref) o define (modo desc) toda la información necesaria para que `/spec` pueda trabajar sin ambigüedades. El contexto debe incluir:

**Origen:**

- Modo (`ref` / `desc`), fuente (carpeta o descripción literal del usuario), carpeta de assets si hay.

**Dimensiones y resolución:**

- Ancho y alto lógico del canvas (de `index.html`/`game.js`, o propuesto en modo desc)

**Entidades del juego:**

- Por cada clase u objeto con lógica propia: nombre, campos de estado, mecánica central, si tiene flag `dead` o equivalente
- Separar las que se portan/implementan de las que no
- Si hay assets: sprite asignado a cada entidad

**Estado de la partida:**

- Variables equivalentes a `score`, `lives`, `level`, `state`
- Cómo transiciona entre estados (inicio, game over, pausa, cambio de nivel)

**Input:**

- Teclas → acciones (de la referencia o propuestas)
- Qué teclas agregar (WASD, P/Esc para pausa) según el patrón del proyecto

**Scoring:**

- Cómo se suma el puntaje (eventos, fórmulas, tablas)

**Mecánicas centrales (In):**

- Lista concreta de lo que se implementa: colisiones, generación de niveles, power-ups, etc.

**Mecánicas fuera de scope (Out):**

- Sonido (salvo que el usuario lo pida), red, localStorage, controles táctiles
- Assets externos si no se pasó `--assets`
- Cualquier mecánica del original o de la descripción que no entra en este MVP

**Decisiones ya tomadas (invariantes del patrón):**

- Canvas único, HUD fijo, GameSnapshot genérico, motor sin globales, colores hex
- Sin assets — o, si hay `--assets`, el plan de integración de A3 (ubicación, atlas TS, precarga, fallback)

**Propuesta de entrada en `lib/games.ts`:**

- `id`, `title` (mayúsculas), `short`, `long`, `cat`, `cover`, `color`

**Paleta del canvas:**

- Asignar cada elemento visual a un color de la paleta neón: `--cyan #00f5ff`, `--magenta #ff006e`, `--yellow #f5ff00`, `--green #00ff88`, `--ink #e6e9ff`
- Criterio: jugador/nave = cyan; obstáculos/enemigos = magenta; proyectiles/activos = yellow; power-ups = green
- Con assets: la paleta aplica a lo que no tiene sprite (fondo, UI del canvas, fallback, efectos)

**Preguntas abiertas para `/spec`:**

- Todo lo marcado `[propuesta]` en modo desc
- Licencia/origen de assets, audio, sprites no mapeados

---

## Fase B — Generar la descripción para /spec

`/spec` no puede invocarse desde este skill (`disable-model-invocation: true`). El entregable final es **un único bloque de texto listo para pegar** como argumento de `/spec`. Como el usuario lo pega en una invocación nueva, la descripción debe ser **autocontenida**: todo lo relevante de la Fase A va dentro.

### Formato de salida

Imprime exactamente esto (y nada de código):

````
```
/spec <Oración principal>

Alcance — generación del código del juego:
- games/<game-id>/constants.ts — resolución lógica, PALETTE (hex de globals.css), constantes de física/velocidades
- games/<game-id>/engine.ts — clase sin globales con start/pause/resume/endGame/restart/destroy y emitSnapshot
- games/<game-id>/<game-id>-canvas.tsx — componente canvas siguiendo el patrón de asteroids
- [si hay assets] games/<game-id>/sprites.ts (atlas tipado) + copia a public/games/<game-id>/, precarga y fallback a primitivas

Alcance — integración a Arcade Vault:
- games/registry.ts — registrar el juego
- lib/games.ts — entrada { id, title, short, long, cat, cover, color } (o reutilizar placeholder)
- Supabase public.games — fila con id = <game-id> y playable = true (INSERT o UPDATE)
- Puntuaciones reales vía /api/scores con el GameSnapshot genérico

Diseño del juego:
- Origen: <modo ref: carpeta | modo desc: descripción literal del usuario>
- Canvas: <ancho>x<alto> lógico
- Entidades: <nombre — estado — mecánica — sprite/color>
- Estados y transiciones: <inicio, playing, dead, gameover, pausa, cambio de nivel>
- Input: <tecla → acción, incl. WASD y P/Esc>
- Scoring: <eventos/fórmulas>
- Vidas iniciales / progresión de niveles: <...>
- Paleta: <elemento → color neón>

Decisiones ya tomadas (invariantes, no preguntar): canvas único en .crt-screen; HUD React fijo (Jugador/Puntuación/Vidas/Nivel + PAUSA/FIN/SALIR); GameSnapshot { score, lives, level, state }; motor sin globales; colores hex copiados de globals.css; <"sin assets ni sonido" | plan de assets de A3>.

Fuera de alcance: <sonido, red, localStorage, táctil, mecánicas descartadas, sprites no usados...>

Preguntas abiertas a confirmar: <cada [propuesta] de mayor impacto, licencia de assets, audio...>
```
````

### Reglas de la descripción

- **Oración principal** (una sola, primera línea): verbo de creación + qué juego + que se genera su código y se integra a Arcade Vault con puntuaciones reales. Ejemplos:
  > Modo ref: "Generar el juego Tetris portando `references/started-games/03-tetris/game.js` a un motor canvas propio e integrarlo a Arcade Vault como juego jugable con puntuaciones reales"
  >
  > Modo desc + assets: "Generar el juego original Snake Fruit (serpiente que come frutas en grid) usando los sprites de `references/snake/snake-assets/` e integrarlo a Arcade Vault como juego jugable con puntuaciones reales"
- Siempre incluir **las dos secciones de alcance** (generación de código + integración). Nunca solo una.
- Datos concretos, no genéricos: rellena todos los `<...>` con lo obtenido en la Fase A; elimina líneas que no apliquen (ej. sprites sin `--assets`).
- Mantén las marcas `[propuesta]` para que `/spec` las confirme en sus preguntas.
- Español, conciso, viñetas.

Tras el bloque, indica en una línea: "Pegá el bloque para ejecutar `/spec`; luego `/spec-impl <número-de-spec>`."

---

## Reglas estrictas

- **El resultado final es solo la descripción para `/spec`.** No intentes invocar `/spec` con `Skill` (no es invocable por el modelo).
- **No escribas la spec directamente.** El análisis es tuyo; la escritura y el guardado son de `/spec`, cuando el usuario lo ejecute.
- **No escribas código ni copies assets.** Copiar a `public/` es parte de la implementación (`/spec-impl`), no de este skill.
- **Si la referencia o la carpeta de assets no existe**, detente inmediatamente y avisa al usuario antes de continuar.
- **Mantén el idioma** de los specs existentes (español en este proyecto).
- **Las restricciones del patrón son invariantes.** No las presentes como opciones en las preguntas de `/spec`; preséntalas como decisiones ya tomadas para que `/spec` las registre en la sección Decisions. La única que cambia es "sin assets", y solo cuando se pasa `--assets`.
- **Modo desc no inventa en silencio:** toda decisión de diseño no dicha por el usuario va marcada `[propuesta]` y llega a `/spec` como pregunta o como decisión explícita confirmable.
