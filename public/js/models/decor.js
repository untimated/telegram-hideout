export function createDecorModels(t, architecture) {
  const { THREE, materials: m, group, box, cylinder, sphere, torus, rod, rng } = t;
  const { NeonStrip, RecessedStepLight } = architecture;

  function Shrub(size = 1, seed = 1) {
    const model = group('Shrub');
    const random = rng(seed);
    cylinder(model, m.bark, .09 * size, .12 * size, .42 * size, 0, .2 * size, 0, 8);
    const leafMaterials = [m.leaf, m.leafLight, m.leafDark];
    for (let index = 0; index < 9; index++) {
      const angle = index * 2.399;
      const radius = (.12 + random() * .18) * size;
      const height = (.42 + random() * .36) * size;
      sphere(
        model,
        leafMaterials[index % leafMaterials.length],
        (.2 + random() * .09) * size,
        Math.cos(angle) * radius,
        height,
        Math.sin(angle) * radius,
        0,
      );
    }
    return model;
  }

  function PlantPot(size = 1) {
    const model = group('PlantPot');
    cylinder(model, m.plantPot, .22 * size, .16 * size, .32 * size, 0, .16 * size, 0, 12);
    torus(model, m.brass, .205 * size, .018 * size, 0, .315 * size, 0, Math.PI / 2);
    cylinder(model, m.soil, .19 * size, .19 * size, .025 * size, 0, .29 * size, 0, 16);
    return model;
  }

  function PottedPlant(size = 1, seed = 1) {
    const model = group('PottedPlant');
    const pot = PlantPot(size);
    const shrub = Shrub(size, seed);
    shrub.position.y = .26 * size;
    model.add(pot, shrub);
    return model;
  }

  function GossipBarSign(width = 3.2) {
    const model = group('GossipBarSign');
    box(model, m.darkMetal, width, .65, .08, 0, .325, 0);
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 144;
    const context = canvas.getContext('2d');
    context.font = '500 78px sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillStyle = '#ffe0fa';
    context.shadowColor = '#ff35c4';
    context.shadowBlur = 18;
    context.fillText('GOSSIP BAR', 512, 76);
    context.fillText('GOSSIP BAR', 512, 76);
    context.strokeStyle = '#ff80dd';
    context.lineWidth = 5;
    context.beginPath();
    context.moveTo(45, 76);
    context.lineTo(190, 76);
    context.moveTo(834, 76);
    context.lineTo(979, 76);
    context.stroke();
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const lettering = new THREE.Mesh(
      new THREE.PlaneGeometry(width - .1, .62),
      new THREE.MeshBasicMaterial({ map: texture, transparent: true, toneMapped: false }),
    );
    lettering.position.set(0, .325, .045);
    model.add(lettering);
    return model;
  }

  function TableLamp() {
    const model = group('TableLamp');
    box(model, m.brass, .2, .035, .2, 0, .018, 0);
    box(model, m.neonWarm, .14, .2, .14, 0, .135, 0);
    box(model, m.brass, .2, .025, .2, 0, .248, 0);
    for (const x of [-.083, .083]) {
      for (const z of [-.083, .083]) box(model, m.brass, .014, .22, .014, x, .14, z);
    }
    const glow = new THREE.PointLight(0xffb44f, 1.4, 3, 2);
    glow.position.y = .3;
    model.add(glow);
    return model;
  }

  function FountainPedestal() {
    const model = group('FountainPedestal');
    box(model, m.darkMetal, 1.75, .1, .95, 0, .05, 0);
    box(model, m.wood, 1.7, .64, .85, 0, .4, 0);
    box(model, m.counter, 1.95, .1, 1.08, 0, .77, 0);
    box(model, m.neonWarm, 1.7, .018, .02, 0, .7, .436);
    cylinder(model, m.brass, .35, .32, .04, -.4, .84, 0, 24);
    cylinder(model, m.chocolate, .3, .3, .025, -.4, .875, 0, 24);
    return model;
  }

  function ChocolateFlow(height = .5) {
    const model = group('ChocolateFlow');
    cylinder(model, m.chocolate, .1, .24, height, 0, height / 2, 0, 24);
    for (const y of [height * .25, height * .65]) {
      torus(model, m.chocolate, .2 - y * .08, .04, 0, y, 0, Math.PI / 2);
    }
    return model;
  }

  function ChocolateFountain() {
    const model = group('ChocolateFountain');
    cylinder(model, m.brass, .055, .055, 1.15, 0, .575, 0, 16);
    const tiers = [
      { y: .3, top: .18, bottom: .36, height: .14 },
      { y: .58, top: .12, bottom: .29, height: .12 },
      { y: .84, top: .08, bottom: .21, height: .1 },
      { y: 1.04, top: .025, bottom: .13, height: .09 },
    ];
    for (const tier of tiers) {
      cylinder(model, m.chocolate, tier.top, tier.bottom, tier.height, 0, tier.y, 0, 24);
    }
    return model;
  }

  function DrinkDispenser() {
    const model = group('DrinkDispenser');
    cylinder(model, m.steel, .18, .2, .035, 0, .018, 0, 20);
    cylinder(model, m.brass, .11, .15, .13, 0, .095, 0, 16);
    cylinder(model, m.glassware, .17, .17, .4, 0, .36, 0, 24);
    cylinder(model, m.beverage, .15, .15, .33, 0, .33, 0, 24);
    cylinder(model, m.brass, .18, .18, .035, 0, .585, 0, 20);
    cylinder(model, m.brass, .045, .04, .05, 0, .628, 0, 12);
    rod(model, m.steel, [0, .2, -.15], [0, .2, -.25], .025);
    rod(model, m.steel, [0, .2, -.25], [0, .12, -.25], .022);
    box(model, m.darkMetal, .1, .025, .025, 0, .245, -.22);
    return model;
  }

  function Cup() {
    const model = group('Cup');
    cylinder(model, m.porcelain, .095, .065, .16, 0, .08, 0, 16);
    torus(model, m.brass, .09, .008, 0, .16, 0, Math.PI / 2);
    return model;
  }

  function CupStack(count = 4) {
    const model = group('CupStack');
    for (let index = 0; index < count; index++) {
      const cup = Cup();
      cup.position.y = index * .13;
      model.add(cup);
    }
    return model;
  }

  function Jukebox() {
    const model = group('Jukebox');
    box(model, m.wood, .78, 1.52, .42, 0, .76, 0);
    const arch = new THREE.Mesh(
      new THREE.SphereGeometry(.39, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), m.woodLight,
    );
    arch.position.y = 1.52;
    arch.scale.z = .54;
    model.add(arch);
    const archLight = new THREE.Mesh(new THREE.TorusGeometry(.33, .025, 8, 24, Math.PI), m.neonWarm);
    archLight.position.set(0, 1.5, .235);
    model.add(archLight);
    box(model, m.black, .59, 1.22, .035, 0, .98, .225);
    box(model, m.neonMagenta, .045, 1.18, .025, -.32, .98, .25);
    box(model, m.neonMagenta, .045, 1.18, .025, .32, .98, .25);
    box(model, m.darkMetal, .5, .28, .025, 0, 1.57, .25);
    for (const y of [1.49, 1.57, 1.65]) {
      box(model, m.neonWarm, .34, .015, .018, 0, y, .272);
    }
    for (const y of [.4, .76]) {
      cylinder(model, m.darkMetal, .14, .14, .035, 0, y, .258, 20).rotation.x = Math.PI / 2;
      torus(model, m.brass, .12, .015, 0, y, .285);
    }
    for (let index = 0; index < 5; index++) {
      cylinder(model, m.neonCyan, .027, .027, .035, -.2 + index * .1, 1.28, .26, 12).rotation.x = Math.PI / 2;
    }
    return model;
  }

  function StagePlatform(width = 3.2, depth = 1.9) {
    const model = group('StagePlatform');
    box(model, m.platform, width, .34, depth, 0, .17, 0);
    box(model, m.counter, width - .1, .055, depth - .1, 0, .37, 0);
    const front = NeonStrip(width - .18, 'magenta');
    front.position.set(0, .25, -depth / 2 - .02);
    model.add(front);
    const left = NeonStrip(depth - .18, 'magenta');
    left.rotation.y = Math.PI / 2;
    left.position.set(-width / 2 - .015, .25, 0);
    model.add(left);
    return model;
  }

  function StageSteps(width = .8, count = 3) {
    const model = group('StageSteps');
    for (let index = 0; index < count; index++) {
      const height = .11 * (index + 1);
      box(model, m.platform, width, height, .2, 0, height / 2, index * .2);
      const light = RecessedStepLight(width * .7);
      light.position.set(0, height + .015, index * .2 + .065);
      model.add(light);
    }
    return model;
  }

  function StageSpeaker() {
    const model = group('StageSpeaker');
    box(model, m.black, .48, .68, .38, 0, .34, 0);
    box(model, m.wallTrim, .4, .6, .025, 0, .34, -.2);
    for (const y of [.2, .49]) {
      cylinder(model, m.darkMetal, y === .2 ? .11 : .075, y === .2 ? .11 : .075, .03, 0, y, -.22, 20).rotation.x = Math.PI / 2;
      torus(model, m.steel, y === .2 ? .105 : .07, .01, 0, y, -.245);
    }
    box(model, m.neonMagenta, .28, .018, .02, 0, .63, -.22);
    return model;
  }

  function MicrophoneStand() {
    const model = group('MicrophoneStand');
    cylinder(model, m.darkMetal, .17, .19, .05, 0, .025, 0, 20);
    rod(model, m.steel, [0, .04, 0], [0, 1.15, 0], .018);
    rod(model, m.steel, [0, 1.15, 0], [.28, 1.28, 0], .018);
    return model;
  }

  function Microphone() {
    const model = group('Microphone');
    cylinder(model, m.darkMetal, .045, .035, .19, 0, .095, 0, 12);
    sphere(model, m.steel, .05, 0, .19, 0, 1);
    torus(model, m.neonMagenta, .04, .008, 0, .19, 0);
    return model;
  }

  function WallArtFrame(width = .9, height = .65) {
    const model = group('WallArtFrame');
    box(model, m.brass, width, height, .075, 0, height / 2, 0);
    box(model, m.darkMetal, width - .1, height - .1, .03, 0, height / 2, .055);
    const panel = WallArtPanel(width - .16, height - .16);
    panel.position.set(0, .08, .08);
    model.add(panel);
    return model;
  }

  function WallArtPanel(width = .74, height = .49) {
    const model = group('WallArtPanel');
    box(model, m.wall, width, height, .025, 0, height / 2, 0);
    const triangle = new THREE.Mesh(new THREE.ConeGeometry(.18, .36, 3), m.neonMagenta);
    triangle.position.set(-.16, height * .5, .03);
    triangle.rotation.z = Math.PI;
    model.add(triangle);
    sphere(model, m.neonCyan, Math.min(width, height) * .18, .15, height * .55, .04, 1);
    box(model, m.neonWarm, width * .4, .025, .025, 0, height * .17, .045);
    return model;
  }

  // A real painting in a slim brass frame with a picture light. Origin is bottom-centre and the
  // canvas faces +z; the image is a texture, lightly self-lit so it stays readable at night.
  function WallPainting({ width = 1.8, height = 1.2, image } = {}) {
    const model = group('WallPainting');
    const rim = .07;
    box(model, m.brass, width + rim * 2, height + rim * 2, .06, 0, height / 2, 0);
    box(model, m.darkMetal, width + .03, height + .03, .05, 0, height / 2, .012);
    const texture = new THREE.TextureLoader().load(image);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;
    const canvas = new THREE.Mesh(
      new THREE.PlaneGeometry(width, height),
      new THREE.MeshStandardMaterial({
        map: texture, emissive: 0xffffff, emissiveMap: texture, emissiveIntensity: .35, roughness: .6, metalness: 0,
      }),
    );
    canvas.position.set(0, height / 2, .04);
    model.add(canvas);
    // Picture light: a brass arm out from the wall with a warm strip aimed down at the canvas.
    const top = height + rim;
    box(model, m.brass, .05, .05, .2, 0, top + .06, .1);
    box(model, m.brass, width * .45, .045, .05, 0, top + .06, .22);
    box(model, m.neonWarm, width * .45 - .06, .02, .03, 0, top + .03, .22);
    return model;
  }

  function ChefHat() {
    const model = group('ChefHat');
    cylinder(model, m.porcelain, .15, .15, .08, 0, .04, 0, 20);
    const puff = new THREE.Mesh(new THREE.SphereGeometry(.17, 14, 8), m.porcelain);
    puff.scale.set(1, .86, .82);
    puff.position.y = .2;
    model.add(puff);
    sphere(model, m.porcelain, .09, -.1, .18, 0, 0);
    sphere(model, m.porcelain, .09, .1, .18, 0, 0);
    return model;
  }

  return {
    Shrub, PlantPot, PottedPlant, GossipBarSign, TableLamp, FountainPedestal,
    ChocolateFountain, ChocolateFlow, DrinkDispenser, Cup, CupStack, Jukebox,
    StagePlatform, StageSteps, StageSpeaker, MicrophoneStand, Microphone,
    WallArtFrame, WallArtPanel, WallPainting, ChefHat,
  };
}
