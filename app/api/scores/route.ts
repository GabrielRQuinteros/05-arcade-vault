import { StatusCodes } from "http-status-codes";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { submitScore } from "@/lib/scores";
import {
  submitScoreSchema,
  type ScoreErrorCode,
  type SubmitResult,
} from "@/lib/scores-schema";
import { createServerResponse } from "@/lib/server-response";

function failure(status: StatusCodes, code: ScoreErrorCode) {
  return NextResponse.json(
    createServerResponse<null>(false, status, null, code),
    {
      status,
    },
  );
}

export async function POST(request: Request) {
  // El userId sale siempre de la sesión, nunca del body.
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return failure(StatusCodes.UNAUTHORIZED, "UNAUTHORIZED");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return failure(StatusCodes.BAD_REQUEST, "INVALID_BODY");
  }

  const parsed = submitScoreSchema.safeParse(body);
  if (!parsed.success) return failure(StatusCodes.BAD_REQUEST, "INVALID_BODY");

  try {
    const result = await submitScore(
      session.user.id,
      parsed.data.gameId,
      parsed.data.score,
    );
    if (!result) return failure(StatusCodes.NOT_FOUND, "GAME_NOT_PLAYABLE");

    return NextResponse.json(
      createServerResponse<SubmitResult>(true, StatusCodes.OK, result, null),
      { status: StatusCodes.OK },
    );
  } catch (err) {
    console.error("[api/scores] Error de BD:", err);
    return failure(StatusCodes.INTERNAL_SERVER_ERROR, "INTERNAL_ERROR");
  }
}
