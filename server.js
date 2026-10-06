import { createServer } from 'node:http';
import { createHash, timingSafeEqual } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { WebSocket, WebSocketServer } from 'ws';
import { makeSession, readSession, readSessionToken, sessionCookie, verifyInitData } from './auth.js';
import { createAvatarLoader } from './avatars.js';
import { SPAWN_AREA, WALK_SPEED } from './public/js/config.js';
import { MAPS, mapFromQuery } from './public/js/maps.js';
import { NEWSPAPER } from './public/js/news.js';
import { AMBIENCE_FILE, BAND, ITEM_BY_ID, SONGS } from './public/js/game/catalog.js';
import { createGame } from './game.js';

// A random spot in the entrance area, at least SPAWN_GAP from everyone already there (the best of
// a few tries when it is crowded).
const SPAWN_GAP = .9;
export function randomSpawn(taken, random = Math.random, area = SPAWN_AREA) {
  let best;
  let bestGap = -1;
  for (let attempt = 0; attempt < 30; attempt++) {
    const spot = {
      x: Math.round((area.x0 + random() * (area.x1 - area.x0)) * 100) / 100,
      z: Math.round((area.z0 + random() * (area.z1 - area.z0)) * 100) / 100,
    };
    const gap = Math.min(Infinity, ...taken.map(other => Math.hypot(other.x - spot.x, other.z - spot.z)));
    if (gap >= SPAWN_GAP) return spot;
    if (gap > bestGap) { best = spot; bestGap = gap; }
  }
  return best;
}

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
  // Who may use "/cheat ..." in chat: comma-separated Telegram user IDs and/or @usernames. For
  // anyone else the text is an ordinary chat message, so the command is invisible.
  const admins = new Set(String(options.adminIDs ?? process.env.ADMIN_USER_IDS ?? '').split(',').map(id => id.trim().toLowerCase()).filter(Boolean));
  const isAdmin = session => !session.guest &&
    (admins.has(String(session.id)) || (session.name?.startsWith('@') && admins.has(session.name.toLowerCase())));
  const guestEnabled = Boolean(debugGuestUsername) && Boolean(debugGuestPassword);
  const telegramAPIBase = options.telegramAPIBase ?? 'https://api.telegram.org';
  const fetchImpl = options.fetchImpl ?? fetch;
  const notificationURL = options.notificationURL ?? process.env.HIDEOUT_NOTIFICATION_URL;
  const notificationSecret = options.notificationSecret ?? process.env.HIDEOUT_NOTIFICATION_SECRET;
  if (Boolean(notificationURL) !== Boolean(notificationSecret)) {
    throw new Error('HIDEOUT_NOTIFICATION_URL and HIDEOUT_NOTIFICATION_SECRET must both be set');
  }
  const now = options.now ?? (() => Math.floor(Date.now() / 1000));
  const moveNow = options.moveNow ?? (() => performance.now());
  const pickSpawn = options.pickSpawn ?? ((taken, map) => randomSpawn(taken, Math.random, map.spawnArea));
  const gameNow = options.gameNow ?? (() => Date.now());
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

  const packageVersion = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')).version;
  const appVersion = String(options.appVersion ?? process.env.APP_VERSION ?? '').trim() || packageVersion;
  const versionLabel = `v${appVersion}`.replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]);
  const page = readFileSync(new URL('./public/hideout.html', import.meta.url), 'utf8')
    .replaceAll('__APP_VERSION__', () => versionLabel);
  const staticAsset = (file, contentType, cacheControl = 'no-cache') => ({
    contentType,
    cacheControl,
    body: readFileSync(new URL(file, import.meta.url)),
  });
  const textureAsset = name => staticAsset(`./assets/textures/pool_tiles/Tiles132A_1K-JPG_${name}.jpg`, 'image/jpeg', 'public, max-age=86400');
  // Everything under public/js is served as-is (read once at startup), so new modules need no
  // registration. Binary assets outside public/ are listed explicitly and cached for a day.
  const listFiles = directory => readdirSync(new URL(directory, import.meta.url), { withFileTypes: true })
    .flatMap(entry => entry.isDirectory() ? listFiles(`${directory}${entry.name}/`) : [`${directory}${entry.name}`]);
  const iconTypes = { webp: 'image/webp', png: 'image/png', jpg: 'image/jpeg' };
  // One picture per catalog item, WebP preferred over PNG/JPG.
  const iconByID = new Map();
  try {
    const files = readdirSync(new URL('./assets/menu-icons/', import.meta.url), { withFileTypes: true }).filter(entry => entry.isFile());
    for (const extension of ['webp', 'png', 'jpg']) {
      for (const { name } of files) {
        const id = name.slice(0, -extension.length - 1);
        if (name.endsWith(`.${extension}`) && ITEM_BY_ID.has(id) && !iconByID.has(id)) iconByID.set(id, { name, id, type: iconTypes[extension] });
      }
    }
  } catch { /* No menu pictures yet: menus use emoji. */ }
  const menuIcons = [...iconByID.values()];
  const menuIconURLs = Object.fromEntries(menuIcons.map(icon => [icon.id, `/menu-icons/${icon.name}`]));
  const staticAssets = new Map([
    ['/hideout.css', staticAsset('./public/hideout.css', 'text/css; charset=utf-8')],
    ['/branding/gossip-bar-logo.webp', staticAsset('./assets/branding/gossip-bar-logo.webp', 'image/webp', 'public, max-age=86400')],
    ['/branding/roulette-logo.png', staticAsset('./assets/branding/roulette-logo.png', 'image/png', 'public, max-age=86400')],
    ...NEWSPAPER.articles.map(article => [
      article.photo.src, staticAsset(`./assets/news/${article.id}.jpg`, 'image/jpeg', 'public, max-age=86400'),
    ]),
    ...listFiles('./public/js/').filter(file => file.endsWith('.js')).map(file => [
      file.replace('./public', ''), staticAsset(file, 'text/javascript; charset=utf-8'),
    ]),
    ['/textures/pool_tiles/color.jpg', textureAsset('Color')],
    ['/textures/pool_tiles/normal.jpg', textureAsset('NormalGL')],
    ['/textures/pool_tiles/roughness.jpg', textureAsset('Roughness')],
    ...['abstract_cyber_ai_gen', 'geom_face_ai_gen'].map(name => [
      `/paintings/${name}.webp`, staticAsset(`./assets/paintings/${name}.webp`, 'image/webp', 'public, max-age=86400'),
    ]),
    // Optional menu pictures: assets/menu-icons/<item id>.webp|png (originals/ is ignored).
    ...menuIcons.map(({ name, type }) => [`/menu-icons/${name}`, staticAsset(`./assets/menu-icons/${name}`, type, 'public, max-age=86400')]),
    // Jukebox songs and the bar ambience, served with Range support so clients can seek in sync.
    ...[...SONGS.map(song => [song.id, song.file]), ['ambience', AMBIENCE_FILE]].map(([id, file]) => [
      `/music/${id}.mp3`, staticAsset(`./assets/music/${file}`, 'audio/mpeg', 'public, max-age=86400'),
    ]),
    [`/music/${BAND.id}.mp3`, staticAsset(`./assets/band/${BAND.file}`, 'audio/mpeg', 'public, max-age=86400')],
    // Interface sounds: a click when something opens, a bell when a purchase goes through, and a
    // slurp or bite when someone consumes an item.
    ...[['click', 'click(96K).mp3'], ['bell', 'soft-bell(96K).mp3'], ['slurp', 'slurp(96K).mp3'], ['bite', 'bite(96K).mp3'], ['footstep', 'footstep(96K).mp3'],
      ['slot-reel', 'slot-reel(96K).mp3'], ['slot-payout', 'slot-payout(96K).mp3'], ['casino-win', 'casino-win(96K).mp3'],
      ['trumpet-fail', 'trumpet-fail(96K).mp3'], ['holding-paper', 'holding-paper(96K).mp3'],
      ['paper-flip', 'paper-filp(96K).mp3'], ['roulette-button', 'roulette-button(96K).mp3'],
      ['roulette-win', 'slot-payout(96K).mp3'], ['roulette-fail', 'trumpet-fail(96K).mp3'],
      ['roulette-coin', 'roulette-coin(96K).mp3'],
      ['roulette-spin', 'roulette-spin(96K).mp3'], ['roulette-spin-bgm', 'roulette-spin-bgm(96K).mp3']].map(([id, file]) => [
      `/sfx/${id}.mp3`, staticAsset(`./assets/sfx/${file}`, 'audio/mpeg', 'public, max-age=86400'),
    ]),
  ]);
  const server = createServer(async (request, response) => {
    const url = new URL(request.url, 'http://localhost');
    const path = url.pathname;
    const map = mapFromQuery(url.searchParams.get('map'));
    if (['/hideout', '/hideout/', '/auth', '/auth/guest'].includes(path) && !map) {
      response.writeHead(400).end('Unknown map');
      return;
    }
    if (request.method === 'GET' && path === '/') {
      response.writeHead(302, { Location: '/hideout' }).end();
    } else if (request.method === 'GET' && staticAssets.has(path)) {
      const { contentType, cacheControl, body } = staticAssets.get(path);
      const headers = { 'Content-Type': contentType, 'Cache-Control': cacheControl, 'X-Content-Type-Options': 'nosniff', 'Accept-Ranges': 'bytes' };
      const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.range ?? '');
      if (range && (range[1] || range[2])) {
        const start = range[1] ? Number(range[1]) : Math.max(0, body.length - Number(range[2]));
        const end = range[1] && range[2] ? Math.min(Number(range[2]), body.length - 1) : body.length - 1;
        if (start > end || start >= body.length) {
          response.writeHead(416, { 'Content-Range': `bytes */${body.length}` }).end();
          return;
        }
        response.writeHead(206, { ...headers, 'Content-Range': `bytes ${start}-${end}/${body.length}` }).end(body.subarray(start, end + 1));
      } else {
        response.writeHead(200, headers).end(body);
      }
    } else if (request.method === 'GET' && /^\/avatars\/\d+$/.test(path)) {
      const guestSession = guestEnabled && readSessionToken(request.headers['x-debug-guest-token'], botToken, now());
      const session = guestSession?.guest ? guestSession : readSession(request.headers.cookie, botToken, now());
      if (!session || (session.guest && !guestEnabled) || !findPlayer(String(session.id))) {
        response.writeHead(401, { 'Cache-Control': 'no-store' }).end('Room session required');
        return;
      }
      const id = path.slice('/avatars/'.length);
      const player = findPlayer(id);
      if (!player?.avatarURL) { response.writeHead(404).end('Photo unavailable'); return; }
      try {
        const photo = await avatars.get(id, player.photoURL);
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
      if (notificationURL && map.id === 'main') {
        try {
          const notice = await fetchImpl(notificationURL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${notificationSecret}` },
            body: JSON.stringify({ name: user.name }),
            signal: AbortSignal.timeout(10000),
            redirect: 'error',
          });
          await notice.body?.cancel();
          if (!notice.ok) throw new Error(`HTTP ${notice.status}`);
        } catch (error) {
          // A notification outage should not lock members out of the room.
          console.error('Hideout entry notification:', String(error.message).replaceAll(notificationSecret, '[redacted]'));
        }
      }
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
  function createRoom(map) {
    const positions = new Map();
    const players = new Map();
    const movementTimes = new Map();
    const orientationTimes = new Map();

    function broadcast(message, except) {
      // Both boards show the main room's cumulative spending and daily visits.
      if (message.type === 'leaderboard' && map.id !== 'main') return;
      const outgoing = JSON.stringify(message);
      for (const peer of sockets.clients) {
        if ((peer.mapID === map.id || message.type === 'leaderboard') && peer !== except && peer.readyState === WebSocket.OPEN) peer.send(outgoing);
      }
    }

    function sendTo(playerID, message) {
      const outgoing = JSON.stringify(message);
      for (const peer of sockets.clients) {
        if (peer.mapID === map.id && peer.playerID === playerID && peer.readyState === WebSocket.OPEN) peer.send(outgoing);
      }
    }

    const game = createGame({
      mapID: map.id,
      now: gameNow,
      send: sendTo,
      broadcast,
      getPosition: id => players.get(id),
      setPosition(id, x, z) {
        const player = players.get(id);
        const position = positions.get(Number(id));
        for (const target of [player, position]) if (target) Object.assign(target, { x, z });
      },
      getName: id => players.get(id)?.name ?? 'Someone',
    });
    return { positions, players, movementTimes, orientationTimes, game, broadcast };
  }
  const rooms = new Map(Object.values(MAPS).map(map => [map.id, createRoom(map)]));
  function findPlayer(id) {
    for (const room of rooms.values()) {
      if (room.players.has(id)) return room.players.get(id);
    }
    return null;
  }
  const gameTimer = setInterval(() => { for (const room of rooms.values()) room.game.tick(); }, 5000);
  gameTimer.unref();
  server.on('close', () => clearInterval(gameTimer));

  server.on('upgrade', async (request, socket, head) => {
    const url = new URL(request.url, 'http://localhost');
    if (url.pathname !== '/ws') {
      rejectUpgrade(socket, 404, 'Not Found');
      return;
    }
    const map = mapFromQuery(url.searchParams.get('map'));
    if (!map) { rejectUpgrade(socket, 400, 'Unknown map'); return; }
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
      sockets.emit('connection', client, session, map);
    });
  });

  sockets.on('connection', (client, session, map) => {
    const { positions, players, movementTimes, orientationTimes, game, broadcast } = rooms.get(map.id);
    const MOVEMENT_BOUNDS = map.bounds;
    client.mapID = map.id;
    client.on('error', error => console.error('WebSocket:', error.message));
    const playerID = String(session.id);
    const position = positions.get(session.id) ?? pickSpawn([...players.values()], map);
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
    const snapshot = game.join(playerID);
    const { spenders, visitors } = rooms.get('main').game.leaderboard();
    client.send(JSON.stringify({ type: 'welcome', selfID: playerID, players: [...players.values()], game: {
      ...snapshot, spenders, visitors, icons: menuIconURLs,
    } }));
    broadcast({ type: 'player_joined', player }, client);
    if (map.id === 'main') broadcast(game.leaderboard(), client);
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
        peer.mapID === map.id && peer !== client && peer.readyState === WebSocket.OPEN && peer.playerID === playerID);
      if (!stillConnected) {
        players.delete(playerID);
        game.leave(playerID);
        movementTimes.delete(playerID);
        orientationTimes.delete(playerID);
        if (!findPlayer(playerID)) avatars.remove(playerID);
        broadcast({ type: 'player_left', id: playerID });
      }
    });
    client.on('message', (data, isBinary) => {
      if (isBinary) return;
      let message;
      try { message = JSON.parse(data.toString()); } catch { return; }
      if (game.handle(playerID, message)) return;
      let outgoing;
      if (message?.type === 'chat' && typeof message.text === 'string') {
        const text = message.text.trim();
        if (!text || text.length > 500) return;
        if (isAdmin(session) && /^\/cheat\s/i.test(text)) {
          game.cheat(playerID, text.slice(7));
          return;
        }
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
        if (!game.canMove(playerID)) return;
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
        // Clients may report where they predict they are; a stop message (no direction) only syncs.
        const reported = Number.isFinite(message.x) && Number.isFinite(message.z) ? { x: message.x, z: message.z } : null;
        if (!magnitude && !reported) return;
        if (magnitude) game.stand(playerID);
        if (magnitude > 1) {
          forward /= magnitude;
          strafe /= magnitude;
        }
        const time = moveNow();
        const elapsed = time - (movementTimes.get(playerID) ?? -Infinity);
        if (elapsed < 160) return;
        movementTimes.set(playerID, time);
        const previous = { x: position.x, z: position.z };
        // A diagonal is normalized to the same fixed step length as a straight move.
        const step = WALK_SPEED * .2; // One 200 ms movement step.
        const delta = [strafe * step, -forward * step];
        // Rotate the fixed local step around Y; clients cannot choose distance/speed.
        const dx = delta[0] * Math.cos(yaw) + delta[1] * Math.sin(yaw);
        const dz = -delta[0] * Math.sin(yaw) + delta[1] * Math.cos(yaw);
        position.x = Math.max(-MOVEMENT_BOUNDS.halfWidth, Math.min(MOVEMENT_BOUNDS.halfWidth, Math.round((position.x + dx) * 1e6) / 1e6));
        position.z = Math.max(-MOVEMENT_BOUNDS.halfDepth, Math.min(MOVEMENT_BOUNDS.halfDepth, Math.round((position.z + dz) * 1e6) / 1e6));
        // Trust the client's own position when it is reachable at walking speed since the last
        // accepted move, so the server and the player's view never drift apart. Anything
        // further (teleports, speed hacks) falls back to the fixed step above.
        if (reported) {
          // Never contradict the client (that is what makes players rubber-band): move to the
          // reported spot, or as far toward it as walking speed allows, so a lagging or bursty
          // client is caught up with over the next messages instead of being sent elsewhere.
          const allowed = WALK_SPEED * 1.2 * Math.min(elapsed, 400) / 1000 + .05;
          const distance = Math.hypot(reported.x - previous.x, reported.z - previous.z);
          const reach = distance > allowed ? allowed / distance : 1;
          const x = previous.x + (reported.x - previous.x) * reach;
          const z = previous.z + (reported.z - previous.z) * reach;
          position.x = Math.max(-MOVEMENT_BOUNDS.halfWidth, Math.min(MOVEMENT_BOUNDS.halfWidth, Math.round(x * 1e6) / 1e6));
          position.z = Math.max(-MOVEMENT_BOUNDS.halfDepth, Math.min(MOVEMENT_BOUNDS.halfDepth, Math.round(z * 1e6) / 1e6));
        }
        player.x = position.x;
        player.z = position.z;
        position.yaw = player.yaw = yaw;
        const direction = forward > 0 ? 'up' : forward < 0 ? 'down' : strafe > 0 ? 'right' : strafe < 0 ? 'left' : 'stop';
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
