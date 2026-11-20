"use client";

import { useEffect, useImperativeHandle, useRef } from "react";
import type { GameCanvasProps } from "../types";
import { H, W } from "./constants";
import { BloqueBusterEngine } from "./engine";

export function BloqueBusterCanvas({
  paused,
  onSnapshot,
  onTogglePause,
  ref,
}: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<BloqueBusterEngine | null>(null);
  // Callbacks más recientes: el motor se crea una sola vez y no se recrea si cambian.
  const callbacksRef = useRef({ onSnapshot, onTogglePause });

  useEffect(() => {
    callbacksRef.current = { onSnapshot, onTogglePause };
  }, [onSnapshot, onTogglePause]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Buffer nítido en HiDPI; el motor dibuja en coordenadas lógicas 800×600.
    const dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.getContext("2d")?.setTransform(dpr, 0, 0, dpr, 0, 0);

    const engine = new BloqueBusterEngine(canvas, {
      onSnapshot: (s) => callbacksRef.current.onSnapshot(s),
      onTogglePause: () => callbacksRef.current.onTogglePause(),
    });
    engineRef.current = engine;
    engine.start();

    return () => {
      engine.destroy();
      engineRef.current = null;
    };
  }, []);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    if (paused) engine.pause();
    else engine.resume();
  }, [paused]);

  useImperativeHandle(
    ref,
    () => ({
      endGame: () => engineRef.current?.endGame(),
      restart: () => engineRef.current?.restart(),
    }),
    [],
  );

  return (
    <canvas
      ref={canvasRef}
      aria-label="Bloque Buster"
      style={{
        position: "absolute",
        inset: 0,
        display: "block",
        width: "100%",
        height: "100%",
      }}
    />
  );
}
