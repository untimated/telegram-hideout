import { createStageContext } from './stage/context.js';
import { buildLighting } from './stage/lighting.js';
import { buildShell } from './stage/shell.js';
import { buildPool } from './stage/pool.js';
import { buildBar } from './stage/bar.js';
import { buildKitchen } from './stage/kitchen.js';
import { buildLounge } from './stage/lounge.js';
import { buildStageArea } from './stage/stage-area.js';
import { buildDressing } from './stage/dressing.js';
import { buildNpcs } from './stage/npcs.js';
import { buildCeiling } from './stage/ceiling.js';
import { buildBackdrop } from './stage/backdrop.js';

// Builds the Gossip Bar and returns its group. One module per area lives in ./stage/, sharing the
// context from ./stage/context.js; coordinates are metres (see ./stage/layout.js).
//
// The returned group carries:
//   userData.interactables  live list of { id, label, object, approach } for click/UI systems
//   userData.animate(time)  advances pool ripples and caustics; call every frame with seconds
export function buildGossipBarStage(THREE, scene, options = {}) {
  const context = createStageContext(THREE, scene, options);
  for (const build of [
    buildLighting, buildShell, buildPool, buildBar, buildKitchen, buildLounge,
    buildStageArea, buildDressing, buildNpcs, buildCeiling, buildBackdrop,
  ]) build(context);
  return context.level;
}
