import type { AudioBus } from './audiobus';
import type { SoundName } from './sfx-map';
import type { GameWorld } from '../sim/world';

function skillSound(behavior: string, tier: string): SoundName {
  if (tier === 'ultimate') return 'ultimate';
  if (behavior.startsWith('baguette')) return 'baguette';
  if (behavior === 'rocket') return 'rocket';
  if (behavior.startsWith('heatgun') || behavior === 'minigun' || behavior === 'flamer') return 'flamer';
  if (behavior === 'meteor') return 'meteor';
  if (behavior.startsWith('sorc') || behavior === 'wall' || behavior === 'nova') return 'spell';
  return 'fireball';
}

/** 把逻辑事件接到音频总线：位置只用于声像，不参与判定。 */
export function hookAudio(audio: AudioBus, world: GameWorld): void {
  const panFor = (x: number): number => {
    const id = world.playerId;
    const player = id !== null ? world.transforms.get(id) : undefined;
    if (!player) return 0;
    return Math.max(-1, Math.min(1, (x - player.x) / 700));
  };

  world.bus.on('skill:cast', (payload) => {
    audio.play(skillSound(payload.behavior, payload.tier), { pan: panFor(payload.x) });
  });
  world.bus.on('player:dodge', (payload) => audio.play('dodge', { pan: panFor(payload.x) }));
  world.bus.on('player:hurt', () => audio.play('hurt'));
  world.bus.on('enemy:kill', (payload) => {
    const enemyTransform = world.transforms.get(payload.id);
    audio.play('kill', { pan: enemyTransform ? panFor(enemyTransform.x) : 0 });
  });
  world.bus.on('player:death', () => audio.play('hurt', { volume: 0.7 }));
  world.bus.on('player:levelup', () => audio.play('levelup'));
  world.bus.on('shop:purchase', () => audio.play('buy'));
  world.bus.on('base:upgrade', () => audio.play('upgrade'));
}
