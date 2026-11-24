"use client";

import { useEffect } from "react";
import { markTouch, readTouchMark } from "@/lib/touch";

/** Sin UI: marca la pestaña como táctil con el primer `pointerdown` de tipo touch. */
export function TouchDetector() {
  useEffect(() => {
    if (readTouchMark()) return;
    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType !== "touch") return;
      window.removeEventListener("pointerdown", onPointerDown);
      markTouch();
    };
    window.addEventListener("pointerdown", onPointerDown, { passive: true });
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, []);

  return null;
}
