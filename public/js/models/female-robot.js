import { CHARACTER_SCALE } from '../config.js';

// Samantha's prototype: rigid primitive panels, with the same -z face direction as the other robots.
export function createFemaleRobotModel(THREE) {
  const actor = new THREE.Group();
  actor.name = 'FemaleRobot';
  actor.scale.setScalar(CHARACTER_SCALE);
  actor.userData.modelName = 'FemaleRobot';
  actor.userData.kind = 'npc'; // Keep the animated pivots out of the static room bake.

  const material = (color, roughness, metalness) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
  const shell = material(0x9481c4, .42, .25);
  const shellLight = material(0xac99d6, .4, .22);
  const shellDark = material(0x655780, .48, .32);
  const cream = material(0xf0ddbb, .46, .18);
  const brass = material(0xc89b58, .34, .65);
  const joints = material(0x252532, .46, .55);
  const visor = material(0x101a24, .28, .32);
  const glow = new THREE.MeshStandardMaterial({
    color: 0x9af5ff, emissive: 0x41dcec, emissiveIntensity: 1.2, roughness: .3, metalness: .1,
  });

  function part(parent, geometry, finish, x = 0, y = 0, z = 0) {
    const mesh = new THREE.Mesh(geometry, finish);
    mesh.position.set(x, y, z);
    mesh.castShadow = mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  // A chamfered box or trapezoid, made by extruding four corners with one bevel segment.
  function panel(parent, finish, width, height, depth, x = 0, y = 0, z = 0, topWidth = width, bevel = .012) {
    const b = Math.min(bevel, width * .2, topWidth * .2, height * .2, depth * .2);
    const shape = new THREE.Shape();
    shape.moveTo(-width / 2 + b, -height / 2 + b);
    shape.lineTo(width / 2 - b, -height / 2 + b);
    shape.lineTo(topWidth / 2 - b, height / 2 - b);
    shape.lineTo(-topWidth / 2 + b, height / 2 - b);
    shape.closePath();
    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth: depth - b * 2, steps: 1, bevelEnabled: true,
      bevelThickness: b, bevelSize: b, bevelSegments: 1, curveSegments: 1,
    });
    geometry.translate(0, 0, -depth / 2 + b);
    return part(parent, geometry, finish, x, y, z);
  }

  function cylinder(parent, finish, radius, height, x = 0, y = 0, z = 0, segments = 10) {
    return part(parent, new THREE.CylinderGeometry(radius, radius, height, segments), finish, x, y, z);
  }

  function disc(parent, finish, radius, depth, x, y, z) {
    const mesh = cylinder(parent, finish, radius, depth, x, y, z, 12);
    mesh.rotation.x = Math.PI / 2;
    return mesh;
  }

  function pivot(parent, name, x, y, z = 0) {
    const group = new THREE.Group();
    group.name = name;
    group.position.set(x, y, z);
    parent.add(group);
    return group;
  }

  const shadow = part(actor, new THREE.CircleGeometry(.39, 24), new THREE.MeshBasicMaterial({
    color: 0x080912, transparent: true, opacity: .32, depthWrite: false,
  }), 0, .018, 0);
  shadow.rotation.x = -Math.PI / 2;
  shadow.castShadow = shadow.receiveShadow = false;

  panel(actor, shellDark, .31, .16, .24, 0, .66, 0);
  cylinder(actor, joints, .09, .12, 0, .8, 0);
  cylinder(actor, brass, .105, .025, 0, .756, 0);
  cylinder(actor, brass, .105, .025, 0, .844, 0);

  // Short rigid hip panels flare out, with gaps that show the leg mechanisms.
  for (const side of [-1, 1]) {
    const flap = panel(actor, shell, .16, .21, .27, side * .177, .67, 0, .105);
    flap.rotation.z = side * .15;
    panel(flap, cream, .043, .19, .022, side * .049, 0, -.142, .036, .004);
  }
  panel(actor, shellLight, .18, .22, .035, 0, .663, -.145, .125);
  disc(actor, brass, .022, .015, 0, .732, -.169);
  panel(actor, shell, .25, .19, .035, 0, .675, .143, .19);

  const torso = pivot(actor, 'Torso', 0, 1.052);
  panel(torso, shell, .335, .405, .285, 0, 0, 0, .44, .022);
  panel(torso, shellDark, .306, .255, .028, 0, -.016, -.153);
  panel(torso, cream, .29, .237, .025, 0, -.016, -.172);
  panel(torso, visor, .26, .207, .017, 0, -.016, -.19);
  for (const x of [-.078, 0, .078]) disc(torso, glow, .028, .018, x, .022, -.206);
  for (const x of [-.068, 0, .068]) panel(torso, glow, .032, .009, .01, x, -.063, -.203, .032, .002);
  for (const x of [-.14, .14]) {
    for (const y of [-.126, .094]) disc(torso, brass, .009, .012, x, y, -.193);
  }
  panel(torso, shellDark, .235, .25, .022, 0, -.01, .151);
  panel(torso, shellLight, .205, .216, .017, 0, -.01, .169);
  for (const y of [-.085, -.053, -.021]) panel(torso, joints, .115, .009, .008, 0, y, .181, .115, .002);

  cylinder(actor, joints, .064, .125, 0, 1.305, 0);
  cylinder(actor, brass, .092, .027, 0, 1.276, 0);
  cylinder(actor, brass, .084, .026, 0, 1.351, 0);

  const head = pivot(actor, 'Head', 0, 1.552);
  panel(head, shell, .49, .37, .36, 0, 0, 0, .49, .024);
  panel(head, joints, .399, .227, .024, 0, -.007, -.19);
  panel(head, visor, .366, .2, .017, 0, -.003, -.207);
  for (const x of [-.099, .099]) {
    part(head, new THREE.SphereGeometry(.057, 12, 8), glow, x, .008, -.225).scale.z = .48;
  }
  panel(head, joints, .121, .035, .019, 0, -.135, -.198);
  for (const x of [-.033, 0, .033]) panel(head, glow, .022, .009, .01, x, -.135, -.212, .022, .002);

  // Bob silhouette: a broad cap, three fringe panels, and two angled cheek-length shells.
  panel(head, shellLight, .545, .08, .402, 0, .183, .002, .5, .015);
  for (const x of [-.154, 0, .154]) {
    panel(head, shellLight, .148, .115, .055, x, .144, -.2, .144, .009);
  }
  for (const side of [-1, 1]) {
    const hair = panel(head, shell, .125, .404, .392, side * .266, -.013, .014, .075, .018);
    hair.rotation.z = side * .095;
    panel(hair, cream, .026, .36, .025, side * .045, -.01, -.203, .02, .005);
    const ear = cylinder(head, brass, .055, .023, side * .337, -.027, .025);
    ear.rotation.z = Math.PI / 2;
    const inset = cylinder(head, joints, .033, .026, side * .348, -.027, .025);
    inset.rotation.z = Math.PI / 2;
  }
  // A single folded cream accent rather than thin hair strands or simulated cloth.
  const accent = panel(head, cream, .1, .18, .033, .228, .192, -.224, .08, .007);
  accent.rotation.z = .42;
  disc(accent, brass, .027, .021, 0, -.01, -.028);

  const arms = [];
  const forearms = [];
  for (const side of [-1, 1]) {
    const arm = pivot(actor, side < 0 ? 'LeftArm' : 'RightArm', side * .292, 1.175);
    part(arm, new THREE.SphereGeometry(.088, 10, 6), brass);
    panel(arm, shell, .113, .185, .132, 0, -.157, 0, .132, .012);
    cylinder(arm, joints, .042, .06, 0, -.259, 0);
    const forearm = pivot(arm, side < 0 ? 'LeftForearm' : 'RightForearm', 0, -.279);
    const hinge = cylinder(forearm, joints, .059, .117);
    hinge.rotation.z = Math.PI / 2;
    for (const x of [-.063, .063]) {
      const cap = cylinder(forearm, brass, .042, .012, x);
      cap.rotation.z = Math.PI / 2;
    }
    panel(forearm, shellLight, .107, .189, .126, 0, -.134, 0, .122, .011);
    panel(forearm, cream, .112, .033, .133, 0, -.222, 0, .112, .006);
    cylinder(forearm, joints, .034, .049, 0, -.259, 0);
    panel(forearm, joints, .103, .09, .101, 0, -.309, -.012);
    // Three broad fingers and a thumb keep the hand readable without dense geometry.
    for (const x of [-.034, 0, .034]) panel(forearm, shell, .029, .072, .036, x, -.316, -.067, .029, .004);
    panel(forearm, shell, .034, .056, .059, -side * .065, -.294, -.012, .034, .005);
    arms.push(arm);
    forearms.push(forearm);
  }

  const legs = [];
  for (const side of [-1, 1]) {
    const leg = pivot(actor, side < 0 ? 'LeftLeg' : 'RightLeg', side * .12, .59);
    part(leg, new THREE.SphereGeometry(.071, 10, 6), joints);
    panel(leg, shell, .145, .192, .156, 0, -.127, 0, .161, .012);
    const knee = cylinder(leg, joints, .061, .156, 0, -.263, 0);
    knee.rotation.z = Math.PI / 2;
    for (const x of [-.084, .084]) {
      const cap = cylinder(leg, brass, .049, .017, x, -.263);
      cap.rotation.z = Math.PI / 2;
    }
    panel(leg, shellLight, .109, .078, .034, 0, -.269, -.072, .109, .007);
    disc(leg, joints, .018, .015, 0, -.269, -.097);
    panel(leg, shell, .14, .183, .145, 0, -.396, .003, .109, .01);
    const ankle = cylinder(leg, joints, .043, .14, 0, -.492, -.005);
    ankle.rotation.z = Math.PI / 2;
    panel(leg, joints, .203, .032, .291, 0, -.574, -.051, .203, .005);
    panel(leg, shellLight, .191, .099, .276, 0, -.513, -.052, .151, .012);
    panel(leg, cream, .171, .032, .282, 0, -.53, -.055, .171, .005);
    legs.push(leg);
  }

  const microphone = pivot(forearms[0], 'Microphone', 0, -.305, -.12);
  const handle = cylinder(microphone, joints, .022, .145);
  handle.rotation.x = Math.PI / 2;
  const collar = disc(microphone, brass, .029, .024, 0, 0, -.07);
  part(microphone, new THREE.SphereGeometry(.05, 10, 8), joints, 0, 0, -.108);
  collar.name = 'MicrophoneCollar';

  Object.assign(actor.userData, { torso, head, arms, forearms, legs, microphone });
  // A bent elbow brings the microphone toward the face; feet stay planted at y = 0.
  actor.userData.animate = time => {
    torso.rotation.z = Math.sin(time * 1.25) * .018;
    head.rotation.set(-.04 + Math.sin(time * 1.7) * .025, Math.sin(time * .65) * .12, -.035);
    arms[0].rotation.set(1.0, 0, .14);
    forearms[0].rotation.x = 1.05 + Math.sin(time * 1.7) * .025;
    arms[1].rotation.set(.08 + Math.sin(time * 1.25) * .08, 0, -.13);
    forearms[1].rotation.x = .12;
  };
  actor.userData.animate(0);
  return actor;
}
