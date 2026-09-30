import { STONE_TILE, POOL_TILE_UNIT, scaleBoxUVs } from './core.js';

export const POOL_FLOOR = -1.05;

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

  function PoolBasin(width = 1.6, depth = 6.4) {
    const model = group('PoolBasin');
    const wall = .18;
    // Walls stop at deck level; the wider coping sits on top so no faces are coplanar.
    const wallHeight = -POOL_FLOOR + .1;
    const wallY = (POOL_FLOOR - .1) / 2;
    const tiled = mesh => scaleBoxUVs(mesh, POOL_TILE_UNIT);
    tiled(box(model, m.poolTile, width, .1, depth, 0, POOL_FLOOR - .05, 0));
    tiled(box(model, m.poolTile, width + wall * 2, wallHeight, wall, 0, wallY, -depth / 2 - wall / 2));
    tiled(box(model, m.poolTile, width + wall * 2, wallHeight, wall, 0, wallY, depth / 2 + wall / 2));
    tiled(box(model, m.poolTile, wall, wallHeight, depth, -width / 2 - wall / 2, wallY, 0));
    tiled(box(model, m.poolTile, wall, wallHeight, depth, width / 2 + wall / 2, wallY, 0));
    return model;
  }

  // Additive caustic light in layers: over the floor (two scales), along both side walls, and a
  // faint net riding on the surface itself. userData.maps lists { map, speed } for the caller to
  // scroll each frame; opposite drift directions are what make the light shimmer.
  function PoolCaustics(width = 1.6, depth = 6.4) {
    const model = group('PoolCaustics');
    model.userData.maps = [];
    const surfaceY = .105;
    const wallHeight = surfaceY - POOL_FLOOR;
    const wallX = width / 2 + .05 - .012;
    const layer = ({ size, scale, opacity, position, rotationX = 0, rotationY = 0, speed }) => {
      const map = t.textures.caustic.clone();
      map.needsUpdate = true;
      map.repeat.set(size[0] / scale, size[1] / scale);
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(size[0], size[1]),
        new THREE.MeshBasicMaterial({
          map, color: 0x8ff3ff, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false,
        }),
      );
      mesh.rotation.set(rotationX, rotationY, 0, 'YXZ');
      mesh.position.set(...position);
      model.add(mesh);
      model.userData.maps.push({ map, speed });
    };
    layer({ size: [width, depth], scale: 3.4, opacity: .55, position: [0, POOL_FLOOR + .01, 0], rotationX: -Math.PI / 2, speed: [.006, .004] });
    layer({ size: [width, depth], scale: 2.2, opacity: .4, position: [0, POOL_FLOOR + .014, 0], rotationX: -Math.PI / 2, speed: [-.004, .007] });
    layer({ size: [width, depth], scale: 2.6, opacity: .3, position: [0, surfaceY + .004, 0], rotationX: -Math.PI / 2, speed: [-.005, -.006] });
    for (const side of [-1, 1]) {
      layer({
        size: [depth, wallHeight], scale: 2.8, opacity: .5, position: [side * wallX, POOL_FLOOR + wallHeight / 2, 0],
        rotationY: -side * Math.PI / 2, speed: [side * .005, .002],
      });
    }
    return model;
  }

  // A recessed underwater lamp on a pool wall, facing +z locally, with an additive halo.
  function PoolWallLight() {
    const model = group('PoolWallLight');
    box(model, m.darkMetal, .22, .22, .06, 0, 0, 0);
    const disc = cylinder(model, m.neonCyan, .12, .12, .03, 0, 0, .04, 24);
    disc.rotation.x = Math.PI / 2;
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: t.textures.glow, color: 0x7ff2ff, transparent: true, opacity: 1,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    halo.scale.set(2.6, 2.6, 1);
    halo.position.z = .1;
    model.add(halo);
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
    BarPlatform, BarPlatformSteps, PoolBasin, PoolCaustics, PoolWallLight, PoolWaterSurface, PoolCoping, NeonStrip,
    WallLight, RecessedStepLight,
  };
}
