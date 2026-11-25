import type { GameSnapshot } from "../types";
import {
  BOARD_H,
  BOARD_W,
  BOARD_X,
  BOARD_Y,
  CELL,
  COLS,
  DEAD_MS,
  GOAL_COLS,
  GOAL_POINTS,
  GOAL_WIDTH,
  H,
  JUMP_MS,
  PALETTE,
  READY_MS,
  ROUND_POINTS,
  ROW_GOALS,
  ROW_RIVER_BOT,
  ROW_RIVER_TOP,
  ROW_ROAD_BOT,
  ROW_ROAD_TOP,
  ROW_SAFE_MID,
  ROW_START,
  START_COL,
  START_LIVES,
  STEP_POINTS,
  TIME_BONUS_PER_SEC,
  timeLimitMs,
  TURTLE_CYCLE_MS,
  TURTLE_UP_MS,
  TURTLE_WARN_MS,
  W,
} from "./constants";
import { type Action, type Direction, Input, isDirection } from "./input";
import { buildLanes, type Entity, type Lane } from "./lanes";
import { FroggerRenderCache, type Sprite } from "./render-cache";

type PlayState = GameSnapshot["state"];

export type EngineCallbacks = {
  onSnapshot: (s: GameSnapshot) => void;
  onTogglePause: () => void;
};

interface Frog {
  /** Borde izquierdo en celdas (fraccionario solo por arrastre en el río). */
  x: number;
  row: number;
  facing: Direction;
}

interface Jump {
  t: number; // ms transcurridos, 0..JUMP_MS
  fromX: number;
  fromRow: number;
  toX: number;
  toRow: number;
}

/** Margen lateral del cuerpo de la rana para colisiones con vehículos (celdas). */
const FROG_HIT_INSET = 0.15;

const STRIP_Y = 26;
const TIME_BAR_X = 450;
const TIME_BAR_W = 230;
const TIME_BAR_Y = 14;
const TIME_BAR_H = 12;
const BLINK_PERIOD_MS = 100;

const isRiver = (row: number) => row >= ROW_RIVER_TOP && row <= ROW_RIVER_BOT;
const isRoad = (row: number) => row >= ROW_ROAD_TOP && row <= ROW_ROAD_BOT;
const clampCol = (x: number) => Math.min(COLS - 1, Math.max(0, x));

/**
 * Motor de Frogger sin globales. Dibuja en coordenadas lógicas 800×600 con el
 * tablero 640×560 en (80, 40); el escalado por devicePixelRatio lo aplica quien
 * crea el canvas. Solo dibuja valores propios del juego (tiempo, bocas);
 * puntuación, vidas y nivel se publican vía `onSnapshot`.
 */
export class FroggerEngine {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly input = new Input();
  private readonly cb: EngineCallbacks;
  /** Fondo y sprites pre-renderizados; vive lo que vive el motor. */
  private readonly cache: FroggerRenderCache;

  private lanes: Lane[] = [];
  private frog: Frog = { x: START_COL, row: ROW_START, facing: "up" };
  private jump: Jump | null = null;
  private pendingDir: Direction | null = null;
  private goals: boolean[] = [];
  private score = 0;
  private level = 1;
  private lives = START_LIVES;
  private state: PlayState = "playing";
  private readyLeft = READY_MS;
  private deadLeft = 0;
  private timeLeft = timeLimitMs(1);
  /** Fila más alta alcanzada en el intento actual (para +10 por fila nueva). */
  private minRow = ROW_START;
  /** Reloj de juego (ms) para el ciclo de las tortugas; se congela en pausa. */
  private clock = 0;

  private started = false;
  private rafId: number | null = null;
  private paused = false;
  private lastTime: number | null = null;
  private lastSnapshot: GameSnapshot | null = null;

  constructor(canvas: HTMLCanvasElement, cb: EngineCallbacks) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D no disponible");
    this.ctx = ctx;
    this.cb = cb;
    // El canvas ya viene dimensionado a W·dpr por quien lo crea.
    this.cache = new FroggerRenderCache(canvas.width / W);
    this.initGame();
  }

  // ── API pública ───────────────────────────────────────────────────────────

  start(): void {
    if (this.started) return;
    this.started = true;
    this.input.attach();
    this.emitSnapshot();
    this.draw();
    this.rafId = requestAnimationFrame(this.loop);
  }

  pause(): void {
    this.paused = true;
    this.input.clear();
    this.pendingDir = null;
  }

  resume(): void {
    this.paused = false;
    this.lastTime = null;
  }

  endGame(): void {
    if (this.state === "gameover") return;
    this.gameOver();
    this.emitSnapshot();
    this.draw();
  }

  restart(): void {
    this.initGame();
    this.input.clear();
    this.lastTime = null;
    this.emitSnapshot();
    this.draw();
  }

  destroy(): void {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.rafId = null;
    this.input.detach();
  }

  // ── Loop ─────────────────────────────────────────────────────────────────

  private loop = (ts: number): void => {
    const actions = this.input.drain();
    if (this.paused) {
      if (actions.includes("pause")) this.cb.onTogglePause();
    } else {
      const dt = this.lastTime === null ? 0 : Math.min(50, ts - this.lastTime);
      this.lastTime = ts;
      this.handleActions(actions);
      this.update(dt);
      this.draw();
      this.emitSnapshot();
    }
    this.rafId = requestAnimationFrame(this.loop);
  };

  // ── Estado ───────────────────────────────────────────────────────────────

  private initGame(): void {
    this.score = 0;
    this.level = 1;
    this.lives = START_LIVES;
    this.state = "playing";
    this.readyLeft = READY_MS;
    this.deadLeft = 0;
    this.clock = 0;
    this.goals = GOAL_COLS.map(() => false);
    this.lanes = buildLanes(this.level);
    this.resetFrog();
  }

  /** Rana a la base, columna central; reinicia temporizador y progreso del intento. */
  private resetFrog(): void {
    this.frog = { x: START_COL, row: ROW_START, facing: "up" };
    this.jump = null;
    this.pendingDir = null;
    this.minRow = ROW_START;
    this.timeLeft = timeLimitMs(this.level);
  }

  private gameOver(): void {
    this.state = "gameover";
    this.lives = 0;
    this.jump = null;
    this.pendingDir = null;
  }

  private killFrog(): void {
    if (this.state !== "playing") return;
    this.lives = Math.max(0, this.lives - 1);
    this.jump = null;
    this.pendingDir = null;
    if (this.lives === 0) {
      this.gameOver();
      return;
    }
    this.state = "dead";
    this.deadLeft = DEAD_MS;
  }

  private completeRound(): void {
    this.score += ROUND_POINTS;
    this.goals = GOAL_COLS.map(() => false);
    this.level++;
    this.lanes = buildLanes(this.level);
    this.resetFrog();
  }

  private emitSnapshot(): void {
    const prev = this.lastSnapshot;
    if (
      prev &&
      prev.score === this.score &&
      prev.lives === this.lives &&
      prev.level === this.level &&
      prev.state === this.state
    ) {
      return;
    }
    const snap: GameSnapshot = {
      score: this.score,
      lives: this.lives,
      level: this.level,
      state: this.state,
    };
    this.lastSnapshot = snap;
    this.cb.onSnapshot(snap);
  }

  // ── Update ───────────────────────────────────────────────────────────────

  private handleActions(actions: Action[]): void {
    for (const action of actions) {
      if (this.state === "gameover") {
        if (action === "restart") {
          this.initGame();
          return;
        }
        continue;
      }
      if (action === "pause") {
        this.cb.onTogglePause();
        return;
      }
      if (
        isDirection(action) &&
        this.state === "playing" &&
        this.readyLeft <= 0
      ) {
        // Buffer de 1 dirección: la última pulsación gana.
        this.pendingDir = action;
      }
    }
  }

  private update(dt: number): void {
    this.clock += dt;
    this.moveEntities(dt);

    if (this.state === "gameover") return;

    if (this.readyLeft > 0) {
      this.readyLeft = Math.max(0, this.readyLeft - dt);
      return;
    }

    if (this.state === "dead") {
      this.deadLeft -= dt;
      if (this.deadLeft <= 0) {
        this.state = "playing";
        this.resetFrog();
      }
      return;
    }

    if (!this.jump && this.pendingDir) {
      this.startJump(this.pendingDir);
      this.pendingDir = null;
    }

    if (this.jump) {
      this.jump.t += dt;
      if (this.jump.t >= JUMP_MS) this.land();
      else this.checkRoad();
    } else {
      this.checkHazards(dt);
    }
    if (this.state !== "playing") return;

    this.timeLeft -= dt;
    if (this.timeLeft <= 0) {
      this.timeLeft = 0;
      this.killFrog();
    }
  }

  /** Avanza cada entidad y la reintroduce por el lado opuesto al salir. */
  private moveEntities(dt: number): void {
    for (const lane of this.lanes) {
      const dx = (lane.speed * lane.dir * dt) / 1000;
      for (const e of lane.entities) {
        e.x += dx;
        if (lane.dir > 0 && e.x >= COLS) e.x -= lane.span;
        else if (lane.dir < 0 && e.x + e.width <= 0) e.x += lane.span;
      }
    }
  }

  private startJump(dir: Direction): void {
    const { x, row } = this.frog;
    let toX = x;
    let toRow = row;
    if (dir === "left") toX = clampCol(x - 1);
    else if (dir === "right") toX = clampCol(x + 1);
    else {
      toRow =
        dir === "up"
          ? Math.max(ROW_GOALS, row - 1)
          : Math.min(ROW_START, row + 1);
      // Fuera del río la rana vuelve a la grilla.
      if (!isRiver(toRow)) toX = clampCol(Math.round(x));
    }
    this.frog.facing = dir;
    if (toX === x && toRow === row) return;
    this.jump = { t: 0, fromX: x, fromRow: row, toX, toRow };
  }

  private land(): void {
    const j = this.jump;
    if (!j) return;
    this.frog.x = j.toX;
    this.frog.row = j.toRow;
    this.jump = null;

    if (this.frog.row < this.minRow) {
      this.score += STEP_POINTS * (this.minRow - this.frog.row);
      this.minRow = this.frog.row;
    }

    if (this.frog.row === ROW_GOALS) this.reachGoal();
    else this.checkHazards(0);
  }

  /** Boca libre: se ocupa y suma; seto o boca ocupada: muerte. */
  private reachGoal(): void {
    const c = Math.floor(this.frog.x + 0.5);
    const idx = GOAL_COLS.findIndex((g) => c >= g && c < g + GOAL_WIDTH);
    if (idx < 0 || this.goals[idx]) {
      this.killFrog();
      return;
    }
    this.goals[idx] = true;
    this.score +=
      GOAL_POINTS + Math.ceil(this.timeLeft / 1000) * TIME_BONUS_PER_SEC;
    if (this.goals.every(Boolean)) this.completeRound();
    else this.resetFrog();
  }

  private laneAt(row: number): Lane | undefined {
    return this.lanes.find((l) => l.row === row);
  }

  /** Colisión con vehículos en la posición visual actual (también a mitad de salto). */
  private checkRoad(): void {
    const { x, row } = this.visualPos();
    const r = Math.round(row);
    if (!isRoad(r)) return;
    const lane = this.laneAt(r);
    if (!lane) return;
    const left = x + FROG_HIT_INSET;
    const right = x + 1 - FROG_HIT_INSET;
    for (const e of lane.entities) {
      if (left < e.x + e.width && right > e.x) {
        this.killFrog();
        return;
      }
    }
  }

  /** Carretera: vehículos. Río: soporte, arrastre y bordes. */
  private checkHazards(dt: number): void {
    const row = this.frog.row;
    if (isRoad(row)) {
      this.checkRoad();
      return;
    }
    if (!isRiver(row)) return;
    const lane = this.laneAt(row);
    const support = lane ? this.getSupport(lane) : null;
    if (!lane || !support) {
      this.killFrog();
      return;
    }
    this.frog.x += (lane.speed * lane.dir * dt) / 1000;
    const cx = this.frog.x + 0.5;
    if (cx < 0 || cx >= COLS) this.killFrog();
  }

  /** Entidad bajo el centro de la rana; tortugas sumergidas no cuentan. */
  private getSupport(lane: Lane): Entity | null {
    const cx = this.frog.x + 0.5;
    for (const e of lane.entities) {
      if (cx >= e.x && cx < e.x + e.width) {
        return this.isSubmerged(lane, e) ? null : e;
      }
    }
    return null;
  }

  private divePhase(e: Entity): number {
    return (this.clock + e.diveOffset) % TURTLE_CYCLE_MS;
  }

  private isSubmerged(lane: Lane, e: Entity): boolean {
    return lane.dives && this.divePhase(e) >= TURTLE_UP_MS;
  }

  private isWarning(lane: Lane, e: Entity): boolean {
    if (!lane.dives) return false;
    const p = this.divePhase(e);
    return p >= TURTLE_UP_MS - TURTLE_WARN_MS && p < TURTLE_UP_MS;
  }

  /** Posición interpolada (celdas) durante el salto. */
  private visualPos(): { x: number; row: number } {
    const j = this.jump;
    if (!j) return { x: this.frog.x, row: this.frog.row };
    const k = Math.min(1, j.t / JUMP_MS);
    return {
      x: j.fromX + (j.toX - j.fromX) * k,
      row: j.fromRow + (j.toRow - j.fromRow) * k,
    };
  }

  // ── Draw ─────────────────────────────────────────────────────────────────

  private draw(): void {
    const ctx = this.ctx;
    // Fondo estático (zonas, bocas vacías, borde) pre-renderizado.
    ctx.drawImage(this.cache.background, 0, 0, W, H);

    this.drawStrip();
    this.drawGoalFrogs();

    ctx.save();
    ctx.beginPath();
    ctx.rect(BOARD_X, BOARD_Y, BOARD_W, BOARD_H);
    ctx.clip();
    for (const lane of this.lanes) this.drawLane(lane);
    this.drawPlayerFrog();
    ctx.restore();

    if (this.state === "gameover") this.drawGameOver();
    else if (this.readyLeft > 0) this.drawReady();
  }

  /** Copia un sprite con su esquina superior izquierda lógica en (x, y). */
  private blit(s: Sprite, x: number, y: number): void {
    this.ctx.drawImage(
      s.canvas,
      x - s.pad,
      y - s.pad,
      s.w + 2 * s.pad,
      s.h + 2 * s.pad,
    );
  }

  private drawStrip(): void {
    const ctx = this.ctx;
    ctx.textBaseline = "alphabetic";
    ctx.textAlign = "left";
    ctx.fillStyle = PALETTE.label;
    ctx.font = "14px monospace";
    ctx.fillText("BOCAS", BOARD_X, STRIP_Y);
    ctx.fillStyle = PALETTE.value;
    ctx.font = "bold 20px monospace";
    const filled = this.goals.filter(Boolean).length;
    ctx.fillText(`${filled}/${GOAL_COLS.length}`, BOARD_X + 58, STRIP_Y + 1);

    ctx.textAlign = "right";
    ctx.fillStyle = PALETTE.label;
    ctx.font = "14px monospace";
    ctx.fillText("TIEMPO", TIME_BAR_X - 12, STRIP_Y);

    const limit = timeLimitMs(this.level);
    const ratio = Math.max(0, Math.min(1, this.timeLeft / limit));
    const color =
      ratio > 0.5
        ? PALETTE.timeOk
        : ratio > 0.25
          ? PALETTE.timeWarn
          : PALETTE.timeLow;
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.2;
    ctx.fillRect(TIME_BAR_X, TIME_BAR_Y, TIME_BAR_W, TIME_BAR_H);
    ctx.globalAlpha = 1;
    ctx.fillRect(TIME_BAR_X, TIME_BAR_Y, TIME_BAR_W * ratio, TIME_BAR_H);

    ctx.fillStyle = PALETTE.value;
    ctx.font = "bold 18px monospace";
    ctx.fillText(
      `${Math.ceil(this.timeLeft / 1000)}s`,
      BOARD_X + BOARD_W,
      STRIP_Y + 1,
    );
  }

  /** Fondos por zona: seto/bocas, río, mediana, carretera, base. */
  /** Ranas en las bocas ocupadas. */
  private drawGoalFrogs(): void {
    const sprite = this.cache.frog("down", false, 0.8);
    GOAL_COLS.forEach((g, i) => {
      if (!this.goals[i]) return;
      const cx = BOARD_X + (g + GOAL_WIDTH / 2) * CELL;
      const cy = BOARD_Y + ROW_GOALS * CELL + CELL / 2;
      this.blit(sprite, cx - sprite.w / 2, cy - sprite.h / 2);
    });
  }

  private drawLane(lane: Lane): void {
    const py = BOARD_Y + lane.row * CELL;
    for (const e of lane.entities) {
      const px = BOARD_X + e.x * CELL;
      if (px > BOARD_X + BOARD_W || px + e.width * CELL < BOARD_X) continue;
      switch (e.kind) {
        case "car":
          this.blit(this.cache.car(lane.color, lane.dir), px, py);
          break;
        case "truck":
          this.blit(this.cache.truck(e.width, lane.dir), px, py);
          break;
        case "log":
          this.blit(this.cache.log(e.width), px, py);
          break;
        case "turtle":
          this.drawTurtles(px, py, e, lane);
          break;
      }
    }
  }

  private drawTurtles(px: number, py: number, e: Entity, lane: Lane): void {
    const ctx = this.ctx;
    const submerged = this.isSubmerged(lane, e);
    const blinkOff =
      !submerged &&
      this.isWarning(lane, e) &&
      Math.floor(this.clock / BLINK_PERIOD_MS) % 2 === 1;
    const sprite = submerged
      ? this.cache.turtleSubmerged()
      : this.cache.turtle(lane.dir);
    if (blinkOff) ctx.globalAlpha = 0.35;
    for (let i = 0; i < e.width; i++) this.blit(sprite, px + i * CELL, py);
    ctx.globalAlpha = 1;
  }

  private drawPlayerFrog(): void {
    const { x, row } = this.visualPos();
    const cx = BOARD_X + x * CELL + CELL / 2;
    const cy = BOARD_Y + row * CELL + CELL / 2;
    if (this.state === "dead" || this.state === "gameover") {
      this.drawDeadMark(cx, cy);
      return;
    }
    const sprite = this.cache.frog(this.frog.facing, this.jump !== null, 1);
    this.blit(sprite, cx - sprite.w / 2, cy - sprite.h / 2);
  }

  private drawDeadMark(cx: number, cy: number): void {
    const ctx = this.ctx;
    if (
      this.state === "dead" &&
      Math.floor(this.deadLeft / BLINK_PERIOD_MS) % 2 === 1
    ) {
      return;
    }
    ctx.strokeStyle = PALETTE.dead;
    ctx.lineWidth = 4;
    ctx.shadowColor = PALETTE.dead;
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.moveTo(cx - 12, cy - 12);
    ctx.lineTo(cx + 12, cy + 12);
    ctx.moveTo(cx + 12, cy - 12);
    ctx.lineTo(cx - 12, cy + 12);
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  private drawReady(): void {
    const ctx = this.ctx;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = PALETTE.ready;
    ctx.shadowColor = PALETTE.ready;
    ctx.shadowBlur = 16;
    ctx.font = "bold 40px monospace";
    ctx.fillText("LISTO", W / 2, BOARD_Y + ROW_SAFE_MID * CELL + CELL / 2);
    ctx.shadowBlur = 0;
  }

  private drawGameOver(): void {
    const ctx = this.ctx;
    ctx.fillStyle = PALETTE.gameOverShade;
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = PALETTE.gameOverTitle;
    ctx.shadowColor = PALETTE.gameOverTitle;
    ctx.shadowBlur = 18;
    ctx.font = "bold 56px monospace";
    ctx.fillText("GAME OVER", W / 2, H / 2 - 20);
    ctx.shadowBlur = 0;
    ctx.fillStyle = PALETTE.gameOverSub;
    ctx.font = "18px monospace";
    ctx.fillText("ESPACIO PARA REINICIAR", W / 2, H / 2 + 30);
  }
}
