import { ROULETTE, ROULETTE_POCKETS } from '../game/roulette.js';
import { createRouletteEffects } from './roulette-effects.js';
import { createRouletteLights } from './roulette-lights.js';
import { createSlotWinEffects } from './slot-win-effects.js';

// Pachinko-inspired roulette cabinet with a fixed chair. Floor origin, cabinet front +Z.
// This is the visual prototype; the wheel, ball and buttons are ready for later interaction.
export function createRouletteModel(t) {
  const { THREE, materials: m, group, box, cylinder, sphere, rod } = t;
  const model = group('PachinkoRoulette');
  const cabinet = group('RouletteCabinet');
  const chair = group('RouletteChair');
  model.add(cabinet, chair);
  const red = new THREE.MeshStandardMaterial({ color: 0x791c29, roughness: .44, metalness: .18 });
  const padding = new THREE.MeshStandardMaterial({ color: 0x962c38, roughness: .7, metalness: .02 });
  const charcoal = new THREE.MeshStandardMaterial({ color: 0x24232a, roughness: .48, metalness: .3 });
  const light = new THREE.MeshStandardMaterial({ color: 0xffd995, emissive: 0xffb13b, emissiveIntensity: .8, roughness: .3 });
  const green = new THREE.MeshStandardMaterial({ color: 0x26744f, roughness: .48, metalness: .12 });

  function extrude(parent, shape, material, depth, x, y, z, bevel = .008) {
    const mesh = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, {
      depth, steps: 1, curveSegments: 4, bevelEnabled: bevel > 0,
      bevelSize: bevel, bevelThickness: bevel, bevelSegments: 1,
    }), material);
    mesh.position.set(x, y, z);
    mesh.castShadow = mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  function roundedShape(width, height, radius) {
    const shape = new THREE.Shape();
    const x = width / 2;
    const y = height / 2;
    shape.moveTo(-x + radius, -y);
    shape.lineTo(x - radius, -y);
    shape.quadraticCurveTo(x, -y, x, -y + radius);
    shape.lineTo(x, y - radius);
    shape.quadraticCurveTo(x, y, x - radius, y);
    shape.lineTo(-x + radius, y);
    shape.quadraticCurveTo(-x, y, -x, y - radius);
    shape.lineTo(-x, -y + radius);
    shape.quadraticCurveTo(-x, -y, -x + radius, -y);
    shape.closePath();
    return shape;
  }

  function label(parent, text, width, height, x, y, z, { background = '#791c29', color = '#fff0c9', size = 70, canvasWidth = 512 } = {}) {
    const canvas = document.createElement('canvas');
    canvas.width = canvasWidth;
    canvas.height = 128;
    const context = canvas.getContext('2d');
    context.fillStyle = background;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.font = `bold ${size}px Georgia, serif`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillStyle = color;
    context.fillText(text, canvas.width / 2, 67, canvas.width - 24);
    const map = new THREE.CanvasTexture(canvas);
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = 4;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshStandardMaterial({
      map, emissiveMap: map, emissive: 0xffffff, emissiveIntensity: .22, roughness: .6,
    }));
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  }

  // A bevelled shell with a broad wheel window and a projecting control shelf.
  const outline = [
    [-.51, .075], [.51, .075], [.54, .18], [.54, .73], [.5, .89],
    [.5, 1.86], [.46, 1.99], [.34, 2.05], [-.34, 2.05], [-.46, 1.99],
    [-.5, 1.86], [-.5, .89], [-.54, .73], [-.54, .18],
  ];
  const shell = new THREE.Shape();
  outline.forEach(([x, y], index) => index ? shell.lineTo(x, y) : shell.moveTo(x, y));
  shell.closePath();
  extrude(cabinet, shell, charcoal, .48, 0, 0, -.28, .012);
  box(cabinet, m.darkMetal, 1.13, .075, .6, 0, .0375, -.01);
  box(cabinet, m.brass, 1.09, .025, .036, 0, .095, .295);
  for (const side of [-1, 1]) {
    box(cabinet, red, .026, 1.64, .36, side * .506, .99, -.025);
    box(cabinet, m.brass, .025, 1.56, .024, side * .528, .99, .16);
    box(cabinet, m.brass, .025, 1.56, .024, side * .528, .99, -.21);
    for (const y of [.21, 1.77]) box(cabinet, m.brass, .035, .025, .41, side * .52, y, -.025);
    for (const y of [.25, 1.74]) sphere(cabinet, m.brass, .012, side * .544, y, .13, 0);
  }

  // The circular face tilts back slightly. All wheel parts share its local XY plane.
  const face = group('RouletteWindow');
  face.position.set(0, 1.35, .27);
  face.rotation.x = -.07;
  cabinet.add(face);
  const disc = (parent, material, radius, depth, z) => {
    const mesh = cylinder(parent, material, radius, radius, depth, 0, 0, z, 48);
    mesh.rotation.x = Math.PI / 2;
    return mesh;
  };
  const ring = (parent, material, radius, tube, z) => {
    const mesh = new THREE.Mesh(new THREE.TorusGeometry(radius, tube, 6, 64), material);
    mesh.position.z = z;
    mesh.castShadow = mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  };
  disc(face, m.brass, .51, .045, 0);
  disc(face, red, .492, .025, .029);
  disc(face, m.black, .45, .028, .047);
  ring(face, m.brass, .499, .013, .039);
  ring(face, m.brass, .452, .012, .064);
  ring(face, m.brass, .409, .009, .072);

  // Separate rotation pivot; the illustrative pockets do not define payout rules.
  const wheel = group('RouletteWheel');
  wheel.userData.dynamic = true;
  wheel.position.z = .063;
  face.add(wheel);
  disc(wheel, charcoal, .39, .025, 0);
  const pocketCount = ROULETTE_POCKETS.length;
  const step = Math.PI * 2 / pocketCount;
  for (let index = 0; index < pocketCount; index++) {
    const angle = Math.PI / 2 + index * step;
    const pocket = new THREE.Mesh(new THREE.RingGeometry(.235, .385, 2, 1, angle - step / 2 + .01, step - .02),
      { green, red, black: m.black }[ROULETTE_POCKETS[index]]);
    pocket.position.z = .019;
    pocket.receiveShadow = true;
    wheel.add(pocket);
    const edge = angle - step / 2;
    rod(wheel, m.brass, [.235 * Math.cos(edge), .235 * Math.sin(edge), .026],
      [.385 * Math.cos(edge), .385 * Math.sin(edge), .026], .0035, 6);
  }
  ring(wheel, m.brass, .387, .007, .025);
  ring(wheel, m.brass, .234, .007, .025);
  disc(wheel, charcoal, .225, .031, .019);
  ring(wheel, m.brass, .215, .006, .043);
  for (const angle of [0, Math.PI / 2]) {
    rod(wheel, m.brass, [-.16 * Math.cos(angle), -.16 * Math.sin(angle), .065],
      [.16 * Math.cos(angle), .16 * Math.sin(angle), .065], .012, 8);
  }
  disc(wheel, m.brass, .057, .035, .063);
  sphere(wheel, m.brass, .035, 0, 0, .105, 1);

  const ball = group('RouletteBall');
  ball.userData.dynamic = true;
  ball.position.set(.294, -.294, .106);
  sphere(ball, m.porcelain, .023, 0, 0, 0, 1);
  face.add(ball);
  const effects = createRouletteEffects(THREE);
  face.add(effects.object);
  const wheelBulbs = [];
  for (let index = 0; index < 12; index++) {
    const angle = index * Math.PI / 6;
    const x = Math.cos(angle) * .476;
    const y = Math.sin(angle) * .476;
    sphere(face, m.brass, .022, x, y, .051, 1);
    wheelBulbs.push([x, y, .068]);
  }
  // A light transparent cover keeps the wheel readable and adds the pachinko glass face.
  const glass = new THREE.Mesh(new THREE.CircleGeometry(.436, 64), new THREE.MeshStandardMaterial({
    color: 0xe4f2ed, transparent: true, opacity: .055, roughness: .16, metalness: .1,
    depthWrite: false, side: THREE.DoubleSide,
  }));
  glass.position.z = .14;
  glass.castShadow = false;
  face.add(glass);

  // Raised marquee and warm lamps echo the approved cabinet concept.
  extrude(cabinet, roundedShape(1.06, .235, .04), m.brass, .045, 0, 1.94, .218);
  extrude(cabinet, roundedShape(.99, .18, .025), red, .012, 0, 1.94, .272, .004);
  const logoTexture = new THREE.TextureLoader().load('/branding/roulette-logo.png');
  logoTexture.colorSpace = THREE.SRGBColorSpace;
  logoTexture.anisotropy = 8;
  // Ignore the PNG's empty top/bottom padding through UVs, preserving the original asset.
  const logoWidth = .82, imageWidth = 2172, imageHeight = 724, cropTop = 120, cropBottom = 588;
  logoTexture.repeat.set(1, (cropBottom - cropTop) / imageHeight);
  logoTexture.offset.set(0, (imageHeight - cropBottom) / imageHeight);
  const logo = new THREE.Mesh(
    new THREE.PlaneGeometry(logoWidth, logoWidth * (cropBottom - cropTop) / imageWidth),
    new THREE.MeshStandardMaterial({
      map: logoTexture, emissiveMap: logoTexture, emissive: 0xffffff, emissiveIntensity: .35,
      transparent: true, depthWrite: false, roughness: .6,
    }),
  );
  logo.name = 'RouletteLogo';
  logo.position.set(0, 1.94, .29);
  cabinet.add(logo);
  const signBulbs = [];
  for (const side of [-1, 1]) {
    for (const y of [1.898, 1.978]) signBulbs.push([side * .463, y, .297]);
  }
  const lighting = createRouletteLights(THREE, { face, cabinet, wheelBulbs, signBulbs });
  // The slot machine's coin splash, launched from both sides of the wheel. It sits on the
  // model rather than the cabinet so the win squash does not distort the coins.
  const winEffects = createSlotWinEffects(THREE, { width: .5, y: 1.35, z: .45 });
  model.add(winEffects.object);

  const deck = group('RouletteControls');
  // Leave clearance below the wheel rim, including the backs of the raised buttons.
  deck.position.set(0, .72, .36);
  deck.rotation.x = .32;
  cabinet.add(deck);
  box(deck, charcoal, 1.04, .085, .34, 0, 0, 0);
  box(deck, m.brass, 1.06, .024, .023, 0, -.025, .168);
  // A small floating arrow points to the next physical control without intercepting clicks.
  const hintCanvas = document.createElement('canvas');
  hintCanvas.width = hintCanvas.height = 128;
  const hintContext = hintCanvas.getContext('2d');
  hintContext.beginPath();
  hintContext.moveTo(49, 18);
  hintContext.lineTo(79, 18);
  hintContext.lineTo(79, 64);
  hintContext.lineTo(108, 64);
  hintContext.lineTo(64, 111);
  hintContext.lineTo(20, 64);
  hintContext.lineTo(49, 64);
  hintContext.closePath();
  hintContext.fillStyle = '#fff0c9';
  hintContext.strokeStyle = '#352518';
  hintContext.lineWidth = 8;
  hintContext.lineJoin = 'round';
  hintContext.fill();
  hintContext.stroke();
  const hintMap = new THREE.CanvasTexture(hintCanvas);
  hintMap.colorSpace = THREE.SRGBColorSpace;
  const hintMaterial = new THREE.SpriteMaterial({ map: hintMap, depthWrite: false, toneMapped: false });
  const buttons = {};
  for (const [id, x, material, background, radius] of [
    ['red', -.32, red, '#791c29', .095],
    ['spin', -.09, light, '#efc36b', .078],
    ['black', .145, m.black, '#101521', .095],
  ]) {
    const button = group(`Roulette${id[0].toUpperCase() + id.slice(1)}Button`);
    button.userData.dynamic = true;
    button.position.set(x, .055, .025);
    // Each button owns its outer ring material; selection leaves the cap and label unchanged.
    const ringMaterial = m.brass.clone();
    cylinder(button, ringMaterial, radius + .009, radius + .014, .025, 0, 0, 0, 24);
    cylinder(button, material, radius, radius + .003, .025, 0, .022, 0, 24);
    const text = label(button, id.toUpperCase(), radius * 1.52, .048, 0, .037, 0,
      { background, color: id === 'spin' ? '#352518' : '#fff0c9', size: 74, canvasWidth: 192 });
    text.rotation.x = -Math.PI / 2;
    const hint = new THREE.Sprite(hintMaterial);
    hint.position.set(0, .14, 0);
    hint.scale.set(.08, .1, 1);
    hint.visible = false;
    hint.raycast = () => {};
    button.add(hint);
    button.userData.hint = hint;
    if (id !== 'spin') {
      const idleColor = ringMaterial.color.clone();
      let chosen = false;
      button.userData.setSelected = selected => {
        if (chosen === selected) return;
        chosen = selected;
        if (selected) ringMaterial.color.setHex(0x34e64b);
        else ringMaterial.color.copy(idleColor);
        ringMaterial.emissive.setHex(selected ? 0x34e64b : 0x000000);
        ringMaterial.emissiveIntensity = selected ? 1.5 : 0;
      };
    }
    deck.add(button);
    buttons[id] = button;
  }
  box(deck, m.brass, .15, .009, .098, .39, .048, -.045);
  box(deck, m.black, .13, .012, .078, .39, .051, -.045);
  box(deck, m.brass, .064, .018, .064, .39, .055, .095);
  box(deck, m.black, .007, .022, .043, .39, .058, .095);
  box(cabinet, m.black, .42, .2, .014, 0, .36, .22);
  for (const x of [-.226, .226]) box(cabinet, m.brass, .026, .23, .025, x, .36, .241);
  box(cabinet, m.brass, .48, .023, .025, 0, .475, .241);
  box(cabinet, m.brass, .48, .024, .19, 0, .247, .317);
  box(cabinet, m.brass, .48, .049, .023, 0, .28, .402);
  for (const x of [-.228, .228]) box(cabinet, m.brass, .023, .049, .17, x, .28, .317);

  // Fixed pachinko-parlor chair: low back, red vinyl cushions, no arms or casters.
  chair.position.z = ROULETTE.seatZ;
  for (const x of [-.18, .18]) {
    box(model, m.darkMetal, .037, .028, .85, x, .014, .58);
    box(model, m.brass, .012, .006, .85, x, .031, .58);
  }
  cylinder(chair, m.darkMetal, .28, .29, .042, 0, .021, 0, 32);
  cylinder(chair, m.brass, .26, .26, .018, 0, .047, 0, 32);
  cylinder(chair, m.darkMetal, .235, .235, .018, 0, .065, 0, 32);
  cylinder(chair, m.brass, .065, .075, .31, 0, .229, 0, 16);
  cylinder(chair, m.darkMetal, .091, .091, .051, 0, .41, 0, 20);
  const seatShell = extrude(chair, roundedShape(.53, .49, .055), charcoal, .055, 0, .437, 0);
  seatShell.rotation.x = -Math.PI / 2;
  const cushion = extrude(chair, roundedShape(.515, .475, .065), padding, .058, 0, .488, -.01, .01);
  cushion.rotation.x = -Math.PI / 2;
  box(chair, m.darkMetal, .068, .36, .045, 0, .65, .22).rotation.x = .1;
  const back = extrude(chair, roundedShape(.48, .3, .065), charcoal, .05, 0, .81, .20, .009);
  back.rotation.x = .1;
  const backPad = extrude(chair, roundedShape(.45, .275, .055), padding, .044, 0, .81, .149, .01);
  backPad.rotation.x = .1;
  for (const x of [-.024, .024]) sphere(chair, m.brass, .01, x, .76, .262, 0);

  // Local attachment and close-up anchors follow the assembly's placement and yaw.
  const anchor = (name, x, y, z) => {
    const object = new THREE.Object3D();
    object.name = name;
    object.position.set(x, y, z);
    model.add(object);
    return object;
  };
  const seatAnchor = anchor('RouletteSeatAnchor', 0, ROULETTE.seatY, ROULETTE.seatZ);
  const cameraFocus = anchor('RouletteCameraFocus', 0, 1.28, .33);
  const cameraPosition = anchor('RouletteCameraPosition', .85, 1.7, 2.6);
  model.userData.roulette = { cabinet, chair, wheel, ball, effects, lighting, winEffects, buttons, seatAnchor, cameraFocus, cameraPosition };
  return model;
}
