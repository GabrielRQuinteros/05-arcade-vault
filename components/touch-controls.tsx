"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { A_CODE, DPAD_CODES, type TouchBindings } from "@/games/touch-bindings";

const REPEAT_DELAY_MS = 170;
const REPEAT_INTERVAL_MS = 50;
/** Fracción del radio del D-pad sin dirección pulsada. */
const DPAD_DEAD_ZONE = 0.2;

/** `key` que acompaña a cada `code` en el evento sintético. */
const KEY_FOR_CODE: Record<string, string> = {
  ArrowUp: "ArrowUp",
  ArrowDown: "ArrowDown",
  ArrowLeft: "ArrowLeft",
  ArrowRight: "ArrowRight",
  Space: " ",
  KeyW: "w",
  KeyX: "x",
};

type Dir = keyof typeof DPAD_CODES;

const DIRS: { dir: Dir; label: string; glyph: string }[] = [
  { dir: "up", label: "Arriba", glyph: "▲" },
  { dir: "left", label: "Izquierda", glyph: "◀" },
  { dir: "right", label: "Derecha", glyph: "▶" },
  { dir: "down", label: "Abajo", glyph: "▼" },
];

function dispatchKey(type: "keydown" | "keyup", code: string, repeat = false) {
  window.dispatchEvent(
    new KeyboardEvent(type, {
      code,
      key: KEY_FOR_CODE[code] ?? code,
      bubbles: true,
      cancelable: true,
      repeat,
    }),
  );
}

type Props = { bindings: TouchBindings };

/**
 * D-pad + botones A/B que despachan `KeyboardEvent` sintéticos en `window`
 * con el mismo `code` que la tecla física. Estado por `pointerId` (multitouch).
 */
export function TouchControls({ bindings }: Props) {
  // pointerId → code pulsado por ese puntero.
  const pressedRef = useRef(new Map<number, string>());
  // pointerId → temporizador de auto-repeat (timeout inicial o intervalo).
  const timersRef = useRef(new Map<number, number>());
  const [active, setActive] = useState<ReadonlySet<string>>(new Set());

  const sync = useCallback(() => {
    setActive(new Set(pressedRef.current.values()));
  }, []);

  const stopTimer = useCallback((id: number) => {
    const t = timersRef.current.get(id);
    if (t !== undefined) {
      window.clearTimeout(t);
      window.clearInterval(t);
      timersRef.current.delete(id);
    }
  }, []);

  /** Suelta lo que pulsa el puntero `id` (solo su propio code). */
  const release = useCallback(
    (id: number) => {
      const code = pressedRef.current.get(id);
      stopTimer(id);
      if (code === undefined) return;
      pressedRef.current.delete(id);
      dispatchKey("keyup", code);
      sync();
    },
    [stopTimer, sync],
  );

  /** El puntero `id` pasa a pulsar `code` (o nada); suelta lo anterior si cambió. */
  const press = useCallback(
    (id: number, code: string | null) => {
      if (pressedRef.current.get(id) === code) return;
      release(id);
      if (code === null) return;
      pressedRef.current.set(id, code);
      dispatchKey("keydown", code);
      timersRef.current.set(
        id,
        window.setTimeout(() => {
          timersRef.current.set(
            id,
            window.setInterval(
              () => dispatchKey("keydown", code, true),
              REPEAT_INTERVAL_MS,
            ),
          );
        }, REPEAT_DELAY_MS),
      );
      sync();
    },
    [release, sync],
  );

  const releaseAll = useCallback(() => {
    for (const id of [...pressedRef.current.keys()]) release(id);
    for (const id of [...timersRef.current.keys()]) stopTimer(id);
  }, [release, stopTimer]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "hidden") releaseAll();
    };
    window.addEventListener("blur", releaseAll);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("blur", releaseAll);
      document.removeEventListener("visibilitychange", onVisibility);
      releaseAll();
    };
  }, [releaseAll]);

  // ---- D-pad: dirección por posición del dedo respecto al centro ----
  const dpadCode = (e: ReactPointerEvent<HTMLElement>): string | null => {
    const rect = e.currentTarget.getBoundingClientRect();
    const radius = rect.width / 2;
    if (radius === 0) return null;
    const dx = (e.clientX - (rect.left + radius)) / radius;
    const dy = (e.clientY - (rect.top + rect.height / 2)) / radius;
    if (Math.hypot(dx, dy) < DPAD_DEAD_ZONE) return null;
    if (Math.abs(dx) > Math.abs(dy))
      return dx < 0 ? DPAD_CODES.left : DPAD_CODES.right;
    return dy < 0 ? DPAD_CODES.up : DPAD_CODES.down;
  };

  const onDpadDown = (e: ReactPointerEvent<HTMLElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    press(e.pointerId, dpadCode(e));
  };

  const onDpadMove = (e: ReactPointerEvent<HTMLElement>) => {
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
    press(e.pointerId, dpadCode(e));
  };

  // ---- Botones A/B ----
  const buttonDown =
    (code: string | null) => (e: ReactPointerEvent<HTMLElement>) => {
      e.preventDefault();
      if (code === null) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      press(e.pointerId, code);
    };

  const end = (e: ReactPointerEvent<HTMLElement>) => release(e.pointerId);

  const releaseHandlers = {
    onPointerUp: end,
    onPointerCancel: end,
    onLostPointerCapture: end,
  };

  return (
    <div className="touch-controls" onContextMenu={(e) => e.preventDefault()}>
      <div
        className="dpad"
        role="group"
        aria-label="Cruceta"
        onPointerDown={onDpadDown}
        onPointerMove={onDpadMove}
        {...releaseHandlers}
      >
        {DIRS.map(({ dir, label, glyph }) => (
          <button
            key={dir}
            type="button"
            tabIndex={-1}
            aria-label={label}
            className={`dir ${dir}${active.has(DPAD_CODES[dir]) ? " on" : ""}`}
          >
            <span aria-hidden="true">{glyph}</span>
          </button>
        ))}
        <span className="dpad-hub" aria-hidden="true" />
      </div>

      <div className="tbtns">
        <button
          type="button"
          tabIndex={-1}
          aria-label="Botón B"
          disabled={bindings.b === null}
          className={`tbtn b${bindings.b !== null && active.has(bindings.b) ? " on" : ""}`}
          onPointerDown={buttonDown(bindings.b)}
          {...releaseHandlers}
        >
          B
        </button>
        <button
          type="button"
          tabIndex={-1}
          aria-label="Botón A"
          className={`tbtn a${active.has(A_CODE) ? " on" : ""}`}
          onPointerDown={buttonDown(A_CODE)}
          {...releaseHandlers}
        >
          A
        </button>
      </div>
    </div>
  );
}
