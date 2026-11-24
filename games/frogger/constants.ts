export const W = 800;
export const H = 600;
export const COLS = 16;
export const ROWS = 14;
export const CELL = 40;
export const BOARD_X = 80; // (W - COLS * CELL) / 2
export const BOARD_Y = 40; // franja superior de HUD propio
export const BOARD_W = COLS * CELL; // 640
export const BOARD_H = ROWS * CELL; // 560

/** Filas del tablero (0 = arriba). */
export const ROW_GOALS = 0;
export const ROW_RIVER_TOP = 1;
export const ROW_RIVER_BOT = 6;
export const ROW_SAFE_MID = 7;
export const ROW_ROAD_TOP = 8;
export const ROW_ROAD_BOT = 12;
export const ROW_START = 13;
export const START_COL = 7;

/** Columna izquierda de cada boca destino (cada una ocupa 2 columnas). */
export const GOAL_COLS = [1, 4, 7, 10, 13] as const;
export const GOAL_WIDTH = 2;

export const START_LIVES = 3;
export const JUMP_MS = 120;
export const DEAD_MS = 1000;
export const READY_MS = 1000;

/** Ciclo de tortugas que se sumergen: 6 s visibles (el último 1 s parpadea) + 1,5 s bajo el agua. */
export const TURTLE_UP_MS = 6000;
export const TURTLE_DOWN_MS = 1500;
export const TURTLE_WARN_MS = 1000;
export const TURTLE_CYCLE_MS = TURTLE_UP_MS + TURTLE_DOWN_MS;

export const STEP_POINTS = 10; // fila nueva en el intento
export const GOAL_POINTS = 50;
export const TIME_BONUS_PER_SEC = 10; // × ceil(segundos restantes)
export const ROUND_POINTS = 200;

/** Multiplicador de velocidad por nivel: base × 1.15^(level − 1). */
export const SPEED_FACTOR = 1.15;

/** Segundos por intento: 15 en nivel 1, −1 por nivel, mínimo 8. */
export function timeLimitMs(level: number): number {
  return Math.max(8, 15 - (level - 1)) * 1000;
}

/** Hex copiados de `app/globals.css` (salvo tonos de fondo de zona). */
export const PALETTE = {
  background: "#000",
  frog: "#00ff88", // --green
  eyes: "#000",
  eyeWhite: "#e6e9ff", // --ink
  dead: "#ff006e", // --magenta
  carColors: ["#ff006e", "#f5ff00", "#00f5ff"], // --magenta, --yellow, --cyan
  truck: "#8a8fb5", // --ink-dim
  truckCab: "#00f5ff", // --cyan
  wheel: "#15151f", // --bg-3
  log: "#d97a3a", // --bronze
  logGrain: "#7a3e14",
  turtle: "#00f5ff", // --cyan
  turtleShell: "#0f0f18", // --bg-2
  goalBorder: "#ffcf3a", // --gold
  road: "#0a0a0f", // --bg
  roadLine: "rgba(255, 255, 255, 0.12)",
  river: "#001a3a",
  riverLine: "rgba(0, 245, 255, 0.08)",
  safe: "#0d2618",
  hedge: "#063a1e",
  goal: "#001208",
  border: "rgba(0, 245, 255, 0.18)", // --line
  label: "#8a8fb5", // --ink-dim
  value: "#e6e9ff", // --ink
  timeOk: "#00ff88", // --green
  timeWarn: "#f5ff00", // --yellow
  timeLow: "#ff006e", // --magenta
  gameOverTitle: "#ff006e", // --magenta
  gameOverSub: "#e6e9ff", // --ink
  gameOverShade: "rgba(0, 0, 0, 0.6)",
  ready: "#00ff88", // --green
} as const;
