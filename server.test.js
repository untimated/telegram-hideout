import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { once } from 'node:events';
import { WebSocket } from 'ws';
import { createHideoutServer } from './server.js';

const botToken = '123:test-token';
const now = 1_800_000_000;

function signedInitData(id, name = 'Alice') {
  const params = new URLSearchParams({
    auth_date: String(now),
    user: JSON.stringify({ id, first_name: name, username: name.toLowerCase() }),
  });
  const check = [...params].sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => `${key}=${value}`).join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(botToken).digest();
  params.set('hash', createHmac('sha256', secret).update(check).digest('hex'));
  return params.toString();
}

test('only signed group members can connect and relay chat under their verified names', { timeout: 10000 }, async t => {
  const members = new Map([
    ['-100123:1', 'member'],
    ['-100456:2', 'administrator'],
  ]);
  const calls = [];
  let moveTime = 0;
  const photoCalls = [];
  const photoBytes = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64');
  const { server, sockets } = createHideoutServer({
    botToken,
    groupID: '-100123, -100456',
    debugGuestUsername: 'debug',
    debugGuestPassword: 'secret',
    now: () => now,
    moveNow: () => moveTime,
    fetchImpl: async (url, options) => {
      if (!url.endsWith('/getChatMember')) {
        photoCalls.push(url);
        if (url.endsWith('/getUserProfilePhotos')) {
          const id = JSON.parse(options.body).user_id;
          return Response.json({ ok: true, result: { photos: id === 1 ? [[{ width: 160, file_id: 'photo-1' }]] : [] } });
        }
        if (url.endsWith('/getFile')) return Response.json({ ok: true, result: { file_path: 'photos/alice.png' } });
        assert.equal(url, `https://api.telegram.org/file/bot${botToken}/photos/alice.png`);
        return new Response(photoBytes, { headers: { 'Content-Type': 'application/octet-stream' } });
      }
      const request = JSON.parse(options.body);
      calls.push(request);
      return new Response(JSON.stringify({ ok: true, result: { status: members.get(`${request.chat_id}:${request.user_id}`) ?? 'left' } }), {
        headers: { 'Content-Type': 'application/json' },
      });
    },
  });
  t.after(async () => {
    for (const client of sockets.clients) client.terminate();
    sockets.close();
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `127.0.0.1:${server.address().port}`;
  const origin = `http://${base}`;
  const page = await fetch(`${origin}/hideout`);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /telegram-web-app.js/);
  const guestAuthorization = `Basic ${Buffer.from('debug:secret').toString('base64')}`;
  const guestChallenge = await fetch(`${origin}/hideout?guest=1`);
  assert.equal(guestChallenge.status, 401);
  assert.match(guestChallenge.headers.get('www-authenticate'), /Hideout Debug/);
  assert.equal((await fetch(`${origin}/hideout?guest=1`, {
    headers: { Authorization: guestAuthorization },
  })).status, 200);

  async function auth(initData) {
    return fetch(`${origin}/auth`, {
      method: 'POST',
      headers: { Origin: origin, 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData }),
    });
  }
  function connect(cookie) {
    return new WebSocket(`ws://${base}/ws`, { headers: { Origin: origin, ...(cookie ? { Cookie: cookie } : {}) } });
  }
  async function refused(socket, expected) {
    const [error] = await once(socket, 'error');
    assert.match(error.message, new RegExp(`Unexpected server response: ${expected}`));
  }

  await refused(connect(), 401);
  assert.equal((await auth('bad')).status, 401);
  assert.equal((await auth(signedInitData(3))).status, 403);
  const tampered = signedInitData(1).replace('alice', 'mallory');
  assert.equal((await auth(tampered)).status, 401);

  const aAuth = await auth(signedInitData(1));
  const bAuth = await auth(signedInitData(2, 'Bob'));
  assert.equal(aAuth.status, 200);
  assert.equal(bAuth.status, 200);
  const aCookie = aAuth.headers.get('set-cookie').split(';')[0];
  const bCookie = bAuth.headers.get('set-cookie').split(';')[0];
  assert.match(aAuth.headers.get('set-cookie'), /HttpOnly; Secure; SameSite=Strict/);
  await refused(connect(`${aCookie}x`), 401);
  await refused(new WebSocket(`ws://${base}/ws`, { headers: { Origin: 'https://other.example', Cookie: aCookie } }), 401);

  assert.equal((await fetch(`${origin}/auth/guest`, {
    method: 'POST',
    headers: { Origin: origin, Authorization: `Basic ${Buffer.from('debug:wrong').toString('base64')}` },
  })).status, 401);
  const callsBeforeGuest = calls.length;
  const guestAuth = await fetch(`${origin}/auth/guest`, {
    method: 'POST',
    headers: { Origin: origin, Authorization: guestAuthorization },
  });
  assert.equal(guestAuth.status, 200);
  const guestCookie = guestAuth.headers.get('set-cookie').split(';')[0];
  const guest = connect(guestCookie);
  assert.deepEqual(JSON.parse((await once(guest, 'message'))[0].toString()), {
    type: 'welcome',
    selfID: String(Number.MAX_SAFE_INTEGER),
    players: [{ id: String(Number.MAX_SAFE_INTEGER), name: 'Guest', photoURL: null, avatarURL: null, x: 0, z: 0 }],
  });
  guest.send(JSON.stringify({ type: 'move', direction: 'left' }));
  assert.deepEqual(JSON.parse((await once(guest, 'message'))[0].toString()), {
    type: 'move', id: String(Number.MAX_SAFE_INTEGER), name: 'Guest', direction: 'left', x: -0.1, z: 0,
  });
  assert.equal(calls.length, callsBeforeGuest);
  const guestClosed = once(guest, 'close');
  guest.terminate();
  await guestClosed;

  const a = connect(aCookie);
  const welcomeA = JSON.parse((await once(a, 'message'))[0].toString());
  const bobJoined = once(a, 'message');
  const b = connect(bCookie);
  const welcomeB = JSON.parse((await once(b, 'message'))[0].toString());
  assert.deepEqual(welcomeA, {
    type: 'welcome',
    selfID: '1',
    players: [{ id: '1', name: '@alice', photoURL: null, avatarURL: '/avatars/1', x: 0, z: 0 }],
  });
  assert.deepEqual(welcomeB, {
    type: 'welcome',
    selfID: '2',
    players: [
      { id: '1', name: '@alice', photoURL: null, avatarURL: '/avatars/1', x: 0, z: 0 },
      { id: '2', name: '@bob', photoURL: null, avatarURL: '/avatars/2', x: -1.5, z: 0.8 },
    ],
  });
  assert.deepEqual(JSON.parse((await bobJoined)[0].toString()), {
    type: 'player_joined',
    player: { id: '2', name: '@bob', photoURL: null, avatarURL: '/avatars/2', x: -1.5, z: 0.8 },
  });

  assert.equal((await fetch(`${origin}/avatars/1`)).status, 401);
  const avatar = await fetch(`${origin}/avatars/1`, { headers: { Cookie: bCookie } });
  assert.equal(avatar.status, 200);
  assert.equal(avatar.headers.get('content-type'), 'image/png');
  assert.deepEqual(Buffer.from(await avatar.arrayBuffer()), photoBytes);
  assert.equal(photoCalls.length, 3);
  await fetch(`${origin}/avatars/1`, { headers: { Cookie: bCookie } });
  assert.equal(photoCalls.length, 3, 'avatar bytes are cached server-side');
  assert.equal((await fetch(`${origin}/avatars/2`, { headers: { Cookie: aCookie } })).status, 404);
  assert.equal((await fetch(`${origin}/avatars/999`, { headers: { Cookie: aCookie } })).status, 404);

  for (const [sender, name, text] of [[a, '@alice', 'hello from A'], [b, '@bob', 'hello from B']]) {
    const received = Promise.all([once(a, 'message'), once(b, 'message')]);
    sender.send(JSON.stringify({ type: 'chat', text, name: 'spoofed name' }));
    for (const [data] of await received) {
      assert.deepEqual(JSON.parse(data.toString()), { type: 'chat', id: name === '@alice' ? '1' : '2', name, text });
    }
  }
  for (const [direction, x, z] of [['right', 0.1, 0], ['up', 0.1, -0.1]]) {
    moveTime += 150;
    const registered = Promise.all([once(a, 'message'), once(b, 'message')]);
    a.send(JSON.stringify({ type: 'move', direction, x: 999, z: 999 }));
    for (const [data] of await registered) {
      assert.deepEqual(JSON.parse(data.toString()), { type: 'move', id: '1', name: '@alice', direction, x, z });
    }
  }
  // A burst and malformed headings cannot grant extra movement. WebSocket ordering
  // means the next delivered message must be this chat barrier on both clients.
  const barrier = Promise.all([once(a, 'message'), once(b, 'message')]);
  a.send(JSON.stringify({ type: 'move', direction: 'right' }));
  a.send(JSON.stringify({ type: 'move', direction: 'right', yaw: 'bad' }));
  a.send(JSON.stringify({ type: 'move', direction: 'right', yaw: 99 }));
  a.send(JSON.stringify({ type: 'chat', text: 'barrier' }));
  for (const [data] of await barrier) assert.equal(JSON.parse(data).type, 'chat');

  for (const [yaw, direction, x, z] of [
    [-Math.PI / 2, 'up', .2, -.1],
    [-Math.PI / 2, 'right', .2, 0],
    [Math.PI / 4, 'up', .129289, -.070711],
  ]) {
    moveTime += 150;
    const received = Promise.all([once(a, 'message'), once(b, 'message')]);
    a.send(JSON.stringify({ type: 'move', direction, yaw, x: 999, z: 999 }));
    for (const [data] of await received) {
      const registered = JSON.parse(data);
      assert.equal(registered.x, x);
      assert.equal(registered.z, z);
    }
  }
  let boundaryMove;
  for (let step = 0; step < 45; step += 1) {
    moveTime += 150;
    const registered = once(a, 'message');
    a.send(JSON.stringify({ type: 'move', direction: 'right' }));
    boundaryMove = JSON.parse((await registered)[0].toString());
  }
  assert.equal(boundaryMove.x, 4);
  assert.equal(boundaryMove.z, -.070711);
  members.set('-100123:1', 'left');
  await refused(connect(aCookie), 403);
  assert.deepEqual(new Set(calls.map(call => call.chat_id)), new Set(['-100123', '-100456']));
  assert.ok(calls.some(call => call.chat_id === '-100456' && call.user_id === 2));
  a.terminate();
  b.terminate();
});

test('rejects malformed group ID lists at startup', () => {
  for (const groupID of ['', '-100123,', '-100123,abc']) {
    assert.throws(() => createHideoutServer({ botToken, groupID }), /ALLOWED_GROUP_ID/);
  }
  assert.throws(() => createHideoutServer({
    botToken,
    groupID: '-100123',
    debugGuestUsername: 'debug',
  }), /DEBUG_GUEST/);
});
