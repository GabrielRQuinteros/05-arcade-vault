import "server-only";
import { connection } from "next/server";
import type { PoolClient } from "pg";
import { pool } from "./db";
import type { SubmitResult } from "./scores-schema";

// Consultas de puntuaciones. Solo servidor: usan el Pool de pg (rol postgres, sin RLS).
// Las lecturas son siempre dinámicas (SPEC 07): connection() las excluye del prerender.

export type LeaderboardRow = {
  /** 1-based, según (score desc, achieved_at asc). */
  rank: number;
  /** Uso interno del servidor (resaltar la fila del usuario). */
  userId: string;
  /** Username en MAYÚSCULAS. */
  name: string;
  score: number;
  /** dd/mm/yyyy (es-ES, UTC). */
  date: string;
};

export type UserBest = { rank: number; score: number; date: string } | null;

export type GameStats = { best: number | null; plays: number };

const dateFmt = new Intl.DateTimeFormat("es-ES", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "UTC",
});

const formatDate = (d: Date) => dateFmt.format(d);

/**
 * Mejor marca de un usuario en un juego ($1 = gameId, $2 = userId) con su rango:
 * 1 + marcas mejores (mayor score o mismo score logrado antes). Todo en SQL para
 * no perder la precisión de microsegundos de achieved_at.
 */
const USER_BEST_SQL = `
  select me.score, me.achieved_at,
    (select count(*)::int + 1
       from public.best_scores o
      where o.game_id = me.game_id
        and (o.score > me.score
             or (o.score = me.score and o.achieved_at < me.achieved_at))) as rank
  from public.best_scores me
  where me.game_id = $1 and me.user_id = $2`;

type UserBestRow = { score: number; achieved_at: Date; rank: number };

export async function getTopScores(
  gameId: string,
  limit: number,
): Promise<LeaderboardRow[]> {
  await connection();
  const { rows } = await pool.query<{
    user_id: string;
    name: string;
    score: number;
    achieved_at: Date;
  }>(
    `select b.user_id, coalesce(u.username, u.name) as name, b.score, b.achieved_at
     from public.best_scores b
     join public."user" u on u.id = b.user_id
     where b.game_id = $1
     order by b.score desc, b.achieved_at asc
     limit $2`,
    [gameId, limit],
  );
  return rows.map((r, i) => ({
    rank: i + 1,
    userId: r.user_id,
    name: r.name.toUpperCase(),
    score: r.score,
    date: formatDate(r.achieved_at),
  }));
}

export async function getUserBest(
  gameId: string,
  userId: string,
): Promise<UserBest> {
  await connection();
  const { rows } = await pool.query<UserBestRow>(USER_BEST_SQL, [
    gameId,
    userId,
  ]);
  const best = rows[0];
  if (!best) return null;
  return {
    rank: best.rank,
    score: best.score,
    date: formatDate(best.achieved_at),
  };
}

export async function getGameStats(gameId: string): Promise<GameStats> {
  await connection();
  const { rows } = await pool.query<{
    best: number | null;
    plays: string | null;
  }>(
    `select
       (select max(score) from public.best_scores where game_id = $1) as best,
       (select plays_count from public.games where id = $1) as plays`,
    [gameId],
  );
  const r = rows[0];
  return { best: r?.best ?? null, plays: Number(r?.plays ?? 0) };
}

export async function getAllBests(): Promise<Record<string, number | null>> {
  await connection();
  const { rows } = await pool.query<{ id: string; best: number | null }>(
    `select g.id, max(b.score) as best
     from public.games g
     left join public.best_scores b on b.game_id = g.id
     group by g.id`,
  );
  return Object.fromEntries(rows.map((r) => [r.id, r.best]));
}

/**
 * Registra una partida: incrementa plays_count y guarda la marca si supera la anterior.
 * Devuelve null si el juego no existe o no es jugable (no se modifica nada).
 */
export async function submitScore(
  userId: string,
  gameId: string,
  score: number,
): Promise<SubmitResult | null> {
  const client: PoolClient = await pool.connect();
  try {
    await client.query("begin");

    const played = await client.query(
      `update public.games set plays_count = plays_count + 1 where id = $1 and playable`,
      [gameId],
    );
    if (played.rowCount === 0) {
      await client.query("rollback");
      return null;
    }

    // Atómico: solo reemplaza si la marca nueva es mayor.
    const upsert = await client.query(
      `insert into public.best_scores (user_id, game_id, score)
       values ($1, $2, $3)
       on conflict (user_id, game_id) do update
         set score = excluded.score, achieved_at = now()
         where best_scores.score < excluded.score`,
      [userId, gameId, score],
    );
    const isRecord = (upsert.rowCount ?? 0) > 0;

    const current = await client.query<UserBestRow>(USER_BEST_SQL, [
      gameId,
      userId,
    ]);
    const best = current.rows[0];

    await client.query("commit");
    return { isRecord, best: best.score, rank: best.rank };
  } catch (err) {
    await client.query("rollback").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}
