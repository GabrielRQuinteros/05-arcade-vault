export const W = 800;
export const H = 600;
export const COLS = 30;
export const ROWS = 20;
export const CELL = 25;
export const BOARD_X = 25; // (W - COLS * CELL) / 2
export const BOARD_Y = 75; // franja superior de info
export const START_LENGTH = 3;
export const START_DIR = "right";
export const START_HEAD = { x: 15, y: 10 } as const; // cuerpo en (14,10) y (13,10)
export const READY_MS = 1000;
export const MAX_QUEUED_TURNS = 2;

export const FRUITS_PER_LEVEL = 5;
export const FRUIT_POINTS = 10; // × level

export const BONUS_EVERY = 5; // frutas normales
export const BONUS_CHANCE = 0.25;
export const BONUS_MS = 6000;
export const BONUS_BLINK_MS = 2000; // parpadeo en los últimos 2 s
export const BONUS_POINTS = 50; // × level
export const BONUS_POINTS_PER_SEC = 5; // × ceil(segundos restantes)

export const SPRITE_PADDING = 2; // px dentro de la celda (aspect-fit en 21×21)
export const SPRITE_TIMEOUT_MS = 5000; // pasado este tiempo, fallback

/** ms entre ticks: 140 en nivel 1, −8 por nivel, tope 60 (nivel 11). */
export function tickInterval(level: number): number {
  return Math.max(60, 140 - (level - 1) * 8);
}

/** Hex copiados de `app/globals.css`. */
export const PALETTE = {
  snake: "#00ff88", // --green
  eyes: "#000",
  fruitFallback: "#ff006e", // --magenta
  bonus: "#f5ff00", // --yellow
  grid: "rgba(255, 255, 255, 0.06)", // --line-2
  border: "rgba(0, 245, 255, 0.18)", // --line
  label: "#8a8fb5", // --ink-dim
  value: "#e6e9ff", // --ink
  gameOverTitle: "#ff006e", // --magenta
  gameOverSub: "#e6e9ff", // --ink
  gameOverShade: "rgba(0, 0, 0, 0.6)",
  background: "#000",
} as const;
