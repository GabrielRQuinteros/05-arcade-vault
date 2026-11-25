import {
  BOARD_H,
  BOARD_W,
  BOARD_X,
  BOARD_Y,
  CELL,
  GOAL_COLS,
  GOAL_WIDTH,
  H,
  PALETTE,
  ROW_GOALS,
  ROW_RIVER_BOT,
  ROW_RIVER_TOP,
  ROW_ROAD_BOT,
  ROW_ROAD_TOP,
  ROW_SAFE_MID,
  ROW_START,
  W,
} from "./constants";
import type { Direction } from "./input";

/** Sprite pre-renderizado; `pad` = margen lógico alrededor para que el glow no se recorte. */
export interface Sprite {
  canvas: ImageBitmap; // tamaño físico = (w + 2·pad)·dpr × (h + 2·pad)·dpr
  w: number; // ancho lógico de la entidad (px)
  h: number; // alto lógico de la entidad (px)
  pad: number; // px lógicos
}

type Ctx = OffscreenCanvasRenderingContext2D;

const FACING_ANGLE: Record<Direction, number> = {
  up: 0,
  right: Math.PI / 2,
  down: Math.PI,
  left: -Math.PI / 2,
};

/** Margen sin glow. */
const PAD_PLAIN = 2;
/** `pad` ≥ 2 × shadowBlur del elemento. */
const padFor = (blur: number) => blur * 2;

/**
 * Caché de render de Frogger: fondo estático y sprites con glow dibujados una
 * sola vez a resolución `dpr`. El motor solo los copia con `drawImage`.
 */
export class FroggerRenderCache {
  readonly background: ImageBitmap;
  private readonly dpr: number;
  private readonly sprites = new Map<string, Sprite>();

  constructor(dpr: number) {
    this.dpr = dpr;
    const [canvas, ctx] = this.createCanvas(W, H);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    paintBackground(ctx);
    this.background = canvas.transferToImageBitmap();
  }

  car(color: number, dir: 1 | -1): Sprite {
    return this.get(`car:${color}:${dir}`, CELL, CELL, padFor(10), (ctx) =>
      paintCar(ctx, color, dir),
    );
  }

  truck(width: number, dir: 1 | -1): Sprite {
    return this.get(
      `truck:${width}:${dir}`,
      width * CELL,
      CELL,
      padFor(10),
      (ctx) => paintTruck(ctx, width, dir),
    );
  }

  log(width: number): Sprite {
    return this.get(`log:${width}`, width * CELL, CELL, PAD_PLAIN, (ctx) =>
      paintLog(ctx, width),
    );
  }

  /** Tortuga emergida, 1 celda. */
  turtle(dir: 1 | -1): Sprite {
    return this.get(`turtle:${dir}`, CELL, CELL, padFor(8), (ctx) =>
      paintTurtle(ctx, dir),
    );
  }

  /** Anillo tenue de tortuga sumergida, 1 celda. */
  turtleSubmerged(): Sprite {
    return this.get("turtle-sub", CELL, CELL, PAD_PLAIN, paintTurtleSubmerged);
  }

  /** Rana centrada en un cuadro de 40·scale; se dibuja en (cx − w/2, cy − h/2). */
  frog(facing: Direction, jumping: boolean, scale: number): Sprite {
    const size = 40 * scale;
    return this.get(
      `frog:${facing}:${jumping ? 1 : 0}:${scale}`,
      size,
      size,
      padFor(12),
      (ctx) => paintFrog(ctx, size / 2, size / 2, facing, jumping, scale),
    );
  }

  private get(
    key: string,
    w: number,
    h: number,
    pad: number,
    paint: (ctx: Ctx) => void,
  ): Sprite {
    const cached = this.sprites.get(key);
    if (cached) return cached;
    const [canvas, ctx] = this.createCanvas(w + 2 * pad, h + 2 * pad);
    const dpr = this.dpr;
    ctx.setTransform(dpr, 0, 0, dpr, pad * dpr, pad * dpr);
    paint(ctx);
    const sprite: Sprite = {
      canvas: canvas.transferToImageBitmap(),
      w,
      h,
      pad,
    };
    this.sprites.set(key, sprite);
    return sprite;
  }

  private createCanvas(w: number, h: number): [OffscreenCanvas, Ctx] {
    const canvas = new OffscreenCanvas(
      Math.round(w * this.dpr),
      Math.round(h * this.dpr),
    );
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D no disponible");
    return [canvas, ctx];
  }
}

// ── Fondo estático ─────────────────────────────────────────────────────────

/** Fondo negro, zonas, bocas vacías y borde del tablero. */
function paintBackground(ctx: Ctx): void {
  ctx.fillStyle = PALETTE.background;
  ctx.fillRect(0, 0, W, H);
  paintZones(ctx);
  paintGoalBoxes(ctx);
  ctx.strokeStyle = PALETTE.border;
  ctx.lineWidth = 1;
  ctx.strokeRect(BOARD_X - 0.5, BOARD_Y - 0.5, BOARD_W + 1, BOARD_H + 1);
}

/** Fondos por zona: seto/bocas, río, mediana, carretera, base. */
function paintZones(ctx: Ctx): void {
  const rowY = (r: number) => BOARD_Y + r * CELL;

  ctx.fillStyle = PALETTE.hedge;
  ctx.fillRect(BOARD_X, rowY(ROW_GOALS), BOARD_W, CELL);

  ctx.fillStyle = PALETTE.river;
  ctx.fillRect(
    BOARD_X,
    rowY(ROW_RIVER_TOP),
    BOARD_W,
    (ROW_RIVER_BOT - ROW_RIVER_TOP + 1) * CELL,
  );
  ctx.strokeStyle = PALETTE.riverLine;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let r = ROW_RIVER_TOP; r <= ROW_RIVER_BOT; r++) {
    const y = rowY(r) + CELL / 2;
    for (let x = BOARD_X + 10; x < BOARD_X + BOARD_W; x += 40) {
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + 10, y - 4, x + 20, y);
    }
  }
  ctx.stroke();

  ctx.fillStyle = PALETTE.safe;
  ctx.fillRect(BOARD_X, rowY(ROW_SAFE_MID), BOARD_W, CELL);
  ctx.fillRect(BOARD_X, rowY(ROW_START), BOARD_W, CELL);

  ctx.fillStyle = PALETTE.road;
  ctx.fillRect(
    BOARD_X,
    rowY(ROW_ROAD_TOP),
    BOARD_W,
    (ROW_ROAD_BOT - ROW_ROAD_TOP + 1) * CELL,
  );
  ctx.strokeStyle = PALETTE.roadLine;
  ctx.setLineDash([16, 12]);
  ctx.beginPath();
  for (let r = ROW_ROAD_TOP + 1; r <= ROW_ROAD_BOT; r++) {
    ctx.moveTo(BOARD_X, rowY(r));
    ctx.lineTo(BOARD_X + BOARD_W, rowY(r));
  }
  ctx.stroke();
  ctx.setLineDash([]);
}

/** Cajas de las 5 bocas con su glow (sin ranas). */
function paintGoalBoxes(ctx: Ctx): void {
  for (const g of GOAL_COLS) {
    const x = BOARD_X + g * CELL + 3;
    const y = BOARD_Y + ROW_GOALS * CELL + 3;
    const w = GOAL_WIDTH * CELL - 6;
    const h = CELL - 6;
    ctx.fillStyle = PALETTE.goal;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = PALETTE.goalBorder;
    ctx.lineWidth = 2;
    ctx.shadowColor = PALETTE.goalBorder;
    ctx.shadowBlur = 6;
    ctx.strokeRect(x, y, w, h);
    ctx.shadowBlur = 0;
  }
}

// ── Entidades (origen = esquina superior izquierda) ──────────────────────

function paintCar(ctx: Ctx, colorIdx: number, dir: 1 | -1): void {
  const color = PALETTE.carColors[colorIdx];
  // Ruedas
  ctx.fillStyle = PALETTE.wheel;
  for (const wx of [7, CELL - 15]) {
    ctx.fillRect(wx, 5, 8, 5);
    ctx.fillRect(wx, CELL - 10, 8, 5);
  }
  // Carrocería
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 10;
  ctx.beginPath();
  ctx.roundRect(4, 9, CELL - 8, CELL - 18, 5);
  ctx.fill();
  ctx.shadowBlur = 0;
  // Parabrisas en el frente
  ctx.fillStyle = PALETTE.wheel;
  const front = dir > 0 ? CELL - 14 : 8;
  ctx.fillRect(front, 13, 6, CELL - 26);
}

function paintTruck(ctx: Ctx, width: number, dir: 1 | -1): void {
  const len = width * CELL;
  const cab = CELL * 0.6;
  const cabX = dir > 0 ? len - cab - 3 : 3;
  const trailerX = dir > 0 ? 3 : 3 + cab + 3;
  const trailerW = len - cab - 9;
  ctx.fillStyle = PALETTE.truck;
  ctx.fillRect(trailerX, 6, trailerW, CELL - 12);
  ctx.fillStyle = PALETTE.wheel;
  for (let i = 0; i < width; i++) {
    ctx.fillRect(trailerX + 6 + i * CELL * 0.8, CELL / 2 - 1, 14, 2);
  }
  ctx.fillStyle = PALETTE.truckCab;
  ctx.shadowColor = PALETTE.truckCab;
  ctx.shadowBlur = 10;
  ctx.beginPath();
  ctx.roundRect(cabX, 8, cab, CELL - 16, 4);
  ctx.fill();
  ctx.shadowBlur = 0;
}

function paintLog(ctx: Ctx, width: number): void {
  const len = width * CELL;
  ctx.fillStyle = PALETTE.log;
  ctx.beginPath();
  ctx.roundRect(2, 6, len - 4, CELL - 12, 12);
  ctx.fill();
  ctx.strokeStyle = PALETTE.logGrain;
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i < width; i++) {
    const x0 = 10 + i * CELL;
    ctx.moveTo(x0, 15);
    ctx.lineTo(x0 + 18, 15);
    ctx.moveTo(x0 + 8, 25);
    ctx.lineTo(x0 + 26, 25);
  }
  ctx.stroke();
}

function paintTurtle(ctx: Ctx, dir: 1 | -1): void {
  const cx = CELL / 2;
  const cy = CELL / 2;
  // Cabeza en el sentido de avance
  ctx.fillStyle = PALETTE.turtle;
  ctx.beginPath();
  ctx.arc(cx + dir * 15, cy, 4, 0, Math.PI * 2);
  ctx.fill();
  // Caparazón
  ctx.shadowColor = PALETTE.turtle;
  ctx.shadowBlur = 8;
  ctx.beginPath();
  ctx.arc(cx, cy, 13, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  // Escamas
  ctx.strokeStyle = PALETTE.turtleShell;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(cx, cy, 6, 0, Math.PI * 2);
  ctx.moveTo(cx, cy - 13);
  ctx.lineTo(cx, cy - 6);
  ctx.moveTo(cx, cy + 6);
  ctx.lineTo(cx, cy + 13);
  ctx.moveTo(cx - 13, cy);
  ctx.lineTo(cx - 6, cy);
  ctx.moveTo(cx + 6, cy);
  ctx.lineTo(cx + 13, cy);
  ctx.stroke();
}

function paintTurtleSubmerged(ctx: Ctx): void {
  ctx.globalAlpha = 0.25;
  ctx.strokeStyle = PALETTE.turtle;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(CELL / 2, CELL / 2, 13, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

/** Rana vista desde arriba, mirando hacia `facing`; patas extendidas al saltar. */
function paintFrog(
  ctx: Ctx,
  cx: number,
  cy: number,
  facing: Direction,
  jumping: boolean,
  scale: number,
): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(FACING_ANGLE[facing]);
  ctx.scale(scale, scale);

  // Patas
  ctx.fillStyle = PALETTE.frog;
  const back = jumping ? 17 : 11;
  const front = jumping ? -15 : -10;
  for (const s of [-1, 1]) {
    ctx.fillRect(s * 13 - 3, back - 3, 6, 6);
    ctx.fillRect(s * 12 - 2.5, front - 2.5, 5, 5);
  }

  // Cuerpo
  ctx.shadowColor = PALETTE.frog;
  ctx.shadowBlur = 12;
  ctx.beginPath();
  ctx.ellipse(0, 0, 12, 14, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  // Ojos
  for (const s of [-1, 1]) {
    ctx.fillStyle = PALETTE.eyeWhite;
    ctx.beginPath();
    ctx.arc(s * 7, -9, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PALETTE.eyes;
    ctx.beginPath();
    ctx.arc(s * 7, -10, 2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}
