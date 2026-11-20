import type { GameSnapshot } from "../types";
import { type Board, clearLines, collide, createBoard, merge } from "./board";
import {
  BLOCK,
  BOARD_X,
  COLS,
  dropInterval,
  GHOST_ALPHA,
  GLOW_BLUR,
  H,
  HARD_DROP_POINTS,
  KICKS,
  LINE_SCORES,
  LINES_PER_LEVEL,
  PALETTE,
  PIECE_COLORS,
  ROWS,
  SOFT_DROP_POINTS,
  W,
} from "./constants";
import { type Action, Input } from "./input";
import { type Piece, randomPiece, rotateCW, type Shape } from "./pieces";

type GameState = GameSnapshot["state"];

export type EngineCallbacks = {
  onSnapshot: (s: GameSnapshot) => void;
  onTogglePause: () => void;
};

/** Centro horizontal de los paneles laterales y caja de SIGUIENTE (4×4 celdas). */
const LEFT_PANEL_X = BOARD_X / 2; // 125
const RIGHT_PANEL_X = BOARD_X + COLS * BLOCK + BOARD_X / 2; // 675
const PANEL_LABEL_Y = 230;
const NEXT_BOX = 4 * BLOCK; // 120
const NEXT_BOX_X = RIGHT_PANEL_X - NEXT_BOX / 2;
const NEXT_BOX_Y = 250;

/**
 * Motor de Tetris sin globales. Dibuja en coordenadas lógicas 800×600; el
 * escalado por devicePixelRatio lo aplica quien crea el canvas. Solo dibuja
 * valores propios del juego (LÍNEAS y SIGUIENTE); puntuación, vidas y nivel se
 * publican vía `onSnapshot` para el HUD React. Tetris no tiene vidas: `lives`
 * vale 1 durante la partida y 0 en game over.
 */
export class TetrisEngine {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly input = new Input();
  private readonly cb: EngineCallbacks;

  private board: Board = createBoard();
  private current!: Piece;
  private next!: Piece;
  private score = 0;
  private lines = 0;
  private level = 1;
  private lives = 1;
  private state: GameState = "playing";
  private dropAccum = 0;

  private rafId: number | null = null;
  private lastTime: number | null = null;
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

  /** Conecta el teclado y arranca el loop. */
  start(): void {
    if (this.rafId !== null) return;
    this.input.attach();
    this.lastTime = null;
    this.emitSnapshot();
    this.draw();
    this.rafId = requestAnimationFrame(this.loop);
  }

  /** Congela la caída (el último frame queda en pantalla); descarta acciones en cola. */
  pause(): void {
    this.paused = true;
    this.input.clear();
  }

  /** Reanuda; reinicia `lastTime` y `dropAccum` para que la pieza no caiga en salto. */
  resume(): void {
    this.paused = false;
    this.lastTime = null;
    this.dropAccum = 0;
  }

  /** Fuerza game over. */
  endGame(): void {
    if (this.state === "gameover") return;
    this.gameOver();
    this.emitSnapshot();
    this.draw();
  }

  /** Nueva partida: tablero vacío, score 0, lines 0, level 1, lives 1. */
  restart(): void {
    this.initGame();
    this.input.clear();
    this.lastTime = null;
    this.emitSnapshot();
    this.draw();
  }

  /** Cancela el loop y quita los listeners de teclado. */
  destroy(): void {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.rafId = null;
    this.input.detach();
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
      this.updateGravity(dt);
      this.draw();
      this.emitSnapshot();
    }
    this.rafId = requestAnimationFrame(this.loop);
  };

  // ── Estado ───────────────────────────────────────────────────────────────

  private initGame(): void {
    this.board = createBoard();
    this.score = 0;
    this.lines = 0;
    this.level = 1;
    this.lives = 1;
    this.state = "playing";
    this.dropAccum = 0;
    this.next = randomPiece();
    this.spawn();
  }

  private gameOver(): void {
    this.state = "gameover";
    this.lives = 0;
  }

  /** La siguiente pasa a ser la actual; si no cabe al aparecer, game over. */
  private spawn(): void {
    this.current = this.next;
    this.next = randomPiece();
    if (
      collide(this.board, this.current.shape, this.current.x, this.current.y)
    ) {
      this.gameOver();
    }
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
        if (action === "hardDrop") {
          this.initGame();
          return;
        }
        continue;
      }
      switch (action) {
        case "pause":
          // La pausa la decide React; el resto de acciones del frame se descarta.
          this.cb.onTogglePause();
          return;
        case "left":
          this.tryMove(-1);
          break;
        case "right":
          this.tryMove(1);
          break;
        case "rotate":
          this.tryRotate();
          break;
        case "softDrop":
          this.softDrop();
          break;
        case "hardDrop":
          this.hardDrop();
          break;
      }
    }
  }

  private updateGravity(dt: number): void {
    if (this.state === "gameover") return;
    this.dropAccum += dt;
    if (this.dropAccum < dropInterval(this.level)) return;
    this.dropAccum = 0;
    const { shape, x, y } = this.current;
    if (!collide(this.board, shape, x, y + 1)) this.current.y++;
    else this.lockPiece();
  }

  private tryMove(dx: number): void {
    const { shape, x, y } = this.current;
    if (!collide(this.board, shape, x + dx, y)) this.current.x += dx;
  }

  private tryRotate(): void {
    const rotated = rotateCW(this.current.shape);
    for (const kick of KICKS) {
      if (
        !collide(this.board, rotated, this.current.x + kick, this.current.y)
      ) {
        this.current.shape = rotated;
        this.current.x += kick;
        return;
      }
    }
  }

  private softDrop(): void {
    const { shape, x, y } = this.current;
    if (!collide(this.board, shape, x, y + 1)) {
      this.current.y++;
      this.score += SOFT_DROP_POINTS;
    } else {
      this.lockPiece();
    }
  }

  private hardDrop(): void {
    const gy = this.ghostY();
    this.score += (gy - this.current.y) * HARD_DROP_POINTS;
    this.current.y = gy;
    this.lockPiece();
  }

  /** Fila más baja a la que puede caer la pieza actual. */
  private ghostY(): number {
    const { shape, x } = this.current;
    let gy = this.current.y;
    while (!collide(this.board, shape, x, gy + 1)) gy++;
    return gy;
  }

  /** Fija la pieza, limpia líneas (puntúa con el nivel previo) y saca la siguiente. */
  private lockPiece(): void {
    merge(this.board, this.current);
    const cleared = clearLines(this.board);
    if (cleared) {
      this.lines += cleared;
      this.score += (LINE_SCORES[cleared] ?? 0) * this.level;
      this.level = Math.floor(this.lines / LINES_PER_LEVEL) + 1;
    }
    this.dropAccum = 0;
    this.spawn();
  }

  // ── Draw ─────────────────────────────────────────────────────────────────

  private draw(): void {
    const ctx = this.ctx;
    ctx.fillStyle = PALETTE.background;
    ctx.fillRect(0, 0, W, H);

    this.drawGrid();

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const cell = this.board[r][c];
        if (cell) this.drawBlock(BOARD_X + c * BLOCK, r * BLOCK, BLOCK, cell);
      }
    }

    const { shape, x, y } = this.current;
    this.drawShape(shape, x, this.ghostY(), GHOST_ALPHA, false);
    this.drawShape(shape, x, y, 1, true);

    this.drawLinesPanel();
    this.drawNextPanel();
    if (this.state === "gameover") this.drawGameOver();
  }

  /** Grid de líneas finas (un único `stroke`) y borde del tablero. */
  private drawGrid(): void {
    const ctx = this.ctx;
    const boardW = COLS * BLOCK;
    ctx.beginPath();
    for (let c = 1; c < COLS; c++) {
      ctx.moveTo(BOARD_X + c * BLOCK, 0);
      ctx.lineTo(BOARD_X + c * BLOCK, H);
    }
    for (let r = 1; r < ROWS; r++) {
      ctx.moveTo(BOARD_X, r * BLOCK);
      ctx.lineTo(BOARD_X + boardW, r * BLOCK);
    }
    ctx.strokeStyle = PALETTE.grid;
    ctx.lineWidth = 0.5;
    ctx.stroke();

    ctx.strokeStyle = PALETTE.border;
    ctx.lineWidth = 1;
    ctx.strokeRect(BOARD_X - 0.5, 0.5, boardW + 1, H - 1);
  }

  /** Pieza en coordenadas de celda del tablero; glow opcional (solo pieza activa). */
  private drawShape(
    shape: Shape,
    cx: number,
    cy: number,
    alpha: number,
    glow: boolean,
  ): void {
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        const cell = shape[r][c];
        if (!cell || cy + r < 0) continue;
        this.drawBlock(
          BOARD_X + (cx + c) * BLOCK,
          (cy + r) * BLOCK,
          BLOCK,
          cell,
          alpha,
          glow,
        );
      }
    }
  }

  /** Bloque con 1 px de margen y franja superior blanca, como el original. */
  private drawBlock(
    px: number,
    py: number,
    size: number,
    cell: number,
    alpha = 1,
    glow = false,
  ): void {
    const ctx = this.ctx;
    const color = PIECE_COLORS[cell];
    ctx.globalAlpha = alpha;
    if (glow) {
      ctx.shadowColor = color;
      ctx.shadowBlur = GLOW_BLUR;
    }
    ctx.fillStyle = color;
    ctx.fillRect(px + 1, py + 1, size - 2, size - 2);
    ctx.shadowBlur = 0;
    ctx.fillStyle = PALETTE.highlight;
    ctx.fillRect(px + 1, py + 1, size - 2, 4);
    ctx.globalAlpha = 1;
  }

  private drawLabel(text: string, x: number): void {
    const ctx = this.ctx;
    ctx.fillStyle = PALETTE.label;
    ctx.font = "14px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(text, x, PANEL_LABEL_Y);
  }

  /** Valor propio de Tetris: líneas limpiadas. */
  private drawLinesPanel(): void {
    const ctx = this.ctx;
    this.drawLabel("LÍNEAS", LEFT_PANEL_X);
    ctx.fillStyle = PALETTE.value;
    ctx.font = "bold 40px monospace";
    ctx.textAlign = "center";
    ctx.fillText(String(this.lines), LEFT_PANEL_X, PANEL_LABEL_Y + 50);
  }

  /** Valor propio de Tetris: siguiente pieza en una caja de 4×4 celdas. */
  private drawNextPanel(): void {
    const ctx = this.ctx;
    this.drawLabel("SIGUIENTE", RIGHT_PANEL_X);
    ctx.strokeStyle = PALETTE.border;
    ctx.lineWidth = 1;
    ctx.strokeRect(NEXT_BOX_X + 0.5, NEXT_BOX_Y + 0.5, NEXT_BOX, NEXT_BOX);

    const shape = this.next.shape;
    const offX = Math.floor((4 - shape[0].length) / 2);
    const offY = Math.floor((4 - shape.length) / 2);
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        const cell = shape[r][c];
        if (!cell) continue;
        this.drawBlock(
          NEXT_BOX_X + (offX + c) * BLOCK,
          NEXT_BOX_Y + (offY + r) * BLOCK,
          BLOCK,
          cell,
        );
      }
    }
  }

  /** Sobre el tablero, sin puntaje: es un valor común y se lee en el HUD React. */
  private drawGameOver(): void {
    const ctx = this.ctx;
    ctx.fillStyle = PALETTE.gameOverShade;
    ctx.fillRect(BOARD_X, 0, COLS * BLOCK, H);
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
