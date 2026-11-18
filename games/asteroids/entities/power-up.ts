import { GLOW_BLUR, H, PALETTE, POWERUP_TTL, W } from "../constants";
import { rand, wrap } from "../utils";

/** Power-up recogible de triple disparo. */
export class PowerUp {
  x: number;
  y: number;
  readonly radius = 12;
  dead = false;
  private vx: number;
  private vy: number;
  private ttl = POWERUP_TTL;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
    const angle = rand(0, Math.PI * 2);
    const speed = rand(20, 40);
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
  }

  update(dt: number): void {
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }

  draw(ctx: CanvasRenderingContext2D): void {
    // Parpadea en los últimos 2 s antes de desaparecer.
    if (this.ttl < 2 && Math.floor(this.ttl * 8) % 2 === 0) return;
    const pulse = 0.85 + Math.sin(performance.now() / 150) * 0.15;
    const r = this.radius * pulse;

    ctx.save();
    ctx.shadowColor = PALETTE.powerUp;
    ctx.shadowBlur = GLOW_BLUR;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(Math.PI / 4);
    ctx.strokeStyle = PALETTE.powerUp;
    ctx.lineWidth = 2;
    ctx.strokeRect(-r, -r, r * 2, r * 2);
    ctx.restore();

    ctx.fillStyle = PALETTE.powerUp;
    ctx.font = "bold 12px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("3x", this.x, this.y);
    ctx.restore();
  }
}
