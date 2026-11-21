export type Action = "up" | "down" | "left" | "right" | "restart" | "pause";

const KEY_MAP: Record<string, Action> = {
  ArrowUp: "up",
  KeyW: "up",
  ArrowDown: "down",
  KeyS: "down",
  ArrowLeft: "left",
  KeyA: "left",
  ArrowRight: "right",
  KeyD: "right",
  Space: "restart",
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
 * Teclado de Snake: cada `keydown` encola una acción que el motor consume con
 * `drain()` en el siguiente frame. Ninguna acción acepta `e.repeat`. Sin estado global.
 */
export class Input {
  private queue: Action[] = [];
  private attached = false;

  private onKeyDown = (e: KeyboardEvent): void => {
    const action = KEY_MAP[e.code];
    if (!action) return;
    if (!isTyping(e.target)) e.preventDefault();
    if (e.repeat) return;
    this.queue.push(action);
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    if (!(e.code in KEY_MAP)) return;
    // Evita que Espacio active el botón del HUD que tenga el foco (se dispara en keyup).
    if (!isTyping(e.target)) e.preventDefault();
  };

  attach(): void {
    if (this.attached) return;
    globalThis.addEventListener("keydown", this.onKeyDown);
    globalThis.addEventListener("keyup", this.onKeyUp);
    this.attached = true;
  }

  detach(): void {
    if (!this.attached) return;
    globalThis.removeEventListener("keydown", this.onKeyDown);
    globalThis.removeEventListener("keyup", this.onKeyUp);
    this.attached = false;
    this.queue = [];
  }

  /** Devuelve y vacía las acciones pendientes, en orden de pulsación. */
  drain(): Action[] {
    const actions = this.queue;
    this.queue = [];
    return actions;
  }

  /** Descarta las acciones pendientes. */
  clear(): void {
    this.queue = [];
  }
}
