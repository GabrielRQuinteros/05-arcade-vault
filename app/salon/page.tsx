import Link from "next/link";
import { headers } from "next/headers";
import { Suspense } from "react";
import { auth } from "@/lib/auth/auth";
import { GAMES, fmt, type Game } from "@/lib/games";
import { getTopScores, getUserBest, type LeaderboardRow } from "@/lib/scores";

const TOP_SIZE = 12;

export default function HallOfFame({ searchParams }: PageProps<"/salon">) {
  return (
    <div className="av-hall fade-in">
      <div className="hall-head">
        <h1>SALÓN DE LA FAMA</h1>
        <p className="pixel" style={{ fontSize: 10 }}>
          LOS NOMBRES QUE NUNCA SE BORRAN DE LA PANTALLA
        </p>
      </div>

      {/* searchParams, sesión y BD son datos de request: van dentro de Suspense. */}
      <Suspense fallback={<HallTabs activeId={null} />}>
        <HallContent searchParams={searchParams} />
      </Suspense>

      <div style={{ textAlign: "center", marginTop: 32 }}>
        <Link href="/biblioteca" className="btn lg">
          VOLVER A LA BIBLIOTECA
        </Link>
      </div>
    </div>
  );
}

/** `?juego=<id>`; sin parámetro o con id inválido → primer juego de GAMES. */
function resolveGame(param: string | string[] | undefined): Game {
  const id = Array.isArray(param) ? param[0] : param;
  return GAMES.find((g) => g.id === id) ?? GAMES[0];
}

function HallTabs({ activeId }: { activeId: string | null }) {
  return (
    <div className="hall-tabs">
      {GAMES.map((g) => (
        <Link
          key={g.id}
          href={`/salon?juego=${g.id}`}
          className={"chip" + (activeId === g.id ? " active" : "")}
          aria-current={activeId === g.id ? "page" : undefined}
        >
          {g.title}
        </Link>
      ))}
    </div>
  );
}

async function HallContent({
  searchParams,
}: {
  searchParams: PageProps<"/salon">["searchParams"];
}) {
  const { juego } = await searchParams;
  const game = resolveGame(juego);

  const [rows, session] = await Promise.all([
    getTopScores(game.id, TOP_SIZE),
    auth.api.getSession({ headers: await headers() }),
  ]);

  const userId = session?.user.id ?? null;
  const youInTop = userId !== null && rows.some((r) => r.userId === userId);
  const youBest =
    userId !== null && !youInTop ? await getUserBest(game.id, userId) : null;
  const youName = session
    ? (session.user.username ?? session.user.name).toUpperCase()
    : "";

  return (
    <>
      <HallTabs activeId={game.id} />

      <div className="podium">
        <PodiumSlot row={rows[1]} place="silver" />
        <PodiumSlot row={rows[0]} place="gold" />
        <PodiumSlot row={rows[2]} place="bronze" />
      </div>

      <div className="hall-table">
        <div className="th">
          <div>RANGO</div>
          <div>JUGADOR</div>
          <div>PUNTUACIÓN</div>
          <div>FECHA</div>
        </div>
        {rows.length === 0 && (
          <div className="tr hall-empty">▸ SIN PUNTUACIONES TODAVÍA</div>
        )}
        {rows.map((r, i) => (
          <div
            key={r.userId}
            className={
              "tr" +
              (i === 0 ? " top1" : i === 1 ? " top2" : i === 2 ? " top3" : "") +
              (r.userId === userId ? " you" : "")
            }
            style={{ animationDelay: `${i * 50}ms` }}
          >
            <div className="rk">#{String(r.rank).padStart(2, "0")}</div>
            <div className="pl">{r.name}</div>
            <div className="sc">{fmt(r.score)}</div>
            <div className="dt">{r.date}</div>
          </div>
        ))}
        {session && !youInTop && youBest && (
          <>
            <div className="tr you-label">▸ TU MEJOR MARCA EN {game.title}</div>
            <div
              className="tr you"
              style={{ animationDelay: `${rows.length * 50 + 50}ms` }}
            >
              <div className="rk" style={{ color: "var(--yellow)" }}>
                #{String(youBest.rank).padStart(2, "0")}
              </div>
              <div className="pl" style={{ color: "var(--yellow)" }}>
                {youName}
              </div>
              <div
                className="sc"
                style={{
                  color: "var(--yellow)",
                  textShadow: "0 0 6px rgba(245,255,0,0.5)",
                }}
              >
                {fmt(youBest.score)}
              </div>
              <div className="dt">{youBest.date}</div>
            </div>
          </>
        )}
        {session && !youInTop && !youBest && (
          <div className="tr you-label">
            ▸ AÚN NO TIENES MARCA EN {game.title}
          </div>
        )}
      </div>
    </>
  );
}

const PLACE_NUM = { gold: "01", silver: "02", bronze: "03" } as const;

function PodiumSlot({
  row,
  place,
}: {
  row: LeaderboardRow | undefined;
  place: keyof typeof PLACE_NUM;
}) {
  const gold = place === "gold";
  return (
    <div className={`podium-slot ${place}`}>
      {gold && (
        <div
          className="pixel"
          style={{ fontSize: 9, color: "var(--gold)", letterSpacing: "0.18em" }}
        >
          CAMPEÓN
        </div>
      )}
      <div
        className="rank-num"
        style={gold ? { fontSize: 36, marginTop: 4 } : undefined}
      >
        {PLACE_NUM[place]}
      </div>
      <div className="name">{row?.name ?? "—"}</div>
      <div className="score" style={gold ? { fontSize: 20 } : undefined}>
        {row ? fmt(row.score) : "—"}
      </div>
      {row && <div className="date">{row.date}</div>}
    </div>
  );
}
