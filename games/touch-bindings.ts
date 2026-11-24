export type TouchBindings = {
  /** `code` que despacha B; null = B atenuado e inactivo. */
  b: string | null;
};

export const DPAD_CODES = {
  up: "ArrowUp",
  down: "ArrowDown",
  left: "ArrowLeft",
  right: "ArrowRight",
} as const;
export const A_CODE = "Space";

export const TOUCH_BINDINGS: Record<string, TouchBindings> = {
  asteroids: { b: "KeyW" }, // impulso (code distinto de ArrowUp: ambos pueden estar sostenidos)
  tetris: { b: "KeyX" }, // rotar
  "bloque-buster": { b: null },
  snake: { b: null },
  frogger: { b: null }, // D-pad salta; A reinicia
};
