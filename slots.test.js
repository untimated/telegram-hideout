import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from './game.js';
import { SLOT_SYMBOLS, SLOTS, maxSlotBet, rollSlots, slotDisplayCoins } from './public/js/game/slots.js';
import { createSlotAnimator } from './public/js/slot-animation.js';
import { once } from 'node:events';
import { WebSocket } from 'ws';
import { createHideoutServer } from './server.js';
import { makeSession } from './auth.js';

test('slot outcomes have exact category odds and matching symbol counts', () => {
  let seed = 123456;
  const random = () => ((seed = (1664525 * seed + 1013904223) >>> 0) / 2 ** 32);
  const counts = { pair: 0, triple: 0, jackpot: 0, loss: 0 };
  const pairPositions = new Set();
  let total = 0;
  for (let i = 0; i < 10000; i++) {
    let first = true;
    const spin = rollSlots(7, () => {
      if (first) { first = false; return (i + .5) / 10000; }
      return random();
    });
    counts[spin.kind]++;
    total += spin.payout;
    assert.equal(spin.symbols.length, 3);
    assert.ok(spin.symbols.every(symbol => SLOT_SYMBOLS.includes(symbol)));
    const unique = new Set(spin.symbols);
    if (spin.kind === 'pair') {
      assert.equal(unique.size, 2);
      const pair = spin.symbols.find(symbol => spin.symbols.filter(other => other === symbol).length === 2);
      assert.notEqual(pair, SLOTS.jackpot);
      pairPositions.add(spin.symbols.findIndex(symbol => symbol !== pair));
      assert.equal(spin.payout, 21);
    } else if (spin.kind === 'triple') {
      assert.equal(unique.size, 1);
      assert.notEqual(spin.symbols[0], SLOTS.jackpot);
      assert.equal(spin.payout, 42);
    } else if (spin.kind === 'jackpot') {
      assert.deepEqual(spin.symbols, ['gossip', 'gossip', 'gossip']);
      assert.equal(spin.payout, 84);
    } else {
      assert.equal(unique.size, 3);
      assert.equal(spin.payout, 0);
    }
  }
  assert.deepEqual(counts, { pair: 2000, triple: 1000, jackpot: 500, loss: 6500 });
  assert.deepEqual([...pairPositions].sort(), [0, 1, 2]);
  assert.equal(total / 10000, 12.6);
  for (const [chance, kind] of [[0, 'pair'], [.199999, 'pair'], [.2, 'triple'], [.3, 'jackpot'], [.35, 'loss'], [.999999, 'loss']]) {
    assert.equal(rollSlots(7, () => chance).kind, kind);
  }
});

function setup(mapID = SLOTS.map, chance = .325) {
  let now = Date.UTC(2026, 9, 2, 3);
  const inbox = new Map();
  const events = [];
  const positions = new Map([
    ['a', { x: SLOTS.x + 1.6, z: SLOTS.z }], ['b', { x: SLOTS.x + 1.8, z: SLOTS.z }],
  ]);
  const game = createGame({ mapID, now: () => now, random: () => chance,
    send: (id, message) => inbox.set(id, [...(inbox.get(id) ?? []), message]),
    broadcast: message => events.push(message), getPosition: id => positions.get(id), getName: id => id,
  });
  game.join('a'); game.join('b');
  return { game, events, positions, inbox, advance: () => { now += SLOTS.duration; } };
}

test('server pays each award once, ignores client payout claims, and shares machine cooldown', () => {
  for (const bet of [7, 25, 100]) for (const [chance, multiplier] of [[.1, 3], [.25, 6], [.325, 12], [.9, 0]]) {
    const payout = bet * multiplier;
    const { game, events, advance } = setup('main', chance);
    game.handle('a', { type: 'arcade_spin', bet, payout: 9999, symbols: ['gossip', 'gossip', 'gossip'] });
    assert.equal(game.snapshot('a').self.coins, 100 - bet + payout);
    assert.equal(events[0].spin.bet, bet);
    assert.equal(game.snapshot('b').self.coins, 100);
    assert.equal(events.filter(event => event.type === 'arcade_spin').length, 1);
    game.handle('a', { type: 'arcade_spin', bet });
    game.handle('b', { type: 'arcade_spin', bet });
    assert.equal(events.filter(event => event.type === 'arcade_spin').length, 1);
    game.leave('a');
    assert.equal(game.join('a').self.coins, 100 - bet + payout);
    assert.deepEqual(game.join('b').arcade, events[0].spin);
    game.handle('a', { type: 'restore', coins: 9999, drunk: 0, fuel: 1, dayKey: game.snapshot('a').self.dayKey });
    assert.equal(game.snapshot('a').self.coins, 100 - bet + payout);
    advance();
    game.handle('b', { type: 'arcade_spin', bet });
    assert.equal(game.snapshot('b').self.coins, 100 - bet + payout);
    assert.equal(events.filter(event => event.type === 'arcade_spin').length, 2);
  }
});

test('slot guards reject prototype map, distant, asleep, poor and full-wallet players without charging', () => {
  for (const condition of ['prototype', 'far', 'asleep', 'poor', 'full']) {
    const { game, events, positions, inbox } = setup(condition === 'prototype' ? 'prototype' : 'main');
    if (condition === 'far') positions.set('a', { x: 6, z: 6 });
    if (condition === 'poor') game.cheat('a', 'money -94');
    if (condition === 'full') game.cheat('a', `money ${Number.MAX_SAFE_INTEGER}`);
    if (condition === 'asleep') game.handle('a', { type: 'restore', coins: 100, drunk: 1, fuel: 1, dayKey: game.snapshot('a').self.dayKey });
    const before = game.snapshot('a').self.coins;
    game.handle('a', { type: 'arcade_spin' });
    assert.equal(game.snapshot('a').self.coins, before);
    assert.equal(events.filter(event => event.type === 'arcade_spin').length, 0);
    assert.equal(inbox.get('a').at(-1).type, 'notice');
  }
});

test('invalid or unaffordable bets never charge the wallet or start a spin', () => {
  for (const bet of [null, '7', [], {}, -1, 0, 6, 7.5, 101, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    const { game, events, inbox } = setup();
    game.handle('a', { type: 'arcade_spin', bet });
    assert.equal(game.snapshot('a').self.coins, 100);
    assert.equal(game.snapshot('a').arcade, null);
    assert.equal(events.length, 0);
    assert.equal(inbox.get('a').at(-1).type, 'notice');
  }
  const { game } = setup();
  game.handle('a', { type: 'arcade_spin' });
  assert.equal(game.snapshot('a').arcade.bet, 7, 'older clients default to the minimum bet');
  assert.equal(game.snapshot('a').self.coins, 177);
});

test('HUD charges the bet immediately and reveals secured winnings at the final reel stop', () => {
  for (const [chance, multiplier] of [[.1, 3], [.25, 6], [.325, 12], [.9, 0]]) {
    const { game, inbox, advance } = setup('main', chance);
    const startedAt = game.snapshot('a').serverTime;
    game.handle('a', { type: 'arcade_spin', bet: 25 });
    // The self message is delivered before arcade_spin, so it must already defer the award.
    const self = inbox.get('a').at(-1);
    assert.equal(self.coins, 75 + 25 * multiplier, 'full payout stays secured on the server');
    assert.equal(slotDisplayCoins(self, startedAt), 75);
    assert.equal(slotDisplayCoins(self, startedAt + SLOTS.duration - 1), 75);
    assert.equal(slotDisplayCoins(self, startedAt + SLOTS.duration), self.coins);
    assert.equal(slotDisplayCoins(game.snapshot('b').self, startedAt), 100, 'spectator balance stays independent');
    game.leave('a');
    const rejoined = game.join('a');
    assert.equal(slotDisplayCoins(rejoined.self, startedAt + 1000), 75);
    game.handle('b', { type: 'transfer', to: 'a', amount: 10 });
    const transferred = inbox.get('a').findLast(message => message.type === 'self');
    assert.equal(slotDisplayCoins(transferred, startedAt + 1000), 85, 'unrelated credits appear during the spin');
    assert.equal(slotDisplayCoins(transferred, startedAt + SLOTS.duration), 85 + 25 * multiplier);
    advance();
    const finished = game.snapshot('a');
    assert.equal(finished.self.pendingSlotPayout, undefined);
    assert.equal(slotDisplayCoins(finished.self, finished.serverTime), 85 + 25 * multiplier);
    assert.equal(slotDisplayCoins(transferred, startedAt + SLOTS.duration + 5000), 85 + 25 * multiplier);
  }
});

test('large bets pay in full and Gossip Bar wallets can restore and transfer large balances', () => {
  const { game, events } = setup();
  const dayKey = game.snapshot('a').self.dayKey;
  game.handle('a', { type: 'restore', coins: 250000, drunk: 0, fuel: 1, dayKey });
  assert.equal(game.snapshot('a').self.coins, 250000);
  game.handle('a', { type: 'arcade_spin', bet: 200000 });
  assert.equal(events.find(event => event.type === 'arcade_spin').spin.payout, 2400000);
  assert.equal(game.join('a').self.coins, 2450000);
  game.handle('a', { type: 'transfer', to: 'b', amount: 200000 });
  assert.equal(game.snapshot('a').self.coins, 2250000);
  assert.equal(game.snapshot('b').self.coins, 200100);
  const prototype = setup('prototype').game;
  prototype.handle('a', { type: 'restore', coins: 250000, drunk: 0, fuel: 1, dayKey });
  assert.equal(prototype.snapshot('a').self.coins, 250000, 'existing prototype savings stay readable');
});

test('each loss costs two fuel points once, wins cost none, and empty fuel causes sleep', () => {
  for (const [chance, fuel] of [[.1, 1], [.25, 1], [.325, 1], [.9, .98]]) {
    const { game, advance } = setup('main', chance);
    game.handle('a', { type: 'arcade_spin' });
    assert.equal(game.snapshot('a').self.fuel, fuel);
    game.handle('a', { type: 'arcade_spin' });
    assert.equal(game.join('a').self.fuel, fuel, 'cooldown and reconnect do not charge fuel again');
    advance();
    game.handle('a', { type: 'arcade_spin' });
    assert.equal(game.snapshot('a').self.fuel, chance === .9 ? .96 : 1);
  }
  for (const fuel of [.02, .01]) {
    const { game, events } = setup('main', .9);
    game.handle('a', { type: 'restore', coins: 100, drunk: 0, fuel, dayKey: game.snapshot('a').self.dayKey });
    game.handle('a', { type: 'arcade_spin' });
    assert.equal(game.snapshot('a').self.fuel, 0);
    assert.equal(game.snapshot('a').self.asleep, true);
    assert.equal(game.canMove('a'), false);
    assert.equal(events.filter(event => event.type === 'player_state' && event.asleep).length, 1);
  }
});

test('bets near the arithmetic limit keep every possible prize an exact whole-coin amount', () => {
  const largest = Math.floor(Number.MAX_SAFE_INTEGER / 12);
  assert.equal(maxSlotBet(largest), largest);
  const { game, events, advance } = setup();
  game.cheat('a', `money ${largest - 100}`);
  game.handle('a', { type: 'arcade_spin', bet: largest });
  const wallet = game.snapshot('a').self.coins;
  assert.equal(wallet, largest * 12);
  assert.ok(Number.isSafeInteger(wallet));
  const limit = maxSlotBet(wallet);
  const before = events.filter(event => event.type === 'arcade_spin').length;
  advance();
  game.handle('a', { type: 'arcade_spin', bet: Math.max(7, limit + 1) });
  assert.equal(events.filter(event => event.type === 'arcade_spin').length, before);
  assert.equal(game.snapshot('a').self.coins, wallet);
  assert.ok(wallet - limit + limit * 12 <= Number.MAX_SAFE_INTEGER);
  assert.equal(maxSlotBet(Number.MAX_SAFE_INTEGER), 0);
});

test('reel animation ends on the awarded symbols and resumes correctly from a snapshot', () => {
  const drawn = [];
  const context = { fillRect() {}, fillText(text) { drawn.push(text); } };
  const parts = {
    reels: Array.from({ length: 3 }, () => ({ rotation: { x: 1 } })),
    lever: { rotation: { x: 0 } }, button: { position: { y: .854 } },
    lights: { gold: { emissiveIntensity: .55 } },
    display: { material: { map: { image: { getContext: () => context } } } },
  };
  const animator = createSlotAnimator({ userData: { slotMachine: parts } });
  for (const symbols of [SLOT_SYMBOLS.slice(0, 3), SLOT_SYMBOLS.slice(3), ['gossip', 'gossip', 'gossip']]) {
    const spin = { id: symbols.join(), symbols, kind: 'jackpot', payout: 84, startedAt: 1000 };
    animator.setSpin(spin, 1000);
    animator.update(2000);
    assert.equal(drawn.at(-1), 'SPINNING...');
    assert.ok(parts.reels.every(reel => Number.isFinite(reel.rotation.x)));
    animator.update(1000 + SLOTS.duration);
    symbols.forEach((symbol, index) => assert.equal(parts.reels[index].rotation.x,
      Math.PI * 2 * (1 - (SLOT_SYMBOLS.indexOf(symbol) + .5) / SLOT_SYMBOLS.length)));
    assert.equal(drawn.at(-1), 'JACKPOT! 84 coins');
    assert.equal(parts.lever.rotation.x, 0);
    assert.equal(parts.button.position.y, .854);
    animator.setSpin({ ...spin, id: `${spin.id}-rejoin` }, 9000);
    assert.equal(drawn.at(-1), 'JACKPOT! 84 coins');
  }
  animator.setSpin(null, 10000);
  animator.update(11000);
  assert.equal(drawn.at(-1), 'GOSSIP BAR');
  assert.equal(parts.lever.rotation.x, 0);
});

test('marquee flickers while idle and winning cabinet squish stays small and settles', () => {
  const scale = { x: 1, y: 1, z: 1, clone() { return { x: this.x, y: this.y, z: this.z }; },
    set(x, y, z) { Object.assign(this, { x, y, z }); } };
  const parts = {
    visuals: { scale }, reels: Array.from({ length: 3 }, () => ({ rotation: { x: 1 } })),
    lever: { rotation: { x: 0 } }, button: { position: { y: .854 } },
    lights: { pink: { emissiveIntensity: 1.3 }, gold: { emissiveIntensity: .55 },
      marquee: { emissiveIntensity: .65, color: { setScalar(value) { this.value = value; } } } },
    display: { material: { map: { image: { getContext: () => ({ fillRect() {}, fillText() {} }) } } } },
  };
  const animator = createSlotAnimator({ userData: { slotMachine: parts } });
  const levels = [];
  for (let now = 0; now < 20000; now += 16) {
    animator.update(now);
    levels.push(parts.lights.marquee.emissiveIntensity);
    assert.ok(parts.lights.marquee.color.value >= .55 && parts.lights.marquee.color.value <= 1);
    assert.deepEqual([scale.x, scale.y, scale.z], [1, 1, 1]);
  }
  assert.ok(Math.min(...levels) < .3);
  assert.ok(Math.max(...levels) <= .65);
  for (const [kind, payout] of [['pair', 21], ['triple', 42], ['jackpot', 84], ['loss', 0]]) {
    const spin = { id: kind, kind, payout, symbols: SLOT_SYMBOLS.slice(0, 3), startedAt: 30000 };
    animator.setSpin(spin, spin.startedAt);
    assert.deepEqual([scale.x, scale.y, scale.z], [1, 1, 1]);
    animator.update(spin.startedAt + SLOTS.duration + 90);
    if (payout) {
      assert.ok(scale.y < 1 && scale.y >= .968);
      assert.ok(scale.x > 1 && scale.x <= 1.016);
      assert.equal(scale.x, scale.z);
      animator.update(spin.startedAt + SLOTS.duration + 300);
      assert.ok(scale.y > 1 && scale.y <= 1.032);
    } else assert.deepEqual([scale.x, scale.y, scale.z], [1, 1, 1]);
    animator.update(spin.startedAt + SLOTS.duration + 1000);
    assert.deepEqual([scale.x, scale.y, scale.z], [1, 1, 1]);
    animator.setSpin({ ...spin, id: `${kind}-rejoin` }, spin.startedAt + SLOTS.duration + 5000);
    assert.deepEqual([scale.x, scale.y, scale.z], [1, 1, 1]);
    animator.setSpin({ ...spin, id: `${kind}-reset` }, spin.startedAt + SLOTS.duration + 90);
    animator.setSpin(null, spin.startedAt + SLOTS.duration + 95);
    assert.deepEqual([scale.x, scale.y, scale.z], [1, 1, 1]);
  }
});

test('WebSocket slot results reach Gossip Bar spectators, stay out of prototype, and survive reconnects', { timeout: 10000 }, async t => {
  const botToken = 'slots-test-token';
  const now = 1800000000;
  const { server, sockets } = createHideoutServer({ botToken, groupID: '-100123', now: () => now,
    pickSpawn: () => ({ x: SLOTS.x + 1.6, z: SLOTS.z }),
    fetchImpl: async () => Response.json({ ok: true, result: { status: 'member' } }),
  });
  t.after(async () => {
    for (const socket of sockets.clients) socket.terminate();
    sockets.close();
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const host = `127.0.0.1:${server.address().port}`;
  for (const sound of ['slot-reel', 'slot-payout', 'casino-win', 'trumpet-fail']) {
    const response = await fetch(`http://${host}/sfx/${sound}.mp3`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'audio/mpeg');
    assert.ok((await response.arrayBuffer()).byteLength > 1000);
  }
  async function connect(id, map) {
    const client = new WebSocket(`ws://${host}/ws?map=${map}`, { origin: `http://${host}`,
      headers: { Cookie: `hideout_session=${makeSession({ id, name: `Player ${id}` }, botToken, now)}` },
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
        peer.client.off('message', handler);
        resolve(message);
      };
      peer.client.on('message', handler);
    });
  }
  const prototype = await connect(1, 'prototype');
  const player = await connect(1, 'main');
  const spectator = await connect(2, 'main');
  const result = receive(player, 'arcade_spin');
  const observed = receive(spectator, 'arcade_spin');
  player.client.send(JSON.stringify({ type: 'arcade_spin', bet: 25, payout: 10000 }));
  const spin = (await result).spin;
  assert.deepEqual((await observed).spin, spin);
  assert.equal(spin.bet, 25);
  assert.ok([0, 75, 150, 300].includes(spin.payout));
  assert.equal(player.messages.filter(message => message.type === 'self').at(-1).coins, 100 - 25 + spin.payout);
  const rejected = receive(prototype, 'notice');
  prototype.client.send(JSON.stringify({ type: 'arcade_spin' }));
  assert.equal((await rejected).text, 'This machine is not in this map.');
  assert.equal(prototype.messages.filter(message => message.type === 'arcade_spin' || message.type === 'self').length, 0);
  const reconnect = await connect(1, 'main');
  assert.equal(reconnect.welcome.game.self.coins, 100 - 25 + spin.payout);
  assert.deepEqual(reconnect.welcome.game.arcade, spin);
});
