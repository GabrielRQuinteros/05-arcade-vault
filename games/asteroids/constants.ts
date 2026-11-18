/** Resolución lógica del campo de juego. */
export const W = 800;
export const H = 600;

/** Indexados por tamaño de asteroide: 1 (pequeño), 2 (mediano), 3 (grande). */
export const RADII = [0, 16, 30, 50] as const;
export const SPEEDS = [0, 85, 55, 32] as const;
export const POINTS = [0, 100, 50, 20] as const;

export const POWERUP_DROP_CHANCE = 0.15;
/** Segundos que dura el triple disparo. */
export const POWERUP_DURATION = 5;
/** Segundos que el power-up permanece en pantalla. */
export const POWERUP_TTL = 12;
/** Ángulo (rad) entre las balas del triple disparo. */
export const TRIPLE_SPREAD = 0.18;

/** Cap de dt (s) para evitar saltos tras frames largos. */
export const MAX_DT = 0.05;

/** Paleta neón del vault (hex copiados de `app/globals.css`). */
export const PALETTE = {
  ship: "#00f5ff", // --cyan
  asteroid: "#ff006e", // --magenta
  bullet: "#f5ff00", // --yellow (balas y llama)
  powerUp: "#00ff88", // --green (power-up y contador 3x)
  particleRgb: "255, 0, 110", // --magenta, se combina con alpha
  gameOverTitle: "#ff006e", // --magenta
  gameOverSub: "#e6e9ff", // --ink
  background: "#000",
} as const;

/** Intensidad del glow (`shadowBlur`) en nave, asteroides y power-up. */
export const GLOW_BLUR = 10;
