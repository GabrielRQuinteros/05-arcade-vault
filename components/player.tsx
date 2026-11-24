"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { fmt, type Game } from "@/lib/games";
import { GAME_COMPONENTS } from "@/games/registry";
import { TOUCH_BINDINGS } from "@/games/touch-bindings";
import type { GameHandle, GameSnapshot } from "@/games/types";
import { useTouchMode } from "@/lib/touch";
import type { ServerResponse } from "@/lib/server-response";
import type { SubmitResult } from "@/lib/scores-schema";
import { useSession } from "./session";
import { TouchControls } from "./touch-controls";

const INITIAL_SNAPSHOT: GameSnapshot = {
  score: 0,
  lives: 3,
  level: 1,
  state: "playing",
};

/** Estado del guardado automático al terminar una partida de un juego registrado. */
type SaveStatus =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "record"; rank: number }
  | { kind: "registered"; best: number }
  | { kind: "error" }
  | { kind: "guest" };

export function GamePlayer({ game }: { game: Game }) {
  const { user } = useSession();
  const touch = useTouchMode();
  // Juego real registrado; si no existe, se mantiene el reproductor simulado.
  const GameComponent = GAME_COMPONENTS[game.id];
  const simulated = GameComponent === undefined;
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [paused, setPaused] = useState(false);
  const [over, setOver] = useState(false);
  const [typedName, setTypedName] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  // Juego registrado: el motor es la única fuente de verdad de la partida.
  const [snapshot, setSnapshot] = useState<GameSnapshot>(INITIAL_SNAPSHOT);
  const gameRef = useRef<GameHandle>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>({ kind: "idle" });
  // Un único envío por partida (StrictMode / re-renders); se rearma al reiniciar.
  const sentRef = useRef(false);
  // Identifica la partida en curso: descarta respuestas de partidas anteriores.
  const runRef = useRef(0);

  const name = typedName ?? user?.name ?? "INVITADO";
  const hudScore = simulated ? score : snapshot.score;
  const hudLives = simulated ? lives : snapshot.lives;
  const hudLevel = simulated ? 1 + Math.floor(score / 2500) : snapshot.level;
  const gameOver = !simulated && snapshot.state === "gameover";

  const togglePause = () => setPaused((p) => !p);

  const submitScore = async (finalScore: number) => {
    const run = runRef.current;
    if (!user) {
      setSaveStatus({ kind: "guest" });
      return;
    }
    setSaveStatus({ kind: "saving" });
    try {
      const res = await fetch("/api/scores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameId: game.id, score: finalScore }),
      });
      const body = (await res.json()) as ServerResponse<SubmitResult>;
      if (run !== runRef.current) return;
      if (!body.ok || !body.data) {
        setSaveStatus({ kind: "error" });
        return;
      }
      setSaveStatus(
        body.data.isRecord
          ? { kind: "record", rank: body.data.rank }
          : { kind: "registered", best: body.data.best },
      );
    } catch {
      if (run === runRef.current) setSaveStatus({ kind: "error" });
    }
  };

  // El motor emite un snapshot por cada cambio; la transición a "gameover"
  // (perder la última vida o FIN) dispara el envío una sola vez.
  const onSnapshot = (s: GameSnapshot) => {
    setSnapshot(s);
    if (s.state === "gameover") {
      if (sentRef.current) return;
      sentRef.current = true;
      void submitScore(s.score);
    } else if (sentRef.current) {
      // Nueva partida (Espacio o JUGAR DE NUEVO): oculta la línea y rearma el envío.
      sentRef.current = false;
      runRef.current += 1;
      setSaveStatus({ kind: "idle" });
    }
  };

  const onFin = () => {
    if (simulated) {
      setOver(true);
      return;
    }
    setPaused(false);
    if (gameOver) gameRef.current?.restart();
    else gameRef.current?.endGame();
  };

  useEffect(() => {
    if (!simulated || over || paused) return;
    const t = setInterval(
      () => setScore((s) => s + Math.floor(10 + Math.random() * 90)),
      220,
    );
    return () => clearInterval(t);
  }, [simulated, over, paused]);

  const restart = () => {
    setScore(0);
    setLives(3);
    setPaused(false);
    setOver(false);
    setSaved(false);
  };

  const save = () => {
    try {
      const all = JSON.parse(localStorage.getItem("av_scores") || "[]");
      all.push({ game: game.id, score, name, at: Date.now() });
      localStorage.setItem("av_scores", JSON.stringify(all));
    } catch {}
    setSaved(true);
  };

  return (
    <div className="av-player fade-in">
      <div className="player-hud">
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
          <div className="hud-stat">
            <div className="l">Jugador</div>
            <div className="v" style={{ color: "var(--ink)" }}>
              {name}
            </div>
          </div>
          <div className="hud-stat">
            <div className="l">Puntuación</div>
            <div className="v">{fmt(hudScore)}</div>
          </div>
          <div className="hud-stat lives">
            <div className="l">Vidas</div>
            <div className="v">{"♥ ".repeat(hudLives).trim() || "—"}</div>
          </div>
          <div className="hud-stat level">
            <div className="l">Nivel</div>
            <div className="v">{String(hudLevel).padStart(2, "0")}</div>
          </div>
        </div>
        <div className="hud-actions">
          <button
            className="btn yellow"
            onClick={togglePause}
            disabled={gameOver}
          >
            {paused ? "REANUDAR" : "PAUSA"}
          </button>
          <button className="btn magenta" onClick={onFin}>
            {gameOver ? "JUGAR DE NUEVO" : "FIN"}
          </button>
          <Link href={`/juegos/${game.id}`} className="btn ghost">
            SALIR
          </Link>
        </div>
      </div>

      {gameOver && saveStatus.kind !== "idle" && (
        <SaveStatusLine status={saveStatus} />
      )}

      <div className="crt">
        <div className="crt-screen">
          {GameComponent ? (
            <GameComponent
              ref={gameRef}
              paused={paused}
              onSnapshot={onSnapshot}
              onTogglePause={togglePause}
            />
          ) : (
            <div className="game-arena">
              <div className="grid-floor"></div>
              <div className="enemy e1"></div>
              <div className="enemy e2"></div>
              <div className="enemy e3"></div>
              <div className="player-ship"></div>
            </div>
          )}
          {paused && (
            <div
              className="crt-content"
              style={{ background: "rgba(0,0,0,0.6)", zIndex: 5 }}
            >
              <div>
                <div className="pixel neon-yellow" style={{ fontSize: 22 }}>
                  EN PAUSA
                </div>
                <div
                  className="mono"
                  style={{
                    fontSize: 11,
                    color: "var(--ink-dim)",
                    marginTop: 10,
                    letterSpacing: "0.16em",
                  }}
                >
                  PULSA REANUDAR PARA CONTINUAR
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="crt-bottom">
          <span className="led">SEÑAL OK</span>
          <span>{game.title} · CRT-83 · 60 HZ</span>
          <span>CARGA · 1MB</span>
        </div>
      </div>

      {touch && !simulated && (
        <TouchControls bindings={TOUCH_BINDINGS[game.id] ?? { b: null }} />
      )}

      {over && (
        <div
          className="modal-bd"
          role="dialog"
          aria-modal="true"
          aria-label="Fin del juego"
        >
          <div className="modal">
            <h2>FIN DEL JUEGO</h2>
            <div className="final-label">PUNTUACIÓN FINAL</div>
            <div className="final">{fmt(score)}</div>
            {!saved ? (
              <div className="input-row">
                <input
                  value={name}
                  onChange={(e) =>
                    setTypedName(e.target.value.toUpperCase().slice(0, 10))
                  }
                  placeholder="TUS INICIALES"
                  aria-label="Tus iniciales"
                />
                <button className="btn yellow" onClick={save}>
                  GUARDAR PUNTUACIÓN
                </button>
              </div>
            ) : (
              <div className="toast-saved">▸ PUNTUACIÓN GUARDADA_</div>
            )}
            <div className="actions">
              <button className="btn" onClick={restart}>
                JUGAR DE NUEVO
              </button>
              <Link href="/biblioteca" className="btn magenta">
                VOLVER AL VAULT
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SaveStatusLine({ status }: { status: SaveStatus }) {
  switch (status.kind) {
    case "saving":
      return (
        <div className="save-status" role="status">
          ▸ GUARDANDO PUNTUACIÓN...
        </div>
      );
    case "record":
      return (
        <div className="save-status record" role="status">
          ▸ ¡NUEVO RÉCORD! · RANGO #{String(status.rank).padStart(2, "0")}
        </div>
      );
    case "registered":
      return (
        <div className="save-status registered" role="status">
          ▸ PUNTUACIÓN REGISTRADA · TU RÉCORD: {fmt(status.best)}
        </div>
      );
    case "error":
      return (
        <div className="save-status error" role="status">
          ▸ NO SE PUDO GUARDAR LA PUNTUACIÓN
        </div>
      );
    case "guest":
      return (
        <div className="save-status error" role="status">
          <Link href="/auth">▸ INICIA SESIÓN PARA GUARDAR TU PUNTUACIÓN</Link>
        </div>
      );
    default:
      return null;
  }
}
