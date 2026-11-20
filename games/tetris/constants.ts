/** Resolución lógica del canvas (4:3, igual que `.crt-screen`). */
export const W = 800;
export const H = 600;

/** Tablero: 10×20 celdas de 30 px (300×600), centrado en horizontal. */
export const COLS = 10;
export const ROWS = 20;
export const BLOCK = 30;
export const BOARD_X = (W - COLS * BLOCK) / 2; // 250

/** Puntos por líneas limpiadas a la vez (índice = líneas), multiplicados por el nivel. */
export const LINE_SCORES = [0, 100, 300, 500, 800] as const;
/** Desplazamientos horizontales que se prueban al rotar (wall kicks). */
export const KICKS = [0, -1, 1, -2, 2] as const;
export const SOFT_DROP_POINTS = 1; // por fila
export const HARD_DROP_POINTS = 2; // por celda recorrida
export const LINES_PER_LEVEL = 10;

/** ms entre caídas automáticas según el nivel. */
export const dropInterval = (level: number): number =>
  Math.max(100, 1000 - (level - 1) * 90);

/** Paleta neón del vault (hex copiados de `app/globals.css`). */
export const PALETTE = {
  cyan: "#00f5ff", // --cyan
  magenta: "#ff006e", // --magenta
  yellow: "#f5ff00", // --yellow
  green: "#00ff88", // --green
  grid: "rgba(255, 255, 255, 0.06)", // --line-2
  border: "rgba(0, 245, 255, 0.18)", // --line
  label: "#8a8fb5", // --ink-dim
  value: "#e6e9ff", // --ink
  gameOverTitle: "#ff006e", // --magenta
  gameOverSub: "#e6e9ff", // --ink
  gameOverShade: "rgba(0, 0, 0, 0.6)",
  highlight: "rgba(255, 255, 255, 0.12)",
  background: "#000",
} as const;

/** Color por tipo de pieza (índice = celda): I/J cyan, T/Z magenta, O/L amarillo, S verde. */
export const PIECE_COLORS = [
  "", // 0 vacío
  PALETTE.cyan, // I
  PALETTE.yellow, // O
  PALETTE.magenta, // T
  PALETTE.green, // S
  PALETTE.magenta, // Z
  PALETTE.cyan, // J
  PALETTE.yellow, // L
] as const;

export const GHOST_ALPHA = 0.2;
/** Intensidad del glow (`shadowBlur`), solo en la pieza que cae. */
export const GLOW_BLUR = 10;
