import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from './game.js';
import { ROULETTE } from './public/js/game/roulette.js';
import { SEAT_BY_ID } from './public/js/game/seats.js';

const seat = SEAT_BY_ID.get(ROULETTE.seatID);
function setup(mapID = 'prototype') {
  const positions = new Map(['a', 'b'].map(id => [id, { x: ROULETTE.x, z: ROULETTE.z + 1.6 }]));
  const messages = [];
  const game = createGame({
    mapID, now: () => Date.UTC(2026, 9, 5, 3),
    send: (id, message) => messages.push({ ...message, to: id }),
    broadcast: message => messages.push(message),
    getPosition: id => positions.get(id),
    setPosition: (id, x, z) => positions.set(id, { x, z }),
    getName: id => id,
  });
  game.join('a');
  game.join('b');
  return { game, positions, messages };
}

test('prototype roulette chair snaps one occupant to the seat without charging and releases on exit', () => {
  const { game, positions, messages } = setup();
  const before = game.snapshot('a').self;
  game.handle('a', { type: 'sit', seat: seat.id });
  assert.deepEqual(positions.get('a'), { x: seat.x, z: seat.z });
  assert.deepEqual(game.snapshot('a').seated, { a: seat.id });
  assert.deepEqual(game.snapshot('a').self, before);
  game.handle('b', { type: 'sit', seat: seat.id });
  assert.match(messages.at(-1).text, /Someone is sitting/);
  assert.deepEqual(game.snapshot('b').seated, { a: seat.id });
  game.handle('a', { type: 'stand' });
  game.handle('b', { type: 'sit', seat: seat.id });
  assert.deepEqual(game.snapshot('a').seated, { b: seat.id });
  game.leave('b');
  assert.deepEqual(game.snapshot('a').seated, {});
  assert.equal(game.handle('a', { type: 'roulette_spin', bet: 7, payout: 999 }), false);
  assert.deepEqual(game.snapshot('a').self, before);
});

test('roulette seating rejects the wrong map, distant and asleep players; bar seats remain unavailable in prototype', () => {
  const main = setup('main');
  main.game.handle('a', { type: 'sit', seat: seat.id });
  assert.match(main.messages.at(-1).text, /not in this map/);
  assert.deepEqual(main.game.snapshot('a').seated, {});
  const { game, positions, messages } = setup();
  game.handle('a', { type: 'sit', seat: 'stool-front-1' });
  assert.match(messages.at(-1).text, /not in this map/);
  positions.set('a', { x: -5, z: -5 });
  game.handle('a', { type: 'sit', seat: seat.id });
  assert.match(messages.at(-1).text, /Walk closer/);
  positions.set('a', { x: seat.x, z: seat.z });
  const self = game.snapshot('a').self;
  game.handle('a', { ...self, type: 'restore', fuel: 0 });
  game.handle('a', { type: 'sit', seat: seat.id });
  assert.match(messages.at(-1).text, /passed out/);
  assert.deepEqual(game.snapshot('a').seated, {});
});
