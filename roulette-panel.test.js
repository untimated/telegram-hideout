import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRoulettePanel } from './public/js/roulette-panel.js';
import { ROULETTE } from './public/js/game/roulette.js';
import { createRouletteAnimator } from './public/js/roulette-animation.js';

function setup(t, { advance = true, coins = 100, random = .4 } = {}) {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'document');
  t.after(() => {
    if (original) Object.defineProperty(globalThis, 'document', original);
    else delete globalThis.document;
  });
  const element = () => ({
    children: [], events: {}, attributes: {},
    append(...nodes) { this.children.push(...nodes); },
    replaceChildren() { this.children = []; },
    addEventListener(name, action) { this.events[name] = action; },
    setAttribute(name, value) { this.attributes[name] = value; }, focus() {},
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
  const spins = [], sent = [], results = [];
  let presses = 0, coinSounds = 0;
  const state = { self: { coins }, selfID: 'a', seated: new Map([['a', ROULETTE.seatID]]) };
  const wheel = { rotation: { z: 0 } };
  const ball = { position: { x: .294, y: -.294, z: .106,
    set(x, y, z) { Object.assign(this, { x, y, z }); } } };
  const machine = { userData: { roulette: { buttons, wheel, ball } } };
  const animation = createRouletteAnimator(machine, { now: () => Date.now(),
    random: typeof random === 'function' ? random : () => random });
  machine.userData.roulette.animation = animation;
  const controller = buildRoulettePanel({
    body, foot, machine,
    setHeading(kicker, title) { heading = title; }, close() {},
    game: {
      state: () => state, isInspecting: () => true, send: message => sent.push(message),
      audio: {
        rouletteSpinDuration: ROULETTE.spinDuration,
        addRouletteCoin() { coinSounds++; },
        pressRouletteButton() { presses++; }, setRouletteSpin(active) { spins.push(active); },
        setRouletteResult(value) { results.push(value); },
      },
    },
  });
  controller.update();
  if (advance) {
    body.children[1].children[0].events.click(); // Add a ten-coin wager.
    foot.children[0].events.click();
  }
  results.length = 0;
  return { controller, body, foot, buttons, spins, sent, results, state, animation, wheel, ball,
    heading: () => heading, presses: () => presses, coinSounds: () => coinSounds };
}

test('roulette holds results for the audio duration; spam cannot change color or restart the spin', t => {
  // A draw above any win chance loses; the last non-red pocket is black.
  const { controller, body, buttons, spins, foot, heading, presses, sent, results, wheel, ball } = setup(t, { random: .99 });
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
  assert.equal(body.children[1].textContent, 'Landed on BLACK · You lose.');
  assert.deepEqual(results, [false]);
  const pocketAngle = Math.atan2(ball.position.y, ball.position.x) - wheel.rotation.z;
  assert.ok(Math.abs(Math.cos(pocketAngle) - Math.cos(Math.PI / 2 + 24 * Math.PI * 2 / 25)) < 1e-10);
  assert.deepEqual(spins, [true, false]);
  assert.equal(sent.length, 0, 'the player remains seated at the result');
  assert.equal(buttons.red.userData.selected, false);
  assert.equal(buttons.red.position.y, .055);
  foot.children[0].events.click(); // Play Again.
  body.children[1].children[0].events.click(); // New round starts with an empty wager.
  foot.children[0].events.click(); // Next.
  assert.equal(buttons.red.userData.hint.visible, true);
  assert.equal(buttons.black.userData.hint.visible, true);
  controller.dispose();
});

test('leaving during the spin cancels the delayed result and stops its audio', t => {
  const { controller, buttons, spins, sent, results, heading, ball, animation } = setup(t);
  controller.control('black');
  controller.control('spin');
  t.mock.timers.tick(1000);
  controller.dispose();
  const stopped = { ...ball.position };
  t.mock.timers.tick(ROULETTE.spinDuration);
  animation.update();
  assert.deepEqual(ball.position, stopped, 'leaving also stops the moving ball');
  assert.equal(heading(), 'Spinning…', 'disposed panel cannot render a late result');
  assert.deepEqual(spins, [true, false]);
  assert.deepEqual(results, [], 'leaving cannot play a late outcome cue');
  assert.deepEqual(sent, [{ type: 'stand' }]);
  for (const button of Object.values(buttons)) {
    assert.equal(button.userData.hint.visible, false);
    assert.equal(button.position.y, .055);
  }
});

test('coin denominations stack into one bet, with undo, clear and an empty start each round', t => {
  const { controller, body, foot } = setup(t, { advance: false, coins: 200 });
  const [ten, fifty] = body.children[1].children;
  const [total, undo, clear] = body.children[2].children;
  assert.equal(foot.children[0].disabled, true);
  fifty.events.click(); fifty.events.click(); ten.events.click();
  assert.equal(total.textContent, 'Bet: 110 coins');
  assert.equal(fifty.children[2].textContent, '×2');
  assert.equal(ten.children[2].textContent, '×1');
  undo.events.click();
  assert.equal(total.textContent, 'Bet: 100 coins');
  clear.events.click();
  assert.equal(total.textContent, 'Bet: 0 coins');
  assert.equal(foot.children[0].disabled, true);
  fifty.events.click(); fifty.events.click(); ten.events.click();
  foot.children[0].events.click();
  assert.equal(body.children[0].textContent, 'Bet: 110 coins');
  controller.dispose();
});

test('coin additions cannot exceed cash and a balance change invalidates the current wager', t => {
  const { controller, body, foot, state, coinSounds } = setup(t, { advance: false, coins: 60 });
  const [ten, fifty, hundred] = body.children[1].children;
  const [total, undo] = body.children[2].children;
  assert.equal(hundred.disabled, true);
  fifty.events.click();
  assert.equal(fifty.disabled, true);
  fifty.events.click(); // The handler also guards requests outside native disabled-button behavior.
  assert.equal(coinSounds(), 1, 'only accepted additions play the coin cue');
  assert.equal(total.textContent, 'Bet: 50 coins');
  ten.events.click();
  assert.equal(coinSounds(), 2);
  assert.equal(total.textContent, 'Bet: 60 coins');
  state.self.coins = 55;
  controller.update();
  assert.equal(foot.children[0].disabled, true);
  undo.events.click();
  assert.equal(total.textContent, 'Bet: 50 coins');
  assert.equal(foot.children[0].disabled, false);
  controller.dispose();
});

test('a matching color plays the win cue once and Play Again clears it', t => {
  const { controller, results, body, foot } = setup(t, { random: 0 });
  controller.control('black'); controller.control('spin'); controller.control('spin');
  t.mock.timers.tick(ROULETTE.spinDuration);
  assert.deepEqual(results, [true]);
  assert.equal(body.children[1].textContent, 'Landed on BLACK · You win!');
  foot.children[0].events.click();
  assert.deepEqual(results, [true, null], 'Play Again clears the previous result sound');
  controller.dispose();
});

test('green is a failed color match in the visual preview', t => {
  const draws = [.99, 0]; // Lose the win-chance draw, then take the first other pocket.
  const { controller, results } = setup(t, { random: () => draws.shift() ?? .5 });
  controller.control('red'); controller.control('spin');
  t.mock.timers.tick(ROULETTE.spinDuration);
  assert.deepEqual(results, [false]);
  controller.dispose();
});
