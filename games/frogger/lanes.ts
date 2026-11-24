import { COLS, SPEED_FACTOR, TURTLE_CYCLE_MS } from "./constants";

export type EntityKind = "car" | "truck" | "log" | "turtle";

export interface Entity {
  /** Borde izquierdo en celdas; puede ser fraccionario. */
  x: number;
  /** Ancho en celdas. */
  width: number;
  kind: EntityKind;
  /** Desfase del ciclo de inmersión (ms); solo en carriles con `dives`. */
  diveOffset: number;
}

export interface Lane {
  row: number;
  /** Celdas/s, ya escalado por nivel. */
  speed: number;
  dir: 1 | -1;
  /** Longitud del loop en celdas (≥ COLS + ancho): al salir, la entidad se desplaza ±span. */
  span: number;
  entities: Entity[];
  /** Solo tortugas: alternan visibles / sumergidas. */
  dives: boolean;
  /** Índice de color (coches). */
  color: number;
}

type LaneDef = {
  row: number;
  kind: EntityKind;
  dir: 1 | -1;
  speed: number; // celdas/s en nivel 1
  width: number;
  count: number;
  gap: number; // celdas libres entre entidades
  dives?: boolean;
};

/** 6 carriles de río (filas 1–6) y 5 de carretera (filas 8–12), sentidos alternos. */
const LANE_DEFS: readonly LaneDef[] = [
  // Río
  { row: 1, kind: "log", dir: 1, speed: 3, width: 2, count: 5, gap: 2 },
  {
    row: 2,
    kind: "turtle",
    dir: -1,
    speed: 1.75,
    width: 3,
    count: 4,
    gap: 2,
    dives: true,
  },
  { row: 3, kind: "log", dir: 1, speed: 2, width: 4, count: 3, gap: 3 },
  {
    row: 4,
    kind: "turtle",
    dir: -1,
    speed: 2.5,
    width: 2,
    count: 5,
    gap: 2,
    dives: true,
  },
  { row: 5, kind: "log", dir: 1, speed: 1.5, width: 3, count: 4, gap: 2 },
  { row: 6, kind: "turtle", dir: -1, speed: 2, width: 3, count: 4, gap: 2 },
  // Carretera
  { row: 8, kind: "truck", dir: -1, speed: 2.25, width: 3, count: 3, gap: 4 },
  { row: 9, kind: "car", dir: 1, speed: 6, width: 1, count: 2, gap: 8 },
  { row: 10, kind: "truck", dir: -1, speed: 2.5, width: 2, count: 3, gap: 4 },
  { row: 11, kind: "car", dir: 1, speed: 3, width: 1, count: 3, gap: 5 },
  { row: 12, kind: "car", dir: -1, speed: 2.25, width: 1, count: 4, gap: 4 },
];

/** Carriles del nivel: velocidades base × 1.15^(level − 1), entidades espaciadas uniformemente. */
export function buildLanes(level: number): Lane[] {
  const mult = SPEED_FACTOR ** (level - 1);
  return LANE_DEFS.map((d, laneIdx) => {
    const spacing = d.width + d.gap;
    const span = Math.max(d.count * spacing, COLS + d.width);
    const entities: Entity[] = Array.from({ length: d.count }, (_, i) => ({
      x: i * spacing,
      width: d.width,
      kind: d.kind,
      diveOffset: d.dives ? (i * TURTLE_CYCLE_MS) / d.count : 0,
    }));
    return {
      row: d.row,
      speed: d.speed * mult,
      dir: d.dir,
      span,
      entities,
      dives: d.dives ?? false,
      color: laneIdx % 3,
    };
  });
}
