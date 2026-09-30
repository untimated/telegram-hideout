import { createFoodDrinkTools } from './core.js';
import { createFoodBuilders } from './food.js';
import { createDrinkBuilders } from './drinks.js';

// One factory per scene. Materials are shared; each call creates independent geometry.
export function createFoodDrinkModels(THREE) {
  const tools = createFoodDrinkTools(THREE);
  const builders = { ...createFoodBuilders(tools), ...createDrinkBuilders(tools) };
  const ids = Object.freeze(Object.keys(builders));
  function create(itemID) {
    if (!builders[itemID]) throw new Error(`Unknown food/drink model: ${itemID}`);
    const root = new THREE.Group();
    root.name = itemID;
    root.userData.itemID = itemID;
    builders[itemID](root);
    return root;
  }
  return { create, ids };
}
