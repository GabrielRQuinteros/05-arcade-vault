import { BLOCK_COLS, BLOCK_ROWS } from "./constants";

export type BlockColor = "cyan" | "magenta" | "yellow" | "green";
export type LevelBlock = { col: number; row: number; color: BlockColor };

// Colores del original ya mapeados a la paleta neón:
// cyan → cyan, yellow → yellow, green → green; magenta / red / hotpink / gray → magenta.
const M: BlockColor = "magenta";
const Y: BlockColor = "yellow";
const C: BlockColor = "cyan";
const G: BlockColor = "green";

function grid(
  pick: (col: number, row: number) => BlockColor | null,
): LevelBlock[] {
  const blocks: LevelBlock[] = [];
  for (let row = 0; row < BLOCK_ROWS; row++) {
    for (let col = 0; col < BLOCK_COLS; col++) {
      const color = pick(col, row);
      if (color) blocks.push({ col, row, color });
    }
  }
  return blocks;
}

// 1 — Grilla completa (red, yellow, cyan, magenta, hotpink, green).
const ROW_COLORS_1 = [M, Y, C, M, M, G];
const level1 = grid((_, row) => ROW_COLORS_1[row]);

// 2 — Pirámide centrada (gray, cyan, hotpink, yellow, magenta, green).
const ROW_COLORS_2 = [M, C, M, Y, M, G];
const PY_START = [4, 3, 2, 1, 0, 0];
const PY_END = [5, 6, 7, 8, 9, 9];
const level2 = grid((col, row) =>
  col >= PY_START[row] && col <= PY_END[row] ? ROW_COLORS_2[row] : null,
);

// 3 — Tablero de ajedrez (yellow arriba, magenta abajo).
const level3 = grid((col, row) =>
  (col + row) % 2 === 0 ? (row < 3 ? Y : M) : null,
);

// 4 — Filas con huecos (cyan, magenta, green, yellow, hotpink, red).
const ROW_COLORS_4 = [C, M, G, Y, M, M];
const GAPS_4 = [
  [2, 5, 8],
  [0, 4, 7, 9],
  [1, 3, 6],
  [2, 5, 8, 9],
  [0, 4, 7],
  [1, 3, 6, 9],
];
const level4 = grid((col, row) =>
  GAPS_4[row].includes(col) ? null : ROW_COLORS_4[row],
);

// 5 — Marco + cruz central (marco cyan, cruz hotpink).
const level5 = grid((col, row) => {
  const isFrame = col === 0 || col === 9 || row === 0 || row === 5;
  const isCross = col === 4 || row === 2;
  if (!isFrame && !isCross) return null;
  return isCross && !isFrame ? M : C;
});

/** Los 5 patrones del original; el nivel n usa `LEVELS[(n - 1) % LEVELS.length]`. */
export const LEVELS: readonly LevelBlock[][] = [
  level1,
  level2,
  level3,
  level4,
  level5,
];

export const layoutFor = (level: number): LevelBlock[] =>
  LEVELS[(level - 1) % LEVELS.length];
