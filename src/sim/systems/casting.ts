import type { SkillData } from '../../data/skills';
import type { GameWorld } from '../world';
import type { Player } from '../components';
import type { CastContext } from '../runtime';
import type { EntityId } from '../../types';
import { sendNotice } from './notice';
import { consumeUlt, controlInput } from '../player-input';

/** 技能释放：所有玩家（本地 + 联机队友）共用冷却/前摇/体力规则。 */
export function castingSystem(world: GameWorld, dt: number): void {
  for (const id of world.playerIds) updateCasting(world, id, dt);
}

function updateCasting(world: GameWorld, id: EntityId, dt: number): void {
  const player = world.players.get(id);
  const transform = world.transforms.get(id);
  if (!player || !transform) return;

  for (const key of Object.keys(player.cooldowns)) {
    const value = player.cooldowns[key] ?? 0;
    if (value > 0) player.cooldowns[key] = Math.max(0, value - dt);
  }

  if (id === world.playerId) handleSlotSwitch(world, player);
  armPassive(world, player);

  if (player.castTimer > 0) {
    player.castTimer -= dt;
    if (player.castTimer <= 0) {
      const pending = player.pendingSkill;
      player.pendingSkill = null;
      if (pending) executeSkill(world, id, player, pending);
    }
  }

  if (consumeUlt(world, id)) tryUltimate(world, id, player);

  if (player.castTimer > 0) return;
  if (controlInput(world, id).fireHeld) {
    const slotId = player.slots[player.activeSlot];
    if (slotId) tryCast(world, id, player, slotId);
  }
}

function handleSlotSwitch(world: GameWorld, player: Player): void {
  const wheel = world.input.wheel;
  if (wheel !== 0) {
    world.input.wheel = 0;
    const direction = wheel > 0 ? 1 : -1;
    const next = (player.activeSlot + direction + 3) % 3;
    player.activeSlot = next as 0 | 1 | 2;
  }
  const request = world.input.slotRequest;
  if (request !== null) {
    world.input.slotRequest = null;
    if (request >= 0 && request <= 2) player.activeSlot = request as 0 | 1 | 2;
  }
}

function armPassive(world: GameWorld, player: Player): void {
  const featherId = player.slots.find((slotId) => {
    if (!slotId) return false;
    return world.registry.get(slotId)?.data.behavior === 'passive_revive';
  });
  if (!featherId || player.reviveReady) return;
  const cooldown = player.cooldowns[featherId] ?? 0;
  if (cooldown <= 0) player.reviveReady = true;
}

function tryCast(world: GameWorld, id: EntityId, player: Player, skillId: string): void {
  const def = world.registry.get(skillId);
  if (!def) return;
  const data = def.data;

  if (player.overheatLock) {
    if (player.overheat <= 45) player.overheatLock = false;
    else if (data.overheat) return;
  }

  if ((player.cooldowns[skillId] ?? 0) > 0) return;

  const cost = skillStaminaCost(world, data);
  if (cost > 0 && player.stamina < cost) {
    if (!player.remote) sendNotice(world, `体力不足，${data.name}释放失败`);
    return;
  }
  if (cost > 0) {
    player.stamina = Math.max(0, player.stamina - cost);
    player.staminaDelay = world.config.stamina.regenDelay;
  }

  if (data.castTime > 0) {
    player.cooldowns[skillId] = Math.max(0.05, player.overdrive > 0 ? 0.05 : effectiveCooldown(world, player, data));
    player.castTimer = data.castTime;
    player.pendingSkill = skillId;
    return;
  }
  player.cooldowns[skillId] = Math.max(0.05, player.overdrive > 0 ? 0.05 : effectiveCooldown(world, player, data));
  executeSkill(world, id, player, skillId);
}

/** 高阶技能体力成本：技能表可显式覆盖，否则按 tier 取默认。 */
export function skillStaminaCost(world: GameWorld, data: SkillData): number {
  if (typeof data.stamina === 'number') return data.stamina;
  if (data.tier === 'ultimate') return world.config.stamina.ultimateCost;
  if (data.tier === 'power') return world.config.stamina.powerSkillCost;
  return 0;
}

function effectiveCooldown(world: GameWorld, player: Player, data: SkillData): number {
  if (data.behavior === 'minigun') {
    return Math.max(0.08, data.cooldown - player.minigunSpin * 0.02);
  }
  return data.cooldown;
}

function executeSkill(world: GameWorld, id: EntityId, player: Player, skillId: string): void {
  const def = world.registry.get(skillId);
  const transform = world.transforms.get(id);
  if (!def || !transform) return;
  if (def.data.behavior === 'minigun') player.minigunSpin = Math.min(6, player.minigunSpin + 0.12);

  world.bus.emit('skill:cast', {
    id: def.data.id,
    behavior: def.data.behavior,
    tier: def.data.tier,
    x: transform.x,
    y: transform.y,
  });

  const aim = controlInput(world, id).aimWorld;
  const ctx: CastContext = {
    caster: id,
    origin: { x: transform.x, y: transform.y },
    aim: { x: aim.x, y: aim.y },
    world,
    rng: world.rng,
  };
  def.fire(ctx);
}

function tryUltimate(world: GameWorld, id: EntityId, player: Player): void {
  if (!player.ultimate) return;
  const def = world.registry.get(player.ultimate);
  if (!def) return;
  if (player.ultimateCharge < 1) {
    if (!player.remote) sendNotice(world, `${def.data.name}充能 ${Math.round(player.ultimateCharge * 100)}%`);
    return;
  }
  const cost = skillStaminaCost(world, def.data);
  if (cost > 0 && player.stamina < cost) {
    if (!player.remote) sendNotice(world, `体力不足，${def.data.name}无法释放`);
    return;
  }
  if (cost > 0) {
    player.stamina = Math.max(0, player.stamina - cost);
    player.staminaDelay = world.config.stamina.regenDelay;
  }
  player.ultimateCharge = 0;
  player.ultTimer = def.data.duration ?? 0.8;
  executeSkill(world, id, player, player.ultimate);
}
