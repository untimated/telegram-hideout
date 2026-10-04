import test from 'node:test';
import assert from 'node:assert/strict';
import { moveCommand, saveGuestMove, takeGuestMove } from './public/js/chat-commands.js';

test('room commands preserve guest and preview options and reject invalid destinations', () => {
  const href = 'http://localhost/hideout?guest=1&hour=14&map=main';
  const command = moveCommand('/move prototype', href);
  const url = new URL(command.url);
  assert.equal(command.map.id, 'prototype');
  assert.equal(url.searchParams.get('map'), 'prototype');
  assert.equal(url.searchParams.get('guest'), '1');
  assert.equal(url.searchParams.get('hour'), '14');
  assert.equal(moveCommand('/move main', url.href).map.id, 'main');
  for (const text of ['/move', '/move unknown', '/move prototype extra', '/move https://example.com']) {
    assert.ok(moveCommand(text, href).error);
  }
  assert.equal(moveCommand('hello', href), null);
  assert.equal(moveCommand('/cheat money 10', href), null);
});

test('guest identity carries across one navigation without appearing in the URL', () => {
  const data = new Map();
  const storage = {
    getItem: key => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
    removeItem: key => data.delete(key),
  };
  saveGuestMove(storage, 'signed-guest-token');
  assert.equal(takeGuestMove(storage), 'signed-guest-token');
  assert.equal(takeGuestMove(storage), null, 'handoff is consumed once');
  assert.ok(!moveCommand('/move prototype', 'http://localhost/hideout?guest=1').url.includes('signed-guest-token'));
});
