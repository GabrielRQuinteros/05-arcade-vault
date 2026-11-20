import { COLS, ROWS } from "./constants";
import type { Cell, Piece, Shape } from "./pieces";

/** ROWS × COLS; 0 = vacío, 1–7 = tipo de la pieza fijada. */
export type Board = Cell[][];

export function createBoard(): Board {
  return Array.from({ length: ROWS }, () => new Array<Cell>(COLS).fill(0));
}

/** ¿`shape` en (ox, oy) se sale por los lados/abajo o pisa una celda ocupada? Arriba (y < 0) se permite. */
export function collide(
  board: Board,
  shape: Shape,
  ox: number,
  oy: number,
): boolean {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const x = ox + c;
      const y = oy + r;
      if (x < 0 || x >= COLS || y >= ROWS) return true;
      if (y >= 0 && board[y][x]) return true;
    }
  }
  return false;
}

/** Fija la pieza en el tablero (muta `board`). */
export function merge(board: Board, piece: Piece): void {
  const { shape, x, y } = piece;
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (shape[r][c] && y + r >= 0) board[y + r][x + c] = shape[r][c];
    }
  }
}

/** Elimina las filas completas (muta `board`) y devuelve cuántas limpió. */
export function clearLines(board: Board): number {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every((v) => v !== 0)) {
      board.splice(r, 1);
      board.unshift(new Array<Cell>(COLS).fill(0));
      cleared++;
      r++; // revisar de nuevo la fila que bajó a esta posición
    }
  }
  return cleared;
}
