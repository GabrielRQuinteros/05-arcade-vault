type Point = { x: number; y: number };

/** Envuelve `v` en [0, max) — espacio toroidal. */
export const wrap = (v: number, max: number): number => ((v % max) + max) % max;

export const dist = (a: Point, b: Point): number =>
  Math.hypot(a.x - b.x, a.y - b.y);

export const rand = (min: number, max: number): number =>
  min + Math.random() * (max - min);

/** Entero en [min, max], ambos incluidos. */
export const randInt = (min: number, max: number): number =>
  Math.floor(rand(min, max + 1));
