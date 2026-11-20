import type { Ref } from "react";

/** Solo campos comunes a cualquier juego; nada específico de un juego concreto. */
export type GameSnapshot = {
  score: number;
  lives: number;
  level: number;
  state: "playing" | "dead" | "gameover";
};

export type GameHandle = {
  /** Fuerza game over. */
  endGame(): void;
  /** Nueva partida con los valores iniciales del juego. */
  restart(): void;
};

export type GameCanvasProps = {
  /** Fuente de verdad: estado React del reproductor. */
  paused: boolean;
  /** Solo cuando algún campo cambia, no por frame. */
  onSnapshot: (s: GameSnapshot) => void;
  /** P / Esc dentro del juego. */
  onTogglePause: () => void;
  /** React 19: ref como prop. */
  ref?: Ref<GameHandle>;
};
