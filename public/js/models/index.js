import { createProceduralTools } from './core.js';
import { createArchitectureModels } from './architecture.js';
import { createBarModels } from './bar.js';
import { createKitchenModels } from './kitchen.js';
import { createFurnitureModels } from './furniture.js';
import { createDecorModels } from './decor.js';
import { createRoofModels } from './roof.js';
import { createPalmModels } from './palms.js';

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
    materials: tools.materials,
    ...(Robot ? { Robot } : {}),
  });
}
