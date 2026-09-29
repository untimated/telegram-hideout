import { POOL } from './layout.js';

// Everything beyond the glass: dark ground, lit palms by the pool wall, black silhouette rows and a
// ridge line further out, so the starry sky has layers of depth behind it. Coordinates below were
// authored against the old, narrower pool; `west()` shifts them out to clear the wider one.
export function buildBackdrop({ THREE, models, level }) {
  const backdrop = new THREE.Group();
  backdrop.name = 'Backdrop';
  level.add(backdrop);
  const west = x => x - POOL.growth;

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(200, 200),
    new THREE.MeshStandardMaterial({ color: 0x0a111c, roughness: .95, metalness: 0 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(POOL.outerWallX - .1 - 100, -.05, 0);
  backdrop.add(ground);

  const palm = (options, x, z, yaw = 0) => {
    const model = models.Palm(options);
    model.position.set(west(x), -.05, z);
    model.rotation.y = yaw;
    backdrop.add(model);
  };

  // Lit palms leaning their crowns over the pool. The short ones show from mid-room; the tall
  // ones arch into view when standing at the glass.
  for (const [x, z, height, lean, seed] of [
    [-11.0, -4.6, 3.7, 1.3, 3], [-10.9, 3.2, 4.1, 1.5, 8], [-11.2, 7.7, 3.5, 1.1, 14],
    [-12.2, -7.6, 6.6, 2.3, 21], [-11.7, -1.2, 5.4, 2.1, 27], [-12.6, 1.2, 7.0, 2.6, 33],
    [-11.9, 5.4, 5.9, 1.9, 40], [-13.2, 9.6, 6.8, 2.3, 53],
    [-15.6, 4.6, 7.6, 2.6, 65], [-14.4, 13, 6.4, 2.0, 71],
  ]) palm({ height, lean, seed, fronds: 12 + seed % 4 }, x, z, (seed % 5 - 2) * .12);

  // Silhouettes ignore fog and lighting: black shapes standing against the horizon glow.
  for (let index = 0; index < 22; index++) {
    const angle = (index / 22 - .5) * 2.1;
    const distance = 32 + (index % 4) * 8;
    palm({
      height: 9 + (index * 37 % 7), lean: 2.4 + (index % 3), seed: 90 + index * 7,
      fronds: 11, frondLength: 4.6, silhouette: true,
    }, -Math.cos(angle) * distance - 6, Math.sin(angle) * distance, (index % 4 - 1.5) * .3);
  }

  // Ground-level floodlights aimed up the palms. Every fixture gets a fading beam; only three
  // carry a real SpotLight, since each dynamic light costs every pixel on phones.
  function floodlight(x, z, tx, ty, tz, color, lit) {
    const from = new THREE.Vector3(west(x), .08, z);
    const to = new THREE.Vector3(west(tx), ty, tz);
    const direction = new THREE.Vector3().subVectors(to, from);
    const length = direction.length();
    direction.normalize();

    const fixture = new THREE.Group();
    fixture.position.copy(from);
    fixture.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
    const housing = new THREE.Mesh(new THREE.CylinderGeometry(.09, .12, .3, 14), models.materials.darkMetal);
    housing.position.y = .05;
    const lens = new THREE.Mesh(new THREE.CircleGeometry(.085, 20), new THREE.MeshBasicMaterial({ color }));
    lens.rotation.x = -Math.PI / 2;
    lens.position.y = .205;
    fixture.add(housing, lens);
    backdrop.add(fixture);

    // Beam cone, bright at the lens and fading to black (additive, so black adds nothing).
    const cone = new THREE.ConeGeometry(length * Math.tan(.24), length, 28, 1, true);
    cone.translate(0, -length / 2, 0);
    const tint = new THREE.Color(color).multiplyScalar(.09);
    const colors = [];
    const positions = cone.attributes.position;
    for (let index = 0; index < positions.count; index++) {
      const strength = positions.getY(index) > -length * .02 ? 1 : 0;
      colors.push(tint.r * strength, tint.g * strength, tint.b * strength);
    }
    cone.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    const beam = new THREE.Mesh(cone, new THREE.MeshBasicMaterial({
      vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    }));
    beam.position.copy(from);
    beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), direction);
    backdrop.add(beam);

    if (lit) {
      const spot = new THREE.SpotLight(color, 260, 24, .42, .8, 2);
      spot.position.copy(from);
      spot.target.position.copy(to);
      backdrop.add(spot, spot.target);
    }
  }
  for (const [x, z, tx, ty, tz, color, lit] of [
    [-10.5, -6.2, -11, 4.2, -7.6, 0xffc27a, true],
    [-10.5, -3.4, -10.4, 2.8, -4.6, 0xffc27a, false],
    [-10.5, 1, -11.3, 4.4, 1.2, 0x8fe8ff, true],
    [-10.5, 3.6, -10.2, 3, 3.2, 0x8fe8ff, false],
    [-10.5, 6.4, -10.9, 3.8, 5.4, 0xffc27a, true],
    [-10.6, 8.8, -10.6, 2.6, 7.7, 0xffc27a, false],
  ]) floodlight(x, z, tx, ty, tz, color, lit);

  backdrop.add(models.HorizonRidge(95));
}
