import { ITEM_BY_ID } from './game/catalog.js';

// Short, cosmetic actions driven by the server's successful item_removed event.
export function createConsumptionAnimator(THREE) {
  const down = new THREE.Vector3(0, -1, 0);
  const smooth = value => {
    const t = Math.max(0, Math.min(1, value));
    return t * t * (3 - 2 * t);
  };

  function clear(character) {
    const action = character.userData.consumption;
    if (!action) return;
    character.remove(action.prop);
    action.prop.traverse(part => {
      part.geometry?.dispose();
      part.material?.dispose();
    });
    character.userData.arms[1].quaternion.identity();
    character.userData.forearms[1].quaternion.identity();
    delete character.userData.consumption;
  }

  function start(character, itemID, time) {
    const item = ITEM_BY_ID.get(itemID);
    if (!character || !item || character.userData.asleep) return;
    clear(character);
    const drink = item.menu === 'bar' || /juice/.test(item.id);
    const prop = new THREE.Group();
    const add = (geometry, color, y = 0) => {
      const part = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color, roughness: .45 }));
      part.position.y = y;
      part.castShadow = true;
      part.raycast = () => {};
      prop.add(part);
    };
    if (drink) {
      // An open, opaque cup reads clearly against the dim bar without glass sorting.
      add(new THREE.CylinderGeometry(.06, .045, .12, 10, 1, true), 0xe5ddd0, .035);
      add(new THREE.CylinderGeometry(.054, .054, .008, 10), /apple/.test(itemID) ? 0xb77928 : 0xe4a136, .08);
      const rim = new THREE.TorusGeometry(.06, .005, 4, 10);
      rim.rotateX(Math.PI / 2);
      add(rim, 0xf4e9d5, .095);
    } else if (item.model === 'burger') {
      add(new THREE.SphereGeometry(.075, 10, 6), 0xdca04d, .025);
      prop.children[0].scale.y = .6;
      add(new THREE.CylinderGeometry(.072, .072, .018, 10), 0x603522, -.006);
    } else {
      // One bite rather than lifting a whole plate into the character's face.
      add(new THREE.BoxGeometry(.08, .065, .075), item.model === 'fondue' ? 0x693728 : 0xd9a65a, .02);
    }
    character.add(prop);
    character.userData.consumption = { prop, drink, start: time, duration: drink ? 2.8 : 3.2 };
    update(character, time, false);
  }

  function update(character, time, asleep) {
    const action = character.userData.consumption;
    if (!action) return;
    const age = time - action.start;
    if (asleep || age >= action.duration) { clear(character); return; }
    const lift = smooth(age / .65) * (1 - smooth((age - action.duration + .65) / .65));
    const atMouth = age > .65 && age < action.duration - .65;
    const pulse = atMouth ? Math.sin((age - .65) * Math.PI * (action.drink ? 1.5 : 3)) : 0;
    const arm = character.userData.arms[1];
    const forearm = character.userData.forearms[1];
    const hand = new THREE.Vector3(.31, .51, -.015).lerp(
      new THREE.Vector3(action.drink ? .085 : .045, action.drink ? 1.22 : 1.30, -.31 + pulse * .012), lift,
    );
    // Two-bone IK: choose a forward elbow, then aim both original limb segments.
    const direction = hand.clone().sub(arm.position);
    const distance = Math.min(.5699, direction.length());
    direction.normalize();
    const along = (.31 ** 2 - .26 ** 2 + distance ** 2) / (2 * distance);
    const bend = new THREE.Vector3(0, -1, -1);
    bend.addScaledVector(direction, -bend.dot(direction)).normalize();
    const elbow = arm.position.clone().addScaledVector(direction, along)
      .addScaledVector(bend, Math.sqrt(Math.max(0, .31 ** 2 - along ** 2)));
    const upper = new THREE.Quaternion().setFromUnitVectors(down, elbow.clone().sub(arm.position).normalize());
    const lower = new THREE.Quaternion().setFromUnitVectors(down, hand.clone().sub(elbow).normalize());
    // Blend out into the walk pose already written by the world each frame.
    arm.quaternion.slerp(upper, lift);
    forearm.quaternion.identity().slerp(upper.clone().invert().multiply(lower), lift);
    const actualHand = new THREE.Vector3(0, -.26, -.015).applyQuaternion(forearm.quaternion)
      .add(forearm.position).applyQuaternion(arm.quaternion).add(arm.position);
    action.prop.position.copy(actualHand);
    action.prop.rotation.x = action.drink ? lift * (.42 + pulse * .035) : pulse * .08;
    if (!action.drink) action.prop.scale.setScalar(1 - .4 * smooth((age - 1.2) / .9));
  }
  return { start, update, clear };
}
