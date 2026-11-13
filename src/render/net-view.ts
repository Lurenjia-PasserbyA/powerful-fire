import { Container, Graphics } from 'pixi.js';
import type { RenderLayers } from './layers';
import type { Snapshot } from '../net/protocol';

interface Tracked {
  root: Container;
  body: Graphics;
  bar: Graphics;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  fromAt: number;
  toAt: number;
  kind: string;
  radius: number;
  angle: number;
  hpRatio: number;
  color: number;
}

const PLAYER_COLORS = [0xffc857, 0x66d9ff, 0x9dff7a, 0xff8ad8];

/** 客机专用轻量渲染：只画快照里的实体，不跑 ECS/模拟。 */
export class NetView {
  readonly root = new Container();
  private tracked = new Map<string, Tracked>();
  private playersOnly: boolean;
  private excludeNetId: number;

  constructor(layers: RenderLayers, options: { playersOnly?: boolean; excludeNetId?: number } = {}) {
    this.root.label = 'net-view';
    this.playersOnly = options.playersOnly ?? false;
    this.excludeNetId = options.excludeNetId ?? -1;
    layers.world.addChild(this.root);
  }

  apply(snapshot: Snapshot): void {
    const now = performance.now();
    const seen = new Set<string>();
    for (const player of snapshot.players) {
      if (player.netId === this.excludeNetId) continue;
      const key = `p:${player.netId}`;
      seen.add(key);
      this.upsert(key, 'player', player.x, player.y, 16, player.angle, player.hp / Math.max(1, player.maxHp), PLAYER_COLORS[player.netId % PLAYER_COLORS.length] ?? 0xffc857, now);
    }
    if (!this.playersOnly) {
      for (const enemy of snapshot.enemies) {
        const key = `e:${enemy.id}`;
        seen.add(key);
        const color = enemy.state === 'windup' ? 0xff8a3d : enemy.state === 'chase' ? 0xff5c5c : 0x9aa4b2;
        this.upsert(key, enemy.type, enemy.x, enemy.y, 15, 0, enemy.hp / Math.max(1, enemy.maxHp), color, now);
      }
      snapshot.projectiles.forEach((projectile, index) => {
        const key = `j:${index}`;
        seen.add(key);
        this.upsert(key, `proj:${projectile.kind}`, projectile.x, projectile.y, 3.5, projectile.angle, 1, 0xffd166, now);
      });
      snapshot.orbs.forEach((orb, index) => {
        const key = `o:${index}`;
        seen.add(key);
        this.upsert(key, 'orb', orb.x, orb.y, 4, 0, 1, 0x7ef7c8, now);
      });
      snapshot.areas.forEach((area, index) => {
        const key = `a:${index}`;
        seen.add(key);
        this.upsert(key, `area:${area.kind}`, area.x, area.y, Math.max(12, area.radius), area.angle, Math.max(0, area.life / Math.max(0.001, area.maxLife)), 0xff7a2f, now);
      });
    }

    for (const key of [...this.tracked.keys()]) {
      if (seen.has(key)) continue;
      const entry = this.tracked.get(key);
      entry?.root.destroy({ children: true });
      this.tracked.delete(key);
    }
  }

  private upsert(
    key: string,
    kind: string,
    x: number,
    y: number,
    radius: number,
    angle: number,
    hpRatio: number,
    color: number,
    now: number,
  ): void {
    let entry = this.tracked.get(key);
    if (!entry) {
      const root = new Container();
      const body = new Graphics();
      const bar = new Graphics();
      root.addChild(body, bar);
      this.root.addChild(root);
      entry = {
        root,
        body,
        bar,
        fromX: x,
        fromY: y,
        toX: x,
        toY: y,
        fromAt: now,
        toAt: now + 100,
        kind,
        radius,
        angle,
        hpRatio,
        color,
      };
      this.tracked.set(key, entry);
    }
    const currentX = lerp(entry.fromX, entry.toX, (now - entry.fromAt) / Math.max(1, entry.toAt - entry.fromAt));
    const currentY = lerp(entry.fromY, entry.toY, (now - entry.fromAt) / Math.max(1, entry.toAt - entry.fromAt));
    entry.fromX = currentX;
    entry.fromY = currentY;
    entry.toX = x;
    entry.toY = y;
    entry.fromAt = now;
    entry.toAt = now + 100;
    entry.kind = kind;
    entry.radius = radius;
    entry.angle = angle;
    entry.hpRatio = hpRatio;
    entry.color = color;
    this.draw(entry);
  }

  private draw(entry: Tracked): void {
    entry.body.clear();
    if (entry.kind.startsWith('area:')) {
      const alpha = Math.max(0.08, Math.min(0.65, entry.hpRatio));
      entry.body.circle(0, 0, entry.radius).fill({ color: entry.color, alpha });
      entry.body.circle(0, 0, entry.radius).stroke({ color: 0xffc38a, alpha: 0.5, width: 1.5 });
      return;
    }
    if (entry.kind === 'orb') {
      entry.body.circle(0, 0, 4).fill({ color: 0x7ef7c8, alpha: 0.95 });
      return;
    }
    if (entry.kind.startsWith('proj:')) {
      entry.body.circle(0, 0, 3.5).fill({ color: 0xffd166, alpha: 0.95 });
      return;
    }
    if (entry.kind === 'player') {
      entry.body.circle(0, 0, 15).fill({ color: entry.color, alpha: 0.9 });
      entry.body.circle(0, 0, 15).stroke({ color: 0x1a120c, width: 2 });
      entry.body.moveTo(0, 0).lineTo(Math.cos(entry.angle) * 24, Math.sin(entry.angle) * 24).stroke({ color: 0xfff1c9, width: 2 });
      this.drawBar(entry, 34);
      return;
    }
    entry.body.circle(0, 0, 14).fill({ color: entry.color, alpha: 0.92 });
    entry.body.circle(0, 0, 14).stroke({ color: 0x28140c, width: 2 });
    this.drawBar(entry, 28);
  }

  private drawBar(entry: Tracked, width: number): void {
    entry.bar.clear();
    entry.bar.rect(-width / 2, -26, width, 4).fill({ color: 0x120d09, alpha: 0.8 });
    entry.bar
      .rect(-width / 2, -26, width * Math.max(0, Math.min(1, entry.hpRatio)), 4)
      .fill({ color: entry.hpRatio > 0.5 ? 0xffcf6b : 0xff5c5c, alpha: 0.95 });
  }

  sync(): void {
    const now = performance.now();
    for (const entry of this.tracked.values()) {
      const t = Math.min(1, (now - entry.fromAt) / Math.max(1, entry.toAt - entry.fromAt));
      entry.root.x = lerp(entry.fromX, entry.toX, t);
      entry.root.y = lerp(entry.fromY, entry.toY, t);
    }
  }

  destroy(): void {
    this.root.destroy({ children: true });
  }
}

function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * Math.max(0, Math.min(1, t));
}
