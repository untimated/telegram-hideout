import { DEFAULT_SPAWN, MOVEMENT_BOUNDS, SPAWN_AREA } from './config.js';

// Shared by the browser and server. Keep map bounds and spawn placement together.
export const MAPS = Object.freeze({
  main: Object.freeze({ id: 'main', label: 'Gossip Bar', bounds: MOVEMENT_BOUNDS, spawn: DEFAULT_SPAWN, spawnArea: SPAWN_AREA }),
  prototype: Object.freeze({
    id: 'prototype', label: 'Prototype Room',
    bounds: Object.freeze({ halfWidth: 6, halfDepth: 6 }),
    spawn: Object.freeze({ x: 0, z: 5 }),
    spawnArea: Object.freeze({ x0: -2, x1: 2, z0: 4, z1: 5.5 }),
  }),
});

// Missing/empty map keeps old links working. Unknown names are rejected.
export function mapFromQuery(value) {
  const id = value || 'main';
  return Object.hasOwn(MAPS, id) ? MAPS[id] : null;
}
