// Cosmetic parts attach to the existing animated body groups and use their materials.
export function addRobotDetails(THREE, { group, torso, head, arms, legs, materials, part }) {
  const { shell, shellLight, shellDark, jointMaterial, metalMaterial, visorMaterial, lensMaterial } = materials;

  function plate(parent, material, width, height, depth, x, y, z, bevel = .008) {
    const radius = Math.min(bevel, width * .4, height * .4, depth * .4);
    const outline = new THREE.Shape();
    outline.moveTo(0, 0);
    outline.lineTo(width - radius * 2, 0);
    outline.lineTo(width - radius * 2, height - radius * 2);
    outline.lineTo(0, height - radius * 2);
    outline.closePath();
    // One bevel segment gives a chamfer without subdividing every broad face.
    const geometry = new THREE.ExtrudeGeometry(outline, {
      depth: depth - radius * 2, steps: 1, bevelEnabled: true,
      bevelThickness: radius, bevelSize: radius, bevelSegments: 1, curveSegments: 1,
    });
    geometry.translate(-width / 2 + radius, -height / 2 + radius, -depth / 2 + radius);
    return part(geometry, material, parent, x, y, z);
  }

  function frontDisc(parent, material, radius, depth, x, y, z, segments = 8) {
    const mesh = part(new THREE.CylinderGeometry(radius, radius, depth, segments), material, parent, x, y, z);
    mesh.rotation.x = Math.PI / 2;
    return mesh;
  }

  // Console surround and smaller indicator bars beneath the three original chest lights.
  plate(torso, metalMaterial, .31, .025, .025, 0, .105, -.168);
  plate(torso, shellDark, .31, .035, .03, 0, -.135, -.17);
  for (const side of [-1, 1]) {
    plate(torso, metalMaterial, .022, .21, .025, side * .147, -.015, -.168);
    for (const y of [-.083, .075]) frontDisc(torso, jointMaterial, .009, .012, side * .145, y, -.186, 6);
    plate(torso, shellLight, .065, .27, .025, side * .194, .01, -.15);
  }
  for (const x of [-.067, 0, .067]) {
    plate(torso, lensMaterial, .038, .012, .012, x, -.075, -.182, .003);
  }
  // Rear service hatch and inset vents keep the robot readable from behind.
  plate(torso, shellDark, .29, .29, .035, 0, -.005, .155);
  for (const y of [-.075, -.025, .025, .075]) {
    plate(torso, visorMaterial, .2, .013, .012, 0, y, .178, .003);
  }

  // Segmented waist and neck collar suggest an articulated mechanism.
  plate(group, metalMaterial, .35, .035, .27, 0, .69, 0);
  for (const x of [-.105, 0, .105]) plate(group, shellLight, .08, .09, .035, x, .615, -.137);
  part(new THREE.CylinderGeometry(.105, .105, .025, 10), jointMaterial, group, 0, 1.18, 0);
  part(new THREE.CylinderGeometry(.088, .088, .018, 10), jointMaterial, group, 0, 1.24, 0);

  // Brow, cheeks and temple discs retain the two-eye face from the concept.
  plate(head, shell, .4, .045, .05, 0, .073, -.18);
  for (const side of [-1, 1]) {
    plate(head, shellDark, .055, .072, .035, side * .178, -.08, -.181);
    const ear = part(new THREE.CylinderGeometry(.055, .055, .045, 8), metalMaterial, head, side * .245, -.015, 0);
    ear.rotation.z = Math.PI / 2;
    const inset = part(new THREE.CylinderGeometry(.032, .032, .049, 8), jointMaterial, head, side * .249, -.015, 0);
    inset.rotation.z = Math.PI / 2;
  }
  for (const x of [-.03, 0, .03]) plate(head, jointMaterial, .01, .015, .009, x, -.105, -.216, .002);

  for (let i = 0; i < arms.length; i++) {
    const arm = arms[i];
    const side = i === 0 ? -1 : 1;
    plate(arm, shellLight, .16, .12, .18, side * .015, .018, 0, .02);
    frontDisc(arm, metalMaterial, .046, .02, 0, -.31, -.063);
    plate(arm, shellLight, .105, .13, .05, 0, -.435, -.052);
    plate(arm, jointMaterial, .112, .023, .12, 0, -.525, -.012);
    // Two shallow seams split the palm into three chunky gripper fingers.
    for (const x of [-.021, .021]) plate(arm, jointMaterial, .006, .048, .012, x, -.59, -.084, .001);
    plate(arm, shellDark, .038, .065, .055, -side * .068, -.563, -.02);
  }

  for (const leg of legs) {
    frontDisc(leg, shellLight, .075, .035, 0, -.27, -.067, 6);
    frontDisc(leg, metalMaterial, .027, .041, 0, -.27, -.071, 8);
    plate(leg, shell, .103, .155, .035, 0, -.405, -.066);
    plate(leg, jointMaterial, .2, .027, .29, 0, -.543, -.055);
    plate(leg, shellLight, .16, .025, .12, 0, -.447, -.07);
    for (const z of [-.107, -.067, -.027]) plate(leg, jointMaterial, .11, .008, .009, 0, -.431, z, .002);
    plate(leg, metalMaterial, .15, .028, .025, 0, -.5, -.19);
  }
}
