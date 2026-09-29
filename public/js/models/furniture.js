export function createFurnitureModels(t) {
  const { materials: m, group, box, cylinder, torus } = t;

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
    box(model, m.upholstery, .47, .12, .46, 0, .39, 0);
    box(model, m.cushion, .46, .1, .39, 0, .47, .025);
    box(model, m.upholstery, .47, .54, .1, 0, .73, .18);
    for (const x of [-.19, .19]) {
      for (const z of [-.17, .17]) {
        box(model, m.darkMetal, .045, .38, .045, x, .19, z);
      }
    }
    return model;
  }

  function Sofa(width = 1.75) {
    const model = group('Sofa');
    box(model, m.darkMetal, width, .2, .76, 0, .13, 0);
    box(model, m.upholstery, width - .18, .24, .58, 0, .3, .015);
    box(model, m.upholstery, width, .58, .18, 0, .57, -.29);
    box(model, m.upholstery, .19, .4, .76, -width / 2 + .095, .4, 0);
    box(model, m.upholstery, .19, .4, .76, width / 2 - .095, .4, 0);
    for (const x of [-width * .25, width * .25]) {
      box(model, m.cushion, width * .42, .14, .45, x, .46, .055);
      box(model, m.cushion, width * .42, .31, .1, x, .69, -.205);
    }
    for (const x of [-width * .38, width * .38]) {
      cylinder(model, m.darkMetal, .045, .055, .14, x, .07, .23, 10);
      cylinder(model, m.darkMetal, .045, .055, .14, x, .07, -.23, 10);
    }
    return model;
  }

  function CoffeeTable() {
    const model = group('CoffeeTable');
    box(model, m.darkMetal, 1.25, .1, .7, 0, .365, 0);
    box(model, m.counter, 1.31, .055, .76, 0, .438, 0);
    for (const x of [-.52, .52]) {
      for (const z of [-.24, .24]) box(model, m.steel, .07, .35, .07, x, .175, z);
    }
    return model;
  }

  function SquareSeat() {
    const model = group('SquareSeat');
    box(model, m.darkMetal, .52, .36, .52, 0, .18, 0);
    box(model, m.upholstery, .48, .17, .48, 0, .43, 0);
    box(model, m.cushion, .38, .055, .38, 0, .54, 0);
    return model;
  }

  return { CafeTable, CafeChair, Sofa, CoffeeTable, SquareSeat };
}
