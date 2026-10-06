// Two reusable mesh pools in the wheel face's local XY plane. Decoration never takes clicks.
const TRAIL_PIECES = 24;
const SPARKS = 7;
const DROP_AT = .6;
const CATCH_AT = .88;

export function createRouletteEffects(THREE) {
  const object = new THREE.Group();
  object.name = 'RouletteBallEffects';
  object.userData.dynamic = true;
  object.visible = false;

  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const context = canvas.getContext('2d');
  const glow = context.createRadialGradient(32, 32, 0, 32, 32, 32);
  glow.addColorStop(0, 'rgba(255,255,235,1)');
  glow.addColorStop(.25, 'rgba(255,226,150,.85)');
  glow.addColorStop(.6, 'rgba(255,179,70,.3)');
  glow.addColorStop(1, 'rgba(255,160,40,0)');
  context.fillStyle = glow;
  context.fillRect(0, 0, 64, 64);
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.MeshBasicMaterial({
    map, transparent: true, opacity: .8, blending: THREE.AdditiveBlending,
    depthWrite: false, toneMapped: false, side: THREE.DoubleSide,
  });
  const geometry = new THREE.PlaneGeometry(1, 1);
  const trail = new THREE.InstancedMesh(geometry, material, TRAIL_PIECES);
  const sparks = new THREE.InstancedMesh(geometry, material, SPARKS);
  for (const mesh of [trail, sparks]) {
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
    mesh.raycast = () => {};
    mesh.count = 0;
    object.add(mesh);
  }
  const pose = new THREE.Object3D();
  const head = new THREE.Vector3(), tail = new THREE.Vector3(), impact = new THREE.Vector3();
  const color = new THREE.Color();
  const smooth = t => t * t * (3 - 2 * t);
  function write(mesh, index, brightness) {
    pose.updateMatrix();
    mesh.setMatrixAt(index, pose.matrix);
    mesh.setColorAt(index, color.setRGB(brightness, brightness, brightness));
  }
  function clear() {
    object.visible = false;
    trail.count = sparks.count = 0;
  }

  return {
    object, clear,
    // sample(progress, vector) follows the actual ball path, including its scripted hops.
    update(progress, duration, bounces, sample) {
      if (progress <= 0 || progress >= CATCH_AT) return clear();
      object.visible = true;
      // The fast orbit has the strongest trail; it disappears before pocket capture.
      const fade = 1 - smooth(Math.max(0, (progress - .5) / (CATCH_AT - .5)));
      trail.count = 0;
      sample(progress, head);
      for (let index = 0; index < TRAIL_PIECES; index++) {
        const previous = progress - (index + 1) * 6 / duration;
        if (previous < 0) break;
        sample(previous, tail);
        const strength = (1 - index / TRAIL_PIECES) ** 2 * fade;
        const dx = head.x - tail.x, dy = head.y - tail.y;
        pose.position.set((head.x + tail.x) / 2, (head.y + tail.y) / 2, .133);
        pose.rotation.set(0, 0, Math.atan2(dy, dx));
        // Overlap the soft glow cards so the tail reads as one streak instead of beads.
        pose.scale.set(Math.hypot(dx, dy) * 2.5 + .018, .045 * strength + .003, 1);
        write(trail, index, strength);
        trail.count++;
        head.copy(tail);
      }
      sparks.count = 0;
      if (progress >= DROP_AT) {
        const hits = bounces * 2;
        const step = (CATCH_AT - DROP_AT) / hits;
        const hit = Math.floor((progress - DROP_AT) / step);
        const hitAt = DROP_AT + hit * step;
        const age = (progress - hitAt) * duration / 1000;
        if (hit > 0 && hit < hits && age < .24) {
          sample(hitAt, impact);
          const strength = Math.sin(Math.PI * hit / hits) ** 2 * (1 - age / .24) ** 2;
          const outward = Math.atan2(impact.y, impact.x);
          for (let index = 0; index < SPARKS; index++) {
            const angle = outward + (index - 3) * .38;
            const travel = index === 0 ? 0 : age * (.18 + index * .035);
            pose.position.set(impact.x + Math.cos(angle) * travel,
              impact.y + Math.sin(angle) * travel, .134);
            pose.rotation.set(0, 0, angle);
            // One round contact flash surrounded by short outward streaks.
            pose.scale.set(index === 0 ? .085 : .024 + age * .1,
              index === 0 ? .085 : .012, 1);
            write(sparks, index, strength * (index === 0 ? 1 : .85));
          }
          sparks.count = SPARKS;
        }
      }
      for (const mesh of [trail, sparks]) {
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      }
    },
  };
}
