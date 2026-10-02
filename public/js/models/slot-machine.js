import { drawButton, drawDisplay, drawMarquee, drawReelStrip, SLOT_SYMBOLS } from './slot-machine-art.js';

// Floor origin, front +Z. Moving parts have their own pivots and survive mesh merging.
export function createSlotMachineModel(t) {
  const { THREE, materials: m, group, box, cylinder, sphere, rod } = t;
  const model = group('GossipJackpot');
  // Squash the visible machine around its floor origin, leaving camera anchors steady.
  const visuals = group('SlotMachineVisuals');
  model.add(visuals);
  const cabinet = group('SlotCabinet');
  visuals.add(cabinet);
  const teal = new THREE.MeshStandardMaterial({ color: 0x174944, metalness: .32, roughness: .4 });
  const pink = m.neonMagenta.clone();
  pink.emissiveIntensity = 1.3;
  const goldLight = new THREE.MeshStandardMaterial({ color: 0xffd685, emissive: 0xf8a12f, emissiveIntensity: .55, roughness: .3, metalness: .35 });

  const texture = surface => {
    const map = new THREE.CanvasTexture(surface);
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = 4;
    return map;
  };
  function face(parent, surface, width, height, x, y, z, glow = .35) {
    const map = texture(surface);
    const material = new THREE.MeshStandardMaterial({ map, emissiveMap: map, emissive: 0xffffff, emissiveIntensity: glow, roughness: .5 });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  }

  const silhouette = [
    [-.44, .08], [-.47, .2], [-.47, .74], [-.42, .9], [-.42, 1.54],
    [-.46, 1.67], [-.42, 1.85], [-.32, 1.94], [.32, 1.94], [.42, 1.85],
    [.46, 1.67], [.42, 1.54], [.42, .9], [.47, .74], [.47, .2], [.44, .08],
  ];
  const shape = new THREE.Shape();
  silhouette.forEach(([x, y], index) => index ? shape.lineTo(x, y) : shape.moveTo(x, y));
  shape.closePath();
  const body = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, {
    depth: .43, bevelEnabled: true, bevelSize: .018, bevelThickness: .018, bevelSegments: 1, curveSegments: 4, steps: 1,
  }), teal);
  body.position.z = -.29;
  body.castShadow = body.receiveShadow = true;
  cabinet.add(body);

  // Raised side rails outline the inset reel face; neon is emissive rather than extra lights.
  for (const side of [-1, 1]) {
    box(cabinet, m.darkMetal, .09, .63, .25, side * .405, 1.24, .22);
    box(cabinet, m.brass, .018, .61, .018, side * .357, 1.24, .365);
  }
  const outline = silhouette.map(([x, y]) => [x, y, .183]);
  for (let index = 0; index < outline.length - 1; index++) {
    rod(cabinet, pink, outline[index], outline[index + 1], .012, 8);
  }
  for (const y of [.08, .93, 1.555]) box(cabinet, m.brass, .87, .022, .035, 0, y, .21);
  box(cabinet, m.darkMetal, .99, .075, .61, 0, .038, -.015);
  for (const side of [-1, 1]) box(cabinet, m.brass, .075, .12, .075, side * .45, .09, .255);

  // Back and side cabinet seams give the machine depth from a three-quarter view.
  for (const side of [-1, 1]) {
    box(cabinet, m.darkMetal, .014, .68, .28, side * .447, .43, -.04);
    for (let index = 0; index < 4; index++) box(cabinet, m.black, .02, .018, .17, side * .45, 1.65 + index * .04, -.03);
  }

  // Sign and small crown.
  box(cabinet, m.brass, .84, .34, .025, 0, 1.744, .177);
  const marquee = face(cabinet, drawMarquee(), .8, .3, 0, 1.744, .193, .65);
  box(cabinet, teal, .25, .095, .075, 0, 1.973, -.04);
  const star = new THREE.Shape();
  for (let index = 0; index < 8; index++) {
    const angle = Math.PI / 2 + index * Math.PI / 4;
    const radius = index % 2 ? .033 : .087;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    index ? star.lineTo(x, y) : star.moveTo(x, y);
  }
  star.closePath();
  const badge = new THREE.Mesh(new THREE.ExtrudeGeometry(star, { depth: .014, bevelEnabled: false }), goldLight);
  badge.position.set(0, 2.025, .012);
  cabinet.add(badge);

  // Three horizontal drum axes. UVs put the artwork around the circumference, upright at +Z.
  const strip = texture(drawReelStrip());
  strip.wrapT = THREE.RepeatWrapping;
  const paper = new THREE.MeshStandardMaterial({ map: strip, emissiveMap: strip, emissive: 0xffffff, emissiveIntensity: .3, roughness: .6 });
  const reels = [-.252, 0, .252].map((x, index) => {
    const pivot = group(`SlotReel${index + 1}`);
    pivot.userData.dynamic = true;
    pivot.position.set(x, 1.255, .18);
    const geometry = new THREE.CylinderGeometry(.265, .265, .228, 48, 1, true);
    geometry.rotateZ(Math.PI / 2);
    const uv = geometry.attributes.uv;
    for (let i = 0; i < uv.count; i++) {
      const u = uv.getX(i);
      const v = uv.getY(i);
      uv.setXY(i, 1 - v, u);
    }
    const drum = new THREE.Mesh(geometry, paper);
    drum.name = 'ReelDrum';
    pivot.add(drum);
    // Centre beer, robot, and jukebox on the payline in the idle pose.
    pivot.rotation.x = Math.PI * 2 * (1 - (index + .5) / SLOT_SYMBOLS.length);
    visuals.add(pivot);
    return pivot;
  });
  // Narrow dividers and hood conceal the drum edges, leaving the curved paper visible.
  for (const x of [-.378, -.126, .126, .378]) box(cabinet, m.brass, .017, .56, .06, x, 1.255, .36);
  for (const y of [.975, 1.535]) {
    box(cabinet, m.darkMetal, .83, .06, .27, 0, y, .26);
    box(cabinet, m.brass, .78, .014, .018, 0, y + (y > 1 ? -.024 : .024), .404);
  }
  // Payline markers on the outer frame, without a line crossing the illustrations.
  for (const side of [-1, 1]) box(cabinet, goldLight, .045, .014, .015, side * .406, 1.255, .358);

  // Mount the result panel on the lower reel hood, clear of the Spin button below.
  box(cabinet, m.black, .69, .06, .018, 0, .975, .402);
  const display = face(visuals, drawDisplay(), .64, .044, 0, .975, .414, .45);
  display.name = 'SlotResultDisplay';
  display.userData.dynamic = true;
  for (const y of [.945, 1.005]) box(cabinet, m.brass, .69, .006, .012, 0, y, .417);
  for (const x of [-.342, .342]) box(cabinet, m.brass, .006, .06, .012, x, .975, .417);

  const deck = box(cabinet, teal, .89, .07, .34, 0, .797, .265);
  deck.rotation.x = .25;
  const deckLip = box(cabinet, m.brass, .92, .02, .025, 0, .764, .424);
  deckLip.rotation.x = .25;
  const button = group('SlotSpinButton');
  button.userData.dynamic = true;
  button.position.set(0, .854, .29);
  button.rotation.x = .25;
  cylinder(button, m.brass, .118, .125, .033, 0, 0, 0, 32);
  cylinder(button, goldLight, .104, .11, .027, 0, .027, 0, 32);
  const buttonMap = texture(drawButton());
  const buttonFace = new THREE.Mesh(new THREE.CircleGeometry(.099, 32), new THREE.MeshStandardMaterial({
    map: buttonMap, emissiveMap: buttonMap, emissive: 0xffffff, emissiveIntensity: .25, roughness: .4,
  }));
  buttonFace.rotation.x = -Math.PI / 2;
  buttonFace.position.y = .042;
  button.add(buttonFace);
  visuals.add(button);
  const slot = box(cabinet, m.brass, .095, .065, .16, -.29, .831, .255);
  slot.rotation.x = .25;
  box(cabinet, m.black, .013, .013, .1, -.29, .87, .261).rotation.x = .25;
  for (let index = 0; index < 4; index++) box(cabinet, m.black, .09, .009, .014, .29, .835 + index * .012, .31 - index * .047);

  // The lever rotates around its side axle, independently of the shell.
  const axle = cylinder(cabinet, m.brass, .075, .075, .115, .481, 1.08, .03, 20);
  axle.rotation.z = Math.PI / 2;
  const lever = group('SlotLever');
  lever.userData.dynamic = true;
  lever.position.set(.55, 1.08, .03);
  rod(lever, m.brass, [0, 0, 0], [0, .36, .1], .018, 12);
  const red = new THREE.MeshStandardMaterial({ color: 0xa72046, metalness: .3, roughness: .25 });
  sphere(lever, red, .058, 0, .385, .106, 2);
  visuals.add(lever);

  // Recessed payout opening and projecting tray.
  box(cabinet, m.black, .49, .24, .012, 0, .335, .166);
  for (const x of [-.267, .267]) box(cabinet, m.brass, .026, .29, .028, x, .335, .181);
  for (const y of [.19, .48]) box(cabinet, m.brass, .56, .024, .028, 0, y, .181);
  box(cabinet, m.brass, .53, .021, .23, 0, .194, .269);
  box(cabinet, m.brass, .53, .055, .025, 0, .23, .377);
  for (const x of [-.252, .252]) box(cabinet, m.brass, .025, .055, .21, x, .23, .27);
  box(cabinet, m.brass, .39, .012, .018, 0, .13, .178);

  // Local anchors follow placement/rotation; they are not pickable meshes.
  const cameraFocus = new THREE.Object3D();
  cameraFocus.name = 'SlotCameraFocus';
  cameraFocus.position.set(0, 1.32, .25);
  const cameraPosition = new THREE.Object3D();
  cameraPosition.name = 'SlotCameraPosition';
  cameraPosition.position.set(.42, 1.4, 2.45);
  model.add(cameraFocus, cameraPosition);
  model.userData.slotMachine = { visuals, reels, lever, button, lights: { pink, gold: goldLight, marquee: marquee.material }, display, cameraFocus, cameraPosition, symbols: SLOT_SYMBOLS };
  return model;
}
