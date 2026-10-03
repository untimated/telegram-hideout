import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPoolFloats } from './public/js/stage/pool-floats.js';
import { POOL } from './public/js/stage/layout.js';

test('pool rings start on the water and remain inside the pool while drifting', () => {
  const previousDocument = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ({ fillRect() {} }) }) };
  const vector = () => ({ x: 0, y: 0, z: 0, set(x, y, z) { Object.assign(this, { x, y, z }); } });
  class Group {
    constructor() { this.children = []; this.userData = {}; this.position = vector(); this.rotation = vector(); }
    add(child) { this.children.push(child); }
  }
  class Mesh extends Group {}
  class Asset {}
  const THREE = { Group, Mesh, CanvasTexture: Asset, TorusGeometry: Asset, MeshStandardMaterial: Asset };
  try {
    const level = new Group();
    const animators = [];
    buildPoolFloats({ THREE, level, animators });
    assert.equal(level.children.length, 2);
    const check = () => {
      for (const ring of level.children) {
        // Include the ring's outer radius, so its whole footprint remains on the water.
        assert.ok(Math.abs(ring.position.x - POOL.x) + .57 < POOL.width / 2);
        assert.ok(Math.abs(ring.position.z) + .57 < POOL.length / 2);
        assert.ok(ring.position.y > 0, 'ring must not sit at the room origin');
        assert.equal(ring.userData.dynamic, true);
      }
    };
    check(); // Before any frame: catches the misplaced ring in still previews/startup.
    for (const time of [1, 20, 40, 80, 105, 500]) {
      animators.forEach(animate => animate(time));
      check();
    }
  } finally {
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
  }
});
