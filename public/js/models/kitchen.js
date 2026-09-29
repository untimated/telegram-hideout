export function createKitchenModels(t) {
  const { THREE, materials: m, group, box, cylinder, sphere, torus, rod } = t;

  function KitchenBaseCabinet(width = 1, height = .9, depth = .68) {
    const model = group('KitchenBaseCabinet');
    box(model, m.wood, width, height, depth, 0, height / 2, 0);
    box(model, m.darkMetal, width - .12, .12, depth + .035, 0, .06, 0);
    box(model, m.woodLight, width - .12, height - .18, .035, 0, height / 2, depth / 2 + .02);
    box(model, m.darkMetal, .035, height - .24, .025, 0, height / 2, depth / 2 + .045);
    box(model, m.brass, .22, .025, .025, 0, height * .72, depth / 2 + .065);
    return model;
  }

  function KitchenWorktop(width = 1, depth = .72) {
    const model = group('KitchenWorktop');
    box(model, m.counter, width, .11, depth, 0, .055, 0);
    box(model, m.coping, width + .04, .025, depth + .04, 0, .115, 0);
    return model;
  }

  function KitchenBacksplash(width = 1, height = .72) {
    const model = group('KitchenBacksplash');
    box(model, m.tile, width, height, .065, 0, height / 2, 0);
    for (let y = .18; y < height; y += .18) {
      box(model, m.wallTrim, width - .06, .012, .015, 0, y, .04);
    }
    return model;
  }

  function KitchenShelf(width = 1.2) {
    const model = group('KitchenShelf');
    box(model, m.woodLight, width, .07, .32, 0, 0, 0);
    for (const x of [-width * .38, width * .38]) box(model, m.brass, .035, .28, .055, x, .15, .1);
    box(model, m.neonWarm, width - .12, .018, .02, 0, -.045, .13);
    return model;
  }

  function Refrigerator() {
    const model = group('Refrigerator');
    box(model, m.steel, .78, 1.9, .72, 0, .95, 0);
    box(model, m.wallTrim, .7, 1.48, .035, 0, 1.13, .38);
    box(model, m.darkMetal, .035, .46, .06, .29, 1.12, .43);
    box(model, m.darkMetal, .035, .16, .06, .29, 1.78, .43);
    box(model, m.neonCyan, .48, .025, .02, -.05, 1.82, .41);
    return model;
  }

  function Stove() {
    const model = group('Stove');
    box(model, m.darkMetal, .92, .82, .78, 0, .41, 0);
    box(model, m.cooktop, .94, .09, .8, 0, .86, 0);
    for (const x of [-.23, .23]) {
      for (const z of [-.2, .2]) {
        cylinder(model, m.darkMetal, .14, .14, .025, x, .92, z, 20);
        cylinder(model, m.brass, .085, .085, .028, x, .945, z, 16);
        cylinder(model, m.black, .045, .045, .035, x, .97, z, 12);
      }
    }
    box(model, m.black, .66, .34, .035, 0, .42, .41);
    box(model, m.steel, .55, .025, .025, 0, .61, .435);
    for (let index = 0; index < 4; index++) cylinder(model, m.brass, .035, .035, .035, -.25 + index * .167, .72, .44, 12);
    return model;
  }

  function ExtractorHood(width = 1.05) {
    const model = group('ExtractorHood');
    box(model, m.steel, width * .38, .58, .34, 0, 1.08, .06);
    box(model, m.darkMetal, width * .42, .04, .38, 0, 1.38, .04);
    box(model, m.steel, width, .12, .68, 0, .73, 0);
    box(model, m.brass, width - .14, .025, .04, 0, .66, .34);
    return model;
  }

  function KitchenSink() {
    const model = group('KitchenSink');
    box(model, m.counter, .95, .09, .74, 0, .84, 0);
    box(model, m.black, .52, .045, .4, 0, .89, .035);
    box(model, m.steel, .57, .025, .45, 0, .88, .035);
    cylinder(model, m.darkMetal, .035, .035, .025, .31, .9, .24, 12);
    return model;
  }

  function KitchenFaucet() {
    const model = group('KitchenFaucet');
    rod(model, m.steel, [0, 0, 0], [0, .34, 0], .025);
    rod(model, m.steel, [0, .34, 0], [0, .34, .16], .025);
    rod(model, m.steel, [0, .34, .16], [0, .23, .16], .022);
    cylinder(model, m.brass, .055, .055, .035, 0, .035, -.1, 12);
    return model;
  }

  function CookingPot() {
    const model = group('CookingPot');
    cylinder(model, m.steel, .22, .19, .28, 0, .15, 0, 20);
    torus(model, m.darkMetal, .205, .018, 0, .3, 0);
    rod(model, m.darkMetal, [-.2, .25, 0], [-.32, .25, 0], .024);
    rod(model, m.darkMetal, [.2, .25, 0], [.32, .25, 0], .024);
    return model;
  }

  function PotLid() {
    const model = group('PotLid');
    cylinder(model, m.steel, .22, .22, .035, 0, .018, 0, 20);
    sphere(model, m.steel, .055, 0, .07, 0, 8).scale.y = .55;
    return model;
  }

  function FryingPan() {
    const model = group('FryingPan');
    cylinder(model, m.darkMetal, .22, .22, .055, 0, .028, 0, 20);
    cylinder(model, m.steel, .18, .18, .015, 0, .062, 0, 20);
    rod(model, m.darkMetal, [.19, .04, 0], [.55, .04, 0], .032);
    return model;
  }

  function UtensilHolder() {
    const model = group('UtensilHolder');
    cylinder(model, m.ceramic, .15, .13, .27, 0, .135, 0, 16);
    for (let index = 0; index < 5; index++) {
      const x = -.09 + index * .045;
      rod(model, m.steel, [x, .22, 0], [x + (index % 2 ? .035 : -.035), .55 + (index % 3) * .04, 0], .012, 8);
      sphere(model, m.brass, .025, x, .56 + (index % 3) * .04, 0, 6);
    }
    return model;
  }

  function CookingUtensil(type = 'spoon') {
    const model = group('CookingUtensil');
    rod(model, m.steel, [0, 0, 0], [0, .46, 0], .012, 8);
    if (type === 'spatula') box(model, m.steel, .1, .12, .018, 0, .51, 0);
    else if (type === 'whisk') {
      for (let index = 0; index < 4; index++) {
        const offset = (index - 1.5) * .024;
        rod(model, m.steel, [0, .42, 0], [offset, .58, 0], .008, 6);
      }
    } else sphere(model, m.steel, .05, 0, .52, 0, 8);
    return model;
  }

  function CuttingBoard() {
    const model = group('CuttingBoard');
    box(model, m.woodLight, .62, .055, .42, 0, .028, 0);
    cylinder(model, m.wood, .045, .045, .04, .24, .035, 0, 12);
    return model;
  }

  return {
    KitchenBaseCabinet, KitchenWorktop, KitchenBacksplash, KitchenShelf, Refrigerator,
    Stove, ExtractorHood, KitchenSink, KitchenFaucet, CookingPot, PotLid, FryingPan,
    UtensilHolder, CookingUtensil, CuttingBoard,
  };
}
