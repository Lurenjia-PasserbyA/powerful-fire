export interface SlotSnapshot {
  name: string;
  cooldown: number;
  total: number;
  empty: boolean;
}

export interface HudSnapshot {
  level: number;
  xp: number;
  xpToNextLevel: number;
  hp: number;
  maxHp: number;
  shield: number;
  slots: SlotSnapshot[];
  activeSlot: number;
  ultimate: { name: string; charge: number } | null;
  kills: number;
  wave: number;
  biomeName: string;
  stamina: number;
  staminaMax: number;
  inBase: boolean;
  overheat: number;
  weak: boolean;
  x: number;
  y: number;
  worldWidth: number;
  worldHeight: number;
  fps: number;
  frameMs: number;
  steps: number;
  entities: number;
  backend: string;
  boss: { name: string; ratio: number } | null;
}

export interface Hud {
  update(snapshot: HudSnapshot): void;
  notify(text: string, kind?: 'warn' | 'info'): void;
  levelUp(level: number): void;
  saved(): void;
  hurtFlash(): void;
  reveal(): void;
  setTouchMode(active: boolean): void;
  setBoss(boss: { name: string; ratio: number } | null): void;
  readonly root: HTMLElement;
}

function requireEl(id: string): HTMLElement {
  const element = document.getElementById(id);
  if (!element) throw new Error(`HUD 缺少节点 #${id}`);
  return element;
}

/** HUD 为 DOM 层（第 8.1 节：Canvas 只渲染世界，面板走亚克力）。 */
export function createHud(root: HTMLElement): Hud {
  const levelLabel = requireEl('hud-level');
  const xpValue = requireEl('hud-xp-value');
  const xpFill = requireEl('hud-xp-fill');
  const mapPlayer = requireEl('hud-map-player');
  const waveLabel = requireEl('hud-wave');
  const hpValue = requireEl('hud-hp-value');
  const hpFill = requireEl('hud-hp-fill');
  const shieldFill = requireEl('hud-shield-fill');
  const statusRow = requireEl('hud-status');
  const staminaFill = requireEl('hud-stamina-fill');
  const staminaValue = requireEl('hud-stamina-value');
  const staminaTrack = requireEl('hud-stamina-track');
  const zoneChip = requireEl('hud-zone');
  const toast = requireEl('hud-toast');
  const levelup = requireEl('hud-levelup');
  const hurt = requireEl('hud-hurt');
  const saveChip = requireEl('hud-save');
  const ultValue = requireEl('hud-ult-value');
  const ultFill = requireEl('hud-ult-fill');
  const ultRing = requireEl('hud-ult-ring');
  const ultName = requireEl('hud-ult-name');
  const diag = requireEl('hud-diag');

  const slotEls = [0, 1, 2].map((index) => {
    const el = root.querySelector<HTMLElement>(`[data-slot="${index}"]`);
    if (!el) throw new Error(`HUD 缺少槽位 ${index}`);
    return {
      root: el,
      name: el.querySelector<HTMLElement>('.slot__name'),
      mask: el.querySelector<HTMLElement>('.slot__mask'),
      cd: el.querySelector<HTMLElement>('.slot__cd'),
    };
  });

  const bossBar = document.createElement('div');
  bossBar.id = 'hud-boss';
  bossBar.className = 'hud-boss';
  bossBar.innerHTML = '<span class="hud-boss__name"></span><span class="hud-boss__track"><span class="hud-boss__fill"></span></span>';
  root.appendChild(bossBar);
  const bossName = bossBar.querySelector<HTMLElement>('.hud-boss__name');
  const bossFill = bossBar.querySelector<HTMLElement>('.hud-boss__fill');

  let toastTimer: number | null = null;

  return {
    root,
    notify(text: string, kind: 'warn' | 'info' = 'warn'): void {
      toast.textContent = text;
      toast.className = `toast is-on ${kind === 'warn' ? 'is-warn' : 'is-info'}`;
      if (toastTimer !== null) window.clearTimeout(toastTimer);
      toastTimer = window.setTimeout(() => {
        toast.className = 'toast';
        toastTimer = null;
      }, 1600);
    },
    levelUp(level: number): void {
      levelup.textContent = `LEVEL ${level}`;
      levelup.className = 'levelup is-on';
      window.setTimeout(() => {
        levelup.className = 'levelup';
      }, 1200);
    },
    saved(): void {
      saveChip.className = 'save-chip is-on';
      window.setTimeout(() => {
        saveChip.className = 'save-chip';
      }, 900);
    },
    hurtFlash(): void {
      hurt.className = 'hurt is-on';
      window.setTimeout(() => {
        hurt.className = 'hurt';
      }, 380);
    },
    reveal(): void {
      root.classList.add('is-ready');
    },
    setTouchMode(active: boolean): void {
      root.classList.toggle('is-touch', active);
    },
    setBoss(boss: { name: string; ratio: number } | null): void {
      bossBar.classList.toggle('is-on', Boolean(boss));
      root.classList.toggle('has-boss', Boolean(boss));
      if (!boss) return;
      if (bossName) bossName.textContent = boss.name;
      if (bossFill) bossFill.style.width = `${Math.max(0, Math.min(1, boss.ratio)) * 100}%`;
    },
    update(s: HudSnapshot): void {
      this.setBoss(s.boss);
      levelLabel.textContent = `LV ${s.level}`;
      const ratio = s.xpToNextLevel > 0 ? Math.min(1, s.xp / s.xpToNextLevel) : 0;
      xpValue.textContent = `${Math.round(s.xp)} / ${s.xpToNextLevel}`;
      xpFill.style.width = `${(ratio * 100).toFixed(1)}%`;

      const left = ((s.x / s.worldWidth) * 100).toFixed(2);
      const top = ((s.y / s.worldHeight) * 100).toFixed(2);
      mapPlayer.style.left = `${left}%`;
      mapPlayer.style.top = `${top}%`;
      waveLabel.textContent = `WAVE ${s.wave} · ${s.biomeName} · KILL ${s.kills}`;

      const hpRatio = s.maxHp > 0 ? Math.max(0, Math.min(1, s.hp / s.maxHp)) : 0;
      hpFill.style.width = `${(hpRatio * 100).toFixed(1)}%`;
      hpValue.textContent = `${Math.max(0, Math.round(s.hp))} / ${s.maxHp}`;
      shieldFill.style.width = `${s.maxHp > 0 ? Math.min(1, s.shield / s.maxHp) * 100 : 0}%`;

      const staminaRatio = s.staminaMax > 0 ? Math.max(0, Math.min(1, s.stamina / s.staminaMax)) : 0;
      staminaFill.style.width = `${(staminaRatio * 100).toFixed(1)}%`;
      staminaValue.textContent = `${Math.round(s.stamina)} / ${s.staminaMax}`;
      staminaTrack.classList.toggle('is-low', staminaRatio < 0.25);

      zoneChip.classList.toggle('is-on', s.inBase);

      statusRow.innerHTML = '';
      if (s.overheat > 0) statusRow.appendChild(chip(`过热 ${Math.round(s.overheat)}%`, 'is-hot'));
      if (s.weak) statusRow.appendChild(chip('虚弱', 'is-weak'));
      if (s.shield > 0) statusRow.appendChild(chip('护盾', 'is-cold'));
      if (Math.floor(s.xp) > 0) statusRow.appendChild(chip(`XP ${Math.floor(s.xp)}`, ''));

      for (let i = 0; i < slotEls.length; i += 1) {
        const slot = s.slots[i];
        const ui = slotEls[i];
        if (!ui || !ui.name || !ui.mask || !ui.cd) continue;
        ui.root.classList.toggle('is-active', i === s.activeSlot);
        if (!slot || slot.empty) {
          ui.root.classList.add('is-empty');
          ui.name.textContent = '未装配';
          ui.mask.style.opacity = '0';
          ui.cd.textContent = '';
          continue;
        }
        ui.root.classList.remove('is-empty');
        ui.name.textContent = slot.name;
        const remaining = Math.max(0, slot.cooldown);
        if (remaining > 0 && slot.total > 0) {
          const covered = Math.min(1, remaining / slot.total) * 360;
          ui.mask.style.background = `conic-gradient(rgba(6,6,10,0.76) ${covered}deg, rgba(6,6,10,0) 0deg)`;
          ui.mask.style.opacity = '1';
          ui.cd.textContent = remaining >= 1 ? remaining.toFixed(0) : remaining.toFixed(1);
        } else {
          ui.mask.style.opacity = '0';
          ui.cd.textContent = '';
        }
      }

      const charge = s.ultimate ? Math.min(1, s.ultimate.charge) : 0;
      ultValue.textContent = `${Math.round(charge * 100)}%`;
      ultFill.style.opacity = charge >= 1 ? '0.5' : `${0.12 + charge * 0.2}`;
      ultRing.classList.toggle('is-ready', charge >= 1);
      ultName.textContent = s.ultimate ? s.ultimate.name : '未装配';

      diag.textContent = `FPS ${Math.round(s.fps)} · 帧 ${s.frameMs.toFixed(1)}ms · 步 ${s.steps} · 实体 ${s.entities} · X ${Math.round(
        s.x,
      )} Y ${Math.round(s.y)} · ${s.backend}`;
    },
  };
}

function chip(text: string, className: string): HTMLElement {
  const element = document.createElement('span');
  element.className = `status-chip ${className}`.trim();
  element.textContent = text;
  return element;
}
