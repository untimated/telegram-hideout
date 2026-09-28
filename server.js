import { createServer } from 'node:http';
import { createHash, timingSafeEqual } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { WebSocket, WebSocketServer } from 'ws';
import { makeSession, readSession, sessionCookie, verifyInitData } from './auth.js';

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
  const server = createServer(async (request, response) => {
    const url = new URL(request.url, 'http://localhost');
    const path = url.pathname;
    if (request.method === 'GET' && path === '/') {
      response.writeHead(302, { Location: '/hideout' }).end();
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
      response.writeHead(200, {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
        'Set-Cookie': sessionCookie(makeSession({ id: Number.MAX_SAFE_INTEGER, name: 'Guest', guest: true }, botToken, now())),
      }).end(JSON.stringify({ name: 'Guest' }));
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
  const sockets = new WebSocketServer({ noServer: true, maxPayload: 8192 });
  const positions = new Map();

  server.on('upgrade', async (request, socket, head) => {
    if (new URL(request.url, 'http://localhost').pathname !== '/ws') {
      rejectUpgrade(socket, 404, 'Not Found');
      return;
    }
    const session = sameOrigin(request) && readSession(request.headers.cookie, botToken, now());
    if (!session) { rejectUpgrade(socket, 401, 'Unauthorized'); return; }
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
    const position = positions.get(session.id) ?? { x: 0, z: 0 };
    positions.set(session.id, position);
    client.send(JSON.stringify({ type: 'welcome', name: session.name, position }));
    const expiration = setTimeout(() => client.close(1008, 'Session expired'), Math.max(0, (session.exp - now()) * 1000));
    const membership = session.guest ? null : setInterval(async () => {
      try {
        if (!await isGroupMember(session.id)) client.close(1008, 'Group membership required');
      } catch (error) {
        console.error('Membership check:', error.message);
        client.close(1013, 'Membership check unavailable');
      }
    }, 5 * 60 * 1000);
    client.on('close', () => { clearTimeout(expiration); clearInterval(membership); });
    client.on('message', (data, isBinary) => {
      if (isBinary) return;
      let message;
      try { message = JSON.parse(data.toString()); } catch { return; }
      let outgoing;
      if (message?.type === 'chat' && typeof message.text === 'string') {
        const text = message.text.trim();
        if (!text || text.length > 500) return;
        outgoing = JSON.stringify({ type: 'chat', name: session.name, text });
      } else if (message?.type === 'move' && ['up', 'down', 'left', 'right'].includes(message.direction)) {
        const delta = {
          up: [0, -0.1],
          down: [0, 0.1],
          left: [-0.1, 0],
          right: [0.1, 0],
        }[message.direction];
        position.x = Math.round((position.x + delta[0]) * 10) / 10;
        position.z = Math.round((position.z + delta[1]) * 10) / 10;
        outgoing = JSON.stringify({
          type: 'move',
          name: session.name,
          direction: message.direction,
          x: position.x,
          z: position.z,
        });
      } else {
        return;
      }
      for (const peer of sockets.clients) {
        if (peer.readyState === WebSocket.OPEN) peer.send(outgoing);
      }
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
