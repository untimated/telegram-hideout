import { createProceduralTools } from './core.js';
import { createArchitectureModels } from './architecture.js';
import { createBarModels } from './bar.js';
import { createKitchenModels } from './kitchen.js';
import { createFurnitureModels } from './furniture.js';
import { createDecorModels } from './decor.js';
import { createRoofModels } from './roof.js';
import { createPalmModels } from './palms.js';
import { createSlotMachineModel } from './slot-machine.js';
import { createFemaleRobotModel } from './female-robot.js';
import { createNewsstandModel } from './newsstand.js';
import { createLeaderboardModel } from './leaderboard.js';
import { createRouletteModel } from './roulette.js';

export function createModelKit(THREE, { Robot } = {}) {
  const tools = createProceduralTools(THREE);
  const architecture = createArchitectureModels(tools);
  return Object.freeze({
    ...architecture,
    ...createBarModels(tools),
    ...createKitchenModels(tools),
    ...createFurnitureModels(tools),
    ...createDecorModels(tools, architecture),
    ...createRoofModels(tools),
    ...createPalmModels(tools),
    SlotMachine: () => createSlotMachineModel(tools),
    FemaleRobot: () => createFemaleRobotModel(THREE),
    Newsstand: () => createNewsstandModel(tools),
    Leaderboard: () => createLeaderboardModel(tools),
    Roulette: () => createRouletteModel(tools),
    materials: tools.materials,
    ...(Robot ? { Robot } : {}),
  });
}
