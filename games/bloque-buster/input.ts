import { W } from "./constants";

export type Action = "left" | "right" | "launch" | "pause";

const KEY_MAP: Record<string, Action> = {
  ArrowLeft: "left",
  KeyA: "left",
  ArrowRight: "right",
  KeyD: "right",
  Space: "launch",
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
 * Teclado (en `window`) + mouse (solo sobre el canvas). `held`: teclas
 * sostenidas; `justPressed`: pulsaciones consumidas con `pressed()`.
 * `mouseX`: última X del ratón en coordenadas lógicas, consumida con
 * `takeMouseX()`; `clicked`: clic pendiente, consumido con `takeClick()`.
 */
export class Input {
  private held = new Set<string>();
  private justPressed = new Set<string>();
  private mouseX: number | null = null;
  private clicked = false;
  private canvas: HTMLCanvasElement | null = null;

  private onKeyDown = (e: KeyboardEvent): void => {
    if (!(e.code in KEY_MAP)) return;
    if (!isTyping(e.target)) e.preventDefault();
    // Ignora el auto-repeat: Espacio y P/Esc cuentan una sola vez.
    if (!e.repeat && !this.held.has(e.code)) this.justPressed.add(e.code);
    this.held.add(e.code);
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    if (!(e.code in KEY_MAP)) return;
    // Evita que Espacio active el botón del HUD que tenga el foco (se dispara en keyup).
    if (!isTyping(e.target)) e.preventDefault();
    this.held.delete(e.code);
  };

  private onMouseMove = (e: MouseEvent): void => {
    const canvas = this.canvas;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0) return;
    this.mouseX = ((e.clientX - rect.left) * W) / rect.width;
  };

  private onClick = (): void => {
    this.clicked = true;
  };

  attach(canvas: HTMLCanvasElement): void {
    if (this.canvas) return;
    this.canvas = canvas;
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    canvas.addEventListener("mousemove", this.onMouseMove);
    canvas.addEventListener("click", this.onClick);
  }

  detach(): void {
    const canvas = this.canvas;
    if (!canvas) return;
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    canvas.removeEventListener("mousemove", this.onMouseMove);
    canvas.removeEventListener("click", this.onClick);
    this.canvas = null;
    this.held.clear();
    this.clear();
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

  /** Última X del ratón (lógica) desde la lectura anterior, o `null` si no se movió. */
  takeMouseX(): number | null {
    const x = this.mouseX;
    this.mouseX = null;
    return x;
  }

  /** Hubo un clic sobre el canvas desde la lectura anterior. */
  takeClick(): boolean {
    const c = this.clicked;
    this.clicked = false;
    return c;
  }

  /** Descarta pulsaciones, movimiento y clics pendientes (p. ej. al pausar). */
  clear(): void {
    this.justPressed.clear();
    this.mouseX = null;
    this.clicked = false;
  }
}
