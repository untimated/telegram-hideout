import { createHUD } from './ui.js';
import { createWorld } from './world.js';
import { WALK_SPEED } from './config.js';
import { mapFromQuery } from './maps.js';
import { createGamePanels } from './panels.js';
import { createAudio } from './audio.js';
import { hideoutTime } from './game/clock.js';
import { BAND, ITEM_BY_ID, isDrink } from './game/catalog.js';
import { SEAT_BY_ID } from './game/seats.js';
import { slotDisplayCoins } from './game/slots.js';
import { createWalletStore } from './wallet-store.js';

const guestMode = new URLSearchParams(location.search).get('guest') === '1';
const map = mapFromQuery(new URLSearchParams(location.search).get('map'));
if (!map) throw new Error('Unknown map');
const MOVEMENT_BOUNDS = map.bounds;
const mapQuery = `?map=${encodeURIComponent(map.id)}`;
document.querySelector('.room-name').textContent = map.label;
document.title = `${map.label} · Hideout`;
const ui = createHUD({ guestMode, onMessage: sendChat, onMessageFocus: stopAllMovement });

// Shared clock: the server's time, so NPC shifts and specials match what the server enforces.
// Debug guests can preview another hour with ?hour=H (view only; the server still uses real time).
let clockOffset = 0;
const previewHour = guestMode ? Number(new URLSearchParams(location.search).get('hour') ?? NaN) : NaN;
const serverNow = () => Date.now() + clockOffset;
const viewNow = () => {
  const now = serverNow();
  if (!Number.isInteger(previewHour) || previewHour < 0 || previewHour > 23) return now;
  return now + (previewHour - hideoutTime(now).hour) * 3600_000;
};

// Game state mirrored from the server (see game.js).
const game = {
  self: { coins: 100, drunk: 0, fuel: 1, asleep: false },
  items: new Map(),
  jukebox: null,
  band: null,
  arcade: null,
  sleepers: new Set(),
  seated: new Map(), // playerID -> seat id
  icons: {},
};
const audio = createAudio({ serverNow, onBlocked: blocked => panels?.setSoundBlocked(blocked) });
const panels = createGamePanels({
  hud: document.querySelector('.hud'),
  game: {
    state: () => ({ ...game, self: { ...game.self, coins: slotDisplayCoins(game.self, serverNow()) }, selfID, players: playerState }),
    position: () => world?.localPosition() ?? playerState.get(selfID),
    now: viewNow,
    send: sendGame,
    audio,
    inspect: object => world?.inspect(object, Infinity),
    endInspect: () => world?.endInspect(),
    isInspecting: () => world?.isInspecting(),
    serverNow,
  },
});
// Backup copy of the wallet (Telegram CloudStorage or localStorage). Nothing is saved until the
// saved copy has been read back, so a fresh server wallet never overwrites it first.
const walletStore = createWalletStore(map.id);
let walletLoaded = false;
let slotPayoutTimer;

function sendGame(message) {
  if (socket?.readyState !== WebSocket.OPEN) return false;
  socket.send(JSON.stringify(message));
  return true;
}

function refreshCash() {
  clearTimeout(slotPayoutTimer);
  const now = serverNow();
  ui.setCash(slotDisplayCoins(game.self, now));
  panels.refresh();
  const remaining = (game.self.pendingSlotPayout?.revealAt ?? now) - now;
  if (remaining > 0) slotPayoutTimer = setTimeout(refreshCash, remaining);
}

function setSelf(state) {
  game.self = { coins: state.coins, drunk: state.drunk, fuel: state.fuel, asleep: state.asleep,
    pendingSlotPayout: state.pendingSlotPayout ?? null };
  if (state.asleep) stopAllMovement();
  if (walletLoaded) walletStore.save(selfID, { coins: state.coins, drunk: state.drunk, fuel: state.fuel, dayKey: state.dayKey });
  refreshCash();
}

// Slurp or bite as the item reaches the mouth: full volume for your own, fading out over 8 m for
// other players.
function playConsumeSound(consumerID, served) {
  const item = ITEM_BY_ID.get(served.item);
  const me = playerState.get(selfID);
  const them = playerState.get(consumerID);
  const loudness = consumerID === selfID ? 1 : me && them ? Math.max(0, 1 - Math.hypot(me.x - them.x, me.z - them.z) / 8) : 0;
  if (item && loudness > .05) setTimeout(() => audio.sfx(isDrink(item) ? 'slurp' : 'bite', loudness), 450);
}

function setSeat(id, seatID) {
  const seat = seatID ? SEAT_BY_ID.get(seatID) : null;
  if (seat) game.seated.set(id, seatID);
  else game.seated.delete(id);
  world?.setSeat(id, seat);
}

function setSleeper(id, asleep) {
  if (asleep) game.sleepers.add(id);
  else game.sleepers.delete(id);
  world?.setAsleep(id, asleep);
}

// Applies the welcome snapshot, then offers the server our saved wallet (accepted once after a
// server restart, ignored otherwise).
async function applyGameSnapshot(snapshot) {
  clockOffset = snapshot.serverTime - Date.now();
  walletLoaded = false;
  const loading = walletStore.load(selfID);
  game.items = new Map(snapshot.items.map(item => [item.id, item]));
  game.jukebox = snapshot.jukebox;
  game.band = snapshot.band ?? null;
  game.arcade = snapshot.arcade ?? null;
  world?.setSlotSpin(game.arcade, serverNow());
  audio.setSlotSpin(game.arcade);
  game.icons = snapshot.icons ?? {};
  for (const id of [...game.sleepers]) setSleeper(id, false);
  for (const id of snapshot.sleepers) setSleeper(id, true);
  for (const id of [...game.seated.keys()]) setSeat(id, null);
  for (const [id, seat] of Object.entries(snapshot.seated ?? {})) setSeat(id, seat);
  world?.items.reset(snapshot.items);
  audio.setBand(game.band);
  audio.setJukebox(snapshot.jukebox);
  setSelf(snapshot.self);
  const saved = await loading;
  walletLoaded = true;
  // With a saved copy, the server answers the restore with a fresh self message (which is then
  // saved); without one, save the server's starting wallet now.
  if (saved) sendGame({ type: 'restore', ...saved });
  else setSelf({ ...game.self, dayKey: snapshot.self.dayKey });
}
const { input, joystick } = ui;
const moveLabel = {
  up: 'Forward',
  down: 'Backward',
  left: 'Strafe left',
  right: 'Strafe right',
  stop: 'Stop',
};
let socket;
let guestSessionToken;
let world;
let selfID;
const playerState = new Map();
let yaw = 0;
let pitch = -.12;
const heldDirections = new Map();
let movementTimer;
let lastMoveAt = -Infinity;
let lastOrientationAt = -Infinity;
let orientationTimer;
const moveInterval = 200;
const orientationInterval = 100;

function applyMove(position, forward, strafe, heading, distance) {
  forward *= -distance;
  strafe *= distance;
  return {
    x: Math.max(-MOVEMENT_BOUNDS.halfWidth, Math.min(MOVEMENT_BOUNDS.halfWidth, position.x + strafe * Math.cos(heading) + forward * Math.sin(heading))),
    z: Math.max(-MOVEMENT_BOUNDS.halfDepth, Math.min(MOVEMENT_BOUNDS.halfDepth, position.z - strafe * Math.sin(heading) + forward * Math.cos(heading))),
  };
}

function flushOrientation() {
  orientationTimer = undefined;
  if (socket?.readyState !== WebSocket.OPEN) return;
  lastOrientationAt = performance.now();
  socket.send(JSON.stringify({ type: 'orientation', yaw, pitch }));
}

function queueOrientation() {
  if (socket?.readyState !== WebSocket.OPEN || orientationTimer) return;
  const remaining = orientationInterval - (performance.now() - lastOrientationAt);
  if (remaining > 0) orientationTimer = setTimeout(flushOrientation, remaining);
  else flushOrientation();
}


function sendChat(text) {
  if (!text || socket?.readyState !== WebSocket.OPEN) return false;
  socket.send(JSON.stringify({ type: 'chat', text }));
  return true;
}

function setConnected(connected) {
  ui.setConnected(connected);
  if (!connected) stopAllMovement();
}

function upsertPlayer(player, moving = false) {
  if (!player || typeof player.id !== 'string') return;
  playerState.set(player.id, player);
  world?.upsertPlayer(player, moving);
}

function removePlayer(id) {
  playerState.delete(id);
  world?.removePlayer(id);
  ui.removeBubble(id);
}


async function startThree() {
  try {
    world = await createWorld({
      map,
      host: document.getElementById('scene'),
      input,
      players: playerState,
      getSelfID: () => selfID,
      getOrientation: () => ({ yaw, pitch }),
      onLook(nextYaw, nextPitch) {
        yaw = nextYaw;
        pitch = nextPitch;
        world?.setOrientation(selfID, yaw, pitch);
        queueOrientation();
      },
      isLocallyMoving: () => heldDirections.size > 0 && socket?.readyState === WebSocket.OPEN,
      getMovement: activeMovement,
      applyMove,
      walkSpeed: WALK_SPEED,
      bubbles: ui.bubbles,
      addDebug: ui.addDebug,
      guestMode,
      getGuestSessionToken: () => guestSessionToken,
      queueOrientation,
      now: viewNow,
      slotNow: serverNow,
      onListener: (position, forward, up) => audio.setListener(position, forward, up),
      isBandPlaying: () => Boolean(game.band && serverNow() < game.band.startedAt + BAND.duration * 1000),
      getSelfState: () => game.self,
      isJukeboxPlaying: () => {
        const progress = audio.progress();
        return Boolean(progress && progress.elapsed < progress.song.duration);
      },
      onPick: target => (target ? panels.open(target) : panels.closePanel()),
      onHover: panels.setHover,
      onStats: ui.setStats,
      onProgress: ui.setLoading,
    });
    world?.items.reset([...game.items.values()]);
    world?.setSlotSpin(game.arcade, serverNow());
    for (const id of game.sleepers) world?.setAsleep(id, true);
    for (const [id, seat] of game.seated) world?.setSeat(id, SEAT_BY_ID.get(seat));
    await world?.ready;
    ui.hideLoading();
  } catch {
    ui.addDebug('three.js: renderer unavailable', 'muted');
  }
  // Without WebGL the chat still works, so never leave the overlay up.
  if (ui.isLoading()) ui.hideLoading();
}

function activeMovement() {
  let forward = 0;
  let strafe = 0;
  for (const direction of heldDirections.values()) {
    if (typeof direction === 'object') {
      forward += direction.forward;
      strafe += direction.strafe;
    } else if (direction === 'up') forward += 1;
    else if (direction === 'down') forward -= 1;
    else if (direction === 'right') strafe += 1;
    else if (direction === 'left') strafe -= 1;
  }
  const magnitude = Math.hypot(forward, strafe);
  if (magnitude > 1) {
    forward /= magnitude;
    strafe /= magnitude;
  }
  return { forward, strafe };
}

function directionName(forward, strafe) {
  const parts = [];
  if (forward > 0) parts.push('Forward');
  if (forward < 0) parts.push('Backward');
  if (strafe < 0) parts.push('Strafe left');
  if (strafe > 0) parts.push('Strafe right');
  return parts.join(' + ');
}

function sendMove(movement = activeMovement()) {
  const time = performance.now();
  if (game.self.asleep || input.disabled || socket?.readyState !== WebSocket.OPEN || time - lastMoveAt < moveInterval) return;
  if (!movement.forward && !movement.strafe) return;
  // Walking off a seat stands up right away (the server does the same on this move).
  if (game.seated.has(selfID)) setSeat(selfID, null);
  lastMoveAt = time;
  const direction = directionName(movement.forward, movement.strafe);
  ui.addDebug(`input: ${direction} (${Math.round(-yaw * 180 / Math.PI)}°)`);
  socket.send(JSON.stringify({ type: 'move', ...movement, yaw, ...predictedPosition() }));
}

// Where this client has drawn the player; the server adopts it when plausible (see server.js).
function predictedPosition() {
  const position = world?.localPosition();
  return position ? { x: Math.round(position.x * 1000) / 1000, z: Math.round(position.z * 1000) / 1000 } : {};
}

// After the keys are released, report the exact resting spot once the rate limit allows.
let stopSyncTimer;
function syncStop() {
  clearTimeout(stopSyncTimer);
  stopSyncTimer = setTimeout(() => {
    if (heldDirections.size || socket?.readyState !== WebSocket.OPEN || game.self.asleep) return;
    const position = predictedPosition();
    if (position.x === undefined) return;
    lastMoveAt = performance.now();
    socket.send(JSON.stringify({ type: 'move', forward: 0, strafe: 0, yaw, ...position }));
  }, Math.max(0, moveInterval + 20 - (performance.now() - lastMoveAt)));
}

// While standing still, keep re-reporting until the server's copy has caught up (it moves at most
// walking speed per message, so a burst of lag can take a few syncs to absorb).
setInterval(() => {
  const server = playerState.get(selfID);
  const drawn = world?.localPosition();
  if (!server || !drawn || heldDirections.size) return;
  if (Math.hypot(server.x - drawn.x, server.z - drawn.z) > .05) syncStop();
}, 700);

function beginMovement(source, direction) {
  if (game.self.asleep || input.disabled || socket?.readyState !== WebSocket.OPEN || heldDirections.has(source)) return;
  heldDirections.set(source, direction);
  sendMove();
  if (!movementTimer) movementTimer = setInterval(() => {
    if (heldDirections.size) sendMove();
  }, 16);
}

function setPointerMovement(source, direction) {
  if (direction === heldDirections.get(source)) return;
  if (!direction) {
    endMovement(source);
    return;
  }
  if (game.self.asleep || input.disabled || socket?.readyState !== WebSocket.OPEN) return;
  heldDirections.set(source, direction);
  sendMove();
  if (!movementTimer) movementTimer = setInterval(() => {
    if (heldDirections.size) sendMove();
  }, 16);
}

function endMovement(source) {
  heldDirections.delete(source);
  if (!heldDirections.size) {
    clearInterval(movementTimer);
    movementTimer = undefined;
    syncStop();
  }
}

function stopAllMovement() {
  releaseJoystick();
  heldDirections.clear();
  clearInterval(movementTimer);
  movementTimer = undefined;
}

async function connect() {
  const telegram = window.Telegram?.WebApp;
  if (!guestMode && !telegram?.initData) {
    ui.setStatus('Open Hideout from its link inside Telegram.', 'error');
    ui.addDebug('auth: no Telegram init data', 'muted');
    return;
  }
  telegram?.ready();
  telegram?.expand();
  ui.setStatus(guestMode ? 'Checking debug guest access…' : 'Checking Telegram access…');
  let response;
  try {
    response = guestMode ? await fetch(`${location.origin}/auth/guest${mapQuery}`, {
      method: 'POST',
      credentials: 'same-origin',
    }) : await fetch(`${location.origin}/auth${mapQuery}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ initData: telegram.initData }),
      });
  } catch {
    ui.setStatus('Could not reach Hideout. Retrying…', 'error');
    setTimeout(connect, 5000);
    return;
  }
  if (!response.ok) {
    ui.setStatus(guestMode && response.status === 401 ? 'Guest credentials rejected. Reload and try again.' :
      response.status === 403 ? 'This account is not in an allowed group.' :
      response.status === 401 ? 'Telegram login could not be verified. Reopen Hideout.' :
      'Could not check group membership. Reopen Hideout.', 'error');
    return;
  }

  if (guestMode) {
    const login = await response.json();
    guestSessionToken = login.guestToken;
    if (!guestSessionToken) {
      ui.setStatus('Guest login did not return a session. Reload Hideout.', 'error');
      return;
    }
  }

  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  socket = guestMode
    ? new WebSocket(`${protocol}//${location.host}/ws${mapQuery}`, ['hideout-guest', `guest.${guestSessionToken}`])
    : new WebSocket(`${protocol}//${location.host}/ws${mapQuery}`);
  socket.onmessage = event => {
    let message;
    try { message = JSON.parse(event.data); } catch { return; }
    if (message.type === 'welcome') {
      selfID = message.selfID;
      const currentPlayers = new Set(message.players.map(player => player.id));
      for (const id of playerState.keys()) if (!currentPlayers.has(id)) removePlayer(id);
      for (const player of message.players) upsertPlayer(player);
      world?.setLocalPlayer(selfID);
      const self = playerState.get(selfID);
      if (Number.isFinite(self?.yaw)) yaw = self.yaw;
      if (Number.isFinite(self?.pitch)) pitch = self.pitch;
      ui.setStatus(`Connected as ${self?.name ?? 'player'}`, 'connected');
      setConnected(true);
      if (self) ui.updateProfile(self);
      if (message.game) applyGameSnapshot(message.game);
      if (guestMode) ui.addDebug('auth: debug guest access', 'muted');
      ui.addDebug(`server: joined at (${self.x.toFixed(2)}, ${self.z.toFixed(2)})`, 'server');
    } else if (message.type === 'player_joined') {
      upsertPlayer(message.player);
      ui.addDebug(`server: ${message.player.name} joined`, 'server');
    } else if (message.type === 'player_left') {
      const player = playerState.get(message.id);
      removePlayer(message.id);
      if (player) ui.addDebug(`server: ${player.name} left`, 'muted');
    } else if (message.type === 'move') {
      const player = playerState.get(message.id);
      upsertPlayer({
        id: message.id,
        name: player?.name ?? message.name,
        photoURL: player?.photoURL ?? null,
        avatarURL: player?.avatarURL ?? null,
        yaw: message.yaw ?? player?.yaw ?? 0,
        pitch: player?.pitch ?? 0,
        x: message.x,
        z: message.z,
      }, true);
      ui.addDebug(`server: ${message.name} ${message.label || moveLabel[message.direction]} → (${message.x.toFixed(2)}, ${message.z.toFixed(2)})`, 'server');
    } else if (message.type === 'orientation') {
      const player = playerState.get(message.id);
      if (player && Number.isFinite(message.yaw) && Number.isFinite(message.pitch)) {
        upsertPlayer({ ...player, yaw: message.yaw, pitch: message.pitch });
      }
    } else if (message.type === 'self') {
      setSelf(message);
    } else if (message.type === 'notice') {
      panels.slotRejected();
      panels.toast(message.text, message.tone);
    } else if (message.type === 'activity') {
      ui.addSystemLine(message.text);
    } else if (message.type === 'item_added') {
      game.items.set(message.item.id, message.item);
      world?.items.add(message.item);
      if (message.item.byID === selfID) {
        audio.sfx('bell');
        world?.showcase(message.item.id);
      }
      panels.refresh();
    } else if (message.type === 'item_removed') {
      const served = game.items.get(message.id);
      if (message.byID && served) world?.consume(message.byID, served.item);
      game.items.delete(message.id);
      if (message.byID && message.byID === selfID) world?.consumeOwn(message.id);
      else world?.items.remove(message.id);
      if (message.byID && served) playConsumeSound(message.byID, served);
      panels.refresh();
    } else if (message.type === 'arcade_spin') {
      game.arcade = message.spin;
      world?.setSlotSpin(message.spin, serverNow());
      audio.setSlotSpin(message.spin, true);
      panels.refresh();
    } else if (message.type === 'jukebox') {
      game.jukebox = message.jukebox;
      if (message.jukebox?.byID === selfID) audio.sfx('bell');
      audio.setJukebox(message.jukebox);
      panels.refresh();
    } else if (message.type === 'band') {
      game.band = message.band;
      if (message.band?.byID === selfID) audio.sfx('bell');
      audio.setBand(message.band);
      panels.refresh();
    } else if (message.type === 'player_state') {
      if ('asleep' in message) setSleeper(message.id, message.asleep);
      if ('seat' in message) setSeat(message.id, message.seat);
      panels.refresh();
    } else if (message.type === 'chat') {
      ui.addDebug(`sendchat(): ${message.name} ${message.text}`, 'chat');
      ui.addChatHistory(message, selfID);
      if (message.id !== selfID && playerState.has(message.id)) {
        ui.showBubble(message.id, message.name, message.text);
      }
    }
  };
  socket.onclose = () => {
    panels.closePanel();
    audio.setSlotSpin(null);
    clearTimeout(orientationTimer);
    orientationTimer = undefined;
    setConnected(false);
    ui.setStatus('Disconnected. Reconnecting…', 'error');
    ui.addDebug('socket: disconnected', 'muted');
    setTimeout(connect, 1500);
  };
  socket.onerror = () => socket.close();
}

// Thumb joystick: drag anywhere in any direction. Past the dead zone you walk that way, slowly
// near the centre and at full speed from ~70% of the throw outward.
const JOYSTICK_DEAD_ZONE = .18;
const JOYSTICK_FULL_SPEED = .7;
let joystickPointer = null;

function steerJoystick(event) {
  const rect = joystick.getBoundingClientRect();
  const radius = rect.width / 2;
  let x = (event.clientX - rect.left - radius) / radius;
  let y = (event.clientY - rect.top - radius) / radius;
  const reach = Math.hypot(x, y);
  if (reach > 1) {
    x /= reach;
    y /= reach;
  }
  joystick.style.setProperty('--x', x.toFixed(3));
  joystick.style.setProperty('--y', y.toFixed(3));
  if (reach < JOYSTICK_DEAD_ZONE) {
    setPointerMovement('joystick', null);
    return;
  }
  const speed = Math.max(.35, Math.min(1, (reach - JOYSTICK_DEAD_ZONE) / (JOYSTICK_FULL_SPEED - JOYSTICK_DEAD_ZONE)));
  const length = Math.min(reach, 1);
  setPointerMovement('joystick', { forward: -y / length * speed, strafe: x / length * speed });
}

function releaseJoystick() {
  if (joystickPointer === null) return;
  joystickPointer = null;
  joystick.classList.remove('active');
  joystick.style.setProperty('--x', 0);
  joystick.style.setProperty('--y', 0);
  endMovement('joystick');
}

joystick.addEventListener('pointerdown', event => {
  if (event.button !== 0 || joystickPointer !== null || joystick.classList.contains('disabled')) return;
  event.preventDefault();
  joystickPointer = event.pointerId;
  joystick.setPointerCapture(event.pointerId);
  joystick.classList.add('active');
  steerJoystick(event);
});
joystick.addEventListener('pointermove', event => {
  if (event.pointerId === joystickPointer) steerJoystick(event);
});
for (const eventName of ['pointerup', 'pointercancel', 'lostpointercapture']) {
  joystick.addEventListener(eventName, event => {
    if (event.pointerId === joystickPointer) releaseJoystick();
  });
}
const keyDirection = {
  ArrowUp: 'up', w: 'up', W: 'up',
  ArrowDown: 'down', s: 'down', S: 'down',
  ArrowLeft: 'left', a: 'left', A: 'left',
  ArrowRight: 'right', d: 'right', D: 'right',
};
document.addEventListener('keydown', event => {
  if (ui.isLoading()) return;
  const targetElement = event.target instanceof Element ? event.target : null;
  if (targetElement?.closest('.newspaper-panel')) return;
  const textEntry = targetElement?.closest('input, textarea, select, [contenteditable="true"]');
  const control = targetElement?.closest('button, a');
  if (event.key === 'Enter' && !textEntry && !control && !input.disabled &&
      !event.ctrlKey && !event.metaKey && !event.altKey && !event.repeat) {
    event.preventDefault();
    input.focus();
    return;
  }
  if (textEntry || event.ctrlKey || event.metaKey || event.altKey) return;
  if ((event.key === 'e' || event.key === 'E') && !event.repeat) {
    panels.useHovered();
    return;
  }
  const direction = keyDirection[event.key];
  if (!direction) return;
  event.preventDefault();
  if (!event.repeat) beginMovement(`key:${event.code}`, direction);
});
document.addEventListener('keyup', event => {
  const direction = keyDirection[event.key];
  if (direction) endMovement(`key:${event.code}`);
});
window.addEventListener('blur', stopAllMovement);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) stopAllMovement();
});

// Your own footsteps while walking (local only, not synced): one step every ~0.42 s, with a
// little pitch and volume variation so they do not sound like a loop.
setInterval(() => {
  if (!heldDirections.size || game.self.asleep || socket?.readyState !== WebSocket.OPEN) return;
  audio.sfx('footstep', .8 + Math.random() * .2, .9 + Math.random() * .2);
}, 420);

// Keep distance falloff available when the renderer could not start.
setInterval(() => { if (!world) audio.setListener(playerState.get(selfID)); }, 500);

ui.addDebug('client: booting…', 'muted');
startThree();
connect();
