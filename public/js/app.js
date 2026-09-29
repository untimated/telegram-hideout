import { createHUD } from './ui.js';
import { createWorld } from './world.js';
import { MOVEMENT_BOUNDS } from './config.js';

const guestMode = new URLSearchParams(location.search).get('guest') === '1';
const ui = createHUD({ guestMode, onMessage: sendChat, onMessageFocus: stopAllMovement });
const { input, moveButtons } = ui;
const moveLabel = {
  up: 'Forward',
  down: 'Backward',
  left: 'Strafe left',
  right: 'Strafe right',
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
const moveStep = .3;
const walkSpeed = moveStep * 1000 / moveInterval;

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
      walkSpeed,
      bubbles: ui.bubbles,
      addDebug: ui.addDebug,
      guestMode,
      getGuestSessionToken: () => guestSessionToken,
      queueOrientation,
    });
  } catch {
    ui.addDebug('three.js: renderer unavailable', 'muted');
  }
}

function activeMovement() {
  let forward = 0;
  let strafe = 0;
  for (const direction of heldDirections.values()) {
    if (direction === 'up') forward += 1;
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
  if (input.disabled || socket?.readyState !== WebSocket.OPEN || time - lastMoveAt < moveInterval) return;
  if (!movement.forward && !movement.strafe) return;
  lastMoveAt = time;
  const direction = directionName(movement.forward, movement.strafe);
  ui.addDebug(`input: ${direction} (${Math.round(-yaw * 180 / Math.PI)}°)`);
  socket.send(JSON.stringify({ type: 'move', ...movement, yaw }));
}

function beginMovement(source, direction) {
  if (input.disabled || socket?.readyState !== WebSocket.OPEN || heldDirections.has(source)) return;
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
  if (input.disabled || socket?.readyState !== WebSocket.OPEN) return;
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
  }
}

function stopAllMovement() {
  activeMovePointers.clear();
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
    response = guestMode ? await fetch('/auth/guest', {
      method: 'POST',
      credentials: 'same-origin',
    }) : await fetch('/auth', {
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
    ? new WebSocket(`${protocol}//${location.host}/ws`, ['hideout-guest', `guest.${guestSessionToken}`])
    : new WebSocket(`${protocol}//${location.host}/ws`);
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
    } else if (message.type === 'chat') {
      ui.addDebug(`sendchat(): ${message.name} ${message.text}`, 'chat');
      ui.addChatHistory(message, selfID);
      if (message.id !== selfID && playerState.has(message.id)) {
        ui.showBubble(message.id, message.name, message.text);
      }
    }
  };
  socket.onclose = () => {
    clearTimeout(orientationTimer);
    orientationTimer = undefined;
    setConnected(false);
    ui.setStatus('Disconnected. Reconnecting…', 'error');
    ui.addDebug('socket: disconnected', 'muted');
    setTimeout(connect, 1500);
  };
  socket.onerror = () => socket.close();
}

const activeMovePointers = new Set();
for (const button of moveButtons) {
  button.addEventListener('pointerdown', event => {
    if (event.button !== 0 || button.disabled) return;
    event.preventDefault();
    activeMovePointers.add(event.pointerId);
    button.setPointerCapture(event.pointerId);
    beginMovement(`pointer:${event.pointerId}`, button.dataset.direction);
  });
  for (const eventName of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    button.addEventListener(eventName, event => {
      activeMovePointers.delete(event.pointerId);
      endMovement(`pointer:${event.pointerId}`);
    });
  }
  button.addEventListener('click', event => {
    if (event.detail === 0) {
      const direction = button.dataset.direction;
      const movement = {
        forward: direction === 'up' ? 1 : direction === 'down' ? -1 : 0,
        strafe: direction === 'right' ? 1 : direction === 'left' ? -1 : 0,
      };
      sendMove(movement);
    }
  });
}
document.addEventListener('pointermove', event => {
  if (!activeMovePointers.has(event.pointerId)) return;
  const button = document.elementFromPoint(event.clientX, event.clientY)?.closest('.move');
  const direction = button && !button.disabled ? button.dataset.direction : null;
  setPointerMovement(`pointer:${event.pointerId}`, direction);
});
const keyDirection = {
  ArrowUp: 'up', w: 'up', W: 'up',
  ArrowDown: 'down', s: 'down', S: 'down',
  ArrowLeft: 'left', a: 'left', A: 'left',
  ArrowRight: 'right', d: 'right', D: 'right',
};
document.addEventListener('keydown', event => {
  const targetElement = event.target instanceof Element ? event.target : null;
  const textEntry = targetElement?.closest('input, textarea, select, [contenteditable="true"]');
  const control = targetElement?.closest('button, a');
  if (event.key === 'Enter' && !textEntry && !control && !input.disabled &&
      !event.ctrlKey && !event.metaKey && !event.altKey && !event.repeat) {
    event.preventDefault();
    input.focus();
    return;
  }
  if (textEntry || event.ctrlKey || event.metaKey || event.altKey) return;
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

ui.addDebug('client: booting…', 'muted');
startThree();
connect();
