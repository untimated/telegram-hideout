import { ROOM } from '../config.js';
import { WALL_HEIGHT as H, HALF as half, FOUNTAIN } from './layout.js';

// Slabs around a raised glass skylight over the fountain, coffered with neon-inlaid beams, plus
// pendants and a truss so the room reads as lit from above. Nothing here casts shadows.
export function buildCeiling({ THREE, models, level, place }) {
  const ceiling = new THREE.Group();
  ceiling.name = 'Ceiling';
  level.add(ceiling);
  const put = (model, x, y, z, yaw = 0) => place(model, x, y, z, yaw, ceiling);

  // Skylight opening, centred over the fountain inset.
  const hole = { x0: -5.4, x1: -.6, z0: -1.4, z1: 3.4 };
  const holeW = hole.x1 - hole.x0;
  const holeD = hole.z1 - hole.z0;
  const holeX = (hole.x0 + hole.x1) / 2;
  const holeZ = (hole.z0 + hole.z1) / 2;
  put(models.CeilingSlab(ROOM.width, hole.z0 + half), 0, H, (-half + hole.z0) / 2);
  put(models.CeilingSlab(ROOM.width, half - hole.z1), 0, H, (hole.z1 + half) / 2);
  put(models.CeilingSlab(hole.x0 + half, holeD), (-half + hole.x0) / 2, H, holeZ);
  put(models.CeilingSlab(half - hole.x1, holeD), (hole.x1 + half) / 2, H, holeZ);
  put(models.CeilingSlab(6, 3), 3.5, H, -8);
  put(models.Skylight(holeW, holeD), holeX, H, holeZ);
  // Eave over the glass wall hides the top of the frame from inside and outside.
  put(models.CeilingSlab(.45, ROOM.depth + .36), -half - .225 + .09, H, 0);

  put(models.CeilingBeam(ROOM.width, 'cyan'), 0, H, -5.6);
  put(models.CeilingBeam(ROOM.width, 'warm'), 0, H, 5.6);
  put(models.CeilingBeam(ROOM.depth, 'magenta'), 2.2, H, 0, Math.PI / 2);
  put(models.CeilingBeam(ROOM.depth, 'warm'), 5, H, 0, Math.PI / 2);

  // Glow along the top of the walls.
  put(models.CoveStrip(15.8, 'warm'), half - .04, H - .12, -1.5, Math.PI / 2);
  put(models.CoveStrip(6.8, 'cyan'), -3, H - .12, -6.38);
  put(models.CoveStrip(5.8, 'warm'), 3.5, H - .12, -9.38);
  put(models.CoveStrip(2.9, 'warm'), .62, H - .12, -7.95, Math.PI / 2);
  put(models.CoveStrip(9.3, 'cyan'), 1.85, H - .12, half - .04);

  // Bar, café, lounge, fountain and stage each get their own light fitting.
  for (const x of [-5.4, -4.2, -3]) put(models.PendantLamp(.65, 'warm'), x, H, -3.75);
  for (const z of [-4.8, -3.15]) put(models.PendantLamp(.75, 'warm', .3), 3.6, H, z);
  put(models.LinearLight(1.7, .7, 'warm'), 3.2, H, .12);
  put(models.RingLight(1.3, .95, 'warm'), FOUNTAIN.x, 2.75, FOUNTAIN.z);
  put(models.StageTruss(3.8, .55), 4.3, H, 3.3);
  for (const x of [2.5, 4.5]) put(models.RecessedPanel(.9, .9), x, H, -8);
}
