"use client";

import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import type { User } from "./session";

type Props = { user: NonNullable<User>; onSignOut: () => Promise<void> };

export function UserMenu({ user, onSignOut }: Props) {
  const pathname = usePathname();
  // Guarda la ruta en la que se abrió: al navegar, `open` pasa a false solo.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const itemRef = useRef<HTMLButtonElement>(null);
  const focusItemOnOpen = useRef(false);
  const id = useId();

  const close = (returnFocus = false) => {
    setOpenOn(null);
    if (returnFocus) buttonRef.current?.focus();
  };

  useEffect(() => {
    if (!open) return;
    if (focusItemOnOpen.current) {
      focusItemOnOpen.current = false;
      itemRef.current?.focus();
    }
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpenOn(null);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpenOn(null);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const openMenu = (focusItem: boolean) => {
    focusItemOnOpen.current = focusItem;
    setOpenOn(pathname);
  };

  return (
    <div
      ref={rootRef}
      className="user-menu"
      onBlur={(e) => {
        // Tab fuera del menú lo cierra.
        if (open && !rootRef.current?.contains(e.relatedTarget as Node | null))
          setOpenOn(null);
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        className="btn ghost auth-btn"
        id={`${id}-btn`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={`${id}-menu`}
        // detail === 0 → activado con teclado (Enter/Espacio): foco al primer ítem.
        onClick={(e) => (open ? close() : openMenu(e.detail === 0))}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            openMenu(true);
          }
        }}
      >
        {user.name} ▾
      </button>

      {open && (
        <div className="user-menu-panel">
          <div className="user-menu-id">
            <div className="user-menu-name">{user.name}</div>
            <div className="user-menu-email">{user.email}</div>
          </div>
          <div role="menu" id={`${id}-menu`} aria-labelledby={`${id}-btn`}>
            <button
              ref={itemRef}
              type="button"
              role="menuitem"
              className="user-menu-item"
              onClick={() => {
                close();
                void onSignOut();
              }}
            >
              ▸ CERRAR SESIÓN
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
