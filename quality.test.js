import test from 'node:test';
import assert from 'node:assert/strict';
import { createQualityGovernor } from './public/js/quality.js';

function setup(t, pixelRatio = 1) {
  const original = Object.fromEntries(['devicePixelRatio', 'document'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  t.after(() => {
    for (const [key, descriptor] of Object.entries(original)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  });
  globalThis.devicePixelRatio = pixelRatio;
  globalThis.document = { hidden: false };
  const ratios = [];
  const lights = [
    { isPointLight: true, distance: 3.2, visible: true },
    { isPointLight: true, distance: 7, visible: true },
    { isPointLight: true, distance: 0, visible: true },
    { isDirectionalLight: true, visible: true },
  ];
  const quality = createQualityGovernor({
    renderer: { setPixelRatio: value => ratios.push(value) },
    scene: { traverse: visit => lights.forEach(visit) },
  });
  const state = { quality, ratios, lights, ready: false };
  quality.ready.then(() => { state.ready = true; });
  return state;
}

test('a fast device keeps its full initial resolution and opens after the first sample', async t => {
  const state = setup(t, 1.5);
  state.quality.sample(60, .5);
  await state.quality.ready;
  assert.equal(state.ready, true);
  assert.deepEqual(state.ratios, [1.5]);
  assert.ok(state.lights.every(light => light.visible));
});

test('the measured slow desktop profile settles before the room opens', async t => {
  const state = setup(t);
  state.quality.sample(35, .5);
  await Promise.resolve();
  assert.equal(state.ready, false);
  assert.deepEqual(state.ratios, [1, .75]);
  state.quality.sample(48, 1);
  await state.quality.ready;
  assert.equal(state.ready, true);
  assert.ok(state.lights.every(light => light.visible));
});

test('a slow high-density device reaches the resolution floor and dims only small lights', async t => {
  const state = setup(t, 3);
  for (let time = .5; time <= 3; time += .5) state.quality.sample(20, time);
  await Promise.resolve();
  assert.equal(state.ready, false);
  assert.deepEqual(state.ratios, [2, 1.75, 1.5, 1.25, 1, .75]);
  assert.deepEqual(state.lights.map(light => light.visible), [false, true, true, true]);
  state.quality.sample(48, 3.5);
  await state.quality.ready;
});

test('startup sampling has a time limit when frames remain slow', async t => {
  const state = setup(t, 2);
  state.quality.sample(20, .5);
  state.quality.sample(20, 3.5);
  await state.quality.ready;
  assert.deepEqual(state.ratios, [2, 1.75]);
});

test('a hidden tab does not choose quality from its throttled frame rate', async t => {
  const state = setup(t);
  document.hidden = true;
  state.quality.sample(1, .5);
  state.quality.sample(1, 5);
  await Promise.resolve();
  assert.equal(state.ready, false);
  assert.deepEqual(state.ratios, [1]);
  document.hidden = false;
  state.quality.sample(60, 6);
  await state.quality.ready;
  assert.deepEqual(state.ratios, [1]);
});

test('after startup, quality waits for sustained slow frames and resets on recovery', async t => {
  const state = setup(t, 1.25);
  state.quality.sample(60, .5);
  await state.quality.ready;
  for (const time of [1, 1.5, 2, 2.5, 3]) state.quality.sample(20, time);
  assert.deepEqual(state.ratios, [1.25]);
  state.quality.sample(20, 3.5);
  state.quality.sample(60, 4);
  for (const time of [4.5, 5, 5.5]) state.quality.sample(20, time);
  assert.deepEqual(state.ratios, [1.25]);
  state.quality.sample(20, 6);
  assert.deepEqual(state.ratios, [1.25, 1]);
});
