// Procedural night sky. Static on purpose: a dark gradient, a faint haze at the horizon and
// deliberately exaggerated glittering stars, drawn once into an equirectangular canvas.
export function createNightSky(THREE) {
  const width = 4096;
  const height = 2048;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  let seed = 20260929;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  const sky = ctx.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, '#03040d');
  sky.addColorStop(.22, '#060a1f');
  sky.addColorStop(.42, '#101738');
  sky.addColorStop(.5, '#1d2654');
  sky.addColorStop(.515, '#0b0f26');
  sky.addColorStop(1, '#03040a');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);

  ctx.globalCompositeOperation = 'lighter';

  // Horizon haze: a teal band with a violet edge, so the glass wall has something to frame.
  const haze = ctx.createLinearGradient(0, height * .36, 0, height * .5);
  haze.addColorStop(0, 'rgba(40,110,150,0)');
  haze.addColorStop(.7, 'rgba(38,120,150,.16)');
  haze.addColorStop(1, 'rgba(120,70,150,.22)');
  ctx.fillStyle = haze;
  ctx.fillRect(0, height * .36, width, height * .14);

  // A faint, tilted band of dust for depth.
  for (let index = 0; index < 90; index++) {
    const t = index / 90;
    const x = t * width;
    const y = height * (.24 + Math.sin(t * Math.PI * 2 + .6) * .09);
    const radius = 120 + random() * 220;
    const cloud = ctx.createRadialGradient(x, y, 0, x, y, radius);
    cloud.addColorStop(0, `rgba(${90 + random() * 50 | 0},${80 + random() * 40 | 0},${150 + random() * 60 | 0},.045)`);
    cloud.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = cloud;
    ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }

  const tints = ['255,255,255', '255,255,255', '190,215,255', '255,232,180', '255,190,230'];

  function star(radius, glow, alpha, sparkle, soft = false) {
    // Uniform over the visible sphere, from just below the horizon upward.
    const lat = Math.asin(-.08 + random() * 1.08);
    const x = random() * width;
    const y = height * (.5 - lat / Math.PI);
    const stretch = 1 / Math.max(Math.cos(lat), .15);
    const tint = tints[random() * tints.length | 0];
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(stretch, 1);
    const outer = radius * glow;
    const body = ctx.createRadialGradient(0, 0, 0, 0, 0, outer);
    body.addColorStop(0, `rgba(${tint},${alpha})`);
    if (!soft) {
      body.addColorStop(Math.min(.95, radius / outer), `rgba(${tint},${alpha * .55})`);
    }
    body.addColorStop(1, `rgba(${tint},0)`);
    ctx.fillStyle = body;
    ctx.fillRect(-outer, -outer, outer * 2, outer * 2);
    if (sparkle) {
      const length = outer * 2.6;
      for (const [dx, dy] of [[1, 0], [0, 1]]) {
        const ray = ctx.createLinearGradient(-dx * length, -dy * length, dx * length, dy * length);
        ray.addColorStop(0, `rgba(${tint},0)`);
        ray.addColorStop(.5, `rgba(${tint},${alpha * .8})`);
        ray.addColorStop(1, `rgba(${tint},0)`);
        ctx.fillStyle = ray;
        ctx.fillRect(-length * Math.max(dx, .012), -length * Math.max(dy, .012), length * 2 * Math.max(dx, .012), length * 2 * Math.max(dy, .012));
      }
    }
    ctx.restore();
  }

  // Depth comes from layers: a dense, dim, soft-edged far field (reads as out of focus), then
  // progressively sharper and rarer stars. Soft falloff is drawn, not a canvas blur filter,
  // because Telegram's iOS webview ignores ctx.filter.
  for (let index = 0; index < 4500; index++) star(2 + random() * 2.6, 1, .05 + random() * .1, false, true);
  for (let index = 0; index < 1400; index++) star(1.1 + random() * 1.2, 1, .12 + random() * .16, false, true);
  for (let index = 0; index < 12000; index++) star(.45 + random() * .35, 1.9, .5 + random() * .5, false);
  for (let index = 0; index < 1100; index++) star(.8 + random() * .6, 2.4, .75 + random() * .25, false);
  for (let index = 0; index < 140; index++) star(1.3 + random() * .8, 3.2, 1, index % 4 === 0);
  for (let index = 0; index < 26; index++) star(1.9 + random() * .9, 4, 1, true);

  ctx.globalCompositeOperation = 'source-over';
  const texture = new THREE.CanvasTexture(canvas);
  texture.mapping = THREE.EquirectangularReflectionMapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// A tiny stand-in "room" of bright panels, used only as the floor's reflection source so the
// polished stone picks up the ceiling glow, cyan glass wall and magenta stage side.
export function createGlossEnvironment(THREE, renderer) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x05060f);
  const panels = [
    // [r, g, b, width, height, azimuth (deg), elevation (deg)]
    [7, 4.2, 1.5, 3, 1.4, 20, 62],
    [7, 4.2, 1.5, 3, 1.4, 200, 58],
    [6, 3.4, 1.1, 2.5, 1.2, 110, 50],
    [1.2, 5.5, 7, 6, 1.4, 270, 12],
    [7, 2, 5.5, 4, 1.2, 100, 10],
    [6, 3.6, 1.4, 5, 1, 350, 8],
    [.6, 3.2, 4.5, 3, 1.5, 180, 6],
  ];
  for (const [r, g, b, w, h, azimuth, elevation] of panels) {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(r, g, b), side: THREE.DoubleSide }),
    );
    const az = azimuth * Math.PI / 180;
    const el = elevation * Math.PI / 180;
    mesh.position.set(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az)).multiplyScalar(6);
    mesh.lookAt(0, 0, 0);
    scene.add(mesh);
  }
  const generator = new THREE.PMREMGenerator(renderer);
  const target = generator.fromScene(scene, .04);
  generator.dispose();
  return target.texture;
}
