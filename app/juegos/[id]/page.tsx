import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { GAMES, fmt, fmtPlays, getGame } from "@/lib/games";
import { getGameStats, getTopScores } from "@/lib/scores";

const TOP_SIZE = 10;

export function generateStaticParams() {
  return GAMES.map((g) => ({ id: g.id }));
}

export async function generateMetadata({ params }: PageProps<"/juegos/[id]">) {
  const { id } = await params;
  const game = getGame(id);
  return { title: game ? `${game.title} · Arcade Vault` : "Arcade Vault" };
}

export default async function GameDetail({
  params,
}: PageProps<"/juegos/[id]">) {
  const { id } = await params;
  const game = getGame(id);
  if (!game) notFound();

  return (
    <div className="av-detail fade-in">
      <div>
        <div className="detail-cover">
          <div className={"cover-bg " + game.cover}></div>
        </div>
        <div style={{ marginTop: 20 }} className="detail-info">
          <div className="detail-tags">
            <span>{game.cat}</span>
            <span>1 JUGADOR</span>
            <span>TECLADO / TÁCTIL</span>
            <span>RETRO 1985</span>
          </div>
          <h2 className="neon-cyan">{game.title}</h2>
          <p>{game.long}</p>
          {/* Datos de la BD: siempre dinámicos, dentro de Suspense (cacheComponents). */}
          <Suspense fallback={<StatStrip plays="···" best="···" />}>
            <GameStatStrip gameId={game.id} />
          </Suspense>
          <div className="detail-actions">
            <Link href={`/juegos/${game.id}/jugar`} className="btn xl pulse">
              ▶&nbsp; JUGAR AHORA
            </Link>
            <Link href="/biblioteca" className="btn ghost lg">
              VOLVER AL VAULT
            </Link>
          </div>
        </div>
      </div>

      <aside>
        <div className="leaderboard">
          <h3>MEJORES PUNTUACIONES</h3>
          <Suspense fallback={<LeaderboardFallback />}>
            <GameLeaderboard gameId={game.id} />
          </Suspense>
        </div>
      </aside>
    </div>
  );
}

async function GameStatStrip({ gameId }: { gameId: string }) {
  const stats = await getGameStats(gameId);
  return (
    <StatStrip
      plays={fmtPlays(stats.plays)}
      best={stats.best === null ? "—" : fmt(stats.best)}
    />
  );
}

function StatStrip({ plays, best }: { plays: string; best: string }) {
  return (
    <div className="stat-strip">
      <div>
        <div className="l">Partidas</div>
        <div className="v">{plays}</div>
      </div>
      <div>
        <div className="l">Mejor global</div>
        <div
          className="v"
          style={{
            color: "var(--magenta)",
            textShadow: "0 0 6px rgba(255,0,110,0.5)",
          }}
        >
          {best}
        </div>
      </div>
      <div>
        <div className="l">Dificultad</div>
        <div
          className="v"
          style={{
            color: "var(--yellow)",
            textShadow: "0 0 6px rgba(245,255,0,0.5)",
          }}
        >
          ★ ★ ★ ☆ ☆
        </div>
      </div>
    </div>
  );
}

async function GameLeaderboard({ gameId }: { gameId: string }) {
  const scores = await getTopScores(gameId, TOP_SIZE);
  if (scores.length === 0) {
    return <div className="lb-empty">▸ SIN PUNTUACIONES TODAVÍA</div>;
  }
  return scores.map((r, i) => (
    <div
      key={r.userId}
      className={
        "lb-row" +
        (i === 0 ? " top1" : i === 1 ? " top2" : i === 2 ? " top3" : "")
      }
    >
      <div className="rk">#{String(r.rank).padStart(2, "0")}</div>
      <div className="pl">
        {r.name}
        <div
          style={{
            fontSize: 10,
            color: "var(--ink-faint)",
            letterSpacing: "0.1em",
          }}
        >
          {r.date}
        </div>
      </div>
      <div className="sc">{fmt(r.score)}</div>
    </div>
  ));
}

/** Conserva el alto del panel mientras llegan los datos. */
function LeaderboardFallback() {
  return Array.from({ length: TOP_SIZE }, (_, i) => (
    <div key={i} className="lb-row" aria-hidden="true">
      <div className="rk">···</div>
      <div className="pl">
        ···
        <div
          style={{
            fontSize: 10,
            color: "var(--ink-faint)",
            letterSpacing: "0.1em",
          }}
        >
          &nbsp;
        </div>
      </div>
      <div className="sc">···</div>
    </div>
  ));
}
