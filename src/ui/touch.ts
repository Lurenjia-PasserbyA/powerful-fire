import type { Vec2 } from '../types';

export interface TouchOptions {
  host: HTMLElement;
  mapPointer: (clientX: number, clientY: number) => Vec2;
  /** 玩家当前世界坐标：右摇杆据此换算瞄准方向。 */
  playerWorld: () => Vec2;
  onShop: () => void;
  /** 自动瞄准：返回世界坐标中的最近敌人；没有目标返回 null。 */
  autoAim?: () => Vec2 | null;
}

export interface TouchController {
  readonly state: {
    move: Vec2;
    aim: Vec2 | null;
    fireHeld: boolean;
    autoFire: boolean;
    dodgePressed: boolean;
    ultPressed: boolean;
    slotRequest: number | null;
  };
  setActive(active: boolean): void;
  setSlots(names: string[], active: number): void;
  setUltimate(name: string | null, charge: number): void;
  setStamina(ratio: number, low: boolean): void;
  setHp(hp: number, max: number): void;
  consume(): { dodge: boolean; ult: boolean };
}

const STICK_RADIUS = 58;
const AIM_RADIUS = 62;
const AIM_DEADZONE = 8;
const AIM_DISTANCE = 900;

function buzz(ms = 12): void {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* 不支持震动时忽略 */
  }
}

/**
 * 触屏：左半屏任意位置按下滑出浮动摇杆；右半屏拖动瞄准并开火；
 * 右下角大号闪避/大招、下方槽位、体力条与自动开火开关。
 */
export function createTouch(options: TouchOptions): TouchController {
  const { host } = options;
  host.innerHTML = '';

  const moveZone = document.createElement('div');
  moveZone.className = 'touch__move-zone';
  const stick = document.createElement('div');
  stick.className = 'touch__stick';
  const knob = document.createElement('div');
  knob.className = 'touch__knob';
  stick.appendChild(knob);
  moveZone.appendChild(stick);

  const aimPad = document.createElement('div');
  aimPad.className = 'touch__aim';

  // 固定底座只做位置提示，真正跟手的是按下滑出的浮动瞄准摇杆。
  const aimBase = document.createElement('div');
  aimBase.className = 'touch__aim-base';
  const aimBaseLabel = document.createElement('span');
  aimBaseLabel.textContent = '瞄准';
  aimBase.appendChild(aimBaseLabel);

  const aimStick = document.createElement('div');
  aimStick.className = 'touch__aim-stick';
  const aimKnob = document.createElement('div');
  aimKnob.className = 'touch__aim-knob';
  aimStick.appendChild(aimKnob);
  aimPad.append(aimBase, aimStick);

  const actions = document.createElement('div');
  actions.className = 'touch__actions';
  const buttons: Record<string, HTMLButtonElement> = {};
  for (const [key, label] of [
    ['dodge', '闪避'],
    ['ult', '大招'],
  ] as const) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `touch__btn touch__btn--${key}`;
    button.textContent = label;
    actions.appendChild(button);
    buttons[key] = button;
  }

  const autoButton = document.createElement('button');
  autoButton.type = 'button';
  autoButton.className = 'touch__auto';
  autoButton.textContent = '自动开火 关';
  autoButton.setAttribute('aria-pressed', 'false');

  const shopButton = document.createElement('button');
  shopButton.type = 'button';
  shopButton.className = 'touch__shop';
  shopButton.textContent = '商店';

  const hp = document.createElement('div');
  hp.className = 'touch__hp';
  const hpFill = document.createElement('div');
  hpFill.className = 'touch__hp-fill';
  const hpText = document.createElement('span');
  hpText.className = 'touch__hp-text';
  hpText.textContent = '100 / 100';
  hp.append(hpFill, hpText);

  const stamina = document.createElement('div');
  stamina.className = 'touch__stamina';
  const staminaFill = document.createElement('div');
  staminaFill.className = 'touch__stamina-fill';
  stamina.appendChild(staminaFill);

  const slots = document.createElement('div');
  slots.className = 'touch__slots';

  const rotate = document.createElement('div');
  rotate.className = 'touch__rotate';
  rotate.textContent = '横屏游玩体验更佳';

  host.append(moveZone, aimPad, actions, autoButton, shopButton, hp, stamina, slots, rotate);

  const state = {
    move: { x: 0, y: 0 },
    aim: null as Vec2 | null,
    fireHeld: false,
    autoFire: false,
    dodgePressed: false,
    ultPressed: false,
    slotRequest: null as number | null,
  };

  let stickPointer: number | null = null;
  let aimPointer: number | null = null;
  let stickX = 0;
  let stickY = 0;
  let aimX = 0;
  let aimY = 0;
  let ultName: string | null = null;

  const resetStick = (): void => {
    state.move.x = 0;
    state.move.y = 0;
    knob.style.transform = 'translate(0px, 0px)';
    stick.classList.remove('is-active');
  };

  const updateStick = (event: PointerEvent): void => {
    const dx = event.clientX - stickX;
    const dy = event.clientY - stickY;
    const distance = Math.hypot(dx, dy);
    if (distance > 0.001) {
      const strength = Math.min(1, distance / STICK_RADIUS);
      state.move = { x: (dx / distance) * strength, y: (dy / distance) * strength };
    }
    const clamped = Math.min(distance, STICK_RADIUS);
    const angle = Math.atan2(dy, dx);
    knob.style.transform = `translate(${Math.cos(angle) * clamped}px, ${Math.sin(angle) * clamped}px)`;
  };

  const beginStick = (event: PointerEvent): void => {
    if (stickPointer !== null) return;
    stickPointer = event.pointerId;
    stickX = event.clientX;
    stickY = event.clientY;
    const rect = moveZone.getBoundingClientRect();
    stick.style.left = `${event.clientX - rect.left}px`;
    stick.style.top = `${event.clientY - rect.top}px`;
    stick.classList.add('is-active');
    try {
      moveZone.setPointerCapture(event.pointerId);
    } catch {
      /* 合成事件无捕获能力 */
    }
    updateStick(event);
  };

  moveZone.addEventListener('pointerdown', beginStick);
  moveZone.addEventListener('pointermove', (event) => {
    if (stickPointer !== event.pointerId) return;
    updateStick(event);
  });
  const endStick = (event: PointerEvent): void => {
    if (stickPointer !== event.pointerId) return;
    stickPointer = null;
    resetStick();
  };
  moveZone.addEventListener('pointerup', endStick);
  moveZone.addEventListener('pointercancel', endStick);

  const resetAim = (): void => {
    state.aim = null;
    state.fireHeld = false;
    aimKnob.style.transform = 'translate(0px, 0px)';
    aimStick.classList.remove('is-active');
  };

  const updateAim = (event: PointerEvent): void => {
    const dx = event.clientX - aimX;
    const dy = event.clientY - aimY;
    const distance = Math.hypot(dx, dy);
    const clamped = Math.min(distance, AIM_RADIUS);
    if (distance > 0.001) {
      const angle = Math.atan2(dy, dx);
      aimKnob.style.transform = `translate(${Math.cos(angle) * clamped}px, ${Math.sin(angle) * clamped}px)`;
    }
    if (distance < AIM_DEADZONE) {
      state.aim = null;
      return;
    }
    const origin = options.playerWorld();
    state.aim = {
      x: origin.x + (dx / distance) * AIM_DISTANCE,
      y: origin.y + (dy / distance) * AIM_DISTANCE,
    };
  };

  aimPad.addEventListener('pointerdown', (event) => {
    if (aimPointer !== null) return;
    aimPointer = event.pointerId;
    aimX = event.clientX;
    aimY = event.clientY;
    const rect = aimPad.getBoundingClientRect();
    aimStick.style.left = `${event.clientX - rect.left}px`;
    aimStick.style.top = `${event.clientY - rect.top}px`;
    aimStick.classList.add('is-active');
    try {
      aimPad.setPointerCapture(event.pointerId);
    } catch {
      /* 合成事件无捕获能力 */
    }
    state.fireHeld = true;
    state.aim = null;
  });
  aimPad.addEventListener('pointermove', (event) => {
    if (aimPointer !== event.pointerId) return;
    updateAim(event);
  });
  const endAim = (event: PointerEvent): void => {
    if (aimPointer !== event.pointerId) return;
    aimPointer = null;
    resetAim();
  };
  aimPad.addEventListener('pointerup', endAim);
  aimPad.addEventListener('pointercancel', endAim);

  const bindTap = (button: HTMLButtonElement, action: () => void): void => {
    button.addEventListener('pointerdown', (event) => {
      event.stopPropagation();
      event.preventDefault();
      button.classList.add('is-pressed');
      action();
      buzz();
    });
    button.addEventListener('pointerup', () => button.classList.remove('is-pressed'));
    button.addEventListener('pointercancel', () => button.classList.remove('is-pressed'));
    button.addEventListener('click', (event) => event.preventDefault());
  };

  bindTap(buttons.dodge as HTMLButtonElement, () => {
    state.dodgePressed = true;
  });
  bindTap(buttons.ult as HTMLButtonElement, () => {
    if (!ultName) {
      // 没有装备大招时直接打开商店，而不是按了没反应。
      options.onShop();
      return;
    }
    state.ultPressed = true;
  });
  bindTap(shopButton, () => options.onShop());
  autoButton.addEventListener('pointerdown', (event) => {
    event.stopPropagation();
    state.autoFire = !state.autoFire;
    autoButton.textContent = `自动开火 ${state.autoFire ? '开' : '关'}`;
    autoButton.classList.toggle('is-on', state.autoFire);
    autoButton.setAttribute('aria-pressed', state.autoFire ? 'true' : 'false');
    buzz(8);
  });

  const slotButtons: HTMLButtonElement[] = [];
  for (let i = 0; i < 3; i += 1) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'touch__slot';
    button.textContent = `槽 ${i + 1}`;
    button.dataset.slot = String(i);
    slots.appendChild(button);
    slotButtons.push(button);
    button.addEventListener('pointerdown', (event) => {
      event.stopPropagation();
      state.slotRequest = i;
      buzz(6);
    });
  }

  return {
    state,
    setActive(active: boolean): void {
      host.classList.toggle('is-on', active);
      host.setAttribute('aria-hidden', active ? 'false' : 'true');
      if (!active) {
        state.move.x = 0;
        state.move.y = 0;
        stickPointer = null;
        aimPointer = null;
        resetStick();
        resetAim();
      }
    },
    setSlots(names: string[], active: number): void {
      for (let i = 0; i < slotButtons.length; i += 1) {
        const button = slotButtons[i];
        if (!button) continue;
        button.textContent = names[i] ?? '未装配';
        button.classList.toggle('is-active', i === active);
      }
    },
    setUltimate(name: string | null, charge: number): void {
      ultName = name;
      const ratio = Math.min(1, Math.max(0, charge));
      const label = name ? `大招 ${Math.round(ratio * 100)}%` : '大招 · 未装备';
      if (buttons.ult) {
        buttons.ult.textContent = label;
        buttons.ult.style.setProperty('--charge', `${(ratio * 100).toFixed(0)}%`);
        buttons.ult.classList.toggle('is-fire', ratio >= 1 && Boolean(name));
        buttons.ult.classList.toggle('is-locked', !name);
        buttons.ult.setAttribute('aria-disabled', name ? 'false' : 'true');
      }
    },
    setStamina(ratio: number, low: boolean): void {
      staminaFill.style.width = `${Math.max(0, Math.min(1, ratio)) * 100}%`;
      stamina.classList.toggle('is-low', low);
    },
    setHp(current: number, max: number): void {
      const safeMax = Math.max(1, max);
      const ratio = Math.max(0, Math.min(1, current / safeMax));
      hpFill.style.width = `${ratio * 100}%`;
      hpText.textContent = `${Math.ceil(Math.max(0, current))} / ${Math.round(safeMax)}`;
      hp.classList.toggle('is-low', ratio < 0.3);
    },
    consume(): { dodge: boolean; ult: boolean } {
      const result = { dodge: state.dodgePressed, ult: state.ultPressed };
      state.dodgePressed = false;
      state.ultPressed = false;
      return result;
    },
  };
}
