export function createFurnitureModels(t) {
  const { THREE, materials: m, group, box, cylinder, torus } = t;

  // A tiny woven bump map shared by the furniture; colour stays in the lounge palette.
  const weave = document.createElement('canvas');
  weave.width = weave.height = 64;
  const weaveContext = weave.getContext('2d');
  weaveContext.fillStyle = '#808080';
  weaveContext.fillRect(0, 0, 64, 64);
  for (let y = 0; y < 64; y += 4) {
    for (let x = 0; x < 64; x += 4) {
      weaveContext.fillStyle = (x + y) % 8 ? '#969696' : '#696969';
      weaveContext.fillRect(x, y, 3, 2);
    }
  }
  const fabricBump = new THREE.CanvasTexture(weave);
  fabricBump.wrapS = fabricBump.wrapT = THREE.RepeatWrapping;
  fabricBump.repeat.set(5, 5);
  const upholstery = m.upholstery.clone();
  const cushionMaterial = m.cushion.clone();
  for (const material of [upholstery, cushionMaterial]) {
    material.roughness = .86;
    material.metalness = 0;
    material.bumpMap = fabricBump;
    material.bumpScale = .002;
  }

  // Subdivided boxes with a narrow bevel; keep broad faces and a faceted silhouette.
  // Coordinate-based deformation keeps duplicated face vertices joined at the edges.
  function paddedBox(parent, material, width, height, depth, x, y, z, bevel, crown = 0) {
    const mesh = box(parent, material, width, height, depth, x, y, z);
    mesh.geometry.dispose();
    const geometry = new THREE.BoxGeometry(width, height, depth, 6, 6, 6);
    const positions = geometry.attributes.position;
    const half = [width / 2, height / 2, depth / 2];
    for (let i = 0; i < positions.count; i++) {
      const source = [positions.getX(i), positions.getY(i), positions.getZ(i)];
      const point = source.map((value, axis) => {
        const unit = value / half[axis];
        return Math.abs(unit) > .999 ? Math.sign(unit) * half[axis] : unit * 1.5 * (half[axis] - bevel);
      });
      const inner = point.map((value, axis) => Math.max(-half[axis] + bevel, Math.min(half[axis] - bevel, value)));
      const offset = point.map((value, axis) => value - inner[axis]);
      const length = Math.hypot(...offset);
      const rounded = inner.map((value, axis) => value + offset[axis] * bevel / length);
      // A gently domed top reads as padding without adding noisy random dents.
      const fullness = Math.max(0, 1 - (rounded[0] / half[0]) ** 2) * Math.max(0, 1 - (rounded[2] / half[2]) ** 2);
      rounded[1] += crown * fullness * Math.max(0, rounded[1] / half[1]);
      positions.setXYZ(i, ...rounded);
    }
    geometry.computeVertexNormals();
    mesh.geometry = geometry;
    return mesh;
  }

  function CafeTable() {
    const model = group('CafeTable');
    cylinder(model, m.darkMetal, .07, .1, .72, 0, .36, 0, 16);
    cylinder(model, m.counter, .62, .62, .13, 0, .8, 0, 32);
    torus(model, m.brass, .54, .018, 0, .87, 0, Math.PI / 2);
    cylinder(model, m.darkMetal, .34, .42, .065, 0, .045, 0, 24);
    return model;
  }

  function CafeChair() {
    const model = group('CafeChair');
    paddedBox(model, upholstery, .5, .1, .48, 0, .395, 0, .02);
    paddedBox(model, cushionMaterial, .47, .09, .43, 0, .465, -.015, .025, .009);
    const back = paddedBox(model, upholstery, .49, .48, .095, 0, .715, .2, .025);
    back.rotation.x = .1;
    const backPad = paddedBox(model, cushionMaterial, .41, .35, .045, 0, .72, .14, .014);
    backPad.rotation.x = .1;
    for (const x of [-.19, .19]) {
      for (const z of [-.17, .17]) {
        box(model, m.darkMetal, .045, .38, .045, x, .19, z);
        box(model, m.brass, .047, .04, .047, x, .025, z);
      }
    }
    return model;
  }

  function Sofa(width = 1.75) {
    const model = group('Sofa');
    // Metres: ~.46 m seat, .64 m arms, .88 m back. +z is the sitting side.
    box(model, m.darkMetal, width - .24, .08, .65, 0, .16, 0);
    paddedBox(model, upholstery, width - .08, .18, .8, 0, .29, 0, .025);
    const back = paddedBox(model, upholstery, width - .1, .55, .16, 0, .6, -.335, .025);
    back.rotation.x = -.09;
    for (const side of [-1, 1]) {
      paddedBox(model, upholstery, .18, .4, .84, side * (width / 2 - .09), .43, 0, .035);
      paddedBox(model, cushionMaterial, .19, .07, .79, side * (width / 2 - .09), .625, .015, .02, .006);
    }
    const seats = width >= 2.3 ? 3 : 2;
    const innerWidth = width - .4;
    const spacing = innerWidth / seats;
    for (let i = 0; i < seats; i++) {
      const x = (i - (seats - 1) / 2) * spacing;
      paddedBox(model, cushionMaterial, spacing - .025, .12, .56, x, .405, .085, .035, .012);
      const cushion = paddedBox(model, cushionMaterial, spacing - .03, .37, .13, x, .665, -.245, .035);
      cushion.rotation.x = -.12;
    }
    for (const x of [-width / 2 + .19, width / 2 - .19]) {
      for (const z of [-.27, .27]) {
        cylinder(model, m.darkMetal, .035, .045, .13, x, .065, z, 8);
      }
    }
    return model;
  }

  function CoffeeTable() {
    const model = group('CoffeeTable');
    box(model, m.darkMetal, 1.25, .1, .7, 0, .365, 0);
    paddedBox(model, m.counter, 1.31, .055, .76, 0, .438, 0, .012);
    for (const x of [-.52, .52]) {
      for (const z of [-.24, .24]) box(model, m.steel, .07, .35, .07, x, .175, z);
    }
    return model;
  }

  function SquareSeat() {
    const model = group('SquareSeat');
    box(model, m.darkMetal, .43, .1, .43, 0, .075, 0);
    paddedBox(model, upholstery, .52, .26, .52, 0, .25, 0, .025);
    paddedBox(model, cushionMaterial, .5, .1, .5, 0, .425, 0, .03, .009);
    return model;
  }

  return { CafeTable, CafeChair, Sofa, CoffeeTable, SquareSeat };
}
