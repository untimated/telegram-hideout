import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRoulettePanel } from './public/js/roulette-panel.js';
import { ROULETTE } from './public/js/game/roulette.js';

function setup(t) {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'document');
  t.after(() => {
    if (original) Object.defineProperty(globalThis, 'document', original);
    else delete globalThis.document;
  });
  const element = () => ({
    children: [], events: {},
    append(...nodes) { this.children.push(...nodes); },
    replaceChildren() { this.children = []; },
    addEventListener(name, action) { this.events[name] = action; },
    setAttribute() {}, focus() {},
  });
  globalThis.document = { createElement: element };
  t.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: 10000 });
  const body = element(), foot = element();
  const buttons = Object.fromEntries(['red', 'black', 'spin'].map(id => [id, {
    position: { y: .055 }, userData: {
      hint: { visible: false }, setSelected(value) { this.selected = value; },
    },
  }]));
  let heading;
  const spins = [], sent = [];
  let presses = 0;
  const state = { self: { coins: 100 }, selfID: 'a', seated: new Map([['a', ROULETTE.seatID]]) };
  const controller = buildRoulettePanel({
    body, foot, machine: { userData: { roulette: { buttons } } },
    setHeading(kicker, title) { heading = title; }, close() {},
    game: {
      state: () => state, isInspecting: () => true, send: message => sent.push(message),
      audio: {
        rouletteSpinDuration: ROULETTE.spinDuration,
        pressRouletteButton() { presses++; }, setRouletteSpin(active) { spins.push(active); },
      },
    },
  });
  controller.update();
  foot.children[0].events.click(); // Next, with the default seven-coin bet.
  return { controller, body, foot, buttons, spins, sent, heading: () => heading, presses: () => presses };
}

test('roulette holds results for the audio duration; spam cannot change color or restart the spin', t => {
  const { controller, buttons, spins, foot, heading, presses, sent } = setup(t);
  assert.equal(buttons.red.userData.hint.visible, true);
  assert.equal(buttons.black.userData.hint.visible, true);
  controller.control('red');
  assert.equal(buttons.spin.userData.hint.visible, true);
  assert.equal(buttons.red.userData.hint.visible, false);
  controller.control('spin');
  assert.equal(heading(), 'Spinning…');
  assert.equal(buttons.spin.userData.hint.visible, false);
  t.mock.timers.tick(2000);
  controller.control('black');
  controller.control('spin');
  assert.equal(buttons.red.userData.selected, true);
  assert.equal(buttons.black.userData.selected, false);
  assert.deepEqual(spins, [true]);
  assert.equal(presses(), 4, 'all physical presses still give feedback');
  t.mock.timers.tick(ROULETTE.spinDuration - 2001);
  assert.equal(heading(), 'Spinning…');
  t.mock.timers.tick(1);
  assert.equal(heading(), 'Result preview');
  assert.deepEqual(spins, [true, false]);
  assert.equal(sent.length, 0, 'the player remains seated at the result');
  assert.equal(buttons.red.userData.selected, false);
  assert.equal(buttons.red.position.y, .055);
  foot.children[0].events.click(); // Play Again.
  foot.children[0].events.click(); // Next.
  assert.equal(buttons.red.userData.hint.visible, true);
  assert.equal(buttons.black.userData.hint.visible, true);
  controller.dispose();
});

test('leaving during the spin cancels the delayed result and stops its audio', t => {
  const { controller, buttons, spins, sent, heading } = setup(t);
  controller.control('black');
  controller.control('spin');
  t.mock.timers.tick(1000);
  controller.dispose();
  t.mock.timers.tick(ROULETTE.spinDuration);
  assert.equal(heading(), 'Spinning…', 'disposed panel cannot render a late result');
  assert.deepEqual(spins, [true, false]);
  assert.deepEqual(sent, [{ type: 'stand' }]);
  for (const button of Object.values(buttons)) {
    assert.equal(button.userData.hint.visible, false);
    assert.equal(button.position.y, .055);
  }
});
