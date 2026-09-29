// Static NPC robots. They are not connected players, so they live in the level, not the scene.
export function buildNpcs({ models, scene, level, interactable }) {
  if (!models.Robot) return;

  function addNPC(id, name, x, z, { floorY = 0, chefHat = false, approach } = {}) {
    const actor = models.Robot({ id: `npc:${id}`, name, x, z, yaw: Math.PI });
    if (chefHat) {
      const hat = models.ChefHat();
      hat.position.y = .29;
      actor.userData.head.add(hat);
    }
    scene.remove(actor);
    level.add(actor);
    actor.position.y = floorY;
    actor.userData.kind = 'npc';
    interactable(id, actor, { label: name, approach });
    return actor;
  }

  addNPC('wolfred', 'Wolfred', -3.7, -4.9, { floorY: .28, approach: { x: -3.7, z: -2.5, yaw: 0 } });
  addNPC('pierre', 'Pierre', 3.5, -8, { chefHat: true, approach: { x: 3.5, z: -5.9, yaw: 0 } });
}
