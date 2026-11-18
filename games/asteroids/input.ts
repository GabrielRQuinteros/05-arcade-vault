export type Action = "left" | "right" | "thrust" | "fire" | "pause";

const KEY_MAP: Record<string, Action> = {
  ArrowLeft: "left",
  KeyA: "left",
  ArrowRight: "right",
  KeyD: "right",
  ArrowUp: "thrust",
  KeyW: "thrust",
  Space: "fire",
  KeyP: "pause",
  Escape: "pause",
};

/** El foco está en un campo de texto: no se bloquea el comportamiento por defecto. */
function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.isContentEditable
  );
}

/**
 * Teclado del juego. `held`: teclas sostenidas; `justPressed`: pulsaciones de
 * un frame, consumidas al leerlas con `pressed()`. Sin estado global: cada
 * motor crea su instancia y la conecta con `attach()` / `detach()`.
 */
export class Input {
  private held = new Set<string>();
  private justPressed = new Set<string>();
  private attached = false;

  private onKeyDown = (e: KeyboardEvent): void => {
    if (!(e.code in KEY_MAP)) return;
    if (!isTyping(e.target)) e.preventDefault();
    // Ignora el auto-repeat: solo cuenta la primera pulsación.
    if (!this.held.has(e.code)) this.justPressed.add(e.code);
    this.held.add(e.code);
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    if (!(e.code in KEY_MAP)) return;
    // Evita que Espacio active el botón del HUD que tenga el foco (se dispara en keyup).
    if (!isTyping(e.target)) e.preventDefault();
    this.held.delete(e.code);
  };

  attach(): void {
    if (this.attached) return;
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    this.attached = true;
  }

  detach(): void {
    if (!this.attached) return;
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    this.attached = false;
    this.held.clear();
    this.justPressed.clear();
  }

  /** Alguna tecla de la acción está sostenida. */
  isDown(action: Action): boolean {
    for (const code of this.held) if (KEY_MAP[code] === action) return true;
    return false;
  }

  /** Alguna tecla de la acción se pulsó desde la última lectura. Consume la pulsación. */
  pressed(action: Action): boolean {
    let hit = false;
    for (const code of this.justPressed) {
      if (KEY_MAP[code] === action) {
        this.justPressed.delete(code);
        hit = true;
      }
    }
    return hit;
  }

  /** Descarta las pulsaciones pendientes (p. ej. al pausar). */
  clearPressed(): void {
    this.justPressed.clear();
  }
}
