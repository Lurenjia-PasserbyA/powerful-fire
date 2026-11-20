import { Container, Sprite, Texture } from 'pixi.js';
import type { GameWorld } from '../sim/world';
type FxTexture = 'glow' | 'ring' | 'streak';

interface Particle {
  sprite: Sprite;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size0: number;
  size1: number;
  alpha: number;
  drag: number;
  spin: number;
  fade: number;
  streak: boolean;
}

const MAX_PARTICLES = 420;
const GLOW_SIZE = 64;

function canvasTexture(draw: (ctx: CanvasRenderingContext2D, size: number) => void, width = 64, height = 64): Texture {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return Texture.EMPTY;
  draw(ctx, width);
  return Texture.from(canvas);
}

function softGlowTexture(): Texture {
  return canvasTexture((ctx, size) => {
    const radius = size / 2;
    const gradient = ctx.createRadialGradient(radius, radius, 0, radius, radius, radius);
    gradient.addColorStop(0, 'rgba(255,255,255,0.95)');
    gradient.addColorStop(0.26, 'rgba(255,255,255,0.55)');
    gradient.addColorStop(0.62, 'rgba(255,255,255,0.12)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
  });
}

function ringTexture(): Texture {
  return canvasTexture((ctx, size) => {
    const radius = size * 0.42;
    ctx.strokeStyle = 'rgba(255,255,255,0.92)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, radius + 2, 0, Math.PI * 2);
    ctx.stroke();
  });
}

function streakTexture(): Texture {
  return canvasTexture((ctx, width) => {
    const gradient = ctx.createLinearGradient(0, 0, width, 0);
    gradient.addColorStop(0, 'rgba(255,255,255,0)');
    gradient.addColorStop(0.45, 'rgba(255,255,255,0.7)');
    gradient.addColorStop(0.78, 'rgba(255,255,255,1)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 22, width, 20);
  }, 64, 64);
}

const ENEMY_COLORS: Record<string, number> = {
  cinderhound: 0xff7a3d,
  sporeling: 0xa8dc72,
  vinecaster: 0xb68cff,
  obsidian_knight: 0xff6b6b,
  magma_wisp: 0xff9a4a,
  shard_beetle: 0x5ef2ff,
  ash_priest: 0xd67cff,
  caldera_hulk: 0xff5a2a,
  crystal_warden: 0x7af5ff,
};

const PROJECTILE_COLORS: Record<string, number> = {
  fireball: 0xff8a3d,
  ult: 0xffd166,
  rocket: 0xffb347,
  baguette: 0xffd166,
  nail: 0xfff1c1,
  ghost: 0xffb347,
  boomerang: 0xffb347,
};
export function enemyFxColor(type: string): number {
  return ENEMY_COLORS[type] ?? 0xff8a3d;
}

export function projectileFxColor(kind: string): number {
  return PROJECTILE_COLORS[kind] ?? 0xff8a3d;
}

/**
 * 池化粒子表现层：命中火花、枪口闪光、爆炸环、移动/弹道拖尾。
 * 只读取世界状态与事件，不参与判定；粒子使用加色混合，保持 60fps 预算。
 */
export class EffectLayer {
  private readonly particles: Particle[] = [];
  private readonly free: Sprite[] = [];
  private readonly glow: Texture;
  private readonly ring: Texture;
  private readonly streak: Texture;
  private playerTrail = 0;
  private enemyTrail = 0;
  private projectileTrail = 0;

  constructor(private readonly layer: Container) {
    this.glow = softGlowTexture();
    this.ring = ringTexture();
    this.streak = streakTexture();
  }

  burst(
    x: number,
    y: number,
    color: number,
    count = 10,
    speed = 180,
    size = 5,
    life = 0.42,
    spread = Math.PI * 2,
    angle = 0,
  ): void {
    for (let i = 0; i < count; i += 1) {
      const a = angle + (Math.random() - 0.5) * spread;
      const sp = speed * (0.22 + Math.random() * 0.95);
      this.spawn(
        'glow',
        x + (Math.random() - 0.5) * 4,
        y + (Math.random() - 0.5) * 4,
        {
          vx: Math.cos(a) * sp,
          vy: Math.sin(a) * sp,
          life: life * (0.55 + Math.random() * 0.6),
          size0: size * (0.35 + Math.random() * 0.65),
          size1: 0,
          color,
          alpha: 0.75,
          drag: 2.4 + Math.random() * 2.2,
          spin: (Math.random() - 0.5) * 6,
        },
      );
    }
  }

  shockwave(x: number, y: number, radius: number, color: number, life = 0.42): void {
    this.spawn('ring', x, y, {
      vx: 0,
      vy: 0,
      life,
      size0: 8,
      size1: radius * 2,
      color,
      alpha: 0.8,
      drag: 0,
      spin: 0,
      fade: 1.1,
    });
  }

  muzzle(x: number, y: number, aimX: number, aimY: number, color: number, strength = 1): void {
    const angle = Math.atan2(aimY - y, aimX - x);
    const distance = 15;
    const mx = x + Math.cos(angle) * distance;
    const my = y + Math.sin(angle) * distance;
    this.burst(mx, my, color, 5, 130 * strength, 5.5 * strength, 0.18, 0.7, angle);
    this.spawn('glow', mx, my, {
      vx: Math.cos(angle) * 35,
      vy: Math.sin(angle) * 35,
      life: 0.14,
      size0: 24 * strength,
      size1: 4,
      color: 0xfff8e8,
      alpha: 0.8,
      drag: 3,
      spin: 0,
      fade: 1.6,
    });
    this.spawn('glow', x, y, {
      vx: 0,
      vy: 0,
      life: 0.24,
      size0: 10,
      size1: 30 * strength,
      color,
      alpha: 0.25,
      drag: 2,
      spin: 0,
      fade: 1.2,
    });
  }

  impact(x: number, y: number, color: number, amount = 10): void {
    this.burst(x, y, 0xfff3d0, 5, 150 + amount * 2.2, 3.2, 0.24);
    this.burst(x, y, color, 3, 90, 2.1, 0.28);
    this.spawn('glow', x, y, {
      vx: 0,
      vy: 0,
      life: 0.1,
      size0: 24,
      size1: 4,
      color: 0xffffff,
      alpha: 0.6,
      drag: 2,
      spin: 0,
      fade: 1.4,
    });
    if (amount >= 55) this.shockwave(x, y, 26 + amount * 0.8, color, 0.28);
  }

  explosion(x: number, y: number, radius: number, color: number, power = 1): void {
    this.burst(x, y, color, Math.min(34, 12 + Math.round(radius * 0.12)), 120 + radius * 1.5, 6 * power, 0.6);
    this.burst(x, y, 0xfff3d0, 4, 220 * power, 4, 0.25);
    this.shockwave(x, y, radius, color, 0.46);
    this.spawn('glow', x, y, {
      vx: 0,
      vy: 0,
      life: 0.24,
      size0: 20,
      size1: radius * 0.9,
      color: 0xfff0d0,
      alpha: 0.5,
      drag: 0,
      spin: 0,
      fade: 1.4,
    });
  }

  projectileTrailAt(x: number, y: number, vx: number, vy: number, color: number): void {
    const angle = Math.atan2(vy, vx);
    this.spawn('streak', x, y, {
      vx: vx * 0.12,
      vy: vy * 0.12,
      life: 0.18,
      size0: 14,
      size1: 4,
      color,
      alpha: 0.42,
      drag: 3,
      spin: 0,
      fade: 1.3,
      streak: true,
      rotation: angle,
    });
  }

  update(dt: number, world: GameWorld): void {
    this.updateParticles(dt);
    if (dt <= 0) return;

    const playerId = world.playerId;
    if (playerId !== null) {
      const velocity = world.velocities.get(playerId);
      const transform = world.transforms.get(playerId);
      const speed = velocity ? Math.hypot(velocity.x, velocity.y) : 0;
      if (transform && speed > 90) {
        this.playerTrail += dt;
        if (this.playerTrail >= 0.045 && this.particles.length < 330) {
          this.playerTrail = 0;
          const angle = Math.atan2(velocity?.y ?? 0, velocity?.x ?? 0);
          this.spawn('glow', transform.x - Math.cos(angle) * 12, transform.y - Math.sin(angle) * 12, {
            vx: -(velocity?.x ?? 0) * 0.25 + (Math.random() - 0.5) * 30,
            vy: -(velocity?.y ?? 0) * 0.25 + (Math.random() - 0.5) * 30,
            life: 0.34,
            size0: 7,
            size1: 0,
            color: 0xffb347,
            alpha: 0.32,
            drag: 3,
            spin: 0,
            fade: 1.2,
          });
        }
      }
    }

    this.enemyTrail += dt;
    if (this.enemyTrail >= 0.075 && this.particles.length < 310) {
      this.enemyTrail = 0;
      let emitted = 0;
      for (const id of world.enemies.keys()) {
        if (emitted >= 7) break;
        const enemy = world.enemies.get(id);
        const transform = world.transforms.get(id);
        if (!enemy || !transform) continue;
        const color = ENEMY_COLORS[enemy.type] ?? 0xff8a3d;
        this.spawn('glow', transform.x, transform.y, {
          vx: (Math.random() - 0.5) * 22,
          vy: (Math.random() - 0.5) * 22,
          life: 0.28,
          size0: enemy.type === 'caldera_hulk' || enemy.type === 'crystal_warden' ? 14 : 7,
          size1: 0,
          color,
          alpha: enemy.type === 'crystal_warden' ? 0.4 : 0.18,
          drag: 3,
          spin: 0,
          fade: 1.2,
        });
        emitted += 1;
      }
    }

    this.projectileTrail += dt;
    if (this.projectileTrail >= 0.018 && this.particles.length < 300) {
      this.projectileTrail = 0;
      let emitted = 0;
      for (const projectile of world.projectiles) {
        if (emitted >= 14) break;
        if (!projectile.active) continue;
        if (Math.hypot(projectile.vx, projectile.vy) < 28) continue;
        this.projectileTrailAt(
          projectile.x,
          projectile.y,
          projectile.vx,
          projectile.vy,
          PROJECTILE_COLORS[projectile.kind] ?? 0xff8a3d,
        );
        emitted += 1;
      }
    }
  }

  private updateParticles(dt: number): void {
    for (let i = this.particles.length - 1; i >= 0; i -= 1) {
      const particle = this.particles[i];
      if (!particle) continue;
      particle.life -= dt;
      if (particle.life <= 0) {
        particle.sprite.visible = false;
        this.free.push(particle.sprite);
        this.particles[i] = this.particles[this.particles.length - 1] as Particle;
        this.particles.pop();
        continue;
      }
      const damping = particle.drag > 0 ? Math.exp(-particle.drag * dt) : 1;
      particle.vx *= damping;
      particle.vy *= damping;
      const sprite = particle.sprite;
      sprite.x += particle.vx * dt;
      sprite.y += particle.vy * dt;
      if (particle.spin) sprite.rotation += particle.spin * dt;
      const ratio = Math.max(0, particle.life / particle.maxLife);
      const size = particle.size1 + (particle.size0 - particle.size1) * ratio;
      const scale = size / GLOW_SIZE;
      sprite.scale.set(scale, particle.streak ? scale * 1.2 : scale);
      sprite.alpha = particle.alpha * Math.pow(ratio, particle.fade);
    }
  }

  private spawn(
    type: FxTexture,
    x: number,
    y: number,
    options: {
      vx: number;
      vy: number;
      life: number;
      size0: number;
      size1: number;
      color: number;
      alpha: number;
      drag: number;
      spin: number;
      fade?: number;
      streak?: boolean;
      rotation?: number;
    },
  ): void {
    if (this.particles.length >= MAX_PARTICLES) return;
    const sprite = this.free.pop() ?? new Sprite();
    if (!sprite.parent) this.layer.addChild(sprite);
    sprite.visible = true;
    sprite.texture = type === 'ring' ? this.ring : type === 'streak' ? this.streak : this.glow;
    sprite.anchor.set(0.5);
    sprite.blendMode = 'add';
    sprite.tint = options.color;
    sprite.position.set(x, y);
    sprite.rotation = options.rotation ?? 0;
    sprite.alpha = options.alpha;
    const scale = options.size0 / GLOW_SIZE;
    sprite.scale.set(scale, options.streak ? scale * 1.2 : scale);
    this.particles.push({
      sprite,
      vx: options.vx,
      vy: options.vy,
      life: options.life,
      maxLife: options.life,
      size0: options.size0,
      size1: options.size1,
      alpha: options.alpha,
      drag: options.drag,
      spin: options.spin,
      fade: options.fade ?? 1,
      streak: options.streak ?? false,
    });
  }
}
