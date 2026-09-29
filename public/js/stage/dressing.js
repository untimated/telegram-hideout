import { HALF as half } from './layout.js';

// Plants, paintings and wall lights that finish the walls.
export function buildDressing({ models, place }) {
  for (const [x, z, seed] of [
    [6, -5.6, 17], [6, -1.9, 21], [6, 1.9, 26],
    [-6.05, 2.1, 32], [-5.7, 6.1, 39], [-2.3, 6.1, 42],
  ]) place(models.PottedPlant(.62, seed), x, 0, z);

  // East wall: three small procedural frames, lit by alternating warm/magenta sconces.
  for (const z of [-3.4, -.6, 2.2]) place(models.WallArtFrame(.8, .58), 6.37, 1.95, z, -Math.PI / 2);
  for (const [z, tone] of [[-2, 'warm'], [.8, 'magenta'], [3.8, 'warm']]) place(models.WallLight(tone), 6.36, 1.5, z, -Math.PI / 2);

  // South wall: one painting between the entrance doors and the stage, one centred behind it.
  place(models.WallPainting({ width: 1.8, height: 1.2, image: '/paintings/abstract_cyber_ai_gen.webp' }), -.5, 1, half - .12, Math.PI);
  place(models.WallPainting({ width: 2.1, height: 1.4, image: '/paintings/geom_face_ai_gen.webp' }), 4.3, 1.2, half - .12, Math.PI);

  // North wall sconces beside the bar sign.
  place(models.WallLight('magenta'), -6.2, 1.85, -6.36);
  place(models.WallLight('cyan'), 0, 1.85, -6.36);
}
