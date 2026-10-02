import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { WebSocket } from 'ws';
import { createHideoutServer } from './server.js';
import { makeSession } from './auth.js';
import { MAPS, mapFromQuery } from './public/js/maps.js';
import { createWalletStore } from './public/js/wallet-store.js';

test('map lookup keeps old links and rejects unknown names', () => {
  assert.equal(mapFromQuery(null), MAPS.main);
  assert.equal(mapFromQuery(''), MAPS.main);
  assert.equal(mapFromQuery('prototype'), MAPS.prototype);
  assert.equal(mapFromQuery('unknown'), null);
  assert.equal(mapFromQuery('__proto__'), null);
});

test('main and prototype isolate presence, chat, movement, wallets and reconnects', { timeout: 10000 }, async t => {
  const botToken = 'test-token';
  const now = 1_800_000_000;
  let moveTime = 0;
  const { server, sockets } = createHideoutServer({
    botToken, groupID: '-100123', adminIDs: '1', now: () => now, moveNow: () => moveTime,
    fetchImpl: async () => Response.json({ ok: true, result: { status: 'member' } }),
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
  for (const path of ['/hideout?map=prototype', '/hideout?map=main', '/js/maps.js', '/js/stage/prototype.js']) {
    assert.equal((await fetch(origin + path)).status, 200);
  }
  for (const path of ['/hideout?map=missing', '/hideout/?map=missing']) {
    assert.equal((await fetch(origin + path)).status, 400);
  }
  assert.equal((await fetch(`${origin}/auth?map=missing`, { method: 'POST' })).status, 400);
  const invalid = new WebSocket(`ws://${base}/ws?map=missing`, { origin });
  invalid.on('error', () => {});
  const rejected = await once(invalid, 'unexpected-response');
  assert.equal(rejected[1].statusCode, 400);
  rejected[1].resume();
  invalid.terminate();

  async function connect(id, map) {
    const client = new WebSocket(`ws://${base}/ws${map ? `?map=${map}` : ''}`, {
      origin, headers: { Cookie: `hideout_session=${makeSession({ id, name: `Player ${id}` }, botToken, now)}` },
    });
    const messages = [];
    client.on('message', data => messages.push(JSON.parse(data)));
    const [data] = await once(client, 'message');
    return { client, messages, welcome: JSON.parse(data) };
  }
  async function sendAndReceive(peer, message, type = message.type) {
    const received = new Promise(resolve => {
      const handler = data => {
        const incoming = JSON.parse(data);
        if (incoming.type === type) { peer.client.off('message', handler); resolve(incoming); }
      };
      peer.client.on('message', handler);
    });
    peer.client.send(JSON.stringify(message));
    return received;
  }
  const main = await connect(1);
  const proto = await connect(1, 'prototype');
  const friend = await connect(2, 'prototype');
  assert.deepEqual(main.welcome.players.map(player => player.id), ['1']);
  assert.deepEqual(proto.welcome.players.map(player => player.id), ['1']);
  assert.deepEqual(friend.welcome.players.map(player => player.id), ['1', '2']);
  const mainSpawn = main.welcome.players[0];
  const protoSpawn = proto.welcome.players[0];
  assert.ok(mainSpawn.x >= MAPS.main.spawnArea.x0 && mainSpawn.x <= MAPS.main.spawnArea.x1);
  assert.ok(protoSpawn.x >= MAPS.prototype.spawnArea.x0 && protoSpawn.x <= MAPS.prototype.spawnArea.x1);

  const chat = await sendAndReceive(proto, { type: 'chat', text: 'prototype only' });
  assert.equal(chat.text, 'prototype only');
  const money = await sendAndReceive(proto, { type: 'chat', text: '/cheat money 40' }, 'self');
  assert.equal(money.type, 'self');
  assert.equal(money.coins, 140);
  moveTime = 200;
  // Cheat emits a second notice; wait for the move type rather than the next frame.
  const moved = new Promise(resolve => {
    const handler = data => {
      const message = JSON.parse(data);
      if (message.type === 'move') { proto.client.off('message', handler); resolve(message); }
    };
    proto.client.on('message', handler);
  });
  proto.client.send(JSON.stringify({ type: 'move', direction: 'up' }));
  const move = await moved;
  assert.equal(move.z, Math.round((protoSpawn.z - .3) * 1e6) / 1e6);
  const joinedAgain = await connect(1, 'main');
  assert.equal(joinedAgain.welcome.game.self.coins, 100);
  assert.equal(joinedAgain.welcome.players[0].z, mainSpawn.z);
  const prototypeAgain = await connect(1, 'prototype');
  assert.equal(prototypeAgain.welcome.game.self.coins, 140);
  assert.equal(prototypeAgain.welcome.players[0].z, move.z);
  const denied = await sendAndReceive(prototypeAgain, { type: 'sit', seat: 'bar:0' }, 'notice');
  assert.equal(denied.type, 'notice');
  assert.match(denied.text, /not in this map/);

  prototypeAgain.client.close();
  await once(prototypeAgain.client, 'close');
  proto.client.close();
  await once(proto.client, 'close');
  // A round trip through the surviving prototype client flushes the disconnect broadcast.
  const response = await sendAndReceive(friend, { type: 'chat', text: 'still here' });
  assert.ok(['player_left', 'chat'].includes(response.type));
  await new Promise(resolve => setTimeout(resolve, 30));
  assert.ok(friend.messages.some(message => message.type === 'player_left' && message.id === '1'));
  assert.ok(friend.messages.some(message => message.type === 'chat' && message.text === 'prototype only'));
  assert.equal(main.messages.some(message => ['chat', 'move', 'self', 'player_left'].includes(message.type)), false);
  assert.equal(main.messages.some(message => message.type === 'player_joined' && message.player.id === '2'), false);
});

test('prototype wallet storage cannot overwrite the main wallet', async t => {
  const previousWindow = globalThis.window;
  const previousStorage = globalThis.localStorage;
  t.after(() => { globalThis.window = previousWindow; globalThis.localStorage = previousStorage; });
  const storage = new Map();
  globalThis.window = {};
  globalThis.localStorage = { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value) };
  const main = createWalletStore();
  const prototype = createWalletStore('prototype');
  main.save('1', { coins: 77 });
  prototype.save('1', { coins: 500 });
  assert.deepEqual(await main.load('1'), { coins: 77 });
  assert.deepEqual(await prototype.load('1'), { coins: 500 });
  assert.ok(storage.has('hideout.wallet.1'));
  assert.ok(storage.has('hideout.wallet.prototype.1'));
  const cloudKeys = [];
  globalThis.window = { Telegram: { WebApp: {
    initData: 'signed', isVersionAtLeast: () => true,
    CloudStorage: { getItem: (key, callback) => { cloudKeys.push(key); callback(null, null); } },
  } } };
  await createWalletStore().load('1');
  await createWalletStore('prototype').load('1');
  assert.deepEqual(cloudKeys, ['hideout_wallet', 'hideout_wallet_prototype']);
});
