import type { GameSnapshot } from "../types";
import {
  BALL_SIZE,
  BASE_VX,
  BASE_VY,
  BLOCK_H,
  BLOCK_W,
  BLOCKS_ORIGIN_X,
  BLOCKS_ORIGIN_Y,
  EXPLOSION_MS,
  EXPLOSION_SCALE,
  GLOW_BLUR,
  H,
  INITIAL_LIVES,
  MAX_DT,
  MAX_SUBSTEP,
  PADDLE,
  PADDLE_HIT_TOLERANCE,
  PALETTE,
  POINTS_PER_BLOCK,
  speedFactor,
  W,
} from "./constants";
import { Input } from "./input";
import { type BlockColor, layoutFor } from "./levels";

type Rect = { x: number; y: number; w: number; h: number };
type Paddle = Rect;
type Ball = Rect & { vx: number; vy: number };
type Block = Rect & { color: BlockColor; alive: boolean };
type Explosion = Rect & { color: BlockColor; elapsed: number }; // elapsed en ms

type GameState = "playing" | "gameover";

export type EngineCallbacks = {
  onSnapshot: (s: GameSnapshot) => void;
  onTogglePause: () => void;
};

const BALL_RADIUS = BALL_SIZE / 2;
const BLOCK_GAP = 1; // px de margen por lado al dibujar
const HIGHLIGHT_H = 4; // franja superior blanca
const PADDLE_RADIUS = 4;

/**
 * Motor de Bloque Buster sin globales. Dibuja en coordenadas lógicas 800×600;
 * el escalado por devicePixelRatio lo aplica quien crea el canvas. Puntuación,
 * vidas y nivel se publican vía `onSnapshot` para el HUD React; el canvas solo
 * muestra el hint de saque y el overlay de game over.
 */
export class BloqueBusterEngine {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly canvas: HTMLCanvasElement;
  private readonly input = new Input();
  private readonly cb: EngineCallbacks;

  private paddle: Paddle = { x: 0, y: PADDLE.y, w: PADDLE.w, h: PADDLE.h };
  private ball: Ball = {
    x: 0,
    y: 0,
    w: BALL_SIZE,
    h: BALL_SIZE,
    vx: 0,
    vy: 0,
  };
  private blocks: Block[] = [];
  private explosions: Explosion[] = [];
  private score = 0;
  private lives = INITIAL_LIVES;
  private level = 1;
  private state: GameState = "playing";
  /** La pelota espera sobre el paddle hasta Espacio o clic. */
  private serving = true;

  private rafId: number | null = null;
  private lastTime: number | null = null;
  private paused = false;
  private lastSnapshot: GameSnapshot | null = null;

  constructor(canvas: HTMLCanvasElement, cb: EngineCallbacks) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D no disponible");
    this.ctx = ctx;
    this.canvas = canvas;
    this.cb = cb;
    this.initGame();
  }

  // ── API pública ───────────────────────────────────────────────────────────

  /** Conecta teclado y mouse y arranca el loop. */
  start(): void {
    if (this.rafId !== null) return;
    this.input.attach(this.canvas);
    this.lastTime = null;
    this.emitSnapshot();
    this.draw();
    this.rafId = requestAnimationFrame(this.loop);
  }

  /** Congela la física (el último frame queda en pantalla); descarta entradas pendientes. */
  pause(): void {
    this.paused = true;
    this.input.clear();
  }

  /** Reanuda; reinicia `lastTime` para que el primer frame no acumule el tiempo pausado. */
  resume(): void {
    this.paused = false;
    this.lastTime = null;
  }

  /** Fuerza game over. */
  endGame(): void {
    if (this.state === "gameover") return;
    this.lives = 0;
    this.state = "gameover";
    this.emitSnapshot();
    this.draw();
  }

  /** Nueva partida: nivel 1, score 0, lives 3, pelota sobre el paddle centrado. */
  restart(): void {
    this.initGame();
    this.input.clear();
    this.lastTime = null;
    this.emitSnapshot();
    this.draw();
  }

  /** Cancela el loop y quita los listeners. */
  destroy(): void {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.rafId = null;
    this.input.detach();
  }

  // ── Loop ─────────────────────────────────────────────────────────────────

  private loop = (ts: number): void => {
    if (this.paused) {
      // En pausa solo responden P / Esc; el resto de entradas se descarta.
      if (this.input.pressed("pause")) this.cb.onTogglePause();
      this.input.clear();
    } else {
      const dt =
        this.lastTime === null
          ? 0
          : Math.min((ts - this.lastTime) / 1000, MAX_DT);
      this.lastTime = ts;
      this.update(dt);
      this.draw();
      this.emitSnapshot();
    }
    this.rafId = requestAnimationFrame(this.loop);
  };

  // ── Estado ───────────────────────────────────────────────────────────────

  private initGame(): void {
    this.score = 0;
    this.lives = INITIAL_LIVES;
    this.state = "playing";
    this.paddle.x = (W - this.paddle.w) / 2;
    this.loadLevel(1);
  }

  /** Carga el patrón del nivel (en bucle cada 5) y deja la pelota esperando. */
  private loadLevel(level: number): void {
    this.level = level;
    this.blocks = layoutFor(level).map((b) => ({
      x: BLOCKS_ORIGIN_X + b.col * BLOCK_W,
      y: BLOCKS_ORIGIN_Y + b.row * BLOCK_H,
      w: BLOCK_W,
      h: BLOCK_H,
      color: b.color,
      alive: true,
    }));
    this.explosions = [];
    this.serve();
  }

  private serve(): void {
    this.serving = true;
    this.ball.vx = 0;
    this.ball.vy = 0;
    this.stickBall();
  }

  /** Pelota centrada sobre el paddle. */
  private stickBall(): void {
    this.ball.x = this.paddle.x + (this.paddle.w - this.ball.w) / 2;
    this.ball.y = this.paddle.y - this.ball.h;
  }

  private launch(): void {
    const f = speedFactor(this.level);
    this.ball.vx = BASE_VX * f;
    this.ball.vy = BASE_VY * f;
    this.serving = false;
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

  private update(dt: number): void {
    this.updateExplosions(dt);

    if (this.state === "gameover") {
      // Solo Espacio reinicia; mouse, clic y P/Esc se ignoran.
      const restart = this.input.pressed("launch");
      this.input.clear();
      if (restart) this.initGame();
      return;
    }

    // P / Esc: alternan la pausa (la decide React).
    if (this.input.pressed("pause")) this.cb.onTogglePause();

    this.movePaddle(dt);

    const launchPressed = this.input.pressed("launch");
    const clicked = this.input.takeClick();
    if (this.serving) {
      this.stickBall();
      if (launchPressed || clicked) this.launch();
      return;
    }

    // Física del original en sub-pasos de como máximo MAX_SUBSTEP.
    const steps = Math.max(1, Math.ceil(dt / MAX_SUBSTEP));
    const h = dt / steps;
    for (let i = 0; i < steps; i++) {
      if (!this.stepBall(h)) break;
    }
  }

  private movePaddle(dt: number): void {
    const p = this.paddle;
    const mouseX = this.input.takeMouseX();
    if (mouseX !== null) p.x = mouseX - p.w / 2;
    if (this.input.isDown("left")) p.x -= PADDLE.speed * dt;
    if (this.input.isDown("right")) p.x += PADDLE.speed * dt;
    p.x = Math.max(0, Math.min(W - p.w, p.x));
  }

  /** Un sub-paso de la pelota. Devuelve `false` si la pelota dejó de moverse (vida perdida, nivel nuevo, game over). */
  private stepBall(dt: number): boolean {
    const b = this.ball;
    const p = this.paddle;

    b.x += b.vx * dt;
    b.y += b.vy * dt;

    // Paredes izquierda, derecha y superior.
    if (b.x <= 0) {
      b.x = 0;
      b.vx = Math.abs(b.vx);
    }
    if (b.x + b.w >= W) {
      b.x = W - b.w;
      b.vx = -Math.abs(b.vx);
    }
    if (b.y <= 0) {
      b.y = 0;
      b.vy = Math.abs(b.vy);
    }

    // Paddle: solo invierte vy, conserva vx.
    if (
      b.vy > 0 &&
      b.x + b.w > p.x &&
      b.x < p.x + p.w &&
      b.y + b.h >= p.y &&
      b.y + b.h <= p.y + p.h + PADDLE_HIT_TOLERANCE
    ) {
      b.y = p.y - b.h;
      b.vy = -Math.abs(b.vy);
    }

    // Bloques: AABB, uno por paso, siempre invierte vy.
    for (const block of this.blocks) {
      if (!block.alive || !overlaps(b, block)) continue;
      block.alive = false;
      this.explosions.push({
        x: block.x,
        y: block.y,
        w: block.w,
        h: block.h,
        color: block.color,
        elapsed: 0,
      });
      this.score += POINTS_PER_BLOCK;
      b.vy = -b.vy;
      if (this.blocks.every((bl) => !bl.alive)) {
        this.loadLevel(this.level + 1);
        return false;
      }
      break;
    }

    // Pelota perdida.
    if (b.y > H) {
      this.lives--;
      if (this.lives <= 0) {
        this.lives = 0;
        this.state = "gameover";
      } else {
        this.serve();
      }
      return false;
    }
    return true;
  }

  private updateExplosions(dt: number): void {
    for (const e of this.explosions) e.elapsed += dt * 1000;
    this.explosions = this.explosions.filter((e) => e.elapsed < EXPLOSION_MS);
  }

  // ── Draw ─────────────────────────────────────────────────────────────────

  private draw(): void {
    const ctx = this.ctx;
    ctx.fillStyle = PALETTE.background;
    ctx.fillRect(0, 0, W, H);

    for (const block of this.blocks) if (block.alive) this.drawBlock(block);
    this.drawExplosions();
    this.drawPaddle();
    this.drawBall();

    if (this.state === "gameover") this.drawGameOver();
    else if (this.serving) this.drawServeHint();
  }

  private drawBlock(b: Block): void {
    const ctx = this.ctx;
    const x = b.x + BLOCK_GAP;
    const y = b.y + BLOCK_GAP;
    const w = b.w - BLOCK_GAP * 2;
    const h = b.h - BLOCK_GAP * 2;
    ctx.fillStyle = PALETTE[b.color];
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = PALETTE.highlight;
    ctx.fillRect(x, y, w, HIGHLIGHT_H);
  }

  /** Fade + escala desde el centro del bloque, en su color. */
  private drawExplosions(): void {
    const ctx = this.ctx;
    for (const e of this.explosions) {
      const t = Math.min(e.elapsed / EXPLOSION_MS, 1);
      const scale = 1 + (EXPLOSION_SCALE - 1) * t;
      const w = (e.w - BLOCK_GAP * 2) * scale;
      const h = (e.h - BLOCK_GAP * 2) * scale;
      const cx = e.x + e.w / 2;
      const cy = e.y + e.h / 2;
      ctx.globalAlpha = 1 - t;
      ctx.fillStyle = PALETTE[e.color];
      ctx.fillRect(cx - w / 2, cy - h / 2, w, h);
    }
    ctx.globalAlpha = 1;
  }

  private drawPaddle(): void {
    const ctx = this.ctx;
    const p = this.paddle;
    ctx.save();
    ctx.shadowColor = PALETTE.paddle;
    ctx.shadowBlur = GLOW_BLUR;
    ctx.fillStyle = PALETTE.paddle;
    ctx.beginPath();
    ctx.roundRect(p.x, p.y, p.w, p.h, PADDLE_RADIUS);
    ctx.fill();
    ctx.restore();
  }

  private drawBall(): void {
    if (this.state === "gameover" && this.ball.y > H) return;
    const ctx = this.ctx;
    const b = this.ball;
    ctx.save();
    ctx.shadowColor = PALETTE.ball;
    ctx.shadowBlur = GLOW_BLUR;
    ctx.fillStyle = PALETTE.ball;
    ctx.beginPath();
    ctx.arc(b.x + BALL_RADIUS, b.y + BALL_RADIUS, BALL_RADIUS, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private drawServeHint(): void {
    const ctx = this.ctx;
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = PALETTE.hint;
    ctx.font = "18px monospace";
    ctx.fillText("ESPACIO PARA LANZAR", W / 2, H / 2 + 60);
  }

  /** Sin puntaje: es un valor común y se lee en el HUD React. */
  private drawGameOver(): void {
    const ctx = this.ctx;
    ctx.fillStyle = PALETTE.gameOverShade;
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = PALETTE.gameOverTitle;
    ctx.font = "bold 46px monospace";
    ctx.fillText("GAME OVER", W / 2, H / 2 - 18);
    ctx.fillStyle = PALETTE.gameOverSub;
    ctx.font = "18px monospace";
    ctx.fillText("ESPACIO PARA REINICIAR", W / 2, H / 2 + 22);
  }
}

function overlaps(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
  );
}
