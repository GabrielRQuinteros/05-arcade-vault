---
name: spec-impl-game
description: Implementa una spec aprobada de un juego siguiendo exactamente /spec-impl (validación de estado, branch spec-NN-slug, pasos con pausas) y, al terminar el último paso, lanza el agente mobile-porter para auditar y portar el juego a móvil (SPEC 11).
disable-model-invocation: true
argument-hint: <NN-spec-name>
allowed-tools: Read, Glob, Grep, Edit, Write, AskUserQuestion, Agent, SendMessage, Bash(git status:*), Bash(git branch:*), Bash(git checkout:*), Bash(git log:*), Bash(git diff:*), Bash(git stash:*), Bash(git add:*), Bash(git commit:*), Bash(git show:*), Bash(cat:*), Bash(ls:*)
---

# /spec-impl-game — /spec-impl + mobile-porter

## Contexto de sesión

Estado del repo:
!`git status --short`

Branch actual:
!`git branch --show-current`

Specs disponibles:
!`ls specs/ 2>/dev/null || echo "La carpeta specs/ no existe"`

Config de workflow:
!`cat specs/.spec-config.yml 2>/dev/null || echo "Sin config — defaults: AutoCreateBranch: true, AutoCommitSteps: false"`

---

## Instrucciones

Fases en orden estricto. No avanzar si la anterior no terminó bien.

### Fases 1–4 — Igual que /spec-impl

1. Lee **completo** `.agents/skills/spec-impl/SKILL.md`.
2. Sigue sus **Fases 1–4 al pie de la letra** usando como argumento: `$ARGUMENTS` (el contexto de sesión de arriba equivale al suyo).
3. Todos sus bloqueos aplican igual: spec no encontrada, estado ≠ Aprobado, working tree sucio, resume de branch existente, pausa y confirmación tras cada paso, `AutoCommitSteps`, ambigüedades, fuera de scope. Si /spec-impl se detiene, este comando también se detiene (no se lanza el porter).
4. Responde al usuario en español.

### Fase 4.5 — Detectar el id del juego

Al terminar el último paso (mensaje "✅ Todos los pasos del plan están implementados" equivalente al de /spec-impl):

- Deriva el `id` del juego desde la spec y los cambios: carpeta `games/<id>/`, entrada en `GAME_COMPONENTS` (`games/registry.ts`), entrada en `lib/games.ts`. Usa `git diff --stat` / `git status --short` para confirmar.
- Si la spec **no** crea ni modifica un juego (`games/<id>/`): avísalo en una línea y termina sin lanzar el porter.
- Si hay varios ids posibles o duda: pregunta con `AskUserQuestion` antes de seguir.

### Fase 5 — Lanzar mobile-porter (automático)

Sin pedir confirmación, lanza el agente con la tool `Agent`:

- `subagent_type`: `"mobile-porter"`
- `description`: `"Portar <id> a móvil"`
- `prompt`:

  ```
  Juego(s): <id>
  Spec implementada: specs/<NN-slug>.md
  Branch activa: <branch>
  Contexto: juego recién implementado con /spec-impl-game. Corre Fase 0, checklist estático,
  auditoría Playwright (390×844 y 375×667 táctil + escritorio 1280×800) y verificación
  (tsc, eslint, build). Corrige dentro de lo permitido; lo que requiera decisión, devuélvelo
  como preguntas numeradas con opciones y recomendación. No commitees.
  ```

Espera su resultado antes de seguir.

### Fase 6 — Reporte final

El reporte del agente **no** lo ve el usuario: relájalo.

1. Tabla del porter (Juego | Bindings | Layout 390×844 | Input táctil | Regresión escritorio | Estado).
2. Cambios que hizo el porter (`archivo:línea` + motivo).
3. Si dejó preguntas abiertas: preséntalas con `AskUserQuestion` (opción recomendada primero). Con las respuestas, retoma al porter vía `SendMessage` (mismo agente) para aplicarlas.
4. Cierre:

   ```
   ✅ Spec implementada y verificada en móvil.

   Siguiente paso: revisar el diff (incluye cambios del porter), verificar los criterios
   de aceptación uno por uno, pasar el estado de la spec a "Implementado" y commitear
   en la branch (nunca en main).
   ```

No commitear salvo `AutoCommitSteps: true` (solo pasos del plan) o pedido explícito del usuario. Los cambios del porter quedan sin commitear para revisión.
