export function createBarModels(t) {
  const { THREE, materials: m, group, box, cylinder, torus } = t;
  const bottleMaterials = new Map();

  function bottleMaterial(color) {
    if (typeof color !== 'number') return m.glassware;
    if (!bottleMaterials.has(color)) {
      bottleMaterials.set(color, new THREE.MeshStandardMaterial({ color, roughness: .23, metalness: .08 }));
    }
    return bottleMaterials.get(color);
  }

  function BarCounterStraight(width = 1.8) {
    const model = group('BarCounterStraight');
    box(model, m.barBase, width, .82, .72, 0, .45, 0);
    box(model, m.counter, width + .12, .14, .82, 0, .93, 0);
    box(model, m.neonWarm, width - .12, .035, .025, 0, .25, .37);
    box(model, m.brass, width + .1, .045, .84, 0, 1.015, 0);
    return model;
  }

  function BarCounterCorner(width = 1.7, depth = width) {
    const model = group('BarCounterCorner');
    const first = BarCounterStraight(width);
    const second = BarCounterStraight(depth);
    first.position.set(-width / 2, 0, 0);
    second.rotation.y = Math.PI / 2;
    second.position.set(0, 0, -depth / 2);
    model.add(first, second);
    return model;
  }

  function BarBackCabinet(width = 2.5, height = 2.1) {
    const model = group('BarBackCabinet');
    box(model, m.wood, width, height, .32, 0, height / 2, 0);
    box(model, m.darkMetal, width - .18, height - .2, .035, 0, height / 2 + .04, .18);
    for (const y of [.55, 1.05, 1.55]) {
      box(model, m.woodLight, width - .14, .07, .44, 0, y, -.02);
      box(model, m.neonWarm, width - .28, .018, .025, 0, y - .055, .24);
    }
    box(model, m.woodLight, width, .12, .38, 0, .06, 0);
    return model;
  }

  function Bottle(color = 0x31a58a, height = .34) {
    const model = group('Bottle');
    const material = bottleMaterial(color);
    cylinder(model, material, .075, .09, height * .67, 0, height * .4, 0, 12);
    cylinder(model, material, .035, .065, height * .2, 0, height * .8, 0, 12);
    cylinder(model, m.brass, .04, .04, .035, 0, height * .92, 0, 12);
    return model;
  }

  function BarBottleShelf(width = 2.4) {
    const model = group('BarBottleShelf');
    box(model, m.wallTrim, width, .055, .42, 0, 1.42, 0);
    box(model, m.neonWarm, width - .16, .02, .03, 0, 1.37, .2);
    const colors = [0x249d85, 0xa73d5a, 0xd49834, 0x416dbe, 0x7e4f9a, 0x33977a, 0xc05d35];
    colors.forEach((color, index) => {
      const bottle = Bottle(color, .34 + (index % 2) * .04);
      bottle.position.set(-width / 2 + .24 + index * (width - .48) / (colors.length - 1), 1.45, .08);
      model.add(bottle);
    });
    return model;
  }

  function BarStool() {
    const model = group('BarStool');
    cylinder(model, m.darkMetal, .065, .08, .55, 0, .3, 0, 16);
    cylinder(model, m.black, .25, .29, .09, 0, .635, 0, 24);
    cylinder(model, m.upholstery, .245, .245, .065, 0, .6975, 0, 24);
    torus(model, m.brass, .18, .018, 0, .25, 0, Math.PI / 2);
    cylinder(model, m.darkMetal, .29, .31, .045, 0, .0225, 0, 24);
    return model;
  }

  function DrinkingGlass() {
    const model = group('DrinkingGlass');
    cylinder(model, m.glassware, .105, .075, .22, 0, .11, 0, 18);
    cylinder(model, m.beverage, .084, .07, .06, 0, .09, 0, 18);
    torus(model, m.glassware, .095, .009, 0, .223, 0, Math.PI / 2);
    return model;
  }

  function Mug() {
    const model = group('Mug');
    cylinder(model, m.ceramic, .12, .1, .2, 0, .11, 0, 16);
    torus(model, m.ceramic, .075, .024, .12, .12, 0);
    torus(model, m.brass, .095, .012, 0, .214, 0, Math.PI / 2);
    return model;
  }

  function BuffetCounter(width = 3.2) {
    const model = group('BuffetCounter');
    box(model, m.wood, width, .82, .82, 0, .43, 0);
    box(model, m.counter, width + .12, .14, .94, 0, .91, 0);
    box(model, m.neonWarm, width - .14, .035, .025, 0, .25, .425);
    for (let index = 0; index < 4; index++) {
      box(model, m.darkMetal, .045, .58, .025, -width / 2 + .35 + index * (width - .7) / 3, .45, .42);
    }
    return model;
  }

  function ChafingDish() {
    const model = group('ChafingDish');
    box(model, m.brass, .54, .08, .43, 0, .09, 0);
    box(model, m.darkMetal, .44, .18, .34, 0, .22, 0);
    const lid = new THREE.Mesh(
      new THREE.SphereGeometry(.22, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), m.steel,
    );
    lid.scale.set(1, .72, .82);
    lid.position.set(0, .34, 0);
    model.add(lid);
    cylinder(model, m.brass, .045, .045, .07, 0, .56, 0, 12);
    for (const x of [-.17, .17]) cylinder(model, m.brass, .025, .025, .16, x, .08, 0, 10);
    return model;
  }

  function Plate() {
    const model = group('Plate');
    cylinder(model, m.porcelain, .18, .15, .028, 0, .014, 0, 24);
    cylinder(model, m.ceramic, .125, .125, .012, 0, .034, 0, 24);
    return model;
  }

  function PlateStack(count = 4) {
    const model = group('PlateStack');
    for (let index = 0; index < count; index++) {
      const plate = Plate();
      plate.position.y = index * .035;
      model.add(plate);
    }
    return model;
  }

  return {
    BarCounterStraight, BarCounterCorner, BarBackCabinet, BarBottleShelf, BarStool,
    Bottle, DrinkingGlass, Mug, BuffetCounter, ChafingDish, Plate, PlateStack,
  };
}
