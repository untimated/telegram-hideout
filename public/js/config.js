// The level is authored in metres. Origin: centre of the 13 x 13 m main floor,
// +x toward the stage/east wall, +z toward the entrance (south), -z toward the bar.
export const ROOM = Object.freeze({ width: 13, depth: 13, wallHeight: 3.1 });

// Players arrive just inside the entrance, which sits left of centre.
export const DEFAULT_SPAWN = Object.freeze({ x: -4, z: 5.5 });

// Keeps players ~0.5 m inside the walls; the kitchen alcove is behind its counter.
export const MOVEMENT_BOUNDS = Object.freeze({
  halfWidth: 6,
  halfDepth: 6,
});
