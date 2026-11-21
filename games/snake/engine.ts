import type { GameSnapshot } from "../types";
import {
  BOARD_X,
  BOARD_Y,
  BONUS_BLINK_MS,
  BONUS_CHANCE,
  BONUS_EVERY,
  BONUS_MS,
  BONUS_POINTS,
  BONUS_POINTS_PER_SEC,
  CELL,
  COLS,
  FRUIT_POINTS,
  FRUITS_PER_LEVEL,
  H,
  MAX_QUEUED_TURNS,
  PALETTE,
  READY_MS,
  ROWS,
  SPRITE_PADDING,
  SPRITE_TIMEOUT_MS,
  START_DIR,
  START_HEAD,
  START_LENGTH,
  tickInterval,
  W,
} from "./constants";
import { type Action, Input } from "./input";
import {
  BONUS_FRUIT,
  FRUIT_SPRITES,
  type FruitKey,
  NORMAL_FRUITS,
  SNAKE_SHEET,
} from "./sprites";

type Dir = "up" | "down" | "left" | "right";
type Point = { x: number; y: number };
type PlayState = "playing" | "gameover";

export type EngineCallbacks = {
  onSnapshot: (s: GameSnapshot) => void;
  onTogglePause: () => void;
};

const VECTORS: Record<Dir, Point> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

const OPPOSITE: Record<Dir, Dir> = {
  up: "down",
  down: "up",
  left: "right",
  right: "left",
};

const BOARD_W = COLS * CELL; // 750
const BOARD_H = ROWS * CELL; // 500
const BOARD_CX = BOARD_X + BOARD_W / 2;
const BOARD_CY = BOARD_Y + BOARD_H / 2;

/** Franja superior: centros de cada valor propio del juego. */
const STRIP_LENGTH_X = 125;
const STRIP_FRUITS_X = 400;
const STRIP_BONUS_X = 675;
const STRIP_LABEL_Y = 26;
const STRIP_VALUE_Y = 56;
const BONUS_BAR_W = 160;
const BONUS_BAR_H = 6;
const BONUS_BAR_Y = 62;

const SEGMENT_MARGIN = 2;
const SEGMENT_RADIUS = 5;
const HEAD_GLOW = 14;
const BODY_ALPHA_NECK = 0.9;
const BODY_ALPHA_TAIL = 0.35;
const BLINK_PERIOD_MS = 150;

const isDir = (a: Action): a is Dir =>
  a === "up" || a === "down" || a === "left" || a === "right";

/**
 * Motor de Snake sin globales. Dibuja en coordenadas lógicas 800×600; el
 * escalado por devicePixelRatio lo aplica quien crea el canvas. Solo dibuja
 * valores propios del juego (LONGITUD, FRUTAS, BONUS); puntuación, vidas y
 * nivel se publican vía `onSnapshot`. Una sola vida: `lives` vale 1 jugando y 0
 * en game over.
 */
export class SnakeEngine {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly input = new Input();
  private readonly cb: EngineCallbacks;

  private segments: Point[] = [];
  private dir: Dir = START_DIR;
  private dirQueue: Dir[] = [];
  private growPending = 0;
  private fruit: Point & { key: FruitKey } = { x: 0, y: 0, key: "apple" };
  private bonus: (Point & { remainingMs: number }) | null = null;
  private fruitsEaten = 0;
  private score = 0;
  private level = 1;
  private lives = 1;
  private state: PlayState = "playing";
  private readyLeft = READY_MS;
  private tickAccum = 0;
  private lastTime: number | null = null;

  private sheet: HTMLImageElement | null = null;
  private loadingImg: HTMLImageElement | null = null;
  private loaded = false;
  private started = false;
  private destroyed = false;
  private rafId: number | null = null;
  private paused = false;
  private lastSnapshot: GameSnapshot | null = null;

  constructor(canvas: HTMLCanvasElement, cb: EngineCallbacks) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D no disponible");
    this.ctx = ctx;
    this.cb = cb;
    this.initGame();
  }

  // ── API pública ───────────────────────────────────────────────────────────

  /** Conecta el teclado y precarga la hoja; el loop arranca al resolverse la carga. */
  start(): void {
    if (this.started) return;
    this.started = true;
    this.input.attach();
    this.emitSnapshot();
    void this.loadSheet().then((sheet) => {
      if (this.destroyed) return;
      this.sheet = sheet;
      this.loaded = true;
      this.lastTime = null;
      this.draw();
      this.rafId = requestAnimationFrame(this.loop);
    });
  }

  /** Congela ticks, LISTO y temporizador de la bonus; vacía la cola de giros. */
  pause(): void {
    this.paused = true;
    this.input.clear();
    this.dirQueue = [];
  }

  /** Reanuda; reinicia `lastTime` y `tickAccum` para evitar ticks en salto. */
  resume(): void {
    this.paused = false;
    this.lastTime = null;
    this.tickAccum = 0;
  }

  /** Fuerza game over. */
  endGame(): void {
    if (this.state === "gameover") return;
    this.gameOver();
    this.emitSnapshot();
    if (this.loaded) this.draw();
  }

  /** Nueva partida: largo 3 en el centro, LISTO, score 0, frutas 0, level 1, lives 1. */
  restart(): void {
    this.initGame();
    this.input.clear();
    this.lastTime = null;
    this.emitSnapshot();
    if (this.loaded) this.draw();
  }

  /** Cancela el loop, quita los listeners y suelta la imagen. */
  destroy(): void {
    this.destroyed = true;
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.rafId = null;
    this.input.detach();
    if (this.loadingImg) {
      this.loadingImg.onload = null;
      this.loadingImg.onerror = null;
      this.loadingImg.src = "";
    }
    this.loadingImg = null;
    this.sheet = null;
  }

  // ── Carga ────────────────────────────────────────────────────────────────

  /** Resuelve con la imagen, o `null` si falla o vence `SPRITE_TIMEOUT_MS`. */
  private loadSheet(): Promise<HTMLImageElement | null> {
    return new Promise((resolve) => {
      const img = new Image();
      this.loadingImg = img;
      let done = false;
      const finish = (ok: boolean) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        img.onload = null;
        img.onerror = null;
        resolve(ok ? img : null);
      };
      const timer = setTimeout(() => finish(false), SPRITE_TIMEOUT_MS);
      img.onload = () => finish(img.naturalWidth > 0);
      img.onerror = () => finish(false);
      img.src = SNAKE_SHEET;
    });
  }

  // ── Loop ─────────────────────────────────────────────────────────────────

  private loop = (ts: number): void => {
    const actions = this.input.drain();
    if (this.paused) {
      // En pausa solo responden P / Esc; el resto de acciones se descarta.
      if (actions.includes("pause")) this.cb.onTogglePause();
    } else {
      const dt = this.lastTime === null ? 0 : ts - this.lastTime;
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
    this.segments = Array.from({ length: START_LENGTH }, (_, i) => ({
      x: START_HEAD.x - i,
      y: START_HEAD.y,
    }));
    this.dir = START_DIR;
    this.dirQueue = [];
    this.growPending = 0;
    this.bonus = null;
    this.fruitsEaten = 0;
    this.score = 0;
    this.level = 1;
    this.lives = 1;
    this.state = "playing";
    this.readyLeft = READY_MS;
    this.tickAccum = 0;
    this.placeFruit();
  }

  private gameOver(): void {
    this.state = "gameover";
    this.lives = 0;
    this.dirQueue = [];
  }

  /** Emite solo si cambió algún campo común. */
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
        // En game over solo Espacio (reinicia); P / Esc no hacen nada.
        if (action === "restart") {
          this.initGame();
          return;
        }
        continue;
      }
      if (action === "pause") {
        // La pausa la decide React; el resto de acciones del frame se descarta.
        this.cb.onTogglePause();
        return;
      }
      if (isDir(action)) this.queueTurn(action);
    }
  }

  /** Valida contra el último giro encolado (o la dirección actual). */
  private queueTurn(d: Dir): void {
    if (this.dirQueue.length >= MAX_QUEUED_TURNS) return;
    const last = this.dirQueue[this.dirQueue.length - 1] ?? this.dir;
    if (d === last || d === OPPOSITE[last]) return;
    this.dirQueue.push(d);
  }

  private update(dt: number): void {
    if (this.state === "gameover") return;

    if (this.readyLeft > 0) {
      this.readyLeft = Math.max(0, this.readyLeft - dt);
      return;
    }

    if (this.bonus) {
      this.bonus.remainingMs -= dt;
      if (this.bonus.remainingMs <= 0) this.bonus = null;
    }

    this.tickAccum += dt;
    const interval = tickInterval(this.level);
    if (this.tickAccum >= interval) {
      // Un tick por frame como máximo; el resto se conserva sin acumular deuda.
      this.tickAccum = Math.min(this.tickAccum - interval, interval);
      this.tick();
    }
  }

  private tick(): void {
    const turn = this.dirQueue.shift();
    if (turn) this.dir = turn;

    const head = this.segments[0];
    const v = VECTORS[this.dir];
    const next: Point = { x: head.x + v.x, y: head.y + v.y };

    if (next.x < 0 || next.x >= COLS || next.y < 0 || next.y >= ROWS) {
      this.gameOver();
      return;
    }

    // La cola solo es obstáculo si no se mueve en este tick (crecimiento pendiente).
    const checkLen =
      this.growPending > 0 ? this.segments.length : this.segments.length - 1;
    for (let i = 0; i < checkLen; i++) {
      const s = this.segments[i];
      if (s.x === next.x && s.y === next.y) {
        this.gameOver();
        return;
      }
    }

    this.segments.unshift(next);
    if (this.growPending > 0) this.growPending--;
    else this.segments.pop();

    if (next.x === this.fruit.x && next.y === this.fruit.y) {
      this.eatFruit();
      if (this.state === "gameover") return;
    }

    const b = this.bonus;
    if (b && next.x === b.x && next.y === b.y) {
      this.score +=
        BONUS_POINTS * this.level +
        BONUS_POINTS_PER_SEC * Math.ceil(b.remainingMs / 1000);
      this.growPending++;
      this.bonus = null;
    }
  }

  private eatFruit(): void {
    this.score += FRUIT_POINTS * this.level;
    this.fruitsEaten++;
    this.growPending++;
    this.level = Math.floor(this.fruitsEaten / FRUITS_PER_LEVEL) + 1;
    if (!this.placeFruit()) {
      this.gameOver();
      return;
    }
    if (
      this.fruitsEaten % BONUS_EVERY === 0 &&
      !this.bonus &&
      Math.random() < BONUS_CHANCE
    ) {
      const cell = this.randomFreeCell();
      if (cell) this.bonus = { ...cell, remainingMs: BONUS_MS };
    }
  }

  /** Coloca la fruta normal con un sprite al azar; `false` si no hay celdas libres. */
  private placeFruit(): boolean {
    const cell = this.randomFreeCell(true);
    if (!cell) return false;
    const key = NORMAL_FRUITS[Math.floor(Math.random() * NORMAL_FRUITS.length)];
    this.fruit = { ...cell, key };
    return true;
  }

  /** Celda libre al azar (sin serpiente, fruta ni bonus). */
  private randomFreeCell(ignoreFruit = false): Point | null {
    const taken = new Set<number>();
    for (const s of this.segments) taken.add(s.y * COLS + s.x);
    if (!ignoreFruit) taken.add(this.fruit.y * COLS + this.fruit.x);
    if (this.bonus) taken.add(this.bonus.y * COLS + this.bonus.x);
    const free: number[] = [];
    for (let i = 0; i < COLS * ROWS; i++) if (!taken.has(i)) free.push(i);
    if (free.length === 0) return null;
    const idx = free[Math.floor(Math.random() * free.length)];
    return { x: idx % COLS, y: Math.floor(idx / COLS) };
  }

  // ── Draw ─────────────────────────────────────────────────────────────────

  private draw(): void {
    const ctx = this.ctx;
    // setTransform (dpr) puede reactivar el suavizado: se fija en cada frame.
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = PALETTE.background;
    ctx.fillRect(0, 0, W, H);

    this.drawStrip();
    this.drawBoard();
    this.drawFruit(this.fruit.x, this.fruit.y, this.fruit.key);
    this.drawBonus();
    this.drawSnake();

    if (this.state === "gameover") this.drawGameOver();
    else if (this.readyLeft > 0) this.drawReady();
  }

  /** Franja superior: LONGITUD, FRUTAS y, con bonus activa, BONUS con barra. */
  private drawStrip(): void {
    const ctx = this.ctx;
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";

    this.drawStat("LONGITUD", String(this.segments.length), STRIP_LENGTH_X);
    this.drawStat("FRUTAS", String(this.fruitsEaten), STRIP_FRUITS_X);

    const b = this.bonus;
    if (!b) return;
    ctx.fillStyle = PALETTE.label;
    ctx.font = "14px monospace";
    ctx.fillText("BONUS", STRIP_BONUS_X, STRIP_LABEL_Y);
    ctx.fillStyle = PALETTE.bonus;
    ctx.font = "bold 22px monospace";
    ctx.fillText(
      `${(Math.max(0, b.remainingMs) / 1000).toFixed(1)}s`,
      STRIP_BONUS_X,
      STRIP_VALUE_Y - 4,
    );
    const barX = STRIP_BONUS_X - BONUS_BAR_W / 2;
    ctx.globalAlpha = 0.2;
    ctx.fillRect(barX, BONUS_BAR_Y, BONUS_BAR_W, BONUS_BAR_H);
    ctx.globalAlpha = 1;
    ctx.fillRect(
      barX,
      BONUS_BAR_Y,
      BONUS_BAR_W * Math.max(0, b.remainingMs / BONUS_MS),
      BONUS_BAR_H,
    );
  }

  private drawStat(label: string, value: string, x: number): void {
    const ctx = this.ctx;
    ctx.fillStyle = PALETTE.label;
    ctx.font = "14px monospace";
    ctx.fillText(label, x, STRIP_LABEL_Y);
    ctx.fillStyle = PALETTE.value;
    ctx.font = "bold 26px monospace";
    ctx.fillText(value, x, STRIP_VALUE_Y);
  }

  /** Grid de líneas finas (un único `stroke`) y borde del tablero. */
  private drawBoard(): void {
    const ctx = this.ctx;
    ctx.beginPath();
    for (let c = 1; c < COLS; c++) {
      ctx.moveTo(BOARD_X + c * CELL, BOARD_Y);
      ctx.lineTo(BOARD_X + c * CELL, BOARD_Y + BOARD_H);
    }
    for (let r = 1; r < ROWS; r++) {
      ctx.moveTo(BOARD_X, BOARD_Y + r * CELL);
      ctx.lineTo(BOARD_X + BOARD_W, BOARD_Y + r * CELL);
    }
    ctx.strokeStyle = PALETTE.grid;
    ctx.lineWidth = 0.5;
    ctx.stroke();

    ctx.strokeStyle = PALETTE.border;
    ctx.lineWidth = 1;
    ctx.strokeRect(BOARD_X - 0.5, BOARD_Y - 0.5, BOARD_W + 1, BOARD_H + 1);
  }

  /** Sprite con aspect-fit centrado en la celda, o círculo de fallback. */
  private drawFruit(cx: number, cy: number, key: FruitKey): void {
    const ctx = this.ctx;
    const px = BOARD_X + cx * CELL;
    const py = BOARD_Y + cy * CELL;

    if (this.sheet) {
      const r = FRUIT_SPRITES[key];
      const box = CELL - SPRITE_PADDING * 2;
      const scale = Math.min(box / r.w, box / r.h);
      const dw = r.w * scale;
      const dh = r.h * scale;
      ctx.drawImage(
        this.sheet,
        r.x,
        r.y,
        r.w,
        r.h,
        px + (CELL - dw) / 2,
        py + (CELL - dh) / 2,
        dw,
        dh,
      );
      return;
    }

    const color = key === BONUS_FRUIT ? PALETTE.bonus : PALETTE.fruitFallback;
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(px + CELL / 2, py + CELL / 2, CELL / 2 - 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  /** Bol que parpadea en los últimos `BONUS_BLINK_MS`. */
  private drawBonus(): void {
    const b = this.bonus;
    if (!b) return;
    if (
      b.remainingMs <= BONUS_BLINK_MS &&
      Math.floor(b.remainingMs / BLINK_PERIOD_MS) % 2 === 1
    ) {
      return;
    }
    this.drawFruit(b.x, b.y, BONUS_FRUIT);
  }

  /** Cabeza brillante con ojos y glow; cuerpo con alpha decreciente hacia la cola. */
  private drawSnake(): void {
    const ctx = this.ctx;
    const n = this.segments.length;
    const size = CELL - SEGMENT_MARGIN * 2;
    ctx.fillStyle = PALETTE.snake;

    for (let i = n - 1; i >= 1; i--) {
      const s = this.segments[i];
      const t = n > 2 ? (i - 1) / (n - 2) : 0;
      ctx.globalAlpha =
        BODY_ALPHA_NECK - (BODY_ALPHA_NECK - BODY_ALPHA_TAIL) * t;
      ctx.beginPath();
      ctx.roundRect(
        BOARD_X + s.x * CELL + SEGMENT_MARGIN,
        BOARD_Y + s.y * CELL + SEGMENT_MARGIN,
        size,
        size,
        SEGMENT_RADIUS,
      );
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    const head = this.segments[0];
    const hx = BOARD_X + head.x * CELL;
    const hy = BOARD_Y + head.y * CELL;
    ctx.shadowColor = PALETTE.snake;
    ctx.shadowBlur = HEAD_GLOW;
    ctx.beginPath();
    ctx.roundRect(
      hx + SEGMENT_MARGIN,
      hy + SEGMENT_MARGIN,
      size,
      size,
      SEGMENT_RADIUS,
    );
    ctx.fill();
    ctx.shadowBlur = 0;

    // Ojos hacia la dirección actual.
    const f = VECTORS[this.dir];
    const p = { x: -f.y, y: f.x };
    const cx = hx + CELL / 2 + f.x * 4;
    const cy = hy + CELL / 2 + f.y * 4;
    ctx.fillStyle = PALETTE.eyes;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(cx + p.x * 5 * side, cy + p.y * 5 * side, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawReady(): void {
    const ctx = this.ctx;
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = PALETTE.value;
    ctx.font = "bold 42px monospace";
    ctx.fillText("LISTO", BOARD_CX, BOARD_CY - 40);
  }

  /** Sobre el tablero, sin puntaje: es un valor común y se lee en el HUD React. */
  private drawGameOver(): void {
    const ctx = this.ctx;
    ctx.fillStyle = PALETTE.gameOverShade;
    ctx.fillRect(BOARD_X, BOARD_Y, BOARD_W, BOARD_H);
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = PALETTE.gameOverTitle;
    ctx.font = "bold 46px monospace";
    ctx.fillText("GAME OVER", BOARD_CX, BOARD_CY - 18);
    ctx.fillStyle = PALETTE.gameOverSub;
    ctx.font = "18px monospace";
    ctx.fillText("ESPACIO PARA REINICIAR", BOARD_CX, BOARD_CY + 22);
  }
}
