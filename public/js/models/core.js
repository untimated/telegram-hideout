// Seamless polished-stone maps drawn once: a bumpy normal map plus a mottled roughness map, so the
// floor is glossy in patches instead of uniformly plastic. One tile covers STONE_TILE metres.
export const STONE_TILE = 3;

// Pool tile photo-texture (ambientCG Tiles132A). One texture repeat covers this many metres.
export const POOL_TILE_UNIT = 1.2;

// Rescales a box's UVs so every face repeats a texture once per `unit` metres, whatever its size.
export function scaleBoxUVs(mesh, unit) {
  const { width, height, depth } = mesh.geometry.parameters;
  const uv = mesh.geometry.attributes.uv;
  // BoxGeometry face order: +x, -x, +y, -y, +z, -z, four vertices each.
  const faces = [[depth, height], [depth, height], [width, depth], [width, depth], [width, height], [width, height]];
  faces.forEach(([u, v], face) => {
    for (let index = face * 4; index < face * 4 + 4; index++) uv.setXY(index, uv.getX(index) * u / unit, uv.getY(index) * v / unit);
  });
  return mesh;
}

// Seamless value noise on a size x size grid, `cells` lattice cells across, scaled by `weight`.
function tileableNoise(size, cells, weight, random) {
  const lattice = Float32Array.from({ length: cells * cells }, random);
  const field = new Float32Array(size * size);
  const smooth = t => t * t * (3 - 2 * t);
  for (let y = 0; y < size; y++) {
    const gy = y / size * cells;
    const y0 = Math.floor(gy) % cells;
    const y1 = (y0 + 1) % cells;
    const fy = smooth(gy - Math.floor(gy));
    for (let x = 0; x < size; x++) {
      const gx = x / size * cells;
      const x0 = Math.floor(gx) % cells;
      const x1 = (x0 + 1) % cells;
      const fx = smooth(gx - Math.floor(gx));
      const top = lattice[y0 * cells + x0] * (1 - fx) + lattice[y0 * cells + x1] * fx;
      const bottom = lattice[y1 * cells + x0] * (1 - fx) + lattice[y1 * cells + x1] * fx;
      field[y * size + x] = (top * (1 - fy) + bottom * fy) * weight;
    }
  }
  return field;
}

// Tileable ripple maps for the pool: broad, calm swells. The roughness map is glossy only on the
// brightest crests, so specular glints sit on a few spots and the rest of the water stays dull.
// Both maps must share the same repeat and offset; the caller scrolls them to animate.
function createRippleNormal(THREE) {
  const size = 256;
  let seed = 31;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const height = new Float32Array(size * size);
  let total = 0;
  for (const [cells, weight] of [[3, 1], [6, .6], [12, .3], [24, .12]]) {
    const layer = tileableNoise(size, cells, weight, random);
    for (let index = 0; index < layer.length; index++) height[index] += layer[index];
    total += weight;
  }
  let low = Infinity;
  let high = -Infinity;
  for (const value of height) { low = Math.min(low, value); high = Math.max(high, value); }
  for (let index = 0; index < height.length; index++) height[index] = (height[index] - low) / (high - low);

  const makeCanvas = () => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    return canvas;
  };
  const normalCanvas = makeCanvas();
  const roughCanvas = makeCanvas();
  const normal = normalCanvas.getContext('2d').createImageData(size, size);
  const rough = roughCanvas.getContext('2d').createImageData(size, size);
  const at = (x, y) => height[((y + size) % size) * size + ((x + size) % size)];
  const smoothstep = (edge0, edge1, value) => {
    const t = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)));
    return t * t * (3 - 2 * t);
  };
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const index = (y * size + x) * 4;
      const dx = (at(x + 1, y) - at(x - 1, y)) * 9;
      const dy = (at(x, y + 1) - at(x, y - 1)) * 9;
      const length = Math.hypot(dx, dy, 1);
      normal.data.set([(-dx / length * .5 + .5) * 255, (dy / length * .5 + .5) * 255, (1 / length * .5 + .5) * 255, 255], index);
      rough.data.set([0, (.96 - .9 * smoothstep(.5, .8, at(x, y))) * 255, 0, 255], index);
    }
  }
  normalCanvas.getContext('2d').putImageData(normal, 0, 0);
  roughCanvas.getContext('2d').putImageData(rough, 0, 0);
  const prepare = canvas => {
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.anisotropy = 8;
    return texture;
  };
  return { normalMap: prepare(normalCanvas), roughnessMap: prepare(roughCanvas) };
}

// Tileable caustic pattern: bright ridges where two nearest cell points are almost equidistant.
// Drawn as greyscale, so an additive material turns black into "no light".
function createCausticTexture(THREE) {
  const size = 256;
  let seed = 53;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const points = Array.from({ length: 22 }, () => [random(), random()]);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const context = canvas.getContext('2d');
  const image = context.createImageData(size, size);
  const wrap = d => Math.min(Math.abs(d), 1 - Math.abs(d));
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let first = Infinity;
      let second = Infinity;
      for (const [px, py] of points) {
        const dx = wrap(x / size - px);
        const dy = wrap(y / size - py);
        const distance = Math.hypot(dx, dy);
        if (distance < first) { second = first; first = distance; } else if (distance < second) second = distance;
      }
      const ridge = Math.max(0, 1 - (second - first) * 26);
      const value = Math.pow(ridge, 3) * 255;
      image.data.set([value, value, value, 255], (y * size + x) * 4);
    }
  }
  context.putImageData(image, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 4;
  return texture;
}

// Soft round glow for additive halo sprites.
function createGlowTexture(THREE) {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const context = canvas.getContext('2d');
  const gradient = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(.18, 'rgba(255,255,255,.55)');
  gradient.addColorStop(.5, 'rgba(255,255,255,.12)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}

function createStoneTextures(THREE) {
  const size = 512;
  let seed = 7;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  const noise = (cells, weight) => tileableNoise(size, cells, weight, random);

  const height = new Float32Array(size * size);
  const patches = noise(5, 1);
  let total = 0;
  for (const [cells, weight] of [[6, 1], [12, .55], [24, .25], [48, .1]]) {
    const layer = noise(cells, weight);
    for (let index = 0; index < layer.length; index++) height[index] += layer[index];
    total += weight;
  }
  for (let index = 0; index < height.length; index++) height[index] /= total;

  const roughCanvas = document.createElement('canvas');
  const normalCanvas = document.createElement('canvas');
  roughCanvas.width = roughCanvas.height = normalCanvas.width = normalCanvas.height = size;
  const rough = roughCanvas.getContext('2d').createImageData(size, size);
  const normal = normalCanvas.getContext('2d').createImageData(size, size);
  const at = (x, y) => height[((y + size) % size) * size + ((x + size) % size)];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const index = y * size + x;
      // Glossy where the broad patch noise is low, satin where it is high.
      const value = Math.min(1, Math.max(0, .2 + patches[index] * .34 + (height[index] - .5) * .35 + random() * .04));
      rough.data.set([0, value * 255, 0, 255], index * 4);
      const dx = (at(x + 1, y) - at(x - 1, y)) * 9;
      const dy = (at(x, y + 1) - at(x, y - 1)) * 9;
      const length = Math.hypot(dx, dy, 1);
      normal.data.set([(-dx / length * .5 + .5) * 255, (dy / length * .5 + .5) * 255, (1 / length * .5 + .5) * 255, 255], index * 4);
    }
  }
  roughCanvas.getContext('2d').putImageData(rough, 0, 0);
  normalCanvas.getContext('2d').putImageData(normal, 0, 0);

  const prepare = canvas => {
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.anisotropy = 8;
    return texture;
  };
  return { roughnessMap: prepare(roughCanvas), normalMap: prepare(normalCanvas) };
}

export function createProceduralTools(THREE) {
  const stone = createStoneTextures(THREE);
  const ripples = createRippleNormal(THREE);
  const caustic = createCausticTexture(THREE);
  const glow = createGlowTexture(THREE);
  const loader = new THREE.TextureLoader();
  const poolTexture = (name, colour = false) => {
    const texture = loader.load(`/textures/pool_tiles/${name}.jpg`);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.anisotropy = 8;
    if (colour) texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  };
  const poolColour = poolTexture('color', true);
  const standard = (color, roughness = .62, metalness = .14, extra = {}) =>
    new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra });

  const materials = {
    floor: standard(0x3a4058, 1, .22, { ...stone, normalScale: new THREE.Vector2(.28, .28) }),
    wall: standard(0x121a2d, .68, .32),
    wallTrim: standard(0x303b58, .4, .52),
    pillar: standard(0x222c43, .38, .58),
    steel: standard(0x8792a8, .3, .72),
    darkMetal: standard(0x111827, .38, .72),
    glass: new THREE.MeshPhysicalMaterial({
      color: 0x59cde5, roughness: .12, metalness: .08, transmission: .48,
      transparent: true, opacity: .38, side: THREE.DoubleSide, depthWrite: false,
    }),
    water: new THREE.MeshPhysicalMaterial({
      color: 0x1697b3, emissive: 0x075d78, emissiveIntensity: .1,
      roughness: 1, metalness: .1, transparent: true, opacity: .5, depthWrite: false,
      normalMap: ripples.normalMap, roughnessMap: ripples.roughnessMap, normalScale: new THREE.Vector2(1.9, 1.9), specularIntensity: 1,
    }),
    coping: standard(0x77849a, .34, .34),
    poolTile: standard(0xc4dde3, 1, .04, {
      map: poolColour, normalMap: poolTexture('normal'), roughnessMap: poolTexture('roughness'),
      emissive: 0xffffff, emissiveMap: poolColour, emissiveIntensity: .14,
    }),
    platform: standard(0x252a3f, .48, .38),
    barBase: standard(0x2c1c32, .42, .38),
    counter: standard(0x26263a, .28, .45),
    wood: standard(0x573a3b, .58, .16),
    woodLight: standard(0x795147, .5, .18),
    neonCyan: standard(0x77f6ff, .22, .12, { emissive: 0x16d9f4, emissiveIntensity: 2.2 }),
    neonMagenta: standard(0xffa7eb, .22, .12, { emissive: 0xf522b9, emissiveIntensity: 2.2 }),
    neonWarm: standard(0xffd78b, .22, .12, { emissive: 0xff9e37, emissiveIntensity: 1.7 }),
    brass: standard(0xc89b58, .32, .72),
    copper: standard(0xb56b49, .3, .68),
    ceramic: standard(0xe5dfd1, .25, .1),
    porcelain: standard(0xf3eee3, .2, .08),
    glassware: new THREE.MeshPhysicalMaterial({
      color: 0xd9f6ff, roughness: .12, metalness: .05, transmission: .62,
      transparent: true, opacity: .48, side: THREE.DoubleSide,
    }),
    beverage: standard(0xc76a2b, .26, .08),
    upholstery: standard(0x5f2949, .68, .06),
    cushion: standard(0x853457, .74, .02),
    plantPot: standard(0x473546, .72, .08),
    soil: standard(0x292426, .94, .02),
    leaf: standard(0x438a5a, .86, .01),
    leafLight: standard(0x69a95f, .84, .01),
    leafDark: standard(0x28694f, .88, .01),
    bark: standard(0x594236, .9, .01),
    cooktop: standard(0x141a28, .24, .54),
    tile: standard(0x272e43, .74, .2),
    chocolate: standard(0x5d3029, .31, .12),
    black: standard(0x101521, .42, .34),
  };

  function group(name) {
    const result = new THREE.Group();
    result.name = name;
    result.userData.modelName = name;
    return result;
  }

  function box(parent, material, width, height, depth, x = 0, y = height / 2, z = 0) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  function cylinder(parent, material, radiusTop, radiusBottom, height, x = 0, y = height / 2, z = 0, segments = 20) {
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments), material,
    );
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  function sphere(parent, material, radius, x = 0, y = 0, z = 0, detail = 1) {
    const mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(radius, detail), material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  function torus(parent, material, radius, tube, x = 0, y = 0, z = 0, rotationX = 0) {
    const mesh = new THREE.Mesh(new THREE.TorusGeometry(radius, tube, 8, 24), material);
    mesh.position.set(x, y, z);
    mesh.rotation.x = rotationX;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  function rod(parent, material, start, end, radius = .025, segments = 10) {
    const from = new THREE.Vector3(...start);
    const to = new THREE.Vector3(...end);
    const direction = new THREE.Vector3().subVectors(to, from);
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(radius, radius, direction.length(), segments), material,
    );
    mesh.position.copy(from).add(to).multiplyScalar(.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  function rng(seed = 1) {
    let value = Number(seed) || 1;
    return () => {
      value = (value * 1664525 + 1013904223) >>> 0;
      return value / 4294967296;
    };
  }

  return { THREE, materials, textures: { caustic, glow }, group, box, cylinder, sphere, torus, rod, rng };
}
