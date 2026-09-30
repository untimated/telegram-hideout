import { POOL } from './layout.js';

const WATER_Y = .105;

// Two striped float rings drifting along the pool: they glide slowly end to end (in opposite
// directions), bob on the water and turn a little. Marked dynamic so the static bake leaves them
// alone.
export function buildPoolFloats({ THREE, level, animators }) {
  function ring(color) {
    const stripes = document.createElement('canvas');
    stripes.width = 256;
    stripes.height = 8;
    const paint = stripes.getContext('2d');
    for (let index = 0; index < 8; index++) {
      paint.fillStyle = index % 2 ? '#fff4f0' : color;
      paint.fillRect(index * 32, 0, 32, 8);
    }
    const map = new THREE.CanvasTexture(stripes);
    map.colorSpace = THREE.SRGBColorSpace;
    const tube = new THREE.Mesh(new THREE.TorusGeometry(.42, .15, 16, 40), new THREE.MeshStandardMaterial({ map, roughness: .3 }));
    tube.rotation.x = Math.PI / 2;
    tube.castShadow = tube.receiveShadow = true;
    const object = new THREE.Group();
    object.add(tube);
    object.userData.dynamic = true;
    level.add(object);
    return object;
  }

  const reach = POOL.length / 2 - 1.2;
  const floats = [
    { object: ring('#ff5f8f'), x: POOL.x + .4, phase: 0, period: 80 },
    { object: ring('#3fc4e0'), x: POOL.x - .5, phase: Math.PI, period: 105 },
  ];

  animators.push(time => {
    for (const { object, x, phase, period } of floats) {
      const t = time * Math.PI * 2 / period + phase;
      object.position.set(x + Math.sin(t * 2.3) * .18, WATER_Y + .04 + Math.sin(time * 1.4 + phase) * .02, Math.sin(t) * reach);
      object.rotation.set(Math.sin(time * 1.1 + phase) * .05, t * .6, Math.cos(time * .9 + phase) * .05);
    }
  });
}
