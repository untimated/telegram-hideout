import { createServer } from 'node:http';
import { createHash, timingSafeEqual } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { WebSocket, WebSocketServer } from 'ws';
import { makeSession, readSession, readSessionToken, sessionCookie, verifyInitData } from './auth.js';
import { createAvatarLoader } from './avatars.js';
import { DEFAULT_SPAWN, MOVEMENT_BOUNDS } from './public/js/config.js';

function sameOrigin(request) {
  const origin = request.headers.origin;
  if (!origin) return false;
  try {
    const url = new URL(origin);
    const forwarded = request.headers['x-forwarded-proto'];
    return url.host === request.headers.host &&
      (url.protocol === 'https:' || (url.protocol === 'http:' && forwarded !== 'https'));
  } catch {
    return false;
  }
}

function rejectUpgrade(socket, status, reason) {
  socket.end(`HTTP/1.1 ${status} ${reason}\r\nConnection: close\r\n\r\n`);
}

function readBasicAuth(header) {
  if (typeof header !== 'string' || !header.startsWith('Basic ')) return null;
  try {
    const decoded = Buffer.from(header.slice(6), 'base64').toString('utf8');
    const separator = decoded.indexOf(':');
    if (separator < 0) return null;
    return { username: decoded.slice(0, separator), password: decoded.slice(separator + 1) };
  } catch {
    return null;
  }
}

function safeEqual(left, right) {
  const digest = value => createHash('sha256').update(String(value)).digest();
  return timingSafeEqual(digest(left), digest(right));
}

function challengeGuest(response) {
  response.writeHead(401, {
    'WWW-Authenticate': 'Basic realm="Hideout Debug", charset="UTF-8"',
    'Cache-Control': 'no-store',
  }).end('Debug guest credentials required');
}

export function createHideoutServer(options = {}) {
  const botToken = options.botToken ?? process.env.TELEGRAM_BOT_TOKEN;
  const rawGroupIDs = options.groupID ?? process.env.ALLOWED_GROUP_ID;
  const groupIDs = String(rawGroupIDs ?? '').split(',').map(id => id.trim());
  const debugGuestUsername = options.debugGuestUsername ?? process.env.DEBUG_GUEST_USERNAME;
  const debugGuestPassword = options.debugGuestPassword ?? process.env.DEBUG_GUEST_PASSWORD;
  const guestEnabled = Boolean(debugGuestUsername) && Boolean(debugGuestPassword);
  const telegramAPIBase = options.telegramAPIBase ?? 'https://api.telegram.org';
  const fetchImpl = options.fetchImpl ?? fetch;
  const now = options.now ?? (() => Math.floor(Date.now() / 1000));
  const moveNow = options.moveNow ?? (() => performance.now());
  const avatars = createAvatarLoader({ botToken, telegramAPIBase, fetchImpl, now });
  let guestNumber = 0;
  if (!botToken || groupIDs.some(id => !/^-?\d+$/.test(id))) {
    throw new Error('TELEGRAM_BOT_TOKEN and comma-separated numeric ALLOWED_GROUP_ID are required');
  }
  if (Boolean(debugGuestUsername) !== Boolean(debugGuestPassword) || String(debugGuestUsername || '').includes(':')) {
    throw new Error('DEBUG_GUEST_USERNAME and DEBUG_GUEST_PASSWORD must both be set; username cannot contain a colon');
  }

  function hasGuestAccess(request) {
    const credentials = readBasicAuth(request.headers.authorization);
    return guestEnabled && credentials &&
      safeEqual(credentials.username, debugGuestUsername) &&
      safeEqual(credentials.password, debugGuestPassword);
  }

  async function checkGroup(userID, groupID) {
    const response = await fetchImpl(`${telegramAPIBase}/bot${botToken}/getChatMember`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: groupID, user_id: userID }),
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) throw new Error(`getChatMember HTTP ${response.status}`);
    const result = await response.json();
    if (!result.ok) throw new Error(`getChatMember rejected (${result.error_code || 'unknown'})`);
    const member = result.result;
    return member?.status === 'creator' || member?.status === 'administrator' || member?.status === 'member' ||
      (member?.status === 'restricted' && member.is_member === true);
  }

  async function isGroupMember(userID) {
    let lookupFailure;
    for (const groupID of new Set(groupIDs)) {
      try {
        if (await checkGroup(userID, groupID)) return true;
      } catch (error) {
        lookupFailure ??= new Error(`group ${groupID}: ${error.message}`);
      }
    }
    if (lookupFailure) throw lookupFailure;
    return false;
  }

  const page = readFileSync(new URL('./public/hideout.html', import.meta.url));
  const staticAsset = (file, contentType, cacheControl = 'no-cache') => ({
    contentType,
    cacheControl,
    body: readFileSync(new URL(file, import.meta.url)),
  });
  const textureAsset = name => staticAsset(`./assets/textures/pool_tiles/Tiles132A_1K-JPG_${name}.jpg`, 'image/jpeg', 'public, max-age=86400');
  const staticAssets = new Map([
    ['/hideout.css', staticAsset('./public/hideout.css', 'text/css; charset=utf-8')],
    ['/js/app.js', staticAsset('./public/js/app.js', 'text/javascript; charset=utf-8')],
    ['/js/ui.js', staticAsset('./public/js/ui.js', 'text/javascript; charset=utf-8')],
    ['/js/world.js', staticAsset('./public/js/world.js', 'text/javascript; charset=utf-8')],
    ['/js/characters.js', staticAsset('./public/js/characters.js', 'text/javascript; charset=utf-8')],
    ['/js/config.js', staticAsset('./public/js/config.js', 'text/javascript; charset=utf-8')],
    ['/js/stage.js', staticAsset('./public/js/stage.js', 'text/javascript; charset=utf-8')],
    ['/js/models/index.js', staticAsset('./public/js/models/index.js', 'text/javascript; charset=utf-8')],
    ['/js/models/core.js', staticAsset('./public/js/models/core.js', 'text/javascript; charset=utf-8')],
    ['/js/models/architecture.js', staticAsset('./public/js/models/architecture.js', 'text/javascript; charset=utf-8')],
    ['/js/models/bar.js', staticAsset('./public/js/models/bar.js', 'text/javascript; charset=utf-8')],
    ['/js/models/kitchen.js', staticAsset('./public/js/models/kitchen.js', 'text/javascript; charset=utf-8')],
    ['/js/models/furniture.js', staticAsset('./public/js/models/furniture.js', 'text/javascript; charset=utf-8')],
    ['/js/models/decor.js', staticAsset('./public/js/models/decor.js', 'text/javascript; charset=utf-8')],
    ['/js/models/roof.js', staticAsset('./public/js/models/roof.js', 'text/javascript; charset=utf-8')],
    ['/textures/pool_tiles/color.jpg', textureAsset('Color')],
    ['/textures/pool_tiles/normal.jpg', textureAsset('NormalGL')],
    ['/textures/pool_tiles/roughness.jpg', textureAsset('Roughness')],
    ['/paintings/geom_face_ai_gen.webp', staticAsset('./assets/paintings/geom_face_ai_gen.webp', 'image/webp', 'public, max-age=86400')],
    ['/paintings/abstract_cyber_ai_gen.webp', staticAsset('./assets/paintings/abstract_cyber_ai_gen.webp', 'image/webp', 'public, max-age=86400')],
    ['/js/sky.js', staticAsset('./public/js/sky.js', 'text/javascript; charset=utf-8')],
    ['/js/models/palms.js', staticAsset('./public/js/models/palms.js', 'text/javascript; charset=utf-8')],
  ]);
  const server = createServer(async (request, response) => {
    const url = new URL(request.url, 'http://localhost');
    const path = url.pathname;
    if (request.method === 'GET' && path === '/') {
      response.writeHead(302, { Location: '/hideout' }).end();
    } else if (request.method === 'GET' && staticAssets.has(path)) {
      const { contentType, cacheControl, body } = staticAssets.get(path);
      response.writeHead(200, {
        'Content-Type': contentType,
        'Cache-Control': cacheControl,
        'X-Content-Type-Options': 'nosniff',
      }).end(body);
    } else if (request.method === 'GET' && /^\/avatars\/\d+$/.test(path)) {
      const guestSession = guestEnabled && readSessionToken(request.headers['x-debug-guest-token'], botToken, now());
      const session = guestSession?.guest ? guestSession : readSession(request.headers.cookie, botToken, now());
      if (!session || (session.guest && !guestEnabled) || !players.has(String(session.id))) {
        response.writeHead(401, { 'Cache-Control': 'no-store' }).end('Room session required');
        return;
      }
      const id = path.slice('/avatars/'.length);
      if (!players.get(id)?.avatarURL) { response.writeHead(404).end('Photo unavailable'); return; }
      try {
        const photo = await avatars.get(id, players.get(id).photoURL);
        if (!photo) { response.writeHead(404, { 'Cache-Control': 'no-store' }).end('Photo unavailable'); return; }
        response.writeHead(200, {
          'Content-Type': photo.type,
          'Content-Length': photo.bytes.length,
          'Cache-Control': 'private, max-age=300',
          'X-Content-Type-Options': 'nosniff',
        }).end(photo.bytes);
      } catch {
        // Do not log fetch errors: Telegram request URLs include the secret token.
        response.writeHead(502, { 'Cache-Control': 'no-store' }).end('Photo temporarily unavailable');
      }
    } else if (request.method === 'GET' && (path === '/hideout' || path === '/hideout/')) {
      if (url.searchParams.get('guest') === '1') {
        if (!guestEnabled) { response.writeHead(404).end('Debug guest access is disabled'); return; }
        if (!hasGuestAccess(request)) { challengeGuest(response); return; }
      }
      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }).end(page);
    } else if (request.method === 'POST' && path === '/auth/guest') {
      if (!guestEnabled) { response.writeHead(404).end('Debug guest access is disabled'); return; }
      if (!sameOrigin(request)) { response.writeHead(403).end('Forbidden'); return; }
      if (!hasGuestAccess(request)) { challengeGuest(response); return; }
      const number = ++guestNumber;
      const user = { id: Number.MAX_SAFE_INTEGER - number, name: `Guest ${number}`, guest: true };
      response.writeHead(200, {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      }).end(JSON.stringify({ name: user.name, guestToken: makeSession(user, botToken, now()) }));
    } else if (request.method === 'POST' && path === '/auth') {
      if (!sameOrigin(request) || !request.headers['content-type']?.startsWith('application/json')) {
        response.writeHead(403).end('Forbidden');
        return;
      }
      let body = '';
      for await (const chunk of request) {
        body += chunk;
        if (body.length > 16384) { response.writeHead(413).end('Too large'); return; }
      }
      let initData;
      try { initData = JSON.parse(body).initData; } catch { /* Invalid JSON. */ }
      const user = verifyInitData(initData, botToken, now());
      if (!user) { response.writeHead(401).end('Invalid or expired Telegram login'); return; }
      let member;
      try { member = await isGroupMember(user.id); } catch (error) {
        console.error('Membership check:', error.message);
        response.writeHead(503).end('Membership check unavailable');
        return;
      }
      if (!member) { response.writeHead(403).end('Group membership required'); return; }
      response.writeHead(200, {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
        'Set-Cookie': sessionCookie(makeSession(user, botToken, now())),
      }).end(JSON.stringify({ name: user.name }));
    } else {
      response.writeHead(404).end('Not found');
    }
  });
  const sockets = new WebSocketServer({
    noServer: true,
    maxPayload: 8192,
    handleProtocols: protocols => protocols.has('hideout-guest') ? 'hideout-guest' : false,
  });
  const positions = new Map();
  const players = new Map();
  const movementTimes = new Map();
  const orientationTimes = new Map();
  const spawnPoints = [
    DEFAULT_SPAWN,
    { x: DEFAULT_SPAWN.x - 1.4, z: DEFAULT_SPAWN.z },
    { x: DEFAULT_SPAWN.x + 1.4, z: DEFAULT_SPAWN.z },
    { x: DEFAULT_SPAWN.x - 1.4, z: DEFAULT_SPAWN.z - .9 },
    { x: DEFAULT_SPAWN.x + 1.4, z: DEFAULT_SPAWN.z - .9 },
  ];

  function broadcast(message, except) {
    const outgoing = JSON.stringify(message);
    for (const peer of sockets.clients) {
      if (peer !== except && peer.readyState === WebSocket.OPEN) peer.send(outgoing);
    }
  }

  server.on('upgrade', async (request, socket, head) => {
    if (new URL(request.url, 'http://localhost').pathname !== '/ws') {
      rejectUpgrade(socket, 404, 'Not Found');
      return;
    }
    if (!sameOrigin(request)) { rejectUpgrade(socket, 401, 'Unauthorized'); return; }
    const protocols = (request.headers['sec-websocket-protocol'] || '').split(',').map(protocol => protocol.trim()).filter(Boolean);
    const guestToken = protocols.find(protocol => protocol.startsWith('guest.'))?.slice(6);
    const session = guestToken
      ? (guestEnabled && protocols.length === 2 && protocols.includes('hideout-guest') &&
        readSessionToken(guestToken, botToken, now()))
      : readSession(request.headers.cookie, botToken, now());
    if (!session) { rejectUpgrade(socket, 401, 'Unauthorized'); return; }
    if (session.guest && (!guestEnabled || !guestToken)) { rejectUpgrade(socket, 403, 'Forbidden'); return; }
    if (guestToken && !session.guest) { rejectUpgrade(socket, 403, 'Forbidden'); return; }
    if (!session.guest) {
      try {
        if (!await isGroupMember(session.id)) { rejectUpgrade(socket, 403, 'Forbidden'); return; }
      } catch (error) {
        console.error('Membership check:', error.message);
        rejectUpgrade(socket, 503, 'Service Unavailable');
        return;
      }
    }
    sockets.handleUpgrade(request, socket, head, client => {
      sockets.emit('connection', client, session);
    });
  });

  sockets.on('connection', (client, session) => {
    client.on('error', error => console.error('WebSocket:', error.message));
    const playerID = String(session.id);
    const position = positions.get(session.id) ?? { ...spawnPoints[players.size % spawnPoints.length] };
    position.yaw ??= 0;
    position.pitch ??= -.12;
    positions.set(session.id, position);
    const player = players.get(playerID) ?? { id: playerID };
    Object.assign(player, {
      name: session.name,
      photoURL: session.photoURL ?? null,
      avatarURL: session.guest ? null : `/avatars/${playerID}`,
      x: position.x,
      z: position.z,
      yaw: position.yaw,
      pitch: position.pitch,
    });
    client.playerID = playerID;
    players.set(playerID, player);
    client.send(JSON.stringify({ type: 'welcome', selfID: playerID, players: [...players.values()] }));
    broadcast({ type: 'player_joined', player }, client);
    const expiration = setTimeout(() => client.close(1008, 'Session expired'), Math.max(0, (session.exp - now()) * 1000));
    const membership = session.guest ? null : setInterval(async () => {
      try {
        if (!await isGroupMember(session.id)) client.close(1008, 'Group membership required');
      } catch (error) {
        console.error('Membership check:', error.message);
        client.close(1013, 'Membership check unavailable');
      }
    }, 5 * 60 * 1000);
    client.on('close', () => {
      clearTimeout(expiration);
      clearInterval(membership);
      const stillConnected = [...sockets.clients].some(peer =>
        peer !== client && peer.readyState === WebSocket.OPEN && peer.playerID === playerID);
      if (!stillConnected) {
        players.delete(playerID);
        movementTimes.delete(playerID);
        orientationTimes.delete(playerID);
        avatars.remove(playerID);
        broadcast({ type: 'player_left', id: playerID });
      }
    });
    client.on('message', (data, isBinary) => {
      if (isBinary) return;
      let message;
      try { message = JSON.parse(data.toString()); } catch { return; }
      let outgoing;
      if (message?.type === 'chat' && typeof message.text === 'string') {
        const text = message.text.trim();
        if (!text || text.length > 500) return;
        outgoing = { type: 'chat', id: playerID, name: session.name, text };
      } else if (message?.type === 'orientation') {
        const yaw = message.yaw;
        if (typeof yaw !== 'number' || !Number.isFinite(yaw) || Math.abs(yaw) > Math.PI) return;
        const pitch = message.pitch ?? position.pitch;
        if (typeof pitch !== 'number' || !Number.isFinite(pitch) || Math.abs(pitch) > 1.25) return;
        const time = moveNow();
        if (time - (orientationTimes.get(playerID) ?? -Infinity) < 60) return;
        orientationTimes.set(playerID, time);
        position.yaw = player.yaw = yaw;
        position.pitch = player.pitch = pitch;
        outgoing = { type: 'orientation', id: playerID, name: session.name, yaw, pitch };
      } else if (message?.type === 'move') {
        const yaw = message.yaw ?? position.yaw;
        if (typeof yaw !== 'number' || !Number.isFinite(yaw) || Math.abs(yaw) > Math.PI) return;
        let forward;
        let strafe;
        if (typeof message.forward === 'number' && typeof message.strafe === 'number') {
          if (!Number.isFinite(message.forward) || !Number.isFinite(message.strafe) ||
              Math.abs(message.forward) > 1 || Math.abs(message.strafe) > 1) return;
          forward = message.forward;
          strafe = message.strafe;
        } else if (['up', 'down', 'left', 'right'].includes(message.direction)) {
          forward = message.direction === 'up' ? 1 : message.direction === 'down' ? -1 : 0;
          strafe = message.direction === 'right' ? 1 : message.direction === 'left' ? -1 : 0;
        } else {
          return;
        }
        const magnitude = Math.hypot(forward, strafe);
        if (!magnitude) return;
        if (magnitude > 1) {
          forward /= magnitude;
          strafe /= magnitude;
        }
        const time = moveNow();
        if (time - (movementTimes.get(playerID) ?? -Infinity) < 160) return;
        movementTimes.set(playerID, time);
        // A diagonal is normalized to the same fixed step length as a straight move.
        const delta = [strafe * 0.3, -forward * 0.3];
        // Rotate the fixed local step around Y; clients cannot choose distance/speed.
        const dx = delta[0] * Math.cos(yaw) + delta[1] * Math.sin(yaw);
        const dz = -delta[0] * Math.sin(yaw) + delta[1] * Math.cos(yaw);
        position.x = Math.max(-MOVEMENT_BOUNDS.halfWidth, Math.min(MOVEMENT_BOUNDS.halfWidth, Math.round((position.x + dx) * 1e6) / 1e6));
        position.z = Math.max(-MOVEMENT_BOUNDS.halfDepth, Math.min(MOVEMENT_BOUNDS.halfDepth, Math.round((position.z + dz) * 1e6) / 1e6));
        player.x = position.x;
        player.z = position.z;
        position.yaw = player.yaw = yaw;
        const direction = forward > 0 ? 'up' : forward < 0 ? 'down' : strafe > 0 ? 'right' : 'left';
        const label = [
          forward > 0 ? 'Forward' : forward < 0 ? 'Backward' : '',
          strafe < 0 ? 'Strafe left' : strafe > 0 ? 'Strafe right' : '',
        ].filter(Boolean).join(' + ');
        outgoing = {
          type: 'move',
          id: playerID,
          name: session.name,
          direction,
          label,
          yaw,
          x: position.x,
          z: position.z,
        };
      } else {
        return;
      }
      broadcast(outgoing);
    });
  });
  return { server, sockets };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { server } = createHideoutServer();
  const port = Number(process.env.PORT || 8080);
  server.listen(port, '0.0.0.0', () => {
    console.log(`Hideout: http://localhost:${port}/hideout`);
  });
}
