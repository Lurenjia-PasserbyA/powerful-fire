import rawEnemies from './enemies.json';

export interface EnemyData {
  name: string;
  hp: number;
  speed: number;
  radius: number;
  damage: number;
  attackRange: number;
  windup: number;
  attackCooldown: number;
  xp: number;
  knockbackResist: number;
  boss?: boolean;
  summonType?: string;
}

export type EnemyKey = keyof typeof rawEnemies;

export const enemies: Record<EnemyKey, EnemyData> = rawEnemies;

export function enemyData(key: string): EnemyData {
  const data = (enemies as Record<string, EnemyData>)[key];
  if (!data) throw new Error(`未知敌人类型: ${key}`);
  return data;
}
