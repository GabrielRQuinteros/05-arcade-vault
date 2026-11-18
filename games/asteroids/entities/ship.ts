import { GLOW_BLUR, H, PALETTE, TRIPLE_SPREAD, W } from "../constants";
import type { Input } from "../input";
import { rand, wrap } from "../utils";
import { Bullet } from "./bullet";

const ROT = 3.5; // rad/s
const THRUST = 260; // px/s²
const DRAG = 0.987;
const SHOOT_COOLDOWN = 0.2; // s
const INVINCIBLE_TIME = 3; // s
const NOSE = 21; // distancia del centro a la punta, origen de las balas

export class Ship {
  x = W / 2;
  y = H / 2;
  readonly radius = 12;
  /** Segundos restantes de triple disparo (0 = inactivo). */
  tripleShot = 0;
  /** Segundos restantes de invencibilidad tras reaparecer. */
  invincible = INVINCIBLE_TIME;
  dead = false;
  private angle = -Math.PI / 2;
  private vx = 0;
  private vy = 0;
  private thrusting = false;
  private shootCooldown = 0;

  constructor(private readonly input: Input) {}

  /** Reaparece en el centro, quieta e invencible. Conserva `tripleShot`, como el original. */
  reset(): void {
    this.x = W / 2;
    this.y = H / 2;
    this.angle = -Math.PI / 2;
    this.vx = 0;
    this.vy = 0;
    this.thrusting = false;
    this.invincible = INVINCIBLE_TIME;
    this.shootCooldown = 0;
    this.dead = false;
  }

  update(dt: number): void {
    if (this.dead) return;
    if (this.invincible > 0) this.invincible -= dt;
    if (this.shootCooldown > 0) this.shootCooldown -= dt;
    if (this.tripleShot > 0) this.tripleShot -= dt;

    if (this.input.isDown("left")) this.angle -= ROT * dt;
    if (this.input.isDown("right")) this.angle += ROT * dt;

    this.thrusting = this.input.isDown("thrust");
    if (this.thrusting) {
      this.vx += Math.cos(this.angle) * THRUST * dt;
      this.vy += Math.sin(this.angle) * THRUST * dt;
    }

    this.vx *= DRAG;
    this.vy *= DRAG;
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
  }

  tryShoot(): Bullet[] {
    if (this.shootCooldown > 0 || this.dead) return [];
    this.shootCooldown = SHOOT_COOLDOWN;
    const ox = this.x + Math.cos(this.angle) * NOSE;
    const oy = this.y + Math.sin(this.angle) * NOSE;
    if (this.tripleShot > 0) {
      return [
        new Bullet(ox, oy, this.angle - TRIPLE_SPREAD),
        new Bullet(ox, oy, this.angle),
        new Bullet(ox, oy, this.angle + TRIPLE_SPREAD),
      ];
    }
    return [new Bullet(ox, oy, this.angle)];
  }

  draw(ctx: CanvasRenderingContext2D): void {
    if (this.dead) return;
    // Parpadeo durante la invencibilidad de reaparición
    if (this.invincible > 0 && Math.floor(this.invincible * 8) % 2 === 0)
      return;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);
    ctx.strokeStyle = PALETTE.ship;
    ctx.shadowColor = PALETTE.ship;
    ctx.shadowBlur = GLOW_BLUR;
    ctx.lineWidth = 1.5;
    ctx.lineJoin = "round";

    // Silueta clásica: triángulo con muesca trasera
    ctx.beginPath();
    ctx.moveTo(20, 0); // nariz
    ctx.lineTo(-12, -9); // ala izquierda
    ctx.lineTo(-7, 0); // muesca trasera
    ctx.lineTo(-12, 9); // ala derecha
    ctx.closePath();
    ctx.stroke();

    // Llama del propulsor
    if (this.thrusting && Math.random() > 0.35) {
      ctx.beginPath();
      ctx.moveTo(-8, -4);
      ctx.lineTo(-8 - rand(6, 14), 0);
      ctx.lineTo(-8, 4);
      ctx.strokeStyle = PALETTE.bullet;
      ctx.shadowColor = PALETTE.bullet;
      ctx.stroke();
    }

    ctx.restore();
  }
}
