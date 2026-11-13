/** 色板集中管理：禁止在渲染 / 逻辑代码里散落硬编码色值（第 15 节）。 */
export const palette = {
  background: 0x0b0a0e,
  terrainBase: 0x16131a,
  terrainChunk: 0x1c1822,
  terrainGrid: 0x2a2432,
  terrainAccent: 0x30283a,
  fire: 0xff6b35,
  fireSoft: 0xffb347,
  danger: 0xe63946,
  cooldown: 0x4a4e69,
  text: 0xf5efe9,
  steel: 0x8a8f9c,
  ash: 0x4b4340,
  enemyBody: 0x3a2f42,
  enemyRim: 0x6b4a63,
  enemyEye: 0xff7b54,
  hpBack: 0x241e28,
  hpFill: 0xe63946,
  shield: 0x63b3ed,
  xpOrb: 0x8ef2a7,
  toxic: 0x8ac926,
  magma: 0xb23a1f,
  baguette: 0xe0b076,
  spark: 0xffe066,
} as const;

export type PaletteKey = keyof typeof palette;

export function cssColor(key: PaletteKey, alpha = 1): string {
  const hex = palette[key].toString(16).padStart(6, '0');
  return `rgba(${parseInt(hex.slice(0, 2), 16)}, ${parseInt(hex.slice(2, 4), 16)}, ${parseInt(
    hex.slice(4, 6),
    16,
  )}, ${alpha})`;
}
