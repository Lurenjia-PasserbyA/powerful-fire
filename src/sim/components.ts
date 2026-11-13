import type { Vec2 } from '../types';

/** 世界变换：prev* 字段供渲染插值使用（逻辑只读 x/y/angle）。 */
export interface Transform {
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  angle: number;
  prevAngle: number;
}

export interface Velocity {
  x: number;
  y: number;
}

/** 击退冲量，独立衰减，不覆盖 AI / 输入速度。 */
export interface Knockback {
  x: number;
  y: number;
}

/** 移动参数（来自 data/config.json 与 enemies.json）。 */
export interface Movement {
  speed: number;
  radius: number;
}

export interface Health {
  hp: number;
  maxHp: number;
}

export type EnemyState = 'idle' | 'chase' | 'windup' | 'recover' | 'retreat';

export interface Enemy {
  type: string;
  state: EnemyState;
  timer: number;
  attackCooldown: number;
  hurt: number;
}

/** burning 为剩余秒数，flammable / corroding 为层数（随时间缓慢衰减）。 */
export interface Statuses {
  burning: number;
  flammable: number;
  corroding: number;
}

export interface Player {
  level: number;
  xp: number;
  xpToNextLevel: number;
  hp: number;
  maxHp: number;
  shield: number;
  shieldTimer: number;
  activeSlot: 0 | 1 | 2;
  slots: [string | null, string | null, string | null];
  ultimate: string | null;
  ultimateCharge: number;
  cooldowns: Record<string, number>;
  castTimer: number;
  pendingSkill: string | null;
  invulnerable: number;
  dodgeCooldown: number;
  dodgeTimer: number;
  dodgeDir: Vec2;
  overheat: number;
  overheatLock: boolean;
  overdrive: number;
  weakTimer: number;
  ultTimer: number;
  kills: number;
  deaths: number;
  minigunSpin: number;
  reviveReady: boolean;
  /** 体力：冲刺/闪避/高阶技能消耗，静止片刻后回复（基地内更快）。 */
  stamina: number;
  staminaMax: number;
  staminaDelay: number;
  /** 升级台累积的技能伤害加成倍率（1 = 未升级）。 */
  damageMult: number;
  /** 提示节流，避免「体力不足」每帧刷屏。 */
  noticeCooldown: number;
}

/** 瞄准点（世界坐标），由 AimResolver 平滑后写入，技能释放统一读这里。 */
export interface Aim {
  x: number;
  y: number;
}

/** 每逻辑步刷新的输入快照，逻辑层唯一的输入入口。 */
export interface InputBuffer {
  move: Vec2;
  pointerLogical: Vec2;
  aimWorld: Vec2;
  fireHeld: boolean;
  dodgePressed: boolean;
  ultPressed: boolean;
  shopPressed: boolean;
  wheel: number;
  slotRequest: number | null;
  pointerInside: boolean;
  touchMode: boolean;
  sprint: boolean;
}
