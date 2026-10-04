import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { WebSocket } from 'ws';
import { createGame } from './game.js';
import { createHideoutServer } from './server.js';
import { makeSession } from './auth.js';
import { BAND, JUKEBOX } from './public/js/game/catalog.js';
import { SLOTS } from './public/js/game/slots.js';

const EVENING = Date.UTC(2026, 9, 3, 11);

function setup(chance = .1) {
  const clock = { now: EVENING };
  const events = [];
  const names = new Map([['a', 'Alice'], ['b', 'Bob'], ['guest', 'Guest 1'], ['samantha', 'Samantha']]);
  const positions = new Map();
  const game = createGame({ now: () => clock.now, random: () => chance,
    send() {}, broadcast: message => events.push(message),
    getName: id => names.get(id) ?? id, getPosition: id => positions.get(id),
  });
  const backup = (id, spent) => game.handle(id, {
    type: 'restore', coins: 100, drunk: 0, fuel: 1, dayKey: '2026-10-03', spent,
  });
  return { game, clock, events, names, positions, backup };
}

test('spending counts successful orders, songs, performances and gross bets once', () => {
  const { game, positions, events } = setup();
  game.join('a');
  assert.equal(game.snapshot('a').self.spent, 0);
  positions.set('a', { x: -3.4, z: -3 });
  game.handle('a', { type: 'buy', item: 'pint-of-beer', spent: 9999, price: 0 });
  assert.equal(game.snapshot('a').self.spent, 20);
  const served = events.find(event => event.type === 'item_added').item;
  game.handle('a', { type: 'consume', id: served.id });
  positions.set('a', JUKEBOX);
  game.handle('a', { type: 'jukebox_play', song: 'summer-walk' });
  positions.set('a', BAND);
  game.handle('a', { type: 'band_play' });
  assert.equal(game.snapshot('a').self.spent, 20 + 10 + BAND.price);
  positions.set('a', SLOTS);
  game.handle('a', { type: 'arcade_spin', bet: 7 });
  const state = game.snapshot('a');
  assert.equal(state.self.spent, 20 + 10 + BAND.price + 7);
  assert.equal(state.self.coins, 100 - state.self.spent + 21, 'a winning bet still counts its full cost');
  game.handle('a', { type: 'arcade_spin', bet: 7 });
  assert.equal(game.snapshot('a').self.spent, state.self.spent, 'cooldown rejects duplicate charges');
  assert.deepEqual(events.filter(event => event.type === 'leaderboard').at(-1).spenders, state.spenders);
});

test('transfers, cheats, refills and rejected orders do not count as spending', () => {
  const { game, positions, clock, events } = setup();
  game.join('a'); game.join('b');
  game.handle('a', { type: 'transfer', to: 'b', amount: 40 });
  game.cheat('a', 'money -50');
  positions.set('a', { x: -3.4, z: -3 });
  game.handle('a', { type: 'buy', item: 'pint-of-beer' }); // Only ten coins left.
  positions.set('b', { x: 100, z: 100 });
  game.handle('b', { type: 'buy', item: 'pint-of-beer' });
  clock.now += 24 * 3600_000;
  game.tick();
  assert.equal(game.snapshot('a').self.spent, 0);
  assert.equal(game.snapshot('b').self.spent, 0);
  assert.deepEqual(game.topSpenders(), []);
  assert.equal(events.filter(event => event.type === 'leaderboard').length, 0);
});

test('rankings include guests, exclude NPCs, retain offline names and limit to five with stable ties', () => {
  const { game, backup, names } = setup();
  for (const [id, spent] of [['a', 30], ['b', 30], ['guest', 40], ['samantha', 1000], ['c', 20], ['d', 10], ['e', 5], ['zero', 0]]) {
    game.join(id); backup(id, spent);
  }
  game.leave('guest'); names.delete('guest');
  assert.deepEqual(game.topSpenders().map(entry => entry.id), ['guest', 'a', 'b', 'c', 'd']);
  assert.equal(game.topSpenders()[0].name, 'Guest 1');
  names.set('a', 'Alice Updated');
  game.leave('a');
  assert.equal(game.join('a').spenders.find(entry => entry.id === 'a').name, 'Alice Updated');
});

test('saved spending restores once, accepts old wallets and survives day rollovers', () => {
  const { game, backup, clock } = setup();
  game.join('a'); backup('a', 1250);
  backup('a', 9999);
  assert.equal(game.snapshot('a').self.spent, 1250);
  game.leave('a');
  assert.equal(game.join('a').self.spent, 1250);
  clock.now += 24 * 3600_000;
  game.tick();
  assert.equal(game.snapshot('a').self.spent, 1250);
  const restarted = setup();
  restarted.game.join('a'); restarted.backup('a', 1250);
  assert.equal(restarted.game.topSpenders()[0].spent, 1250);
  game.join('b'); backup('b', undefined);
  assert.equal(game.snapshot('b').self.spent, 0, 'old backups start at zero');
});

test('invalid spending backups are rejected and cannot overwrite accepted server spending', () => {
  for (const spent of [-1, 1.5, '50', null, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    const { game, backup } = setup();
    game.join('a'); backup('a', spent);
    assert.equal(game.snapshot('a').self.spent, 0);
    backup('a', 50);
    assert.equal(game.snapshot('a').self.spent, 50, 'invalid backup does not consume the restore');
  }
  const { game, backup, positions } = setup();
  game.join('a'); positions.set('a', SLOTS);
  game.handle('a', { type: 'arcade_spin', bet: 7 });
  backup('a', 9999);
  assert.equal(game.snapshot('a').self.spent, 7);
});

test('prototype board receives main-room guest spending live and in reconnect snapshots', { timeout: 10000 }, async t => {
  const botToken = 'leaderboard-test-token';
  const now = Math.floor(EVENING / 1000);
  const { server, sockets } = createHideoutServer({ botToken, groupID: '-100123', now: () => now,
    debugGuestUsername: 'debug', debugGuestPassword: 'secret', gameNow: () => EVENING,
    pickSpawn: () => ({ x: SLOTS.x + 1.6, z: SLOTS.z }),
    fetchImpl: async () => Response.json({ ok: true, result: { status: 'member' } }),
  });
  t.after(async () => {
    for (const client of sockets.clients) client.terminate();
    sockets.close(); server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const host = `127.0.0.1:${server.address().port}`;
  const origin = `http://${host}`;
  async function connect(map, token, id = 1) {
    const options = { origin, headers: token ? {} : {
      Cookie: `hideout_session=${makeSession({ id, name: `Player ${id}` }, botToken, now)}`,
    } };
    const client = token
      ? new WebSocket(`ws://${host}/ws?map=${map}`, ['hideout-guest', `guest.${token}`], options)
      : new WebSocket(`ws://${host}/ws?map=${map}`, options);
    const [data] = await once(client, 'message');
    return { client, welcome: JSON.parse(data) };
  }
  const receive = (client, type, matches = () => true) => new Promise(resolve => {
    const handler = data => {
      const message = JSON.parse(data);
      if (message.type === type && matches(message)) { client.off('message', handler); resolve(message); }
    };
    client.on('message', handler);
  });
  const board = await connect('prototype');
  assert.deepEqual(board.welcome.game.spenders, []);
  const response = await fetch(`${origin}/auth/guest?map=main`, { method: 'POST', headers: {
    Origin: origin, Authorization: `Basic ${Buffer.from('debug:secret').toString('base64')}`,
  } });
  assert.equal(response.status, 200);
  const guest = await response.json();
  const visit = receive(board.client, 'leaderboard', message => message.visitors.some(entry => entry.name === guest.name));
  const spender = await connect('main', guest.guestToken);
  const guestVisitor = { id: spender.welcome.selfID, name: guest.name, visits: 1 };
  assert.deepEqual((await visit).visitors, [guestVisitor]);
  assert.equal(spender.welcome.game.self.lastVisitAt, EVENING);
  const spectator = await connect('main', null, 2);
  const observed = receive(board.client, 'leaderboard', message => message.spenders.some(entry => entry.spent === 25));
  const shared = receive(spectator.client, 'leaderboard', message => message.spenders.some(entry => entry.spent === 25));
  const own = receive(spender.client, 'self');
  spender.client.send(JSON.stringify({ type: 'arcade_spin', bet: 25, spent: 999999 }));
  const expected = [{ id: spender.welcome.selfID, name: guest.name, spent: 25 }];
  assert.deepEqual((await observed).spenders, expected);
  assert.deepEqual((await shared).spenders, expected);
  assert.equal((await own).spent, 25);
  spender.client.close(); await once(spender.client, 'close');
  const movedGuest = await connect('prototype', guest.guestToken);
  assert.equal(movedGuest.welcome.selfID, spender.welcome.selfID);
  assert.deepEqual(movedGuest.welcome.game.spenders, expected);
  assert.equal(movedGuest.welcome.game.self.coins, 100, 'guest has a separate prototype wallet');
  const returnedGuest = await connect('main', guest.guestToken);
  assert.equal(returnedGuest.welcome.selfID, spender.welcome.selfID);
  assert.equal(returnedGuest.welcome.game.self.spent, 25, 'returning guest retains main-room spending');
  assert.equal(returnedGuest.welcome.game.self.visits, 1, 'map switching does not add a daily visit');
  const reconnect = await connect('prototype');
  assert.deepEqual(reconnect.welcome.game.spenders, expected, 'offline guest remains ranked');
  assert.equal(reconnect.welcome.game.self.spent, 0, 'prototype wallet remains separate');
  const real = await connect('main', null, 3);
  const restored = receive(board.client, 'leaderboard', message => message.spenders.some(entry => entry.spent === 50));
  real.client.send(JSON.stringify({ type: 'restore', coins: 100, drunk: 0, fuel: 1, dayKey: '2026-10-03', spent: 50 }));
  assert.deepEqual((await restored).spenders, [{ id: '3', name: 'Player 3', spent: 50 }, ...expected]);
});

test('daily visits retain the latest entry time and count once across tabs, relogins and the 1am boundary', () => {
  const { game, clock } = setup();
  const first = game.join('guest');
  assert.equal(first.self.visits, 1);
  assert.equal(first.self.lastVisitAt, EVENING);
  clock.now += 60_000;
  assert.equal(game.join('guest').self.visits, 1, 'extra tab');
  assert.equal(game.snapshot('guest').self.lastVisitAt, clock.now);
  game.leave('guest');
  clock.now = Date.UTC(2026, 9, 3, 17, 59); // Next calendar date, 00:59 local.
  assert.equal(game.join('guest').self.visits, 1);
  clock.now += 60_000;
  game.tick();
  assert.equal(game.snapshot('guest').self.visits, 1, 'staying online is not another entry');
  game.leave('guest');
  assert.equal(game.join('guest').self.visits, 2);
  assert.equal(game.join('guest').self.visits, 2);
  clock.now += 7 * 24 * 3600_000;
  assert.equal(game.join('guest').self.visits, 3, 'missed days are not visits');
});

test('visitor backup restores same-day totals without duplicates and adds one after an older visit', () => {
  for (const [lastVisitAt, expected] of [[EVENING - 60_000, 10], [EVENING - 24 * 3600_000, 11]]) {
    const { game } = setup();
    game.join('a');
    game.handle('a', { type: 'restore', coins: 100, drunk: 0, fuel: 1, dayKey: '2026-10-03', visits: 10, lastVisitAt });
    assert.equal(game.snapshot('a').self.visits, expected);
    assert.equal(game.snapshot('a').self.lastVisitAt, EVENING);
    game.handle('a', { type: 'restore', coins: 100, drunk: 0, fuel: 1, dayKey: '2026-10-03', visits: 999, lastVisitAt });
    assert.equal(game.join('a').self.visits, expected, 'accepted server state wins subsequent restores');
  }
  const { game, backup } = setup();
  game.join('a'); backup('a', 0);
  assert.equal(game.snapshot('a').self.visits, 1, 'old wallets gain today only');
});

test('visitor rankings include offline guests, exclude NPCs and do not count prototype entries', () => {
  const { game, names, clock } = setup();
  for (const id of ['guest', 'a', 'b', 'c', 'd', 'e', 'samantha']) game.join(id);
  clock.now += 24 * 3600_000;
  game.join('guest'); game.leave('guest'); names.delete('guest');
  assert.deepEqual(game.topVisitors().map(entry => entry.id), ['guest', 'a', 'b', 'c', 'd']);
  assert.deepEqual(game.topVisitors()[0], { id: 'guest', name: 'Guest 1', visits: 2 });
  const prototype = createGame({ mapID: 'prototype', now: () => EVENING, send() {}, broadcast() {}, getName: () => 'Guest 1', getPosition() {} });
  assert.equal(prototype.join('guest').self.visits, 0);
  assert.deepEqual(prototype.topVisitors(), []);
});

test('invalid visitor counts or timestamps cannot consume the one-time restore', () => {
  for (const fields of [{ visits: -1 }, { visits: 1.5 }, { visits: '10' }, { visits: Number.MAX_SAFE_INTEGER + 1 },
    { lastVisitAt: 'yesterday' }, { lastVisitAt: -1 }, { lastVisitAt: EVENING + 1 }]) {
    const { game } = setup();
    game.join('a');
    const saved = { type: 'restore', coins: 100, drunk: 0, fuel: 1, dayKey: '2026-10-03', visits: 10, lastVisitAt: EVENING - 1 };
    game.handle('a', { ...saved, ...fields });
    assert.equal(game.snapshot('a').self.visits, 1);
    game.handle('a', saved);
    assert.equal(game.snapshot('a').self.visits, 10);
  }
});
