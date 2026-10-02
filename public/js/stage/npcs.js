import { NPCS, npcPresent } from '../game/npcs.js';
import { hideoutTime } from '../game/clock.js';
import { BAND } from '../game/catalog.js';

// NPC robots from game/npcs.js. They are not connected players, so they live in the level, not
// the scene. Each one shows up only during its shift and loops a simple pose for its activity.
export function buildNpcs({ THREE, models, scene, level, interactable, animators, now, isBandPlaying }) {
  if (!models.Robot) return;

  const actors = NPCS.map((npc, index) => {
    const actor = models.Robot(
      { id: `npc:${npc.id}`, name: npc.name, x: npc.x, z: npc.z, yaw: npc.yaw },
      { isNPC: true, model: npc.id === 'samantha' ? 'female' : 'robot' },
    );
    if (npc.chefHat) {
      const hat = models.ChefHat();
      hat.position.y = .29;
      actor.userData.head.add(hat);
    }
    scene.remove(actor);
    level.add(actor);
    actor.position.y = npc.y ?? 0;
    actor.userData.kind = 'npc';
    actor.userData.npc = npc;
    actor.userData.phase = index * 1.7;
    interactable(npc.id, actor, { label: npc.name, action: { type: 'npc', npc: npc.id } });
    return actor;
  });

  buildBandProps(THREE, level);

  let nextShiftCheck = 0;
  animators.push(time => {
    if (time >= nextShiftCheck) {
      nextShiftCheck = time + 5;
      const clock = hideoutTime(now());
      const live = isBandPlaying?.();
      // A paid performance finishes even when it runs past the band's closing time.
      for (const actor of actors) actor.visible = npcPresent(actor.userData.npc, clock) || (live && BAND.members.includes(actor.userData.npc.id));
    }
    for (const actor of actors) if (actor.visible) pose(actor, time + actor.userData.phase);
  });
}

// Looping poses per activity, built from the robot rig: arms/legs pivot at the shoulder/hip and
// hang along -y, so rotation.x > 0 swings them forward (toward the face, -z).
function pose(actor, t) {
  const { npc, arms: [left, right], legs, head, torso } = actor.userData;
  const baseY = npc.y ?? 0;
  actor.position.y = baseY;
  actor.rotation.y = npc.yaw;
  // Custom bodies own their proportions and elbow poses, including Samantha's microphone hand.
  if (actor.userData.animate) {
    actor.userData.animate(t);
    return;
  }
  torso.position.y = .94 + Math.sin(t * 1.6) * .006;
  head.rotation.set(0, 0, 0);
  for (const limb of [left, right, ...legs]) limb.rotation.set(0, 0, 0);

  switch (npc.activity) {
    case 'serve':
      right.rotation.x = .75 + Math.sin(t * 3) * .18;
      right.rotation.z = Math.sin(t * 3) * .25;
      head.rotation.y = Math.sin(t * .4) * .35;
      break;
    case 'sit':
      actor.position.y = baseY - .1;
      for (const leg of legs) leg.rotation.x = Math.PI / 2;
      left.rotation.x = .9;
      right.rotation.x = .9 + Math.max(0, Math.sin(t * .9)) * .9;
      head.rotation.x = .25 + Math.max(0, Math.sin(t * .9)) * -.2;
      break;
    case 'dance': {
      const beat = t * 4.2;
      actor.position.y = baseY + Math.abs(Math.sin(beat)) * .07;
      actor.rotation.y = npc.yaw + Math.sin(t * 1.3) * .7;
      left.rotation.x = 2.5 + Math.sin(beat) * .5;
      right.rotation.x = 2.5 - Math.sin(beat) * .5;
      left.rotation.z = -.35;
      right.rotation.z = .35;
      legs[0].rotation.x = Math.max(0, Math.sin(beat)) * .5;
      legs[1].rotation.x = Math.max(0, -Math.sin(beat)) * .5;
      head.rotation.z = Math.sin(beat) * .15;
      break;
    }
    case 'sing':
      left.rotation.x = 2.2;
      left.rotation.z = .35;
      right.rotation.x = .4 + Math.sin(t * 1.2) * .3;
      right.rotation.z = .5 + Math.sin(t * 1.2) * .2;
      head.rotation.x = -.15 + Math.sin(t * 2.1) * .08;
      break;
    case 'play':
      left.rotation.x = 1.15 + Math.sin(t * 8) * .1;
      right.rotation.x = 1.15 + Math.sin(t * 8 + 1.9) * .1;
      head.rotation.y = Math.sin(t * 1.1) * .15;
      head.rotation.x = .25;
      break;
    case 'drum':
      left.rotation.x = .95 + Math.abs(Math.sin(t * 5.5)) * .45;
      right.rotation.x = .95 + Math.abs(Math.cos(t * 5.5)) * .45;
      head.rotation.x = Math.abs(Math.sin(t * 5.5)) * .12;
      break;
    default: // idle: a slow look around.
      head.rotation.y = Math.sin(t * .3) * .3;
      head.rotation.x = -.05;
  }
}

// A keyboard and a hand drum for the band, so their poses read as playing.
function buildBandProps(THREE, level) {
  const dark = new THREE.MeshStandardMaterial({ color: 0x1b1c26, roughness: .45, metalness: .5 });
  const ivory = new THREE.MeshStandardMaterial({ color: 0xf4efe4, roughness: .4 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xe9d7b4, roughness: .7 });
  const shell = new THREE.MeshStandardMaterial({ color: 0x9c2f3f, roughness: .35, metalness: .3 });

  const keyboard = new THREE.Group();
  keyboard.name = 'StageKeyboard';
  const top = new THREE.Mesh(new THREE.BoxGeometry(1, .08, .32), dark);
  top.position.y = .82;
  const keys = new THREE.Mesh(new THREE.BoxGeometry(.9, .02, .14), ivory);
  keys.position.set(0, .87, .06);
  keyboard.add(top, keys);
  for (const x of [-.4, .4]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(.04, .8, .26), dark);
    leg.position.set(x, .4, 0);
    keyboard.add(leg);
  }
  keyboard.position.set(2.76, .4, 4.47);
  keyboard.rotation.y = .35;
  level.add(keyboard);

  const drum = new THREE.Group();
  drum.name = 'StageDrum';
  const body = new THREE.Mesh(new THREE.CylinderGeometry(.22, .17, .62, 24), shell);
  body.position.y = .31;
  const head = new THREE.Mesh(new THREE.CylinderGeometry(.225, .225, .02, 24), skin);
  head.position.y = .63;
  drum.add(body, head);
  drum.position.set(5.8, .4, 4.48);
  level.add(drum);
  for (const object of [keyboard, drum]) object.traverse(part => { part.castShadow = part.receiveShadow = true; });
}
