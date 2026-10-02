import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { WebSocket } from 'ws';
import { createGame } from './game.js';
import { createHideoutServer } from './server.js';
import { makeSession } from './auth.js';
import { BAND, JUKEBOX } from './public/js/game/catalog.js';

const EVENING = Date.UTC(2026, 9, 2, 11); // 18:00 in Hideout time.

function setup(mapID = 'main') {
  const clock = { now: EVENING };
  const events = [];
  const inbox = new Map();
  const positions = new Map(['a', 'b'].map(id => [id, { x: BAND.x, z: BAND.z - 2 }]));
  const game = createGame({ mapID, now: () => clock.now,
    send: (id, message) => inbox.set(id, [...(inbox.get(id) ?? []), message]),
    broadcast: message => events.push(message), getPosition: id => positions.get(id), getName: id => id,
  });
  game.join('a'); game.join('b');
  return { game, clock, events, inbox, positions };
}

test('one band payment starts one shared song and the lock lasts to the exact end', () => {
  const { game, clock, events, inbox, positions } = setup();
  game.handle('a', { type: 'band_play', price: 0, duration: 1, song: 'anything' });
  const performance = game.snapshot('a').band;
  assert.deepEqual(performance, { startedAt: EVENING, byID: 'a', by: 'a' });
  assert.equal(game.snapshot('a').self.coins, 85);
  assert.equal(game.snapshot('b').self.coins, 100);
  game.handle('a', { type: 'band_play' });
  game.handle('b', { type: 'band_play' });
  assert.equal(game.handle('a', { type: 'band_stop' }), false);
  assert.deepEqual(game.snapshot('a').band, performance);
  game.leave('a');
  assert.deepEqual(game.join('a').band, performance);
  assert.equal(game.join('a').self.coins, 85);
  positions.set('a', JUKEBOX);
  game.handle('a', { type: 'jukebox_play', song: 'summer-walk' });
  assert.match(inbox.get('a').at(-1).text, /live band finish/);
  assert.equal(game.snapshot('a').jukebox, null);
  assert.equal(game.snapshot('a').self.coins, 85);
  clock.now = EVENING + BAND.duration * 1000 - 1;
  game.handle('b', { type: 'band_play' });
  assert.equal(events.filter(event => event.type === 'band').length, 1);
  clock.now += 1;
  game.handle('b', { type: 'band_play' }); // Allowed before the maintenance tick clears the old song.
  assert.equal(game.snapshot('b').self.coins, 85);
  assert.equal(events.filter(event => event.type === 'band').length, 2);
  clock.now += BAND.duration * 1000;
  game.tick();
  assert.equal(game.snapshot('a').band, null);
  assert.deepEqual(events.filter(event => event.type === 'band').at(-1), { type: 'band', band: null });
});

test('band guards reject absent, distant, asleep, poor and prototype requests without charging', () => {
  for (const condition of ['off-shift', 'far', 'asleep', 'poor', 'prototype']) {
    const { game, clock, events, inbox, positions } = setup(condition === 'prototype' ? 'prototype' : 'main');
    if (condition === 'off-shift') clock.now = EVENING - 2 * 3600_000;
    if (condition === 'far') positions.set('a', { x: -5, z: -5 });
    if (condition === 'poor') game.cheat('a', 'money -86');
    if (condition === 'asleep') game.handle('a', { type: 'restore', coins: 100, drunk: 1, fuel: 1, dayKey: game.snapshot('a').self.dayKey });
    const before = game.snapshot('a').self.coins;
    game.handle('a', { type: 'band_play' });
    assert.equal(game.snapshot('a').self.coins, before);
    assert.equal(game.snapshot('a').band, null);
    assert.equal(events.filter(event => event.type === 'band').length, 0);
    assert.equal(inbox.get('a').at(-1).type, 'notice');
  }
});

test('a paid song runs past closing time but another performance waits for the next shift', () => {
  const { game, clock, events } = setup();
  clock.now = Date.UTC(2026, 9, 2, 15, 59); // 22:59 in Hideout time.
  game.handle('a', { type: 'band_play' });
  const performance = game.snapshot('a').band;
  clock.now += 60000;
  game.tick();
  assert.deepEqual(game.snapshot('a').band, performance);
  clock.now = performance.startedAt + BAND.duration * 1000;
  game.tick();
  assert.equal(game.snapshot('a').band, null);
  game.handle('b', { type: 'band_play' });
  assert.equal(game.snapshot('b').self.coins, 100);
  assert.equal(events.filter(event => event.type === 'band' && event.band).length, 1);
});

test('band audio supports seeking and WebSocket performances reach only the bar, including reconnects', { timeout: 10000 }, async t => {
  const botToken = 'band-test-token';
  const authNow = 1800000000;
  let gameNow = EVENING;
  const { server, sockets } = createHideoutServer({ botToken, groupID: '-100123', now: () => authNow,
    gameNow: () => gameNow, pickSpawn: () => ({ x: BAND.x, z: BAND.z - 2 }),
    fetchImpl: async () => Response.json({ ok: true, result: { status: 'member' } }),
  });
  t.after(async () => {
    for (const socket of sockets.clients) socket.terminate();
    sockets.close(); server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const host = `127.0.0.1:${server.address().port}`;
  const song = await fetch(`http://${host}/music/${BAND.id}.mp3`, { headers: { Range: 'bytes=1000-1999' } });
  assert.equal(song.status, 206);
  assert.equal(song.headers.get('content-type'), 'audio/mpeg');
  assert.match(song.headers.get('content-range'), /^bytes 1000-1999\/\d+$/);
  assert.equal((await song.arrayBuffer()).byteLength, 1000);
  async function connect(id, map) {
    const client = new WebSocket(`ws://${host}/ws?map=${map}`, { origin: `http://${host}`,
      headers: { Cookie: `hideout_session=${makeSession({ id, name: `Player ${id}` }, botToken, authNow)}` },
    });
    const messages = [];
    client.on('message', data => messages.push(JSON.parse(data)));
    const [data] = await once(client, 'message');
    return { client, messages, welcome: JSON.parse(data) };
  }
  function receive(peer, type) {
    return new Promise(resolve => {
      const handler = data => {
        const message = JSON.parse(data);
        if (message.type !== type) return;
        peer.client.off('message', handler); resolve(message);
      };
      peer.client.on('message', handler);
    });
  }
  const prototype = await connect(1, 'prototype');
  const player = await connect(1, 'main');
  const spectator = await connect(2, 'main');
  const started = receive(player, 'band');
  const heard = receive(spectator, 'band');
  player.client.send(JSON.stringify({ type: 'band_play' }));
  const performance = (await started).band;
  assert.deepEqual((await heard).band, performance);
  assert.equal(player.messages.filter(message => message.type === 'self').at(-1).coins, 85);
  const rejected = receive(spectator, 'notice');
  spectator.client.send(JSON.stringify({ type: 'band_play' }));
  assert.match((await rejected).text, /live band finish/);
  const absent = receive(prototype, 'notice');
  prototype.client.send(JSON.stringify({ type: 'band_play' }));
  assert.match((await absent).text, /not in this map/);
  assert.equal(prototype.messages.filter(message => message.type === 'band').length, 0);
  gameNow += 45000;
  const reconnect = await connect(1, 'main');
  assert.equal(reconnect.welcome.game.self.coins, 85);
  assert.equal(reconnect.welcome.game.serverTime - performance.startedAt, 45000);
  assert.deepEqual(reconnect.welcome.game.band, performance);
});
