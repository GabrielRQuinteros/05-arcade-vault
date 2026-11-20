import { COLS } from "./constants";

/** 0 = vacío; 1–7 = I, O, T, S, Z, J, L. */
export type Cell = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
export type PieceType = Exclude<Cell, 0>;
export type Shape = Cell[][];
export type Piece = { type: PieceType; shape: Shape; x: number; y: number };

/** Matrices de las 7 piezas estándar (índice = tipo). */
const PIECES: Record<PieceType, Shape> = {
  1: [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ],
  2: [
    [2, 2],
    [2, 2],
  ],
  3: [
    [0, 3, 0],
    [3, 3, 3],
    [0, 0, 0],
  ],
  4: [
    [0, 4, 4],
    [4, 4, 0],
    [0, 0, 0],
  ],
  5: [
    [5, 5, 0],
    [0, 5, 5],
    [0, 0, 0],
  ],
  6: [
    [6, 0, 0],
    [6, 6, 6],
    [0, 0, 0],
  ],
  7: [
    [0, 0, 7],
    [7, 7, 7],
    [0, 0, 0],
  ],
};

/** Pieza aleatoria (sorteo uniforme) en la posición de aparición. */
export function randomPiece(): Piece {
  const type = (Math.floor(Math.random() * 7) + 1) as PieceType;
  const shape = PIECES[type].map((row) => [...row]);
  return {
    type,
    shape,
    x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2),
    y: 0,
  };
}

/** Rotación horaria: transponer + invertir filas. Devuelve una matriz nueva. */
export function rotateCW(shape: Shape): Shape {
  const rows = shape.length;
  const cols = shape[0].length;
  const out: Shape = Array.from({ length: cols }, () =>
    new Array<Cell>(rows).fill(0),
  );
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) out[c][rows - 1 - r] = shape[r][c];
  }
  return out;
}
