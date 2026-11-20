export interface Mounts {
  stage: HTMLElement;
  hudRoot: HTMLElement;
  shopRoot: HTMLElement;
  touchRoot: HTMLElement;
  fxRoot: HTMLElement;
  campPromptRoot: HTMLElement;
  upgradeRoot: HTMLElement;
  menuRoot: HTMLElement;
  boot: HTMLElement | null;
}

/** 统一收集挂载点，缺失时一次性抛错，避免 main 里散落判空。 */
export function collectMounts(): Mounts {
  const stage = document.getElementById('stage');
  const hudRoot = document.getElementById('hud');
  const shopRoot = document.getElementById('shop');
  const touchRoot = document.getElementById('touch');
  const fxRoot = document.getElementById('fx');
  const campPromptRoot = document.getElementById('camp-prompt');
  const upgradeRoot = document.getElementById('upgrade');
  const menuRoot = document.getElementById('start-menu');
  const boot = document.getElementById('boot');
  if (!stage || !hudRoot || !shopRoot || !touchRoot || !fxRoot || !campPromptRoot || !upgradeRoot || !menuRoot) {
    throw new Error('缺少挂载点');
  }
  return { stage, hudRoot, shopRoot, touchRoot, fxRoot, campPromptRoot, upgradeRoot, menuRoot, boot };
}
