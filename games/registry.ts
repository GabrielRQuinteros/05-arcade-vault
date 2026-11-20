import type { ComponentType } from "react";
import { AsteroidsCanvas } from "./asteroids/asteroids-canvas";
import { TetrisCanvas } from "./tetris/tetris-canvas";
import type { GameCanvasProps } from "./types";

/** id de juego (`lib/games.ts`) → componente canvas. Los no registrados usan el reproductor simulado. */
export const GAME_COMPONENTS: Record<
  string,
  ComponentType<GameCanvasProps> | undefined
> = {
  asteroids: AsteroidsCanvas,
  tetris: TetrisCanvas,
};
