import { facilityLabel, type Facility } from '../sim/base';
import {
  applyUpgrade,
  upgradeCost,
  upgradeEffectLabel,
  upgradeKinds,
  upgradeLabel,
  upgradeLevel,
  upgradeMaxLevel,
  type UpgradeKind,
} from '../sim/upgrades';
import type { GameWorld } from '../sim/world';

export interface CampUi {
  readonly panelRoot: HTMLElement;
  update(inBase: boolean, facility: Facility | null): void;
  openUpgrade(): void;
  closeUpgrade(): void;
  toggleUpgrade(): void;
  isUpgradeOpen(): boolean;
  refresh(): void;
}

interface CampOptions {
  promptHost: HTMLElement;
  panelHost: HTMLElement;
  world: GameWorld;
  onOpenShop: () => void;
  onStateChange: () => void;
  /** 联机客机：返回 true 表示升级请求已交给主机。 */
  onUpgrade?: (kind: UpgradeKind) => boolean;
}

function must<T>(value: T | null): T {
  if (value === null) throw new Error('营地面板节点缺失');
  return value;
}

/** 基地交互：设施提示（F / 点击）+ 升级台面板。 */
export function createCampUi(options: CampOptions): CampUi {
  const { promptHost, panelHost, world } = options;
  let currentFacility: Facility | null = null;
  let message = '';

  promptHost.className = 'camp-prompt';
  promptHost.innerHTML = `<span class="camp-prompt__key">F</span><span class="camp-prompt__text" data-role="text"></span>`;
  const promptText = must(promptHost.querySelector<HTMLElement>('[data-role="text"]'));

  promptHost.addEventListener('click', () => {
    if (currentFacility === 'shop') options.onOpenShop();
    if (currentFacility === 'upgrade') openUpgrade();
  });

  panelHost.innerHTML = `
    <div class="shop__panel camp-panel">
      <div class="shop__head">
        <span class="shop__title">Camp Forge</span>
        <span class="shop__xp" data-role="xp">XP 0</span>
        <span class="shop__notice" data-role="notice"></span>
        <button class="shop__close" data-role="close">关闭 F</button>
      </div>
      <div class="camp-body" data-role="rows"></div>
    </div>
  `;
  const xpEl = must(panelHost.querySelector<HTMLElement>('[data-role="xp"]'));
  const rowsEl = must(panelHost.querySelector<HTMLElement>('[data-role="rows"]'));
  const noticeEl = must(panelHost.querySelector<HTMLElement>('[data-role="notice"]'));
  const closeEl = must(panelHost.querySelector<HTMLElement>('[data-role="close"]'));
  closeEl.addEventListener('click', () => closeUpgrade());
  panelHost.addEventListener('click', (event) => {
    if (event.target === panelHost) closeUpgrade();
  });

  rowsEl.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const button = target.closest<HTMLElement>('[data-upgrade]');
    if (!button) return;
    const kind = button.dataset.upgrade as UpgradeKind | undefined;
    if (!kind) return;
    if (options.onUpgrade?.(kind)) {
      message = '已向主机请求升级';
      noticeEl.textContent = message;
      refresh();
      return;
    }
    const result = applyUpgrade(world, kind);
    message = result.message;
    noticeEl.textContent = message;
    if (result.ok) {
      options.onStateChange();
      panelHost.classList.add('is-pulse');
      window.setTimeout(() => panelHost.classList.remove('is-pulse'), 180);
    }
    refresh();
  });

  function player() {
    const id = world.playerId;
    return id !== null ? world.players.get(id) : undefined;
  }

  function refresh(): void {
    const p = player();
    if (!p) return;
    xpEl.textContent = `XP ${Math.floor(p.xp)}`;
    noticeEl.textContent = message;
    rowsEl.innerHTML = '';
    for (const kind of upgradeKinds) {
      const level = upgradeLevel(world, kind);
      const maxLevel = upgradeMaxLevel(world, kind);
      const cost = upgradeCost(world, kind);
      const maxed = level >= maxLevel;
      const affordable = p.xp >= cost;

      const row = document.createElement('article');
      row.className = `camp-row${maxed ? ' is-maxed' : ''}`;

      const head = document.createElement('div');
      head.className = 'camp-row__head';
      const name = document.createElement('span');
      name.className = 'camp-row__name';
      name.textContent = upgradeLabel[kind];
      const lv = document.createElement('span');
      lv.className = 'camp-row__level';
      lv.textContent = `Lv ${level} / ${maxLevel}`;
      head.append(name, lv);

      const effect = document.createElement('p');
      effect.className = 'camp-row__effect';
      effect.textContent = upgradeEffectLabel[kind];

      const action = document.createElement('div');
      action.className = 'camp-row__action';
      const costEl = document.createElement('span');
      costEl.className = 'camp-row__cost';
      costEl.textContent = maxed ? '已满级' : `${cost} XP`;
      const button = document.createElement('button');
      button.className = 'card__btn';
      button.dataset.upgrade = kind;
      button.textContent = maxed ? 'MAX' : '升级';
      if (maxed) button.classList.add('is-disabled');
      else if (!affordable) button.classList.add('is-disabled');
      action.append(costEl, button);

      const pips = document.createElement('div');
      pips.className = 'camp-row__pips';
      for (let i = 0; i < maxLevel; i += 1) {
        const pip = document.createElement('span');
        pip.className = `camp-pip${i < level ? ' is-on' : ''}`;
        pips.appendChild(pip);
      }

      row.append(head, effect, pips, action);
      rowsEl.appendChild(row);
    }
  }

  function openUpgrade(): void {
    panelHost.classList.add('is-open');
    panelHost.setAttribute('aria-hidden', 'false');
    message = '';
    refresh();
  }

  function closeUpgrade(): void {
    panelHost.classList.remove('is-open');
    panelHost.setAttribute('aria-hidden', 'true');
  }

  function toggleUpgrade(): void {
    if (panelHost.classList.contains('is-open')) closeUpgrade();
    else openUpgrade();
  }

  return {
    panelRoot: panelHost,
    update(inBase: boolean, facility: Facility | null): void {
      currentFacility = facility;
      if (!facility) {
        promptHost.classList.remove('is-on');
        promptText.textContent = '';
        void inBase;
        return;
      }
      promptHost.classList.add('is-on');
      promptText.textContent = `打开${facilityLabel(facility)}`;
    },
    openUpgrade,
    closeUpgrade,
    toggleUpgrade,
    isUpgradeOpen: () => panelHost.classList.contains('is-open'),
    refresh,
  };
}
