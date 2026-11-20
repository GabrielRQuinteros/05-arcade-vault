export type Action =
  "left" | "right" | "rotate" | "softDrop" | "hardDrop" | "pause";

const KEY_MAP: Record<string, Action> = {
  ArrowLeft: "left",
  KeyA: "left",
  ArrowRight: "right",
  KeyD: "right",
  ArrowUp: "rotate",
  KeyW: "rotate",
  KeyX: "rotate",
  ArrowDown: "softDrop",
  KeyS: "softDrop",
  Space: "hardDrop",
  KeyP: "pause",
  Escape: "pause",
};

/** Acciones que aceptan la repetición del teclado del sistema operativo. */
const REPEATABLE = new Set<Action>(["left", "right", "softDrop"]);

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
 * Teclado de Tetris: cada `keydown` encola una acción que el motor consume con
 * `drain()` en el siguiente frame. Mover y soft drop aceptan `e.repeat`; el resto
 * solo cuenta la primera pulsación. Sin estado global.
 */
export class Input {
  private queue: Action[] = [];
  private attached = false;

  private onKeyDown = (e: KeyboardEvent): void => {
    const action = KEY_MAP[e.code];
    if (!action) return;
    if (!isTyping(e.target)) e.preventDefault();
    if (e.repeat && !REPEATABLE.has(action)) return;
    this.queue.push(action);
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    if (!(e.code in KEY_MAP)) return;
    // Evita que Espacio active el botón del HUD que tenga el foco (se dispara en keyup).
    if (!isTyping(e.target)) e.preventDefault();
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
