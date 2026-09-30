import { ROOM } from '../config.js';

// Shared layout facts, in metres. Origin is the centre of the 13 x 13 m main floor:
// +x east (stage side), +z south (entrance), -z north (bar). Authored from
// "GossipBar - Layout - Concept.png"; props keep their natural size.
export const WALL_HEIGHT = ROOM.wallHeight;
export const HALF = ROOM.width / 2;

// The refreshment island on its flat tile inset; the skylight and ring light centre on it.
export const FOUNTAIN = Object.freeze({ x: -3, z: .75 });

// Raised floors people stand on (tops in metres); must match bar.js and stage-area.js.
export const PLATFORMS = Object.freeze([
  { name: 'bar', x0: -6.5, x1: -.4, z0: -6.5, z1: -2, height: .28 },
  { name: 'stage', x0: 2.2, x1: 6.4, z0: 2.8, z1: 6.4, height: .4 },
]);

// Floor height under (x, z), so players stand on the bar platform and the stage.
export function floorHeightAt(x, z) {
  for (const platform of PLATFORMS) {
    if (x >= platform.x0 && x <= platform.x1 && z >= platform.z0 && z <= platform.z1) return platform.height;
  }
  return 0;
}

// Pool strip west of the glass wall. It was 1.9 m wide and is now 1.5x that, growing away from
// the glass (its east edge stays put); `growth` lets older west-side coordinates be shifted.
const poolWidth = 1.9 * 1.5;
export const POOL = Object.freeze({
  width: poolWidth,
  length: 13.2,
  x: -7.7 - poolWidth / 2,
  outerWallX: -7.7 - poolWidth - .35,
  growth: poolWidth - 1.9,
});
