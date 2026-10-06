import test from 'node:test';
import assert from 'node:assert/strict';
import { createRouletteAnimator } from './public/js/roulette-animation.js';
import { ROULETTE, ROULETTE_POCKETS } from './public/js/game/roulette.js';

const TURN = Math.PI * 2;
function setup(pocket, variation = .5, effects, parts = {}) {
  const wheel = { rotation: { z: 0 } };
  const ball = { position: { x: .294, y: -.294, z: .106,
    set(x, y, z) { Object.assign(this, { x, y, z }); } } };
  let clock = 0, draw = 0;
  const animation = createRouletteAnimator({ userData: { roulette: { wheel, ball, effects, ...parts } } }, {
    now: () => clock,
    random: () => draw++ % 5 === 0 ? (pocket + .5) / ROULETTE_POCKETS.length : variation,
  });
  return { wheel, ball, animation, setTime(value) { clock = value; } };
}

test('every colored pocket can be reached, with a captured ball following it to the exact stop', () => {
  for (let pocket = 0; pocket < ROULETTE_POCKETS.length; pocket++) {
    const { wheel, ball, animation } = setup(pocket);
    const result = animation.start(ROULETTE.spinDuration);
    assert.equal(result.color, ROULETTE_POCKETS[pocket]);
    for (const progress of [.88, .92, 1]) {
      animation.update(ROULETTE.spinDuration * progress);
      const expected = wheel.rotation.z + Math.PI / 2 + pocket * TURN / ROULETTE_POCKETS.length;
      assert.ok(Math.abs(ball.position.x - Math.cos(expected) * .315) < 1e-10);
      assert.ok(Math.abs(ball.position.y - Math.sin(expected) * .315) < 1e-10);
      assert.equal(ball.position.z, .106);
    }
  }
});

test('effect sampling matches the moving ball and effects clear on cancellation and finish', () => {
  let visible = false, lastSample;
  const position = { set(x, y, z) { Object.assign(this, { x, y, z }); } };
  const effects = {
    clear() { visible = false; },
    update(progress, duration, bounces, sample) {
      visible = progress > 0 && progress < .88;
      sample(progress, position);
      lastSample = [position.x, position.y, position.z];
    },
  };
  const { animation, ball, setTime } = setup(7, .5, effects);
  animation.start(ROULETTE.spinDuration);
  animation.update(4000);
  assert.equal(visible, true);
  assert.deepEqual(lastSample, [ball.position.x, ball.position.y, ball.position.z]);
  setTime(4200);
  animation.cancel();
  assert.equal(visible, false);
  animation.update(5000);
  assert.equal(visible, false, 'a cancelled spin cannot revive its trail');
  animation.start(ROULETTE.spinDuration);
  animation.update(7000);
  assert.equal(visible, true);
  animation.finish();
  assert.equal(visible, false);
});

test('ball counter-rotates, hops behind the glass, and moves continuously across phase boundaries', () => {
  for (const variation of [0, .5, .999]) {
    const { wheel, ball, animation } = setup(11, variation);
    animation.start(ROULETTE.spinDuration);
    const startAngle = Math.atan2(ball.position.y, ball.position.x);
    animation.update(10);
    assert.ok(wheel.rotation.z > 0);
    assert.ok(Math.atan2(ball.position.y, ball.position.x) < startAngle);
    let hops = 0;
    for (let frame = 0; frame <= 754; frame++) {
      animation.update(ROULETTE.spinDuration * frame / 754);
      const radius = Math.hypot(ball.position.x, ball.position.y);
      assert.ok(Number.isFinite(radius));
      assert.ok(radius >= .31 && radius <= .421, 'ball fits between the hub and the outer track');
      assert.ok(ball.position.z + .023 < .14, 'ball remains behind the glass');
      if (ball.position.z > .108) hops++;
    }
    assert.ok(hops > 10, 'divider contacts visibly lift the ball');
    for (const phase of [.08, .6, .88]) {
      const time = ROULETTE.spinDuration * phase;
      animation.update(time - .001);
      const before = { ...ball.position };
      animation.update(time + .001);
      assert.ok(Math.hypot(ball.position.x - before.x, ball.position.y - before.y,
        ball.position.z - before.z) < .00001, 'phase transition has no jump');
    }
  }
});

test('frame skips reach the same finish and another spin launches from the previous ball position', () => {
  const first = setup(2), second = setup(2);
  first.animation.start(ROULETTE.spinDuration);
  second.animation.start(ROULETTE.spinDuration);
  for (let time = 0; time < ROULETTE.spinDuration; time += 1000 / 30) first.animation.update(time);
  first.animation.finish();
  second.animation.update(ROULETTE.spinDuration + 5000);
  assert.deepEqual([first.ball.position.x, first.ball.position.y, first.ball.position.z],
    [second.ball.position.x, second.ball.position.y, second.ball.position.z]);
  assert.deepEqual(first.wheel.rotation, second.wheel.rotation);
  const resting = { ...first.ball.position };
  first.setTime(20000);
  first.animation.start(ROULETTE.spinDuration);
  assert.ok(Math.hypot(first.ball.position.x - resting.x, first.ball.position.y - resting.y) < 1e-10);
  first.setTime(21000);
  first.animation.cancel();
  const cancelled = { ...first.ball.position };
  first.animation.update(50000);
  assert.deepEqual(first.ball.position, cancelled);
});

test('a win briefly squashes and rocks the cabinet with flashing lights, then restores it', () => {
  const scale = { x: 1, y: 1, z: 1, set(x, y, z) { Object.assign(this, { x, y, z }); },
    clone() { return { x: this.x, y: this.y, z: this.z }; } };
  const cabinet = { scale, rotation: { z: 0 } };
  const lights = [];
  const lighting = {
    update() {}, clear() { lights.push('clear'); },
    celebrate(seconds, amount) { lights.push(amount); },
  };
  const splash = [];
  const winEffects = { update(age, kind) { splash.push(kind === 'win' && age >= 0); } };
  const { animation, setTime } = setup(3, .5, undefined, { cabinet, lighting, winEffects });
  animation.start(ROULETTE.spinDuration);
  setTime(ROULETTE.spinDuration);
  animation.finish(false);
  animation.update(ROULETTE.spinDuration + 300);
  assert.deepEqual([scale.y, cabinet.rotation.z], [1, 0], 'a loss leaves the cabinet still');
  assert.ok(!splash.includes(true), 'a loss throws no coins');

  animation.start(ROULETTE.spinDuration);
  setTime(2 * ROULETTE.spinDuration);
  animation.finish(true);
  lights.length = 0;
  let squashed = false, rocked = false;
  for (let ms = 0; ms <= 2400; ms += 1000 / 60) {
    animation.update(2 * ROULETTE.spinDuration + ms);
    squashed ||= Math.abs(scale.y - 1) > .02;
    rocked ||= Math.abs(cabinet.rotation.z) > .015;
    assert.ok(Math.abs(scale.y - 1) < .04 && Math.abs(cabinet.rotation.z) < .04, 'the shake stays subtle');
  }
  assert.ok(squashed && rocked);
  assert.ok(lights.some(value => value === 1), 'lights celebrate at full strength');
  assert.ok(splash.includes(true), 'a win throws the coin splash');
  animation.update(2 * ROULETTE.spinDuration + 2500);
  assert.deepEqual([scale.x, scale.y, scale.z, cabinet.rotation.z], [1, 1, 1, 0]);
  assert.equal(lights.at(-1), 'clear');
  assert.equal(splash.at(-1), false, 'the splash hides once the celebration ends');

  setTime(3 * ROULETTE.spinDuration);
  animation.finish(true);
  animation.update(3 * ROULETTE.spinDuration + 200);
  animation.start(ROULETTE.spinDuration);
  assert.deepEqual([scale.y, cabinet.rotation.z], [1, 0], 'a new spin stops the celebration');
  animation.finish(true);
  animation.update(4 * ROULETTE.spinDuration);
  animation.cancel();
  assert.deepEqual([scale.y, cabinet.rotation.z], [1, 0], 'leaving stops the celebration');
});

test('a bet color lands at the win chance and otherwise on any other pocket', () => {
  for (const [color, draw, won] of [['red', 0, true], ['red', .69, true], ['black', .7, false], ['black', .99, false]]) {
    const { ball, wheel } = setup(0);
    const animation = createRouletteAnimator({ userData: { roulette: { ball, wheel } } }, { now: () => 0, random: () => draw });
    const result = animation.start(ROULETTE.spinDuration, { color, winChance: .7 });
    assert.equal(result.color === color, won);
  }
});
