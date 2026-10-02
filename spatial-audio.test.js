import test from 'node:test';
import assert from 'node:assert/strict';
import { createSpatialAudio } from './public/js/spatial-audio.js';

function setup(t, supported = true) {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'AudioContext');
  t.after(() => {
    if (original) Object.defineProperty(globalThis, 'AudioContext', original);
    else delete globalThis.AudioContext;
  });
  const contexts = [];
  const node = () => ({ connections: [], connect(target) { this.connections.push(target); }, disconnect() { this.connections = []; } });
  globalThis.AudioContext = supported ? class {
    constructor() {
      this.destination = {};
      this.state = 'suspended';
      this.resumes = 0;
      this.sources = [];
      this.panners = [];
      this.gains = [];
      contexts.push(this);
    }
    async resume() {
      this.resumes++;
      if (this.rejectResume) throw new Error('Gesture required');
      this.state = 'running';
    }
    createMediaElementSource(element) {
      assert.equal(this.sources.some(source => source.element === element), false, 'each element is routed only once');
      const source = { ...node(), element };
      this.sources.push(source);
      return source;
    }
    createStereoPanner() {
      const panner = { ...node(), pan: { value: 0 } };
      this.panners.push(panner);
      return panner;
    }
    createGain() {
      const gain = { ...node(), gain: { value: 1 } };
      this.gains.push(gain);
      return gain;
    }
  } : undefined;
  const element = { volume: 1, paused: false, pause() { this.paused = true; } };
  return { spatial: createSpatialAudio(), contexts, element };
}

test('positional audio unlocks lazily, applies camera orientation and routes each element once', async t => {
  const { spatial, contexts, element } = setup(t);
  spatial.setListener({ x: 0, y: 1.3, z: 0 }, { x: -1, y: 0, z: 0 }, { x: 0, y: 1, z: 0 });
  spatial.addSource(element, { position: { x: -4, y: 1.2, z: 0 }, volume: .6, range: 8 });
  assert.equal(contexts.length, 0);
  assert.equal(element.volume, .3);
  assert.equal(await spatial.unlock(), true);
  const context = contexts[0];
  assert.ok(Math.abs(context.panners[0].pan.value) < 1e-6, 'source straight ahead is centred');
  assert.equal(context.panners[0].channelCount, 1);
  assert.equal(element.volume, 1);
  assert.equal(context.gains[0].gain.value, .3);
  assert.deepEqual(context.sources[0].connections, [context.gains[0]]);
  assert.deepEqual(context.gains[0].connections, [context.panners[0]]);
  assert.deepEqual(context.panners[0].connections, [context.destination]);
  await spatial.unlock();
  assert.equal(contexts.length, 1);
  assert.equal(context.sources.length, 1);
  assert.equal(context.resumes, 1);
  spatial.setListener({ x: 0, y: .7, z: 0 }, { x: 0, y: 0, z: -1 }, { x: 0, y: .8, z: .6 });
  assert.equal(context.panners[0].pan.value, -1, 'camera-left source strongly favours the left channel');
});

test('moderately off-centre sources separate strongly and follow camera turns', async t => {
  const { spatial, contexts, element } = setup(t);
  const emitter = spatial.addSource(element, { position: { x: 0, z: -4 } });
  await spatial.unlock();
  const panner = contexts[0].panners[0];
  assert.equal(panner.pan.value, 0);
  emitter.setPosition({ x: -4 * Math.sin(Math.PI / 12), z: -4 * Math.cos(Math.PI / 12) });
  assert.ok(Math.abs(panner.pan.value + .5) < 1e-6, '15 degrees left is already halfway to full pan');
  emitter.setPosition({ x: -2, z: -Math.sqrt(12) });
  assert.ok(panner.pan.value < -.999, '30 degrees left reaches full left');
  emitter.setPosition({ x: 2, z: -Math.sqrt(12) });
  assert.ok(panner.pan.value > .999, '30 degrees right reaches full right');
  spatial.setListener({ x: 0, z: 0 }, { x: 0, y: 0, z: 1 });
  assert.ok(panner.pan.value < -.999, 'turning around swaps speaker dominance');
  emitter.setPosition({ x: 0, z: 4 });
  assert.equal(panner.pan.value, 0, 'straight ahead remains balanced');
  emitter.setPosition({ x: 0, z: 0 });
  assert.equal(panner.pan.value, 0, 'a coincident source has finite, centred pan');
});

test('moving emitters share the listener, become silent at range and disconnect on disposal', async t => {
  const { spatial, contexts, element } = setup(t);
  await spatial.unlock();
  const emitter = spatial.addSource(element, { position: { x: 0, y: 1, z: 0 }, volume: .5, range: 8 });
  const context = contexts[0];
  assert.equal(context.gains[0].gain.value, .5);
  emitter.setPosition({ x: 4, z: 0 });
  assert.equal(context.panners[0].pan.value, 1);
  assert.equal(context.gains[0].gain.value, .25);
  spatial.setListener({ x: -4, z: 0 });
  assert.equal(context.gains[0].gain.value, 0);
  emitter.dispose();
  assert.equal(element.paused, true);
  assert.deepEqual(context.sources[0].connections, []);
  assert.deepEqual(context.gains[0].connections, []);
  assert.deepEqual(context.panners[0].connections, []);
  spatial.setListener({ x: 4, z: 0 });
  assert.equal(context.gains[0].gain.value, 0, 'disposed emitters no longer receive updates');
});

test('suspended audio retries after a blocked gesture without duplicating sources', async t => {
  const { spatial, contexts, element } = setup(t);
  spatial.addSource(element, { position: { x: 0, z: 0 } });
  await spatial.unlock();
  const context = contexts[0];
  context.state = 'suspended';
  context.rejectResume = true;
  assert.equal(await spatial.unlock(), false);
  assert.equal(spatial.blocked, true);
  context.rejectResume = false;
  assert.equal(await spatial.unlock(), true);
  assert.equal(spatial.blocked, false);
  assert.equal(context.resumes, 3);
  assert.equal(context.sources.length, 1);
});

test('browsers without Web Audio retain the same distance fade', async t => {
  const { spatial, contexts, element } = setup(t, false);
  const emitter = spatial.addSource(element, { position: { x: 0, z: 0 }, volume: .6, range: 8 });
  assert.equal(await spatial.unlock(), true);
  spatial.setListener({ x: 4, z: 0 });
  assert.equal(element.volume, .3);
  emitter.setPosition({ x: -4, z: 0 });
  assert.equal(element.volume, 0);
  assert.equal(contexts.length, 0);
});
