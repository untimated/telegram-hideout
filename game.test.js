import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from './game.js';

// Saturday 3 October 2026, 10:00 in Asia/Jakarta (UTC+7): Wolfred and Pierre are both on shift.
const SATURDAY_10AM = Date.UTC(2026, 9, 3, 3, 0);
const HOUR = 3600_000;

function setup() {
  const clock = { now: SATURDAY_10AM };
  const inbox = new Map();
  const everyone = [];
  const positions = new Map([['a', { x: -3.4, z: -3 }], ['b', { x: -3.4, z: -2.5 }]]);
  const names = { a: 'Alice', b: 'Bob' };
  const game = createGame({
    now: () => clock.now,
    send: (id, message) => inbox.set(id, [...(inbox.get(id) ?? []), message]),
    broadcast: message => everyone.push(message),
    getPosition: id => positions.get(id),
    getName: id => names[id],
  });
  const self = id => inbox.get(id).filter(message => message.type === 'self').at(-1);
  const notices = id => (inbox.get(id) ?? []).filter(message => message.type === 'notice').map(message => message.text);
  return { clock, game, everyone, positions, self, notices };
}

test('ordering, serving and consuming drinks moves coins and meters', () => {
  const { game, everyone, positions, self, notices } = setup();
  const welcome = game.join('a');
  game.join('b');
  assert.equal(welcome.self.coins, 100);

  game.handle('a', { type: 'buy', item: 'pint-of-beer' });
  assert.equal(self('a').coins, 80);
  const served = everyone.find(message => message.type === 'item_added').item;
  assert.equal(served.item, 'pint-of-beer');
  assert.equal(served.spot, 'bar-1');

  // Anyone nearby can drink it; the effects land on whoever consumes it.
  game.handle('b', { type: 'consume', id: served.id });
  assert.deepEqual([self('b').drunk, self('b').fuel], [.2, .9]);
  assert.ok(everyone.some(message => message.type === 'item_removed' && message.id === served.id));
  game.handle('a', { type: 'consume', id: served.id });
  assert.match(notices('a').at(-1), /got there first/);

  positions.set('a', { x: 5, z: 5 });
  game.handle('a', { type: 'buy', item: 'pint-of-beer' });
  assert.match(notices('a').at(-1), /Walk up/);
  assert.equal(self('a').coins, 80);

  // Specials follow the weekday: Saturday's is on, Wednesday's is not.
  positions.set('a', { x: -3.4, z: -3 });
  game.handle('a', { type: 'buy', item: 'wednesday-special' });
  assert.match(notices('a').at(-1), /not on today/);
  game.handle('a', { type: 'buy', item: 'saturday-special' });
  assert.equal(self('a').coins, 30);
});

test('vendors must be on shift', () => {
  const { clock, game, self, notices } = setup();
  clock.now = SATURDAY_10AM - 3 * HOUR; // 07:00: Wolfred starts at 9.
  game.join('a');
  game.handle('a', { type: 'buy', item: 'pint-of-beer' });
  assert.match(notices('a').at(-1), /Wolfred is off shift/);
  assert.equal(self('a'), undefined);
});

test('bar coffee costs five coins, applies recovery when drunk, and clamps meters', () => {
  const { game, everyone, self, notices } = setup();
  game.join('a');
  game.join('b');
  game.handle('a', { type: 'restore', coins: 100, drunk: .4, fuel: .5, dayKey: '2026-10-03' });
  game.handle('b', { type: 'restore', coins: 5, drunk: .05, fuel: .85, dayKey: '2026-10-03' });
  game.handle('a', { type: 'buy', item: 'coffee' });
  assert.deepEqual([self('a').coins, self('a').drunk, self('a').fuel], [95, .4, .5]);
  const first = everyone.filter(message => message.type === 'item_added').at(-1).item;
  assert.equal(first.item, 'coffee');
  assert.match(first.spot, /^bar-/);
  game.handle('a', { type: 'consume', id: first.id });
  assert.deepEqual([self('a').drunk, self('a').fuel], [.3, .8]);
  assert.ok(everyone.some(message => message.type === 'activity' && /Alice drank their ☕ Coffee/.test(message.text)));
  game.handle('a', { type: 'consume', id: first.id });
  assert.deepEqual([self('a').drunk, self('a').fuel], [.3, .8], 'one coffee cannot apply twice');
  game.handle('b', { type: 'buy', item: 'coffee' });
  const second = everyone.filter(message => message.type === 'item_added').at(-1).item;
  assert.equal(self('b').coins, 0);
  game.handle('b', { type: 'consume', id: second.id });
  assert.deepEqual([self('b').drunk, self('b').fuel], [0, 1]);
  game.handle('b', { type: 'buy', item: 'coffee' });
  assert.match(notices('b').at(-1), /Not enough coins for Coffee/);
  assert.equal(everyone.filter(message => message.type === 'item_added').length, 2);
});

test('passing out stops movement; hours and splashes bring players back', () => {
  const { clock, game, everyone, self } = setup();
  game.join('a');
  game.join('b');
  for (let round = 0; round < 5; round++) {
    game.handle('a', { type: 'buy', item: 'pint-of-beer' });
    const served = everyone.filter(message => message.type === 'item_added').at(-1).item;
    game.handle('a', { type: 'consume', id: served.id });
  }
  assert.equal(self('a').drunk, 1);
  assert.equal(self('a').asleep, true);
  assert.equal(game.canMove('a'), false);
  assert.ok(everyone.some(message => message.type === 'player_state' && message.id === 'a' && message.asleep));

  game.handle('b', { type: 'splash', id: 'a' });
  assert.equal(self('a').drunk, .9);
  assert.equal(game.canMove('a'), true);

  clock.now += HOUR;
  game.tick();
  assert.equal(self('a').drunk, .6);
  assert.equal(self('a').fuel, .4);
});

test('admin cheats adjust the wallet quietly', () => {
  const { game, everyone, self } = setup();
  game.join('a');
  game.cheat('a', 'money 30');
  assert.equal(self('a').coins, 130);
  game.cheat('a', 'money -500');
  assert.equal(self('a').coins, 0);
  assert.equal(game.cheat('a', 'nonsense'), false);
  assert.equal(everyone.filter(message => message.type === 'activity').length, 0);
});

test('transfers, the jukebox, restores and the daily refill', () => {
  const { clock, game, everyone, positions, self, notices } = setup();
  game.join('a');
  game.join('b');
  game.handle('a', { type: 'restore', coins: 250, drunk: .3, fuel: .8, dayKey: '2026-10-03' });
  assert.deepEqual([self('a').coins, self('a').drunk], [250, .3]);
  game.handle('a', { type: 'restore', coins: 9999, drunk: 0, fuel: 1, dayKey: '2026-10-03' });
  assert.equal(self('a').coins, 250, 'only the first restore counts');

  game.handle('a', { type: 'transfer', to: 'b', amount: 40 });
  assert.equal(self('a').coins, 210);
  assert.equal(self('b').coins, 140);
  assert.match(notices('b').at(-1), /Alice sent you 40/);
  game.handle('a', { type: 'transfer', to: 'b', amount: 1e6 });
  assert.match(notices('a').at(-1), /do not have/);

  positions.set('a', { x: -5.1, z: .9 });
  game.handle('a', { type: 'jukebox_play', song: 'summer-walk' });
  assert.equal(self('a').coins, 200);
  assert.equal(everyone.filter(message => message.type === 'jukebox').at(-1).jukebox.song, 'summer-walk');
  clock.now += 10 * 60_000;
  game.tick();
  assert.equal(everyone.filter(message => message.type === 'jukebox').at(-1).jukebox, null);

  // 01:00 the next day starts a new Hideout day for everyone still connected.
  clock.now = SATURDAY_10AM + 15 * HOUR + 60_000;
  game.tick();
  assert.deepEqual([self('a').coins, self('a').drunk, self('a').fuel], [300, 0, 1]);
});
