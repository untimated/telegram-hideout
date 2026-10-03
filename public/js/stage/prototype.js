import { createStageContext } from './context.js';
import { buildNewsstand } from './newsstand.js';
import { buildLeaderboard } from './leaderboard.js';

// Add experimental props here. Move an approved prop's builder into a main-room area later.
export function buildPrototypeStage(THREE, scene, options = {}) {
  const context = createStageContext(THREE, scene, options);
  const { level, models, place, animators } = context;
  level.name = 'PrototypeStage';
  const floor = place(models.RoomFloor(13, 13), 0, 0, 0);
  floor.userData.kind = 'floor';
  for (const [x, z, yaw] of [[0, -6.5, 0], [0, 6.5, 0], [-6.5, 0, Math.PI / 2], [6.5, 0, Math.PI / 2]]) {
    place(models.RoomWall(13, 3.1), x, 0, z, yaw);
  }
  const grid = new THREE.GridHelper(12, 12, 0x54c8c0, 0x626e78);
  grid.position.y = .015;
  level.add(grid);
  const femaleRobot = place(models.FemaleRobot(), 0, 0, 0, Math.PI);
  animators.push(time => femaleRobot.userData.animate(time));
  buildNewsstand(context, 0, 2);
  buildLeaderboard(context, -2.4, 2.5, 0.2);
  scene.add(new THREE.HemisphereLight(0xe4efff, 0x45403c, 2));
  const light = new THREE.DirectionalLight(0xffe3bb, 2);
  light.position.set(-3, 8, 4);
  light.castShadow = true;
  Object.assign(light.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, far: 25 });
  light.shadow.camera.updateProjectionMatrix();
  light.shadow.mapSize.set(1024, 1024);
  light.shadow.bias = -.0003;
  scene.add(light);
  return level;
}
