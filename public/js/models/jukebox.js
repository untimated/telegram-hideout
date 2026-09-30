// A continuous arched cabinet with an inset face. Front faces +z, origin at the floor.
export function createJukeboxModel(t) {
  const { THREE, materials: m, group, box, cylinder, torus } = t;
  const model = group('Jukebox');
  const spring = 1.48;

  function outline(radius, bottom) {
    const shape = new THREE.Shape();
    shape.moveTo(-radius, bottom);
    shape.lineTo(radius, bottom);
    shape.lineTo(radius, spring);
    shape.absarc(0, spring, radius, 0, Math.PI, false);
    shape.lineTo(-radius, bottom);
    shape.closePath();
    return shape;
  }

  function arch(material, radius, bottom, depth, z, bevel = 0, inset = 0) {
    const shape = inset && bottom === spring ? new THREE.Shape() : outline(radius, bottom);
    if (inset && bottom === spring) {
      shape.moveTo(radius, spring);
      shape.absarc(0, spring, radius, 0, Math.PI, false);
      shape.lineTo(-radius + inset, spring);
      shape.absarc(0, spring, radius - inset, Math.PI, 0, true);
      shape.closePath();
    } else if (inset) {
      shape.holes.push(outline(radius - inset, bottom + inset));
    }
    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth, steps: 1, curveSegments: 10,
      bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 1,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.z = z;
    mesh.castShadow = mesh.receiveShadow = true;
    model.add(mesh);
    return mesh;
  }

  // One silhouette avoids the seam and mismatched depth of a box plus hemisphere.
  arch(m.wood, .37, .075, .38, -.19, .018).name = 'JukeboxCabinet';
  arch(m.darkMetal, .345, .145, .018, .211).name = 'JukeboxFace';
  arch(m.brass, .359, .125, .016, .235, .003, .035);
  arch(m.neonWarm, .326, .18, .008, .257, 0, .018);
  arch(m.brass, .297, .22, .012, .266, 0, .012);

  // A small magenta accent at the crown echoes the concept's coloured shell.
  arch(m.neonMagenta, .402, 1.48, .045, -.10, 0, .014);
  for (const x of [-.35, .35]) {
    box(model, m.brass, .053, .09, .07, x, .22, .251);
    box(model, m.brass, .053, .055, .05, x, 1.475, .246);
  }
  box(model, m.darkMetal, .82, .075, .46, 0, .0375, 0);
  box(model, m.brass, .76, .035, .045, 0, .104, .224);
  box(model, m.black, .72, .04, .05, 0, .059, .24);

  // Broad, uncluttered arch header above a single level control fascia.
  box(model, m.brass, .36, .022, .025, 0, 1.57, .281);
  box(model, m.brass, .27, .018, .025, 0, 1.65, .281);
  box(model, m.brass, .16, .014, .025, 0, 1.72, .281);
  box(model, m.brass, .48, .145, .032, 0, 1.33, .278);
  box(model, m.black, .31, .09, .016, -.05, 1.33, .303);
  box(model, m.neonCyan, .22, .024, .01, -.05, 1.339, .315);
  box(model, m.steel, .075, .075, .017, .174, 1.33, .306);
  box(model, m.black, .042, .008, .008, .174, 1.34, .318);

  // Nine uniformly spaced song cards with a small button beneath each.
  box(model, m.black, .48, .33, .024, 0, 1.073, .279);
  for (const x of [-.145, 0, .145]) {
    for (const y of [.97, 1.075, 1.18]) {
      box(model, m.brass, .116, .069, .018, x, y, .299);
      box(model, m.porcelain, .097, .041, .008, x, y + .005, .313);
      box(model, m.darkMetal, .045, .008, .009, x, y - .023, .314);
    }
  }
  box(model, m.brass, .48, .02, .025, 0, .87, .286);

  // Recessed speaker cloth and straight brass grille ribs share one front plane.
  box(model, m.brass, .48, .61, .025, 0, .54, .276);
  box(model, m.black, .435, .57, .018, 0, .54, .295);
  for (let i = 0; i < 8; i++) {
    box(model, m.brass, .012, .49, .014, -.175 + i * .05, .54, .314);
  }
  box(model, m.brass, .43, .012, .02, 0, .54, .328);
  const badge = cylinder(model, m.darkMetal, .056, .056, .019, 0, .54, .35, 10);
  badge.rotation.x = Math.PI / 2;
  torus(model, m.brass, .049, .005, 0, .54, .363);
  return model;
}
