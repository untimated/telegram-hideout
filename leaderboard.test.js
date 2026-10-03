import test from 'node:test';
import assert from 'node:assert/strict';
import { drawBulletinBoard, drawLeaderboardSign } from './public/js/models/leaderboard-art.js';
import { buildLeaderboard } from './public/js/stage/leaderboard.js';

function createMockDocument() {
  const dummyGrad = { addColorStop() {} };
  const mockContext = {
    fillRect() {},
    roundRect() {},
    save() {},
    restore() {},
    beginPath() {},
    arc() {},
    fill() {},
    stroke() {},
    moveTo() {},
    lineTo() {},
    closePath() {},
    translate() {},
    rotate() {},
    createRadialGradient: () => dummyGrad,
    createLinearGradient: () => dummyGrad,
    fillText() {},
    strokeText() {},
  };
  return {
    createElement(tag) {
      if (tag === 'canvas') {
        return {
          width: 0,
          height: 0,
          getContext: () => mockContext,
        };
      }
      return {};
    },
  };
}

test('drawBulletinBoard and drawLeaderboardSign generate textures with matching dimensions', () => {
  const previousDoc = globalThis.document;
  globalThis.document = createMockDocument();
  try {
    const board = drawBulletinBoard();
    assert.equal(board.width, 1024);
    assert.equal(board.height, 768);

    const sign = drawLeaderboardSign();
    assert.equal(sign.width, 1024);
    assert.equal(sign.height, 384);
  } finally {
    if (previousDoc === undefined) delete globalThis.document;
    else globalThis.document = previousDoc;
  }
});

test('buildLeaderboard places model and registers interactable with approach vector', () => {
  const previousDoc = globalThis.document;
  globalThis.document = createMockDocument();
  try {
    const dummyObj = {
      name: 'Leaderboard',
      position: { x: 0, y: 0, z: 0, set(x, y, z) { Object.assign(this, { x, y, z }); } },
      rotation: { y: 0 },
      userData: {},
    };
    const interactables = [];
    const models = {
      Leaderboard: () => dummyObj,
    };
    const place = (obj, x, y, z, yaw = 0) => {
      obj.position.set(x, y, z);
      obj.rotation.y = yaw;
      return obj;
    };
    const interactable = (id, object, options) => {
      interactables.push({ id, object, ...options });
    };

    const board = buildLeaderboard({ models, place, interactable }, -2.4, 2.5, 0.2);
    assert.equal(board, dummyObj);
    assert.equal(board.position.x, -2.4);
    assert.equal(board.position.z, 2.5);

    assert.equal(interactables.length, 1);
    const [entry] = interactables;
    assert.equal(entry.id, 'leaderboard');
    assert.equal(entry.object, dummyObj);
    assert.equal(entry.label, 'View Rankings');
    assert.deepEqual(entry.action, { type: 'leaderboard' });
    assert.ok(entry.approach, 'must provide approach position');
    assert.ok(typeof entry.approach.x === 'number');
    assert.ok(typeof entry.approach.z === 'number');
  } finally {
    if (previousDoc === undefined) delete globalThis.document;
    else globalThis.document = previousDoc;
  }
});
