"use client";

import { useSyncExternalStore } from "react";

export const TOUCH_STORAGE_KEY = "av_touch"; // sessionStorage, valor "1"
export const TOUCH_EVENT = "av:touch"; // CustomEvent en window al detectar el primer toque

// Respaldo en memoria si sessionStorage no está disponible (modo privado restringido).
let memoryTouch = false;

export function readTouchMark(): boolean {
  if (memoryTouch) return true;
  try {
    return sessionStorage.getItem(TOUCH_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

/** Marca la pestaña como táctil y avisa a los suscriptores. */
export function markTouch(): void {
  memoryTouch = true;
  try {
    sessionStorage.setItem(TOUCH_STORAGE_KEY, "1");
  } catch {}
  window.dispatchEvent(new CustomEvent(TOUCH_EVENT));
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener(TOUCH_EVENT, onChange);
  return () => window.removeEventListener(TOUCH_EVENT, onChange);
}

/** true si el dispositivo ya se detectó como táctil en esta pestaña. */
export function useTouchMode(): boolean {
  return useSyncExternalStore(subscribe, readTouchMark, () => false);
}
