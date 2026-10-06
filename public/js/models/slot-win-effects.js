// A small reusable mesh pool: two draw calls, no textures, physics, or particle library.
const MAX_PIECES = 32;
// Burst origin in the owner's local space: half-width of the launch line, its height and front.
export function createSlotWinEffects(THREE, { width = .3, y = 1.25, z = .56 } = {}) {
  const object = new THREE.Group();
  object.name = 'SlotWinEffects';
  object.userData.dynamic = true;
  object.visible = false;
  const gold = new THREE.MeshStandardMaterial({ color: 0xffd36b, emissive: 0xffb239, emissiveIntensity: .65, metalness: .45, roughness: .3 });
  const sparkle = new THREE.MeshBasicMaterial({ color: 0xffefb0 });
  const coins = new THREE.InstancedMesh(new THREE.CylinderGeometry(.052, .052, .012, 10), gold, MAX_PIECES);
  const stars = new THREE.InstancedMesh(new THREE.OctahedronGeometry(.028), sparkle, MAX_PIECES);
  for (const mesh of [coins, stars]) {
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
    mesh.raycast = () => {}; // Bursts are decoration; clicks still reach the machine.
    object.add(mesh);
  }
  const pose = new THREE.Object3D();
  const trajectories = Array.from({ length: MAX_PIECES }, (_, index) => {
    const angle = index * 2.399963;
    return { x: Math.sin(angle), lift: .9 + (index % 5) * .16, speed: .45 + (index % 4) * .13, delay: (index % 8) * .035 };
  });

  function update(age, kind) {
    const duration = kind === 'jackpot' ? 3 : 2.4;
    object.visible = age >= 0 && age < duration && kind !== 'loss';
    if (!object.visible) return;
    const count = kind === 'jackpot' ? 32 : kind === 'triple' ? 22 : 14;
    const strength = kind === 'jackpot' ? 1.35 : 1;
    coins.count = stars.count = count;
    for (let index = 0; index < count; index++) {
      const path = trajectories[index];
      const time = Math.max(0, age - path.delay);
      const life = duration - path.delay;
      const size = age < path.delay ? 0 : Math.min(1, time * 12, (life - time) * 3);
      // Coins fan up and out from the two sides of the payline, then tumble down.
      const side = index % 2 ? 1 : -1;
      pose.position.set(side * (width + path.speed * time * strength),
        y + path.lift * time * strength - .8 * time * time,
        z + (.1 + Math.abs(path.x) * .17) * time);
      pose.rotation.set(Math.PI / 2 + time * (3 + index % 3), time * (2 + index % 4), path.x + time * 2);
      pose.scale.setScalar(size * (1 + index % 3 * .12));
      pose.updateMatrix();
      coins.setMatrixAt(index, pose.matrix);

      // Bright diamond sparkles rise around the reel frame and marquee.
      pose.position.set(path.x * (width + .16 + time * .28 * strength),
        y - .1 + index % 4 * .18 + time * (.5 + path.lift * .25),
        z + .02 + Math.cos(index * 1.7) * .06);
      pose.rotation.set(time * 2, time * 3, time * 2 + index);
      pose.scale.set(1, 1.8, .6).multiplyScalar(size * (.7 + .3 * Math.sin(time * 15 + index) ** 2));
      pose.updateMatrix();
      stars.setMatrixAt(index, pose.matrix);
    }
    coins.instanceMatrix.needsUpdate = stars.instanceMatrix.needsUpdate = true;
  }
  return { object, update };
}
