import { HALF as half } from './layout.js';
import { buildArtDetails } from './art-details.js';
import { buildLeaderboard } from './leaderboard.js';

// Plants, paintings and wall lights that finish the walls.
export function buildDressing(context) {
  const { models, place } = context;
  for (const [x, z, seed] of [
    [6, -5.6, 17], [6, -1.9, 21], [6, 1.9, 26],
    [-6.05, 3.2, 32], [-5.7, 6.1, 39], [-2.3, 6.1, 42],
  ]) place(models.PottedPlant(.78, seed, true), x, 0, z);

  // East wall: three small procedural frames, lit by alternating warm/magenta sconces.
  for (const z of [-3.4, -.6, 2.2]) place(models.WallArtFrame(.8, .58), 6.37, 1.95, z, -Math.PI / 2);
  for (const [z, tone] of [[-2, 'warm'], [.8, 'magenta'], [3.8, 'warm']]) place(models.WallLight(tone), 6.36, 1.5, z, -Math.PI / 2);

  // The entrance painting moves to the east wall over the stage; its old spot holds rankings.
  place(models.WallPainting({ width: 1.8, height: 1.2, image: '/paintings/abstract_cyber_ai_gen.webp' }), half - .13, 1.25, 4.8, -Math.PI / 2);
  buildLeaderboard(context, -.5, half - .36, Math.PI);
  // Keep the face painting on the stage's south wall.
  place(models.WallPainting({ width: 2.1, height: 1.4, image: '/paintings/geom_face_ai_gen.webp' }), 4.3, 1.2, half - .12, Math.PI);

  // North wall sconces beside the bar sign.
  place(models.WallLight('magenta'), -6.2, 1.85, -6.36);
  place(models.WallLight('cyan'), 0, 1.85, -6.36);
  buildArtDetails(context);
}
