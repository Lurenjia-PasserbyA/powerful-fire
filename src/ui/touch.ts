import type { Vec2 } from '../types';

export interface TouchOptions {
  host: HTMLElement;
  mapPointer: (clientX: number, clientY: number) => Vec2;
  onShop: () => void;
}

export interface TouchController {
  readonly state: {
    move: Vec2;
    aim: Vec2 | null;
    fireHeld: boolean;
    dodgePressed: boolean;
    ultPressed: boolean;
    slotRequest: number | null;
  };
  setActive(active: boolean): void;
  setSlots(names: string[], active: number): void;
  setUltimate(name: string | null, charge: number): void;
  consume(): { dodge: boolean; ult: boolean };
}

const STICK_RADIUS = 46;

/** 触屏：左虚拟摇杆移动，右半屏拖动瞄准并持续开火，右下角闪避/大招/商店与槽位切换。 */
export function createTouch(options: TouchOptions): TouchController {
  const { host } = options;
  host.innerHTML = '';

  const stick = document.createElement('div');
  stick.className = 'touch__stick';
  const knob = document.createElement('div');
  knob.className = 'touch__knob';
  stick.appendChild(knob);

  const aimPad = document.createElement('div');
  aimPad.className = 'touch__aim';
  const aimHint = document.createElement('div');
  aimHint.className = 'touch__aim-hint';
  aimHint.textContent = '拖动瞄准 · 按住开火';
  aimPad.appendChild(aimHint);

  const actions = document.createElement('div');
  actions.className = 'touch__actions';
  const buttons: Record<string, HTMLButtonElement> = {};
  for (const [key, label] of [
    ['dodge', '闪避'],
    ['ult', '大招'],
    ['shop', '商店'],
  ] as const) {
    const button = document.createElement('button');
    button.className = 'touch__btn';
    button.textContent = label;
    actions.appendChild(button);
    buttons[key] = button;
  }

  const slots = document.createElement('div');
  slots.className = 'touch__slots';

  host.append(stick, aimPad, actions, slots);

  const state = {
    move: { x: 0, y: 0 },
    aim: null as Vec2 | null,
    fireHeld: false,
    dodgePressed: false,
    ultPressed: false,
    slotRequest: null as number | null,
  };

  let stickPointer: number | null = null;
  let aimPointer: number | null = null;

  stick.addEventListener('pointerdown', (event) => {
    stickPointer = event.pointerId;
    try {
      stick.setPointerCapture(event.pointerId);
    } catch {
      /* 合成事件无捕获能力时忽略 */
    }
    updateStick(event);
  });
  stick.addEventListener('pointermove', (event) => {
    if (stickPointer !== event.pointerId) return;
    updateStick(event);
  });
  const endStick = (event: PointerEvent): void => {
    if (stickPointer !== event.pointerId) return;
    stickPointer = null;
    state.move.x = 0;
    state.move.y = 0;
    knob.style.transform = 'translate(0px, 0px)';
  };
  stick.addEventListener('pointerup', endStick);
  stick.addEventListener('pointercancel', endStick);
  stick.addEventListener('pointerleave', endStick);

  function updateStick(event: PointerEvent): void {
    const rect = stick.getBoundingClientRect();
    const dx = event.clientX - (rect.left + rect.width / 2);
    const dy = event.clientY - (rect.top + rect.height / 2);
    const distance = Math.hypot(dx, dy);
    if (distance > 0.001) state.move = { x: dx / distance, y: dy / distance };
    const clamped = Math.min(distance, STICK_RADIUS);
    const angle = Math.atan2(dy, dx);
    knob.style.transform = `translate(${Math.cos(angle) * clamped}px, ${Math.sin(angle) * clamped}px)`;
  }

  aimPad.addEventListener('pointerdown', (event) => {
    aimPointer = event.pointerId;
    try {
      aimPad.setPointerCapture(event.pointerId);
    } catch {
      /* 合成事件无捕获能力时忽略 */
    }
    state.aim = options.mapPointer(event.clientX, event.clientY);
    state.fireHeld = true;
  });
  aimPad.addEventListener('pointermove', (event) => {
    if (aimPointer !== event.pointerId) return;
    state.aim = options.mapPointer(event.clientX, event.clientY);
  });
  const endAim = (event: PointerEvent): void => {
    if (aimPointer !== event.pointerId) return;
    aimPointer = null;
    state.fireHeld = false;
    state.aim = null;
  };
  aimPad.addEventListener('pointerup', endAim);
  aimPad.addEventListener('pointercancel', endAim);

  buttons.dodge?.addEventListener('click', () => {
    state.dodgePressed = true;
  });
  buttons.ult?.addEventListener('click', () => {
    state.ultPressed = true;
  });
  buttons.shop?.addEventListener('click', () => options.onShop());

  const slotButtons: HTMLButtonElement[] = [];
  for (let i = 0; i < 3; i += 1) {
    const button = document.createElement('button');
    button.className = 'touch__slot';
    button.textContent = `槽 ${i + 1}`;
    button.dataset.slot = String(i);
    slots.appendChild(button);
    slotButtons.push(button);
  }
  slots.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const slot = target.dataset.slot;
    if (slot === undefined) return;
    state.slotRequest = Number(slot);
  });

  return {
    state,
    setActive(active: boolean): void {
      host.classList.toggle('is-on', active);
      host.setAttribute('aria-hidden', active ? 'false' : 'true');
      if (!active) {
        state.move.x = 0;
        state.move.y = 0;
        state.fireHeld = false;
        state.aim = null;
        knob.style.transform = 'translate(0px, 0px)';
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
      const label = name ? `大招 ${Math.round(Math.min(1, charge) * 100)}%` : '大招';
      if (buttons.ult) buttons.ult.textContent = label;
      buttons.ult?.classList.toggle('is-fire', charge >= 1 && Boolean(name));
    },
    consume(): { dodge: boolean; ult: boolean } {
      const result = { dodge: state.dodgePressed, ult: state.ultPressed };
      state.dodgePressed = false;
      state.ultPressed = false;
      return result;
    },
  };
}

