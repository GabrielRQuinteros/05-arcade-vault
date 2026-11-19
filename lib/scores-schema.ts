import { z } from "zod";

// Compartible cliente/servidor: sin dependencias de servidor.

export const SCORE_MAX = 10_000_000;

export const submitScoreSchema = z.object({
  gameId: z.string().min(1).max(64),
  score: z.number().int().min(0).max(SCORE_MAX),
});

export type SubmitScoreBody = z.infer<typeof submitScoreSchema>;

export type SubmitResult = {
  /** true si la marca nueva superó la anterior (o es la primera). */
  isRecord: boolean;
  /** Mejor marca vigente del usuario en ese juego. */
  best: number;
  /** Rango global de esa mejor marca. */
  rank: number;
};

export type ScoreErrorCode =
  "UNAUTHORIZED" | "INVALID_BODY" | "GAME_NOT_PLAYABLE" | "INTERNAL_ERROR";
