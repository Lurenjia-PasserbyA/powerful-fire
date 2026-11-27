import { schoolLabel, skills, tierLabel, type SkillData, type SkillSchool } from '../data/skills';
import type { GameWorld } from '../sim/world';

export interface Shop {
  readonly root: HTMLElement;
  open(): void;
  close(): void;
  toggle(): void;
  isOpen(): boolean;
  refresh(): void;
}

interface ShopOptions {
  world: GameWorld;
  onStateChange: () => void;
  /** 联机客机：返回 true 表示请求已交给主机，本地不做扣费。 */
  onBuy?: (skillId: string) => boolean;
  /** 联机客机：装备槽/大招变化后同步给主机。 */
  onLoadout?: (slots: Array<string | null>, ultimate: string | null) => void;
}

type Filter = 'all' | SkillSchool;

function must<T>(value: T | null): T {
  if (value === null) throw new Error('商店面板节点缺失');
  return value;
}

/** 商店：单 XP 货币、系别筛选、价格排序、购买解锁与 3 槽/大招装配。 */
export function createShop(host: HTMLElement, options: ShopOptions): Shop {
  const { world } = options;
  let filter: Filter = 'all';
  let ascending = true;
  let notice = '';
  let noticeTimer: number | null = null;

  host.innerHTML = '';
  const panel = document.createElement('div');
  panel.className = 'shop__panel';
  panel.innerHTML = `
    <div class="shop__head">
      <span class="shop__title">Ember Shop</span>
      <span class="shop__xp" data-role="xp">XP 0</span>
      <div class="shop__tabs" data-role="tabs"></div>
      <button class="shop__sort" data-role="sort">价格 ↑</button>
      <span class="shop__notice" data-role="notice"></span>
      <button class="shop__close" data-role="close">关闭 Tab</button>
    </div>
    <div class="shop__grid" data-role="grid"></div>
  `;
  host.appendChild(panel);

  const tabsEl = must(panel.querySelector<HTMLElement>('[data-role="tabs"]'));
  const gridEl = must(panel.querySelector<HTMLElement>('[data-role="grid"]'));
  const xpEl = must(panel.querySelector<HTMLElement>('[data-role="xp"]'));
  const sortEl = must(panel.querySelector<HTMLElement>('[data-role="sort"]'));
  const noticeEl = must(panel.querySelector<HTMLElement>('[data-role="notice"]'));
  const closeEl = must(panel.querySelector<HTMLElement>('[data-role="close"]'));

  const tabs: Filter[] = ['all', 'baguette', 'heatgun', 'projectile', 'sorcery'];
  for (const tab of tabs) {
    const button = document.createElement('button');
    button.className = 'shop__tab';
    button.dataset.tab = tab;
    button.textContent = tab === 'all' ? '全部' : schoolLabel[tab];
    button.addEventListener('click', () => {
      filter = tab;
      refresh();
    });
    tabsEl.appendChild(button);
  }

  sortEl.addEventListener('click', () => {
    ascending = !ascending;
    sortEl.textContent = ascending ? '价格 ↑' : '价格 ↓';
    refresh();
  });
  closeEl.addEventListener('click', () => close());
  host.addEventListener('click', (event) => {
    if (event.target === host) close();
  });

  gridEl.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const button = target.closest<HTMLElement>('[data-action]');
    if (!button || button.classList.contains('is-disabled')) return;
    const id = button.dataset.skill;
    if (!id) return;
    if (button.dataset.action === 'buy') buy(id);
    else if (button.dataset.action === 'equip') equip(id, Number(button.dataset.slot));
    else if (button.dataset.action === 'ult') equip(id, null);
  });

  function player() {
    const id = world.playerId;
    return id !== null ? world.players.get(id) : undefined;
  }

  function setNotice(text: string): void {
    notice = text;
    noticeEl.textContent = text;
    if (noticeTimer !== null) window.clearTimeout(noticeTimer);
    noticeTimer = window.setTimeout(() => {
      notice = '';
      noticeEl.textContent = '';
      noticeTimer = null;
    }, 1600);
  }

  function buy(id: string): void {
    const data = skills.find((skill) => skill.id === id);
    const p = player();
    if (!data || !p) return;
    if (options.onBuy?.(id)) {
      setNotice('已向主机请求购买');
      refresh();
      return;
    }
    if (world.progress.unlocked.has(id)) {
      setNotice('已拥有');
      return;
    }
    if (p.xp < data.price) {
      setNotice('经验不足');
      return;
    }
    p.xp -= data.price;
    world.progress.unlocked.add(id);
    world.progress.spent += data.price;
    world.bus.emit('shop:purchase', { skillId: id, price: data.price });
    setNotice(`解锁 ${data.name}`);
    refresh();
    options.onStateChange();
  }

  function equip(id: string, slot: number | null): void {
    const p = player();
    if (!p) return;
    if (!world.progress.unlocked.has(id)) {
      setNotice('先购买才能装配');
      return;
    }
    if (slot === null) {
      p.ultimate = id;
    } else {
      if (slot < 0 || slot > 2) return;
      for (let i = 0; i < p.slots.length; i += 1) {
        if (p.slots[i] === id) p.slots[i] = null;
      }
      p.slots[slot] = id;
    }
    const def = world.registry.get(id);
    if (def?.data.behavior === 'passive_revive') p.reviveReady = true;
    refresh();
    options.onStateChange();
    options.onLoadout?.([...p.slots], p.ultimate);
  }

  function matches(skill: SkillData): boolean {
    return filter === 'all' || skill.school === filter;
  }

  function refresh(): void {
    const p = player();
    if (!p) return;
    xpEl.textContent = `XP ${Math.floor(p.xp)}`;
    for (const tab of tabsEl.children) {
      if (tab instanceof HTMLElement) tab.classList.toggle('is-active', tab.dataset.tab === filter);
    }
    gridEl.innerHTML = '';
    const list = skills.filter(matches).sort((a, b) => (ascending ? a.price - b.price : b.price - a.price));
    for (const skill of list) gridEl.appendChild(card(skill, p));
    if (notice) noticeEl.textContent = notice;
  }

  function card(skill: SkillData, p: import('../sim/components').Player): HTMLElement {
    const owned = world.progress.unlocked.has(skill.id);
    const equippedSlot = p.slots.indexOf(skill.id);
    const isUltEquipped = p.ultimate === skill.id;
    const element = document.createElement('article');
    element.className = `card${owned ? ' is-owned' : ''}${equippedSlot >= 0 || isUltEquipped ? ' is-equipped' : ''}`;

    const head = document.createElement('div');
    head.className = 'card__head';
    const name = document.createElement('span');
    name.className = 'card__name';
    name.textContent = skill.name;
    const price = document.createElement('span');
    price.className = 'card__price';
    price.textContent = owned ? '已拥有' : `${skill.price} XP`;
    head.append(name, price);

    const meta = document.createElement('div');
    meta.className = 'card__meta';
    meta.textContent = `${schoolLabel[skill.school]} · ${tierLabel[skill.tier]} · CD ${skill.cooldown.toFixed(1)}s`;

    const desc = document.createElement('p');
    desc.className = 'card__desc';
    desc.textContent = skill.description;

    const stats = document.createElement('div');
    stats.className = 'card__stats';
    stats.textContent = statLine(skill);

    const actions = document.createElement('div');
    actions.className = 'card__actions';

    if (!owned) {
      const buyButton = document.createElement('button');
      buyButton.className = `card__btn${p.xp < skill.price ? ' is-disabled' : ''}`;
      buyButton.dataset.action = 'buy';
      buyButton.dataset.skill = skill.id;
      buyButton.textContent = '购买';
      actions.appendChild(buyButton);
    }

    if (owned && skill.isUltimate) {
      const ultButton = document.createElement('button');
      ultButton.className = `card__btn${isUltEquipped ? ' is-equipped' : ''}`;
      ultButton.dataset.action = 'ult';
      ultButton.dataset.skill = skill.id;
      ultButton.textContent = isUltEquipped ? '大招已装配' : '装配大招';
      actions.appendChild(ultButton);
    } else if (owned) {
      for (let i = 0; i < 3; i += 1) {
        const slotButton = document.createElement('button');
        slotButton.className = `card__btn${equippedSlot === i ? ' is-equipped' : ''}`;
        slotButton.dataset.action = 'equip';
        slotButton.dataset.slot = String(i);
        slotButton.dataset.skill = skill.id;
        slotButton.textContent = equippedSlot === i ? `槽 ${i + 1} ✓` : `槽 ${i + 1}`;
        actions.appendChild(slotButton);
      }
    }

    element.append(head, meta, desc, stats, actions);
    return element;
  }

  function statLine(skill: SkillData): string {
    const parts: string[] = [`伤害 ${skill.damage}`];
    if (skill.radius) parts.push(`半径 ${skill.radius}`);
    if (skill.count) parts.push(`数量 ${skill.count}`);
    if (skill.duration) parts.push(`持续 ${skill.duration}s`);
    if (skill.pierce) parts.push(`穿透 ${skill.pierce}`);
    if (skill.explodeRadius) parts.push(`爆炸 ${skill.explodeRadius}`);
    if (skill.shield) parts.push(`护盾 ${skill.shield}`);
    return parts.join(' · ');
  }

  function open(): void {
    host.classList.add('is-open');
    host.setAttribute('aria-hidden', 'false');
    refresh();
  }

  function close(): void {
    host.classList.remove('is-open');
    host.setAttribute('aria-hidden', 'true');
  }

  function toggle(): void {
    if (host.classList.contains('is-open')) close();
    else open();
  }

  return {
    root: host,
    open,
    close,
    toggle,
    isOpen: () => host.classList.contains('is-open'),
    refresh,
  };
}
