import { STONE_TILE } from './core.js';

export function createArchitectureModels(t) {
  const { THREE, materials: m, group, box, cylinder } = t;

  function RoomFloor(width = 1, depth = 1) {
    const model = group('RoomFloor');
    const slab = box(model, m.floor, width, .16, depth, 0, -.08, 0);
    // Top-face UVs in stone-tile units so the texture keeps one scale on every floor piece.
    const uv = slab.geometry.attributes.uv;
    for (let index = 8; index < 12; index++) uv.setXY(index, uv.getX(index) * width / STONE_TILE, uv.getY(index) * depth / STONE_TILE);
    for (let x = -width / 2 + 1; x < width / 2; x += 1) {
      box(model, m.tile, .012, .004, depth, x, .002, 0);
    }
    for (let z = -depth / 2 + 1; z < depth / 2; z += 1) {
      box(model, m.tile, width, .004, .012, 0, .002, z);
    }
    return model;
  }

  function FloorInset(width = 3.6, depth = 3) {
    const model = group('FloorInset');
    box(model, m.tile, width, .016, depth, 0, .012, 0);
    for (const side of [-1, 1]) {
      box(model, m.brass, width, .008, .035, 0, .024, side * (depth / 2 - .025));
      box(model, m.brass, .035, .008, depth, side * (width / 2 - .025), .024, 0);
    }
    return model;
  }

  function RoomWall(width = 2, height = 3, thickness = .18) {
    const model = group('RoomWall');
    box(model, m.wall, width, height, thickness, 0, height / 2, 0);
    box(model, m.wallTrim, width, .13, thickness + .04, 0, .065, 0);
    box(model, m.wallTrim, width, .12, thickness + .04, 0, height - .06, 0);
    return model;
  }

  function WallPillar(height = 2.8) {
    const model = group('WallPillar');
    box(model, m.pillar, .32, height, .34, 0, height / 2, 0);
    box(model, m.wallTrim, .39, .12, .41, 0, height - .06, 0);
    box(model, m.wallTrim, .38, .1, .4, 0, .06, 0);
    return model;
  }

  function EntranceFrame(width = 2.2, height = 2.8) {
    const model = group('EntranceFrame');
    const postX = width / 2 - .17;
    for (const x of [-postX, postX]) {
      const post = WallPillar(height);
      post.position.x = x;
      model.add(post);
      box(model, m.neonCyan, .055, height - .34, .035, x, height / 2, -.19);
    }
    box(model, m.pillar, width, .28, .34, 0, height - .14, 0);
    box(model, m.neonCyan, width - .48, .045, .035, 0, height - .31, -.19);
    return model;
  }

  // Closed double doors: dark leaves with a round brass-ringed glass window, so the night sky
  // still shows through. Leaf x runs from the centre seam outward; the left leaf is mirrored.
  function EntranceDoors(width = 1.74, height = 2.8) {
    const model = group('EntranceDoors');
    const leafWidth = width / 2 - .006;
    const windowY = height * .64;
    const radius = .27;
    for (const side of [1, -1]) {
      const leaf = group('DoorLeaf');
      const shape = new THREE.Shape();
      shape.moveTo(0, 0);
      shape.lineTo(leafWidth, 0);
      shape.lineTo(leafWidth, height);
      shape.lineTo(0, height);
      shape.closePath();
      const opening = new THREE.Path();
      opening.absarc(leafWidth / 2, windowY, radius, 0, Math.PI * 2, true);
      shape.holes.push(opening);
      const geometry = new THREE.ExtrudeGeometry(shape, { depth: .06, bevelEnabled: false, curveSegments: 32 });
      geometry.translate(0, 0, -.03);
      const panel = new THREE.Mesh(geometry, m.darkMetal);
      panel.castShadow = true;
      panel.receiveShadow = true;
      leaf.add(panel);
      const glass = new THREE.Mesh(new THREE.CircleGeometry(radius, 40), m.glass);
      glass.position.set(leafWidth / 2, windowY, 0);
      leaf.add(glass);
      for (const z of [-.034, .034]) {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(radius + .012, .022, 10, 40), m.brass);
        ring.position.set(leafWidth / 2, windowY, z);
        leaf.add(ring);
        box(leaf, m.brass, .035, .55, .045, .1, 1.15, z * 1.9);
      }
      box(leaf, m.brass, leafWidth - .12, .24, .075, leafWidth / 2, .15, 0);
      box(leaf, m.neonCyan, .02, height - .3, .07, leafWidth - .03, height / 2, 0);
      leaf.position.x = side * .006;
      leaf.scale.x = side;
      model.add(leaf);
    }
    return model;
  }

  function WindowGlassPanel(width = 1.05, height = 2.35) {
    const model = group('WindowGlassPanel');
    box(model, m.glass, width, height, .045, 0, height / 2, 0);
    box(model, m.wallTrim, width + .12, .1, .14, 0, height + .05, 0);
    box(model, m.wallTrim, width + .12, .1, .14, 0, .05, 0);
    return model;
  }

  function WindowMullion(height = 2.45, width = .07) {
    const model = group('WindowMullion');
    box(model, m.pillar, width, height, .13, 0, height / 2, 0);
    box(model, m.neonCyan, .025, height - .22, .022, 0, height / 2, .08);
    return model;
  }

  function BarPlatform(width = 3.6, depth = 1.8) {
    const model = group('BarPlatform');
    box(model, m.platform, width, .28, depth, 0, .14, 0);
    box(model, m.tile, width - .12, .012, depth - .12, 0, .276, 0);
    box(model, m.neonCyan, width - .18, .035, .035, 0, .24, depth / 2 + .04);
    box(model, m.neonCyan, .035, .035, depth - .18, width / 2 + .015, .24, 0);
    return model;
  }

  function BarPlatformSteps(width = 1.15, stepCount = 3) {
    const model = group('BarPlatformSteps');
    const stepDepth = .2;
    const stepHeight = .28 / stepCount;
    for (let index = 0; index < stepCount; index++) {
      const height = stepHeight * (index + 1);
      const z = (index - (stepCount - 1) / 2) * stepDepth;
      box(model, m.platform, width, height, stepDepth + .025, 0, height / 2, z);
      box(model, m.neonCyan, width - .16, .018, .025, 0, height - .025, z - stepDepth / 2 - .014);
    }
    return model;
  }

  function SunkenFloor(width = 2.25, depth = 1.9) {
    const model = group('SunkenFloor');
    box(model, m.tile, width, .16, depth, 0, -.28, 0);
    box(model, m.floor, width - .12, .025, depth - .12, 0, -.185, 0);
    return model;
  }

  function SunkenRetainingWall(width = 2.25, height = .38) {
    const model = group('SunkenRetainingWall');
    box(model, m.wallTrim, width, height, .16, 0, height / 2 - .08, 0);
    box(model, m.neonWarm, width - .12, .035, .025, 0, height - .12, -.095);
    return model;
  }

  function SunkenSteps(width = .95, count = 3) {
    const model = group('SunkenSteps');
    for (let index = 0; index < count; index++) {
      const height = .12;
      const depth = .2;
      const z = index * depth;
      const centerY = -.06 - index * .08;
      box(model, m.coping, width, height, depth, 0, centerY, z);
      const light = RecessedStepLight(width * .48);
      light.position.set(0, centerY + height / 2 + .015, z - depth * .34);
      model.add(light);
    }
    return model;
  }

  function SunkenRim(width = 2.35, depth = .12) {
    const model = group('SunkenRim');
    box(model, m.copper, width, .055, depth, 0, 0, 0);
    box(model, m.neonWarm, width - .1, .018, .025, 0, .035, -depth / 2 - .008);
    return model;
  }

  function PoolBasin(width = 1.6, depth = 6.4) {
    const model = group('PoolBasin');
    const wall = .18;
    box(model, m.darkMetal, width, .32, depth, 0, -.16, 0);
    box(model, m.wallTrim, width + wall * 2, .38, wall, 0, -.02, -depth / 2 - wall / 2);
    box(model, m.wallTrim, width + wall * 2, .38, wall, 0, -.02, depth / 2 + wall / 2);
    box(model, m.wallTrim, wall, .38, depth, -width / 2 - wall / 2, -.02, 0);
    box(model, m.wallTrim, wall, .38, depth, width / 2 + wall / 2, -.02, 0);
    return model;
  }

  function PoolWaterSurface(width = 1.42, depth = 6.1) {
    const model = group('PoolWaterSurface');
    const water = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), m.water);
    for (const map of [m.water.normalMap, m.water.roughnessMap]) map.repeat.set(width / 4, depth / 4);
    water.rotation.x = -Math.PI / 2;
    water.position.y = .105;
    water.receiveShadow = true;
    model.add(water);
    return model;
  }

  function PoolCoping(length = 1, width = .22) {
    const model = group('PoolCoping');
    box(model, m.coping, length, .12, width, 0, .04, 0);
    box(model, m.neonCyan, length - .08, .025, .025, 0, .09, 0);
    return model;
  }

  function PoolLight() {
    const model = group('PoolLight');
    const lamp = cylinder(model, m.neonCyan, .085, .085, .035, 0, .13, 0, 20);
    lamp.rotation.x = Math.PI / 2;
    const light = new THREE.PointLight(0x21dfff, 2.2, 2.6, 2);
    light.position.set(0, .3, 0);
    model.add(light);
    return model;
  }

  function NeonStrip(length = 1, color = 'magenta') {
    const model = group('NeonStrip');
    const material = color === 'cyan' ? m.neonCyan : color === 'warm' ? m.neonWarm : m.neonMagenta;
    box(model, material, length, .035, .035, 0, 0, 0);
    return model;
  }

  function WallLight(color = 'warm') {
    const model = group('WallLight');
    const lightMaterial = color === 'cyan' ? m.neonCyan : color === 'magenta' ? m.neonMagenta : m.neonWarm;
    box(model, m.darkMetal, .22, .32, .08, 0, 0, 0);
    box(model, lightMaterial, .11, .18, .035, 0, 0, .055);
    const point = new THREE.PointLight(color === 'cyan' ? 0x4ceaff : color === 'magenta' ? 0xff42c8 : 0xffae52, 1.6, 3.2, 2);
    point.position.set(0, -.04, .12);
    model.add(point);
    return model;
  }

  function RecessedStepLight(width = .28) {
    const model = group('RecessedStepLight');
    box(model, m.darkMetal, width, .035, .08, 0, 0, 0);
    box(model, m.neonWarm, width * .72, .025, .025, 0, .018, -.045);
    return model;
  }

  return {
    RoomFloor, FloorInset, RoomWall, WallPillar, EntranceFrame, EntranceDoors, WindowGlassPanel, WindowMullion,
    BarPlatform, BarPlatformSteps, SunkenFloor, SunkenRetainingWall, SunkenSteps,
    SunkenRim, PoolBasin, PoolWaterSurface, PoolCoping, PoolLight, NeonStrip,
    WallLight, RecessedStepLight,
  };
}
