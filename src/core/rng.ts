export type Rng = {
  readonly seed: number;
  /** [0, 1) 均匀分布 */
  next(): number;
  /** [min, max) 均匀分布 */
  float(min: number, max: number): number;
  /** [min, max) 整数分布 */
  int(min: number, max: number): number;
};

/** mulberry32：32 位种子、无外部依赖、跨平台结果一致（联机与回放必需）。 */
export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createRng(seed: number): Rng {
  const next = mulberry32(seed);
  return {
    seed: seed >>> 0,
    next,
    float: (min: number, max: number) => min + next() * (max - min),
    int: (min: number, max: number) => Math.floor(min + next() * (max - min)),
  };
}
