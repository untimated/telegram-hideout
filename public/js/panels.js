import { ITEMS, ITEM_BY_ID, MENUS, SONGS, isDrink, itemAvailable } from './game/catalog.js';
import { formatHour, hideoutTime } from './game/clock.js';
import { NPCS, NPC_BY_ID, npcPresent, npcShifts } from './game/npcs.js';
import { SEAT_BY_ID } from './game/seats.js';
import { MUSIC_STEPS } from './audio.js';

import { INTERACT_RANGE } from './interaction.js';

// Walking further than this from where a panel was opened closes it.
const CLOSE_RANGE = 4.5;

// The gameplay HUD: coin and mood meters, the "use" hint, contextual panels (menus, served items,
// jukebox, players, NPCs, specials), the coin transfer modal, toasts and the passed-out overlay.
//
// `game` supplies live state and actions:
//   state()          -> { selfID, self: { coins, drunk, fuel, asleep }, items: Map, jukebox, players: Map, sleepers: Set }
//   position()       -> the local player's { x, z } (as drawn, not the server's copy)
//   now()            -> shared clock in ms (NPC shifts, specials)
//   send(message)    -> sends a game message to the server
//   audio            -> audio.js controller (jukebox progress and mute)
export function createGamePanels({ hud, game }) {
  const element = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const button = (className, text, onClick) => {
    const node = element('button', className, text);
    node.type = 'button';
    node.addEventListener('click', event => {
      if (event.detail > 0) node.blur();
      onClick(event);
    });
    return node;
  };
  const distanceTo = (x, z) => {
    const position = game.position();
    return position ? Math.hypot(position.x - x, position.z - z) : Infinity;
  };
  const signed = value => `${value > 0 ? '+' : '−'}${Math.abs(value).toFixed(2).replace(/0$/, '')}`;
  function effectChips(item) {
    const chips = element('span', 'effects');
    if (item.drunk) chips.append(element('span', `chip ${item.drunk > 0 ? 'bad' : 'good'}`, `Drunk ${signed(item.drunk)}`));
    if (item.fuel) chips.append(element('span', `chip ${item.fuel > 0 ? 'good' : 'bad'}`, `Fuel ${signed(item.fuel)}`));
    return chips;
  }
  // A picture from assets/menu-icons when one exists (state().icons maps item id -> URL), else emoji.
  function iconFor(item) {
    const url = game.state().icons?.[item.id];
    const icon = element('span', 'menu-icon', url ? '' : item.icon);
    if (url) {
      const image = element('img');
      image.alt = '';
      image.src = url;
      image.onerror = () => { image.remove(); icon.textContent = item.icon; };
      icon.append(image);
    }
    return icon;
  }
  const verbFor = item => (isDrink(item) ? 'Drink' : 'Eat');
  const minutesAgo = ms => {
    const minutes = Math.round((game.now() - ms) / 60000);
    return minutes < 1 ? 'just now' : minutes < 60 ? `${minutes} min ago` : `${Math.round(minutes / 60)} h ago`;
  };

  // --- Meters -------------------------------------------------------------------------------
  const vitals = element('div', 'vitals');
  vitals.hidden = true;
  vitals.setAttribute('aria-label', 'Coins and mood');
  const coins = element('span', 'vital-coins', '🪙 100');
  const meter = (label, icon) => {
    const wrap = element('span', `vital-meter ${label.toLowerCase()}`);
    wrap.title = label;
    const bar = element('span', 'meter-bar');
    const fill = element('span', 'meter-fill');
    bar.append(fill);
    wrap.append(element('span', 'meter-icon', icon), bar);
    return { wrap, fill };
  };
  const drunkMeter = meter('Drunk', '🍺');
  const fuelMeter = meter('Fuel', '⚡');
  // Sound toggle sits with the utility buttons (log, help, profile).
  const muteButton = button('mute-toggle', '🔊', () => {
    muteButton.textContent = game.audio.toggleMute() ? '🔇' : '🔊';
  });
  muteButton.setAttribute('aria-label', 'Toggle sound');
  muteButton.textContent = game.audio.muted ? '🔇' : '🔊';
  vitals.append(coins, drunkMeter.wrap, fuelMeter.wrap);
  hud.querySelector('.utility-controls')?.append(muteButton);

  // --- Use hint, toasts, sound unlock, sleep overlay -----------------------------------------
  const hint = button('use-hint', '', () => { if (hovered) open(hovered); });
  hint.hidden = true;
  const toasts = element('div', 'toasts');
  toasts.setAttribute('role', 'status');
  const soundChip = button('sound-chip', '🔊 Tap to hear the jukebox', () => { soundChip.hidden = true; });
  soundChip.hidden = true;
  const sleep = element('div', 'sleep-overlay');
  sleep.hidden = true;
  sleep.append(element('strong', '', 'You passed out 💤'), element('span', 'sleep-note', ''));

  // --- Panel sheet -----------------------------------------------------------------------------
  const panel = element('section', 'game-panel');
  panel.hidden = true;
  panel.setAttribute('role', 'dialog');
  const panelHead = element('header', 'panel-head');
  const panelKicker = element('div', 'panel-kicker');
  const panelTitle = element('h2', 'panel-title');
  const close = button('panel-close', '×', () => closePanel());
  close.setAttribute('aria-label', 'Close');
  const headText = element('div', 'panel-head-text');
  headText.append(panelKicker, panelTitle);
  panelHead.append(headText, close);
  const panelBody = element('div', 'panel-body');
  const panelFoot = element('div', 'panel-foot');
  panel.append(panelHead, panelBody, panelFoot);

  // --- Transfer modal (per plan: Cash / Amount / Transfer | Cancel) ---------------------------
  const modal = element('div', 'modal-backdrop');
  modal.hidden = true;
  const transferForm = element('form', 'modal');
  transferForm.setAttribute('role', 'dialog');
  const transferTitle = element('h2', 'modal-title');
  const cashRow = element('label', 'modal-row');
  const cashValue = element('span', 'modal-value');
  cashRow.append(element('span', '', 'Cash'), cashValue);
  const amountRow = element('label', 'modal-row');
  const amountInput = element('input', 'modal-input');
  Object.assign(amountInput, { type: 'number', min: 1, step: 1, inputMode: 'numeric', required: true });
  amountRow.append(element('span', '', 'Amount'), amountInput);
  const modalActions = element('div', 'modal-actions');
  const transferSubmit = element('button', 'primary', 'Transfer');
  transferSubmit.type = 'submit';
  modalActions.append(transferSubmit, button('secondary', 'Cancel', () => { modal.hidden = true; }));
  transferForm.append(transferTitle, cashRow, amountRow, modalActions);
  modal.append(transferForm);
  let transferTarget;
  transferForm.addEventListener('submit', event => {
    event.preventDefault();
    const amount = Number(amountInput.value);
    if (!Number.isSafeInteger(amount) || amount < 1) return;
    game.send({ type: 'transfer', to: transferTarget, amount });
    modal.hidden = true;
  });
  modal.addEventListener('pointerdown', event => { if (event.target === modal) modal.hidden = true; });

  hud.append(vitals, hint, toasts, soundChip, sleep, panel, modal);

  // --- Panel contents ------------------------------------------------------------------------
  let current = null; // { key, update() } for the open panel.
  let hovered = null;

  function show({ key, kicker, title, build }, anchor = openedAt) {
    panelKicker.textContent = kicker ?? '';
    panelTitle.textContent = title;
    panelBody.replaceChildren();
    panelFoot.replaceChildren();
    panel.hidden = false;
    const update = build(panelBody, panelFoot) ?? (() => {});
    current = { key, update, anchor };
    update();
  }
  function closePanel() {
    panel.hidden = true;
    current = null;
  }

  function vendorLine(menu) {
    if (!menu.vendor) return { present: true, text: menu.subtitle };
    const npc = NPC_BY_ID.get(menu.vendor);
    const present = npcPresent(npc, hideoutTime(game.now()));
    return {
      present,
      text: present ? `${npc.name} · ${npc.role} · open until ${formatHour(npc.to)}` : `${npc.name} is off shift · back at ${formatHour(npc.from)}`,
    };
  }

  function openMenu(menuID, greeting) {
    const menu = MENUS[menuID];
    const weekday = hideoutTime(game.now()).weekday;
    const items = ITEMS.filter(item => item.menu === menuID && itemAvailable(item, weekday));
    show({
      key: `menu:${menuID}`,
      kicker: vendorLine(menu).text,
      title: menu.title,
      build(body, foot) {
        if (greeting) body.append(element('p', 'panel-quote', `“${greeting}”`));
        const rows = items.map(item => {
          const row = element('div', 'menu-row');
          const info = element('div', 'menu-info');
          const name = element('div', 'menu-name', item.name);
          if (item.special) name.append(element('span', 'badge', 'Today'));
          info.append(name, effectChips(item));
          const buy = button('buy', `${item.price} 🪙`, () => game.send({ type: 'buy', item: item.id }));
          buy.setAttribute('aria-label', `${menu.verb} ${item.name} for ${item.price} coins`);
          row.append(iconFor(item), info, buy);
          body.append(row);
          return { item, buy };
        });
        const note = element('p', 'panel-note');
        foot.append(note);
        return () => {
          const { self } = game.state();
          const vendor = vendorLine(menu);
          panelKicker.textContent = vendor.text;
          for (const { item, buy } of rows) buy.disabled = !vendor.present || self.asleep || self.coins < item.price;
          note.textContent = !vendor.present ? 'Nobody is serving right now.' :
            `${menu.verb === 'Take' ? 'Taken' : 'Served'} items land nearby; anyone can have them.`;
        };
      },
    });
  }

  function openItem(served) {
    const item = ITEM_BY_ID.get(served.item);
    show({
      key: `item:${served.id}`,
      kicker: `${served.byID === game.state().selfID ? 'Yours' : `From ${served.by}`} · ${minutesAgo(served.at)}`,
      title: `${item.icon} ${item.name}`,
      build(body, foot) {
        body.append(effectChips(item));
        if (served.byID !== game.state().selfID) body.append(element('p', 'panel-note', 'Help yourself: served items are fair game.'));
        const use = button('primary wide', `${verbFor(item)} it`, () => game.send({ type: 'consume', id: served.id }));
        foot.append(use);
        return () => {
          if (!game.state().items.has(served.id)) return closePanel();
          use.disabled = game.state().self.asleep;
        };
      },
    });
  }

  // Four bars of rising height; tapping bar n sets the jukebox volume to n of MUSIC_STEPS.
  function volumeControl() {
    const row = element('div', 'volume-row');
    row.append(element('span', 'volume-label', 'Volume'));
    const bars = element('div', 'volume-bars');
    bars.setAttribute('role', 'group');
    bars.setAttribute('aria-label', 'Jukebox volume');
    const steps = [];
    const render = () => steps.forEach((step, index) => {
      step.classList.toggle('on', index < game.audio.musicLevel);
      step.setAttribute('aria-pressed', String(index + 1 === game.audio.musicLevel));
    });
    for (let level = 1; level <= MUSIC_STEPS; level++) {
      const step = button('volume-step', '', () => { game.audio.setMusicLevel(level); render(); });
      step.style.height = `${6 + level * 5}px`;
      step.setAttribute('aria-label', `Volume ${level} of ${MUSIC_STEPS}`);
      steps.push(step);
      bars.append(step);
    }
    render();
    row.append(bars);
    return row;
  }

  function openJukebox() {
    show({
      key: 'jukebox',
      kicker: 'Everyone in the bar hears it',
      title: 'Jukebox',
      build(body, foot) {
        const playing = element('div', 'now-playing');
        const nowTitle = element('div', 'now-title');
        const nowBy = element('div', 'now-by');
        const progress = element('div', 'progress');
        const progressFill = element('span');
        progress.append(progressFill);
        const stop = button('secondary', 'Stop', () => game.send({ type: 'jukebox_stop' }));
        playing.append(nowTitle, nowBy, progress, stop);
        body.append(playing, volumeControl());
        const rows = SONGS.map(song => {
          const row = element('div', 'menu-row');
          const info = element('div', 'menu-info');
          info.append(element('div', 'menu-name', song.title), element('div', 'menu-sub', `${song.artist} · ${Math.floor(song.duration / 60)}:${String(song.duration % 60).padStart(2, '0')}`));
          const play = button('buy', `${song.price} 🪙`, () => game.send({ type: 'jukebox_play', song: song.id }));
          play.setAttribute('aria-label', `Play ${song.title} for ${song.price} coins`);
          row.append(element('span', 'menu-icon', '♪'), info, play);
          body.append(row);
          return { song, play };
        });
        const note = element('p', 'panel-note');
        foot.append(note);
        return () => {
          const { self, jukebox } = game.state();
          const status = game.audio.progress();
          playing.classList.toggle('idle', !jukebox);
          nowTitle.textContent = status ? `♪ ${status.song.title}` : 'Nothing playing';
          nowBy.textContent = jukebox ? `Picked by ${jukebox.by}` : 'Pick a song for the room.';
          progressFill.style.width = status ? `${status.elapsed / status.song.duration * 100}%` : '0';
          stop.hidden = !jukebox;
          stop.disabled = self.asleep;
          for (const { song, play } of rows) play.disabled = self.asleep || self.coins < song.price;
          note.textContent = 'Anyone can stop a song; the coins are already spent.';
        };
      },
    });
  }

  function openPlayer(id) {
    const player = game.state().players.get(id);
    if (!player) return;
    show({
      key: `player:${id}`,
      kicker: 'Hideout member',
      title: player.name,
      build(body, foot) {
        const status = element('p', 'panel-note');
        body.append(status);
        const send = button('primary', 'Send coins', () => openTransfer(id));
        const splash = button('secondary', 'Splash water 💦', () => game.send({ type: 'splash', id }));
        foot.append(send, splash);
        return () => {
          if (!game.state().players.has(id)) return closePanel();
          const asleep = game.state().sleepers.has(id);
          status.textContent = asleep ? 'Passed out on the floor 💤' : 'Hanging out.';
          splash.hidden = !asleep;
          send.disabled = game.state().self.coins < 1;
        };
      },
    });
  }

  function openTransfer(id) {
    const player = game.state().players.get(id);
    if (!player) return;
    transferTarget = id;
    transferTitle.textContent = `Send coins to ${player.name}`;
    cashValue.textContent = `${game.state().self.coins} 🪙 in hand`;
    amountInput.max = String(game.state().self.coins);
    amountInput.value = String(Math.min(10, game.state().self.coins));
    modal.hidden = false;
    amountInput.focus();
    amountInput.select();
  }

  function openNpc(npcID) {
    const npc = NPC_BY_ID.get(npcID);
    const line = npc.lines[Math.floor(Math.random() * npc.lines.length)];
    if (npc.menu) return openMenu(npc.menu, line);
    show({
      key: `npc:${npcID}`,
      kicker: `${npc.role} · here ${npcShifts(npc).map(([from, to]) => `${formatHour(from)}–${formatHour(to)}`).join(' & ')}`,
      title: npc.name,
      build(body) { body.append(element('p', 'panel-quote', `“${line}”`)); },
    });
  }

  function openStage() {
    const band = NPCS.filter(npc => ['sing', 'play', 'drum'].includes(npc.activity));
    const clock = hideoutTime(game.now());
    const playing = band.some(npc => npcPresent(npc, clock));
    show({
      key: 'stage',
      kicker: playing ? 'Live now' : `Band plays ${formatHour(band[0].from)}–${formatHour(band[0].to)}`,
      title: 'Stage',
      build(body) {
        body.append(element('p', 'panel-note', `${band.map(npc => `${npc.name} (${npc.role.toLowerCase()})`).join(', ')}.`));
        body.append(element('p', 'panel-note', playing ? 'Grab a seat and enjoy the set.' : 'Nobody is on right now. Put something on the jukebox instead.'));
      },
    });
  }

  function openSpecials(menuID) {
    const weekday = hideoutTime(game.now()).weekday;
    const specials = ITEMS.filter(item => item.menu === menuID && item.special);
    show({
      key: `specials:${menuID}`,
      kicker: MENUS[menuID].subtitle,
      title: menuID === 'bar' ? "Wolfred's Specials" : "Pierre's Challenges",
      build(body, foot) {
        for (const item of specials) {
          const today = itemAvailable(item, weekday);
          const card = element('div', `special${today ? ' today' : ''}`);
          const name = element('div', 'menu-name', item.name);
          name.append(element('span', 'badge', today ? 'On today' : item.days.map(day => day.slice(0, 3)).join('/')));
          const heading = element('div', 'special-heading');
          heading.append(iconFor(item), name);
          card.append(heading,element('p', 'panel-note', item.blurb), effectChips(item), element('div', 'menu-sub', `${item.price} coins`));
          body.append(card);
        }
        foot.append(button('primary wide', `Open the ${MENUS[menuID].title.toLowerCase()} menu`, () => openMenu(menuID)));
      },
    });
  }

  // Opens whatever a picked target is about (see interaction.js for target shapes). Targets out of
  // reach are ignored, so taps from across the room do nothing.
  let openedAt = null;
  function open(target) {
    if (!target || !(target.distance <= INTERACT_RANGE)) return;
    openedAt = target.point ? { x: target.point.x, z: target.point.z } : null;
    game.audio.sfx('click');
    if (target.kind === 'item') return openItem(target.served);
    if (target.kind === 'player') return openPlayer(target.id);
    const action = target.action ?? { type: target.id };
    if (action.type === 'menu') return openMenu(action.menu);
    if (action.type === 'npc') return openNpc(action.npc);
    if (action.type === 'jukebox') return openJukebox();
    if (action.type === 'stage') return openStage();
    if (action.type === 'specials') return openSpecials(action.menu);
    if (action.type === 'seat') return sitDown(action.seats, target.point);
  }

  // Sits in the free place of this furniture nearest to where it was tapped; no panel.
  function sitDown(seatIDs, point) {
    const taken = new Set(game.state().seated.values());
    const free = seatIDs.map(id => SEAT_BY_ID.get(id)).filter(seat => seat && !taken.has(seat.id));
    if (!free.length) return toast('Someone is sitting there.');
    const seat = point
      ? free.reduce((best, seat) => Math.hypot(seat.x - point.x, seat.z - point.z) < Math.hypot(best.x - point.x, best.z - point.z) ? seat : best)
      : free[0];
    closePanel();
    game.send({ type: 'sit', seat: seat.id });
  }

  function labelFor(target) {
    if (target.action?.type === 'seat') return `Sit · ${target.label}`;
    if (target.kind === 'item') {
      const item = ITEM_BY_ID.get(target.served.item);
      return `${item.icon} ${item.name}`;
    }
    if (target.kind === 'player') return game.state().players.get(target.id)?.name ?? 'Player';
    return target.label;
  }

  const touch = matchMedia('(hover: none)').matches;
  function setHover(target) {
    hovered = target && target.distance <= INTERACT_RANGE ? target : null;
    hint.hidden = !hovered || !modal.hidden;
    if (hovered) hint.textContent = `${touch ? 'Tap' : 'E'} · ${labelFor(hovered)}`;
  }

  // Refresh the meters and the open panel.
  function refresh() {
    const { self } = game.state();
    vitals.hidden = false;
    coins.textContent = `🪙 ${self.coins}`;
    drunkMeter.fill.style.width = `${self.drunk * 100}%`;
    drunkMeter.fill.classList.toggle('hot', self.drunk > .5);
    fuelMeter.fill.style.width = `${self.fuel * 100}%`;
    fuelMeter.fill.classList.toggle('low', self.fuel < .25);
    drunkMeter.wrap.title = `Drunk ${Math.round(self.drunk * 100)}%`;
    fuelMeter.wrap.title = `Fuel ${Math.round(self.fuel * 100)}%`;
    sleep.hidden = !self.asleep;
    if (self.asleep) {
      sleep.lastChild.textContent = self.drunk >= 1
        ? 'Too much to drink. You will sober up on the hour, or a friend can splash you awake.'
        : 'Out of fuel. A nap on the hour gets you up, or a friend can splash you awake.';
    }
    current?.update();
  }
  setInterval(() => {
    if (current?.anchor && distanceTo(current.anchor.x, current.anchor.z) > CLOSE_RANGE) closePanel();
    current?.update();
  }, 500);

  function toast(text, tone = 'error') {
    const node = element('div', `toast ${tone}`, text);
    toasts.append(node);
    setTimeout(() => node.classList.add('leaving'), 3200);
    setTimeout(() => node.remove(), 3700);
    while (toasts.children.length > 3) toasts.firstElementChild.remove();
  }

  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    if (!modal.hidden) modal.hidden = true;
    else if (current) closePanel();
  });

  return {
    open,
    useHovered: () => { if (hovered) open(hovered); },
    closePanel,
    setHover,
    refresh,
    toast,
    setSoundBlocked(blocked) { soundChip.hidden = !blocked || game.audio.muted; },
  };
}
