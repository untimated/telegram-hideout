import { ROOM } from '../config.js';

// Shared layout facts, in metres. Origin is the centre of the 13 x 13 m main floor:
// +x east (stage side), +z south (entrance), -z north (bar). Authored from
// "GossipBar - Layout - Concept.png"; props keep their natural size.
export const WALL_HEIGHT = ROOM.wallHeight;
export const HALF = ROOM.width / 2;

// The refreshment island on its flat tile inset; the skylight and ring light centre on it.
export const FOUNTAIN = Object.freeze({ x: -3, z: .75 });

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
