import { HALF as half, POOL } from './layout.js';

// Planted deck against the glass, the tiled basin with its water and caustics, underwater lamps,
// and a low outer wall. Ripples and caustics drift via the context's animators.
export function buildPool({ THREE, models, level, place, animators }) {
  const { width, length, x: poolX, outerWallX } = POOL;

  place(models.RoomFloor(1.1, 13.4), -7.05, 0, 0);
  place(models.PoolBasin(width, length), poolX, 0, 0);
  place(models.PoolWaterSurface(width - .1, 13.1), poolX, 0, 0);
  const caustics = place(models.PoolCaustics(width - .1, 13.1), poolX, 0, 0);

  // Coping sits on top of the tile walls and is wider than them, so no faces are coplanar.
  for (const x of [poolX - width / 2 - .09, poolX + width / 2 + .09]) place(models.PoolCoping(13.2, .24), x, 0, 0, Math.PI / 2);
  for (const z of [-6.69, 6.69]) place(models.PoolCoping(width + .5, .24), poolX, 0, z);

  // Lamps staggered along both long walls, plus three real lights so they wash the tiles;
  // the rest of the glow is additive halos.
  for (let index = 0; index < 6; index++) {
    place(models.PoolWallLight(), poolX + width / 2 - .015, -.62, -5.5 + index * 2.2, -Math.PI / 2);
    place(models.PoolWallLight(), poolX - width / 2 + .015, -.62, -4.4 + index * 2.2, Math.PI / 2);
  }
  for (const z of [-4.4, 0, 4.4]) {
    const wash = new THREE.PointLight(0x33e6ff, 7, 5.5, 2);
    wash.position.set(poolX, -.55, z);
    level.add(wash);
  }

  place(models.RoomWall(13.6, 1.3), outerWallX, 0, 0, Math.PI / 2);
  for (const z of [-6.8, 6.8]) place(models.RoomWall(-half - outerWallX + .18, 1.3), (outerWallX - half) / 2, 0, z);
  for (let index = 0; index < 10; index++) place(models.PottedPlant(1, index + 2), -7.05, 0, -5.4 + index * 1.2);

  // Slowly drift the ripple normal and roughness maps together, and each caustic layer.
  const water = models.materials.water;
  animators.push(time => {
    water.normalMap.offset.set(time * .003, time * .005);
    water.roughnessMap.offset.copy(water.normalMap.offset);
    for (const { map, speed } of caustics.userData.maps) map.offset.set(time * speed[0], time * speed[1]);
  });
}
