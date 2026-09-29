// Procedural palms for the backdrop outside the glass wall. Two looks share one generator:
// a lit palm (vertex-coloured fronds, ringed trunk) and a flat black silhouette that ignores
// fog, so distant rows read as dark shapes against the horizon glow.
export function createPalmModels(t) {
  const { THREE, group, sphere, rng } = t;

  const leafMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff, vertexColors: true, roughness: .72, metalness: .02,
    side: THREE.DoubleSide, emissive: 0x06261f, emissiveIntensity: .7,
  });
  const trunkMaterials = [0x5b4638, 0x6d5544].map(color => new THREE.MeshStandardMaterial({ color, roughness: .9, metalness: .01 }));
  const nutMaterial = new THREE.MeshStandardMaterial({ color: 0x3b2a20, roughness: .8 });
  const silhouetteMaterial = new THREE.MeshBasicMaterial({ color: 0x04060f, side: THREE.DoubleSide, fog: false });

  const leafTones = [new THREE.Color(0x2c7a55), new THREE.Color(0x3f9560), new THREE.Color(0x1f5f48), new THREE.Color(0x57a45f)];

  function segment(parent, material, from, to, radiusBottom, radiusTop) {
    const direction = new THREE.Vector3().subVectors(to, from);
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radiusTop, radiusBottom, direction.length(), 8), material);
    mesh.position.copy(from).add(to).multiplyScalar(.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
    parent.add(mesh);
    return mesh;
  }

  // One geometry for every frond: each is a bowed spine with a leaflet triangle per side per step.
  function frondGeometry({ crown, fronds, length, random, coloured }) {
    const positions = [];
    const colors = [];
    const steps = 22;
    const tip = new THREE.Vector3();
    for (let index = 0; index < fronds; index++) {
      const azimuth = index / fronds * Math.PI * 2 + (random() - .5) * .5;
      const upright = random();
      const elevation = (72 - upright * 88) * Math.PI / 180;
      const reach = length * (.8 + random() * .4);
      const droop = .55 + random() * .7;
      const heading = new THREE.Vector3(Math.cos(azimuth), 0, Math.sin(azimuth));
      const side = new THREE.Vector3(-Math.sin(azimuth), 0, Math.cos(azimuth));
      const tone = leafTones[random() * leafTones.length | 0];
      const spine = [];
      for (let step = 0; step <= steps; step++) {
        const s = step / steps;
        spine.push(new THREE.Vector3()
          .copy(crown)
          .addScaledVector(heading, Math.cos(elevation) * reach * s)
          .add(new THREE.Vector3(0, Math.sin(elevation) * reach * s - droop * reach * s * s * .55, 0)));
      }
      for (let step = 1; step < steps; step++) {
        const s = step / steps;
        const from = spine[step];
        const along = new THREE.Vector3().subVectors(spine[step + 1], from);
        const leaflet = reach * .3 * Math.pow(Math.sin(Math.PI * Math.min(1, s * .95 + .06)), .8) * (1 - .3 * s);
        for (const sign of [-1, 1]) {
          tip.copy(from)
            .addScaledVector(side, sign * leaflet * .92)
            .addScaledVector(along.clone().normalize(), leaflet * .3);
          tip.y -= leaflet * (.35 + s * .35);
          const back = from.clone().add(along.clone().multiplyScalar(1.15));
          const shade = coloured ? tone.clone().multiplyScalar(.75 + random() * .5) : null;
          for (const point of [from, back, tip]) {
            positions.push(point.x, point.y, point.z);
            if (shade) colors.push(shade.r, shade.g, shade.b);
          }
        }
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    if (coloured) geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.computeVertexNormals();
    return geometry;
  }

  // The trunk bows toward local +x by `lean` metres, so yaw a palm to aim its crown.
  function Palm({ height = 6, lean = 2, fronds = 13, frondLength, seed = 1, silhouette = false } = {}) {
    const model = group('Palm');
    const random = rng(seed);
    const scale = height / 6;
    const reach = frondLength ?? 3.4 * Math.max(.75, scale);
    const trunkAt = s => new THREE.Vector3(lean * Math.pow(s, 1.7), height * s, 0);
    const rings = 14;
    for (let ring = 0; ring < rings; ring++) {
      const from = trunkAt(ring / rings);
      const to = trunkAt((ring + 1) / rings);
      const bottom = (.24 - .12 * ring / rings) * Math.max(.7, scale);
      const top = (.24 - .12 * (ring + 1) / rings) * Math.max(.7, scale);
      segment(model, silhouette ? silhouetteMaterial : trunkMaterials[ring % 2], from, to, bottom, top);
    }
    const crown = trunkAt(1);
    const foliage = new THREE.Mesh(
      frondGeometry({ crown, fronds, length: reach, random, coloured: !silhouette }),
      silhouette ? silhouetteMaterial : leafMaterial,
    );
    model.add(foliage);
    if (!silhouette) {
      for (let index = 0; index < 5; index++) {
        const angle = index / 5 * Math.PI * 2;
        const nut = sphere(model, nutMaterial, .1 * Math.max(.8, scale), crown.x + Math.cos(angle) * .16, crown.y - .12, Math.sin(angle) * .16, 1);
        nut.castShadow = false;
      }
    }
    model.traverse(object => { if (object.isMesh) { object.castShadow = false; object.receiveShadow = false; } });
    return model;
  }

  // A low, jagged ridge line around the horizon, so the sky has an edge to sit behind.
  function HorizonRidge(radius = 95, segments = 180) {
    const positions = [];
    const random = rng(11);
    const heights = Array.from({ length: segments + 1 }, (_, index) => {
      const angle = index / segments * Math.PI * 2;
      return 5 + Math.sin(angle * 3 + 1) * 2.4 + Math.sin(angle * 7) * 1.6 + random() * 1.4;
    });
    heights[segments] = heights[0];
    for (let index = 0; index < segments; index++) {
      const a0 = index / segments * Math.PI * 2;
      const a1 = (index + 1) / segments * Math.PI * 2;
      const x0 = Math.cos(a0) * radius;
      const z0 = Math.sin(a0) * radius;
      const x1 = Math.cos(a1) * radius;
      const z1 = Math.sin(a1) * radius;
      positions.push(x0, -2, z0, x1, -2, z1, x1, heights[index + 1], z1, x0, -2, z0, x1, heights[index + 1], z1, x0, heights[index], z0);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    const ridge = new THREE.Mesh(geometry, silhouetteMaterial);
    ridge.name = 'HorizonRidge';
    return ridge;
  }

  return { Palm, HorizonRidge };
}
