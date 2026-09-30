import { createModelKit } from '../models/index.js';

// Everything a stage module needs: the model kit, the level group, placement helpers, and the
// registries other systems read (interactables to click on, per-frame animators).
// `now()` is the shared clock in ms (server-corrected), used for NPC shifts and specials.
export function createStageContext(THREE, scene, { Robot, floorEnvironment, now = () => Date.now() } = {}) {
  const models = createModelKit(THREE, { Robot });
  if (floorEnvironment) {
    models.materials.floor.envMap = floorEnvironment;
    models.materials.floor.envMapIntensity = 1.1;
    models.materials.water.envMap = floorEnvironment;
    models.materials.water.envMapIntensity = 1.5;
  }

  const level = new THREE.Group();
  level.name = 'GossipBarStage';
  level.userData.kind = 'level';
  scene.add(level);

  // Places a model at (x, y, z) with a yaw, into `parent` (the level by default).
  function place(model, x, y, z, yaw = 0, parent = level) {
    model.position.set(x, y, z);
    model.rotation.y = yaw;
    parent.add(model);
    return model;
  }

  // Strips point lights from a decorative copy, so it adds no dynamic light to the scene.
  function unlit(model) {
    const lights = [];
    model.traverse(object => { if (object.isPointLight) lights.push(object); });
    for (const light of lights) light.parent.remove(light);
    return model;
  }

  // Things a player can click or walk up to. Each entry is
  //   { id, label, object, approach: { x, z, yaw }, action }
  // where `approach` is where a player stands to use it, facing `yaw` (0 faces -z), and `action`
  // tells the HUD what to open ({ type: 'menu', menu: 'bar' }, { type: 'npc', npc }, ...). The
  // list is live on level.userData.interactables; interaction.js picks against it.
  const interactables = [];
  function interactable(id, object, { label = id, approach, action = { type: id } } = {}) {
    object.userData.interaction = id;
    object.userData.interactable = true;
    interactables.push({ id, label, object, approach, action });
    return object;
  }
  level.userData.interactables = interactables;

  // Furniture a player can sit on; `seatIDs` are the places it holds (see game/seats.js).
  function seatable(object, seatIDs, label = 'Seat') {
    return interactable(`seat:${seatIDs[0]}`, object, { label, action: { type: 'seat', seats: seatIDs } });
  }

  // Callbacks run every frame with elapsed seconds; see level.userData.animate.
  const animators = [];
  level.userData.animate = time => { for (const animate of animators) animate(time); };

  return { THREE, scene, models, level, place, unlit, interactable, seatable, animators, now };
}
