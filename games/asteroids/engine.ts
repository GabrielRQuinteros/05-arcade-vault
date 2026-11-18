import type { GameSnapshot } from "../types";
import {
  H,
  MAX_DT,
  PALETTE,
  POINTS,
  POWERUP_DROP_CHANCE,
  POWERUP_DURATION,
  W,
} from "./constants";
import { Asteroid } from "./entities/asteroid";
import { Bullet } from "./entities/bullet";
import { Particle } from "./entities/particle";
import { PowerUp } from "./entities/power-up";
import { Ship } from "./entities/ship";
import { Input } from "./input";
import { dist, rand } from "./utils";

type GameState = GameSnapshot["state"];

export type EngineCallbacks = {
  onSnapshot: (s: GameSnapshot) => void;
  onTogglePause: () => void;
};

const SAFE_DIST = 130; // radio libre de asteroides alrededor del centro al aparecer
const RESPAWN_DELAY = 2; // s entre morir y reaparecer
const KILLS_FOR_GUARANTEED_POWERUP = 5;

/**
 * Motor de Asteroids sin globales. El campo de juego se dibuja en coordenadas
 * lógicas 800×600; el escalado por devicePixelRatio lo aplica quien crea el canvas.
 * Solo dibuja valores propios del juego (contador 3x); puntuación, vidas y nivel
 * se publican vía `onSnapshot` para el HUD React.
 */
export class AsteroidsEngine {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly input = new Input();
  private readonly cb: EngineCallbacks;

  private ship!: Ship;
  private bullets: Bullet[] = [];
  private asteroids: Asteroid[] = [];
  private particles: Particle[] = [];
  private powerUps: PowerUp[] = [];
  private score = 0;
  private lives = 3;
  private level = 1;
  private state: GameState = "playing";
  private deadTimer = 0;
  private powerUpSpawned = false;
  private killsSinceSpawn = 0;

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

  /** Detiene update y draw (el último frame queda en pantalla); descarta pulsaciones pendientes. */
  pause(): void {
    this.paused = true;
    this.input.clearPressed();
  }

  /** Reanuda; reinicia `lastTime` para que el primer frame no acumule el tiempo pausado. */
  resume(): void {
    this.paused = false;
    this.lastTime = null;
  }

  /** Fuerza game over. */
  endGame(): void {
    if (this.state === "gameover") return;
    if (!this.ship.dead) {
      this.explode(this.ship.x, this.ship.y, 14);
      this.ship.dead = true;
    }
    this.state = "gameover";
    this.emitSnapshot();
    this.draw();
  }

  /** Nueva partida: score 0, lives 3, level 1. */
  restart(): void {
    this.initGame();
    this.input.clearPressed();
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
    if (this.paused) {
      // En pausa solo responden P / Esc; el resto de pulsaciones se descarta.
      if (this.input.pressed("pause")) this.cb.onTogglePause();
      this.input.clearPressed();
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
    this.ship = new Ship(this.input);
    this.bullets = [];
    this.asteroids = [];
    this.particles = [];
    this.powerUps = [];
    this.powerUpSpawned = false;
    this.killsSinceSpawn = 0;
    this.score = 0;
    this.lives = 3;
    this.level = 1;
    this.state = "playing";
    this.spawnAsteroids(4);
  }

  private nextLevel(): void {
    this.level++;
    this.bullets = [];
    this.particles = [];
    this.powerUps = [];
    this.powerUpSpawned = false;
    this.killsSinceSpawn = 0;
    this.ship.reset();
    this.spawnAsteroids(3 + this.level);
  }

  private spawnAsteroids(count: number): void {
    for (let i = 0; i < count; i++) {
      let x: number;
      let y: number;
      do {
        x = rand(0, W);
        y = rand(0, H);
      } while (Math.hypot(x - W / 2, y - H / 2) < SAFE_DIST);
      this.asteroids.push(new Asteroid(x, y, 3));
    }
  }

  private explode(x: number, y: number, count = 8): void {
    for (let i = 0; i < count; i++) this.particles.push(new Particle(x, y));
  }

  private killShip(): void {
    this.explode(this.ship.x, this.ship.y, 14);
    this.ship.dead = true;
    this.lives--;
    if (this.lives <= 0) {
      this.state = "gameover";
    } else {
      this.state = "dead";
      this.deadTimer = RESPAWN_DELAY;
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

  private updateParticles(dt: number): void {
    this.particles.forEach((p) => p.update(dt));
    this.particles = this.particles.filter((p) => !p.dead);
  }

  private update(dt: number): void {
    // P / Esc: alternan la pausa (la decide React), salvo en game over.
    if (this.input.pressed("pause") && this.state !== "gameover") {
      this.cb.onTogglePause();
    }

    if (this.state === "gameover") {
      if (this.input.pressed("fire")) {
        this.initGame();
        return;
      }
      this.updateParticles(dt);
      return;
    }

    if (this.state === "dead") {
      this.deadTimer -= dt;
      this.updateParticles(dt);
      this.asteroids.forEach((a) => a.update(dt));
      if (this.deadTimer <= 0) {
        this.state = "playing";
        this.ship.reset();
      }
      return;
    }

    // Disparar
    if (this.input.pressed("fire")) this.bullets.push(...this.ship.tryShoot());

    this.ship.update(dt);
    this.bullets.forEach((b) => b.update(dt));
    this.asteroids.forEach((a) => a.update(dt));
    this.powerUps.forEach((p) => p.update(dt));
    this.updateParticles(dt);

    this.bullets = this.bullets.filter((b) => !b.dead);
    this.powerUps = this.powerUps.filter((p) => !p.dead);

    // Nave vs power-up
    for (const p of this.powerUps) {
      if (!p.dead && dist(this.ship, p) < this.ship.radius + p.radius) {
        p.dead = true;
        this.ship.tripleShot = POWERUP_DURATION;
      }
    }

    // Bala vs asteroide
    const newAsteroids: Asteroid[] = [];
    for (const b of this.bullets) {
      for (const a of this.asteroids) {
        if (!a.dead && !b.dead && dist(b, a) < a.radius) {
          b.dead = true;
          a.dead = true;
          this.score += POINTS[a.size];
          this.explode(a.x, a.y, a.size * 5);
          newAsteroids.push(...a.split());
          if (!this.powerUpSpawned) {
            this.killsSinceSpawn++;
            const guaranteed =
              this.killsSinceSpawn >= KILLS_FOR_GUARANTEED_POWERUP;
            if (guaranteed || Math.random() < POWERUP_DROP_CHANCE) {
              this.powerUps.push(new PowerUp(a.x, a.y));
              this.powerUpSpawned = true;
            }
          }
        }
      }
    }
    this.asteroids = this.asteroids.filter((a) => !a.dead).concat(newAsteroids);
    this.bullets = this.bullets.filter((b) => !b.dead);

    // Nave vs asteroide
    if (this.ship.invincible <= 0) {
      for (const a of this.asteroids) {
        if (dist(this.ship, a) < this.ship.radius + a.radius * 0.82) {
          this.killShip();
          break;
        }
      }
    }

    // Nivel completado
    if (this.asteroids.length === 0) this.nextLevel();
  }

  // ── Draw ─────────────────────────────────────────────────────────────────

  private draw(): void {
    const ctx = this.ctx;
    ctx.fillStyle = PALETTE.background;
    ctx.fillRect(0, 0, W, H);

    this.particles.forEach((p) => p.draw(ctx));
    this.asteroids.forEach((a) => a.draw(ctx));
    this.powerUps.forEach((p) => p.draw(ctx));
    this.bullets.forEach((b) => b.draw(ctx));
    this.ship.draw(ctx);

    this.drawTripleShotTimer();
    if (this.state === "gameover") this.drawGameOver();
  }

  /** Único valor de HUD dentro del canvas: es propio de Asteroids. */
  private drawTripleShotTimer(): void {
    if (this.ship.tripleShot <= 0) return;
    const ctx = this.ctx;
    ctx.fillStyle = PALETTE.powerUp;
    ctx.font = "15px monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(`3x  ${this.ship.tripleShot.toFixed(1)}s`, 14, 26);
  }

  /** Sin puntaje: es un valor común y se lee en el HUD React. */
  private drawGameOver(): void {
    const ctx = this.ctx;
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
