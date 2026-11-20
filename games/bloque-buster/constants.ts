/** Resolución lógica del canvas (4:3, igual que `.crt-screen`). */
export const W = 800;
export const H = 600;

/** Paddle: posición vertical fija, tamaño y velocidad por teclado (px/s). */
export const PADDLE = { y: 560, w: 81, h: 14, speed: 400 } as const;
/** Caja AABB de la pelota (16×16); se dibuja como círculo de radio 8. */
export const BALL_SIZE = 16;
/** Velocidad base de la pelota al lanzar (px/s), antes del factor de nivel. */
export const BASE_VX = 200;
export const BASE_VY = -300;

/** Grilla de bloques: 10×6 celdas de 64×24, centrada en horizontal. */
export const BLOCK_COLS = 10;
export const BLOCK_ROWS = 6;
export const BLOCK_W = 64;
export const BLOCK_H = 24;
export const BLOCKS_ORIGIN_X = (W - BLOCK_COLS * BLOCK_W) / 2; // 80
export const BLOCKS_ORIGIN_Y = 80;

export const POINTS_PER_BLOCK = 10;
export const INITIAL_LIVES = 3;
/** Duración de la explosión de un bloque (ms). */
export const EXPLOSION_MS = 150;
/** Escala final de la explosión. */
export const EXPLOSION_SCALE = 1.3;

/** Factor de velocidad por nivel y su tope (se alcanza en el nivel 11). */
export const SPEED_STEP = 1.1;
export const MAX_SPEED_FACTOR = 2.5;
/** px bajo el borde superior del paddle que aún cuentan como golpe (original). */
export const PADDLE_HIT_TOLERANCE = 8;

/** Cap de dt (s) para evitar saltos tras frames largos. */
export const MAX_DT = 0.05;
/** Sub-paso máximo de física (s): evita que la pelota atraviese el paddle a velocidad máxima. */
export const MAX_SUBSTEP = 1 / 120;

/** Factor de velocidad del nivel: 1.00, 1.10, 1.21, 1.33, 1.46… hasta 2.5. */
export const speedFactor = (level: number): number =>
  Math.min(SPEED_STEP ** (level - 1), MAX_SPEED_FACTOR);

/** Paleta neón del vault (hex copiados de `app/globals.css`). */
export const PALETTE = {
  cyan: "#00f5ff", // --cyan
  magenta: "#ff006e", // --magenta
  yellow: "#f5ff00", // --yellow
  green: "#00ff88", // --green
  paddle: "#00f5ff", // --cyan
  ball: "#f5ff00", // --yellow
  hint: "#8a8fb5", // --ink-dim
  gameOverTitle: "#ff006e", // --magenta
  gameOverSub: "#e6e9ff", // --ink
  gameOverShade: "rgba(0, 0, 0, 0.6)",
  highlight: "rgba(255, 255, 255, 0.12)",
  background: "#000",
} as const;

/** Intensidad del glow (`shadowBlur`), solo en paddle y pelota. */
export const GLOW_BLUR = 10;
