import { ROOM } from '../config.js';
import { WALL_HEIGHT as H, HALF as half } from './layout.js';

// Floors, walls, the entrance with its doors, and the glass wall onto the pool.
export function buildShell({ models, place }) {
  // Main floor plus the kitchen alcove that juts out to the north.
  const floor = place(models.RoomFloor(ROOM.width, ROOM.depth), 0, 0, 0);
  floor.userData.kind = 'floor';
  place(models.RoomFloor(6, 3), 3.5, 0, -8);

  // Hard walls north, east and south; the entrance sits left of centre in the south wall.
  place(models.RoomWall(7, H), -3, 0, -6.5);
  place(models.RoomWall(3, H), .5, 0, -8, Math.PI / 2);
  place(models.RoomWall(6, H), 3.5, 0, -9.5);
  place(models.RoomWall(16, H), half, 0, -1.5, Math.PI / 2);
  place(models.RoomWall(1.3, H), -5.85, 0, half);
  place(models.RoomWall(9.3, H), 1.85, 0, half);
  place(models.EntranceFrame(2.4, H), -4, 0, half - .05);
  place(models.EntranceDoors(1.74, H - .32), -4, 0, half - .05);

  // Glass wall toward the pool: ten panels, mullions between them, pillars at the corners.
  for (let index = 0; index < 10; index++) {
    const z = -5.85 + index * 1.3;
    place(models.WindowGlassPanel(1.24, H - .1), -half, 0, z, Math.PI / 2);
    if (index < 9) place(models.WindowMullion(H), -half, 0, z + .65, Math.PI / 2);
  }
  for (const z of [-half, half]) place(models.WallPillar(H), -half, 0, z);
}
