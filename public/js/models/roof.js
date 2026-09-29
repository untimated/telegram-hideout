// Ceiling pieces are modelled with y = 0 at the underside of the ceiling slab.
// None of them cast shadows: the key light must still reach the room below.
export function createRoofModels(t) {
  const { THREE, materials: m, group, box, cylinder, torus, rod } = t;

  const neon = color => (color === 'cyan' ? m.neonCyan : color === 'warm' ? m.neonWarm : m.neonMagenta);

  function unshadowed(model) {
    model.traverse(object => { if (object.isMesh) object.castShadow = false; });
    return model;
  }

  function CeilingSlab(width, depth) {
    const model = group('CeilingSlab');
    box(model, m.wallTrim, width, .16, depth, 0, .08, 0);
    return unshadowed(model);
  }

  function CeilingBeam(length, color = 'magenta') {
    const model = group('CeilingBeam');
    box(model, m.pillar, length, .22, .26, 0, -.11, 0);
    box(model, neon(color), length - .3, .03, .06, 0, -.225, 0);
    return unshadowed(model);
  }

  // A raised light well: dark curb walls with a cyan inlay, glass on top, thin mullions.
  function Skylight(width, depth, rise = .6) {
    const model = group('Skylight');
    const wall = .14;
    for (const side of [-1, 1]) {
      box(model, m.pillar, width + wall * 2, rise + .16, wall, 0, (rise + .16) / 2, side * (depth / 2 + wall / 2));
      box(model, m.pillar, wall, rise + .16, depth, side * (width / 2 + wall / 2), (rise + .16) / 2, 0);
      box(model, m.neonCyan, width - .2, .03, .03, 0, rise - .08, side * (depth / 2 - .02));
      box(model, m.neonCyan, .03, .03, depth - .2, side * (width / 2 - .02), rise - .08, 0);
    }
    box(model, m.glass, width, .03, depth, 0, rise, 0);
    const columns = Math.round(width / 1.2);
    const rows = Math.round(depth / 1.2);
    for (let index = 1; index < columns; index++) {
      box(model, m.pillar, .06, .06, depth, -width / 2 + index * width / columns, rise + .03, 0);
    }
    for (let index = 1; index < rows; index++) {
      box(model, m.pillar, width, .06, .06, 0, rise + .03, -depth / 2 + index * depth / rows);
    }
    return unshadowed(model);
  }

  function PendantLamp(drop = .7, color = 'warm', radius = .24) {
    const model = group('PendantLamp');
    rod(model, m.darkMetal, [0, 0, 0], [0, -drop, 0], .012);
    const shade = cylinder(model, m.darkMetal, .05, radius, .2, 0, -drop - .1, 0, 20);
    shade.material = m.darkMetal;
    cylinder(model, neon(color), radius * .82, radius * .82, .02, 0, -drop - .195, 0, 20);
    return unshadowed(model);
  }

  function LinearLight(length = 1.6, drop = .7, color = 'warm') {
    const model = group('LinearLight');
    for (const x of [-length * .4, length * .4]) rod(model, m.darkMetal, [x, 0, 0], [x, -drop, 0], .01);
    box(model, m.darkMetal, length, .07, .13, 0, -drop, 0);
    box(model, neon(color), length - .08, .02, .08, 0, -drop - .045, 0);
    return unshadowed(model);
  }

  // Hangs from `height` above its own centre, so it can be slung from a raised skylight.
  function RingLight(radius = 1.2, height = .95, color = 'warm') {
    const model = group('RingLight');
    torus(model, neon(color), radius, .035, 0, 0, 0, Math.PI / 2);
    for (let index = 0; index < 3; index++) {
      const angle = index * Math.PI * 2 / 3 + Math.PI / 6;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      rod(model, m.darkMetal, [x, 0, z], [x * .5, height, z * .5], .01);
    }
    return unshadowed(model);
  }

  function StageTruss(length = 3.8, drop = .55) {
    const model = group('StageTruss');
    for (const x of [-length * .42, length * .42]) rod(model, m.darkMetal, [x, 0, 0], [x, -drop + .06, 0], .012);
    for (const y of [-drop, -drop - .16]) {
      const chord = cylinder(model, m.steel, .025, .025, length, 0, y, 0, 8);
      chord.rotation.z = Math.PI / 2;
    }
    const segments = Math.round(length / .32);
    for (let index = 0; index < segments; index++) {
      const x0 = -length / 2 + index * length / segments;
      const x1 = x0 + length / segments;
      const [from, to] = index % 2 ? [-drop - .16, -drop] : [-drop, -drop - .16];
      rod(model, m.steel, [x0, from, 0], [x1, to, 0], .009, 6);
    }
    for (const x of [-length * .32, 0, length * .32]) {
      const can = group('SpotCan');
      cylinder(can, m.black, .09, .12, .24, 0, -.12, 0, 14);
      cylinder(can, m.neonMagenta, .085, .085, .02, 0, -.25, 0, 14);
      can.position.set(x, -drop - .16, 0);
      can.rotation.x = -.45;
      model.add(can);
    }
    return unshadowed(model);
  }

  function RecessedPanel(width = 1, depth = 1) {
    const model = group('RecessedPanel');
    box(model, m.darkMetal, width + .1, .03, depth + .1, 0, -.015, 0);
    box(model, m.neonWarm, width, .02, depth, 0, -.035, 0);
    return unshadowed(model);
  }

  // A light strip that runs along the top of a wall, just under the ceiling.
  function CoveStrip(length, color = 'magenta') {
    const model = group('CoveStrip');
    box(model, neon(color), length, .035, .05, 0, 0, 0);
    return unshadowed(model);
  }

  return {
    CeilingSlab, CeilingBeam, Skylight, PendantLamp, LinearLight, RingLight,
    StageTruss, RecessedPanel, CoveStrip,
  };
}
