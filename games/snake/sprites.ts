/**
 * Atlas de frutas de Snake.
 *
 * Origen: rip de Google Snake (spriters-resource,
 * https://www.spriters-resource.com/browser_games/googlesnakegame/).
 * Uso educativo/local, no comercial. Solo se usa la fila central (pixel art).
 */
export const SNAKE_SHEET = "/games/snake/fruits.png"; // 3790×442, fondo transparente

type Rect = { x: number; y: number; w: number; h: number };

export type FruitKey =
  | "apple"
  | "banana"
  | "pineapple"
  | "grape"
  | "pumpkin"
  | "turnip"
  | "eggplant"
  | "strawberry"
  | "cherry"
  | "carrot"
  | "mushroom"
  | "broccoli"
  | "watermelon"
  | "pepper"
  | "kiwi"
  | "lemon"
  | "orange"
  | "peach"
  | "peanut"
  | "raspberry"
  | "tomato"
  | "bowl";

const Y = 136;
const H = 160;

/** Recortes de la fila central, en orden de la hoja; claves según el contenido visual. */
export const FRUIT_SPRITES: Record<FruitKey, Rect> = {
  apple: { x: 34, y: Y, w: 110, h: H },
  banana: { x: 186, y: Y, w: 150, h: H },
  pineapple: { x: 378, y: Y, w: 110, h: H },
  grape: { x: 540, y: Y, w: 130, h: H },
  pumpkin: { x: 712, y: Y, w: 130, h: H },
  turnip: { x: 894, y: Y, w: 110, h: H },
  eggplant: { x: 1066, y: Y, w: 110, h: H },
  strawberry: { x: 1228, y: Y, w: 130, h: H },
  cherry: { x: 1400, y: Y, w: 130, h: H },
  carrot: { x: 1582, y: Y, w: 110, h: H },
  mushroom: { x: 1734, y: Y, w: 150, h: H },
  broccoli: { x: 1906, y: Y, w: 150, h: H },
  watermelon: { x: 2068, y: Y, w: 170, h: H },
  pepper: { x: 2250, y: Y, w: 140, h: H },
  kiwi: { x: 2432, y: Y, w: 130, h: H },
  lemon: { x: 2604, y: Y, w: 130, h: H },
  orange: { x: 2786, y: Y, w: 110, h: H },
  peach: { x: 2948, y: Y, w: 130, h: H },
  peanut: { x: 3110, y: Y, w: 150, h: H },
  raspberry: { x: 3302, y: Y, w: 110, h: H },
  tomato: { x: 3454, y: Y, w: 150, h: H },
  bowl: { x: 3637, y: Y, w: 130, h: H },
};

export const BONUS_FRUIT: FruitKey = "bowl";

/** Las 21 frutas normales (todas menos el bol). */
export const NORMAL_FRUITS: readonly FruitKey[] = (
  Object.keys(FRUIT_SPRITES) as FruitKey[]
).filter((k) => k !== BONUS_FRUIT);
