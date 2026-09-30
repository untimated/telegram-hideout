// Shown on the loading screen and in the log panel. Keep in step with package.json's version.
export const APP_VERSION = '1.0.0-beta.1';

// The level is authored in metres. Origin: centre of the 13 x 13 m main floor,
// +x toward the stage/east wall, +z toward the entrance (south), -z toward the bar.
export const ROOM = Object.freeze({ width: 13, depth: 13, wallHeight: 3.1 });

// Players arrive just inside the entrance, which sits left of centre: somewhere random in
// SPAWN_AREA (the floor between the doors and the pool glass), facing into the room.
export const DEFAULT_SPAWN = Object.freeze({ x: -4, z: 5.5 });
export const SPAWN_AREA = Object.freeze({ x0: -5.9, x1: -2.6, z0: 4.4, z1: 6 });

// Keeps players ~0.5 m inside the walls; the kitchen alcove is behind its counter.
export const MOVEMENT_BOUNDS = Object.freeze({
  halfWidth: 6,
  halfDepth: 6,
});

// Robots are modelled ~1.9 m tall; shrink them a touch so they sit better in the room.
export const CHARACTER_SCALE = .9;

// First-person eye height in metres (about level with the robots' faces).
export const EYE_HEIGHT = 1.3;
