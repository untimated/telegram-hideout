const COLORS = [0xffbb64, 0xff67c7, 0x6eeaff, 0xb695ff, 0xa4ff81];
const smooth = t => t * t * (3 - 2 * t);

// A pair of small instanced pools per fixture: colored bulbs and soft star glints.
export function createRouletteLights(THREE, { face, cabinet, wheelBulbs, signBulbs }) {
  const palette = COLORS.map(value => new THREE.Color(value));
  const warm = new THREE.Color(0xffd995);
  const color = new THREE.Color();
  const pose = new THREE.Object3D();
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const context = canvas.getContext('2d');
  const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(.2, 'rgba(255,255,255,.8)');
  gradient.addColorStop(.6, 'rgba(255,255,255,.15)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 64, 64);
  context.beginPath();
  for (const [index, [x, y]] of [[32, 1], [36, 28], [63, 32], [36, 36], [32, 63], [28, 36], [1, 32], [28, 28]].entries()) {
    if (index === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  }
  context.closePath();
  context.fillStyle = 'rgba(255,255,255,.75)';
  context.fill();
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  const bulbMaterial = new THREE.MeshBasicMaterial({ toneMapped: false });
  const glowMaterial = new THREE.MeshBasicMaterial({
    map, transparent: true, opacity: .8, blending: THREE.AdditiveBlending,
    depthWrite: false, toneMapped: false, side: THREE.DoubleSide,
  });
  const glowGeometry = new THREE.PlaneGeometry(1, 1);

  function fixture(parent, positions, radius, offset) {
    const object = new THREE.Group();
    object.name = offset === 0 ? 'RouletteWheelLights' : 'RouletteSignLights';
    object.userData.dynamic = true;
    const bulbs = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(radius, 1), bulbMaterial, positions.length);
    const glints = new THREE.InstancedMesh(glowGeometry, glowMaterial, positions.length);
    for (const mesh of [bulbs, glints]) {
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.frustumCulled = false;
      mesh.raycast = () => {};
      object.add(mesh);
    }
    for (let index = 0; index < positions.length; index++) {
      pose.position.set(...positions[index]);
      pose.rotation.set(0, 0, 0);
      pose.scale.setScalar(1);
      pose.updateMatrix();
      bulbs.setMatrixAt(index, pose.matrix);
      bulbs.setColorAt(index, warm);
      glints.setColorAt(index, warm);
    }
    glints.visible = false;
    parent.add(object);
    return { positions, radius, offset, bulbs, glints };
  }
  const fixtures = [fixture(face, wheelBulbs, .016, 0), fixture(cabinet, signBulbs, .024, 12)];

  function clear() {
    for (const { bulbs, glints, positions } of fixtures) {
      glints.visible = false;
      for (let index = 0; index < positions.length; index++) bulbs.setColorAt(index, warm);
      bulbs.instanceColor.needsUpdate = true;
    }
  }
  function tint(phase) {
    const cycle = Math.floor(phase);
    color.copy(palette[cycle % palette.length]).lerp(palette[(cycle + 1) % palette.length], smooth(phase - cycle));
  }
  function draw(seconds, amount, flash = 0) {
    for (const { positions, radius, offset, bulbs, glints } of fixtures) {
      glints.visible = true;
      for (let index = 0; index < positions.length; index++) {
        const order = index + offset;
        // Neighboring lamps chase smoothly; only individual glints get a bright sparkle peak.
        const pulse = ((1 + Math.cos(seconds * 7 - order * .8)) / 2) ** 8;
        tint(seconds * 1.1 + order * .28);
        color.lerp(warm, 1 - amount);
        bulbs.setColorAt(index, color);
        glints.setColorAt(index, color);
        const [x, y, z] = positions[index];
        pose.position.set(x, y, z + radius + .004);
        pose.rotation.set(0, 0, seconds * .4 + order * .3);
        pose.scale.setScalar(amount * radius * (2.2 + pulse * 6 + flash * 3));
        pose.updateMatrix();
        glints.setMatrixAt(index, pose.matrix);
      }
      bulbs.instanceColor.needsUpdate = glints.instanceColor.needsUpdate = true;
      glints.instanceMatrix.needsUpdate = true;
    }
  }
  return {
    clear,
    update(progress, duration) {
      if (progress <= 0 || progress >= 1) return clear();
      draw(progress * duration / 1000,
        smooth(Math.min(1, progress / .04)) * (1 - smooth(Math.max(0, (progress - .9) / .1))));
    },
    // Win: a faster chase with every glint flashing together, like the slot machine payout.
    celebrate(seconds, amount) {
      if (amount <= 0) return clear();
      draw(seconds * 3, amount, Math.sin(seconds * 16) ** 2);
    },
  };
}
