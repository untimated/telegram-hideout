export function createDrinkBuilders(t) {
  const { THREE, m, material, mesh, box, cylinder } = t;
  const liquid = color => material(color, { roughness: .28 });
  function rim(root, radius, y) {
    const ring = mesh(root, new THREE.TorusGeometry(radius, .002, 3, 10), m.glass, 0, y, 0);
    ring.rotation.x = Math.PI / 2;
  }
  function tumbler(root, radius, height, color, fill = .8) {
    cylinder(root, m.glass, radius, radius * .83, height, 0, height / 2, 0, 10, true);
    cylinder(root, m.glass, radius * .83, radius * .83, .006);
    cylinder(root, liquid(color), radius * .9, radius * .76, height * fill, 0, .006 + height * fill / 2, 0);
    rim(root, radius, height);
  }
  function ice(root, y) {
    for (const [x, z, angle] of [[-.012, .003, .3], [.013, -.01, -.2]]) {
      box(root, m.ice, .021, .023, .021, x, y, z).rotation.set(.15, angle, .12);
    }
  }
  function garnish(root, color, radius, x, y) {
    const slice = cylinder(root, material(color), radius, radius, .006, x, y, 0, 6);
    slice.rotation.z = Math.PI / 2;
  }
  function stemGlass(root, color, special = false) {
    cylinder(root, m.glass, .031, .031, .005);
    cylinder(root, m.glass, .004, .005, .05, 0, .03, 0, 6);
    const base = .055;
    cylinder(root, m.glass, .044, .016, .045, 0, base + .0225, 0, 10, true);
    cylinder(root, m.glass, .037, .044, .045, 0, base + .0675, 0, 10, true);
    cylinder(root, liquid(color), .037, .014, .035, 0, base + .0175, 0);
    if (special) {
      cylinder(root, liquid(color), .04, .037, .022, 0, .101, 0);
      ice(root, .113);
      box(root, m.brass, .003, .067, .003, .024, .135, 0).rotation.z = -.2;
      mesh(root, new THREE.OctahedronGeometry(.012), m.brass, .031, .17, 0);
    }
    rim(root, .037, .145);
  }
  return {
    'pint-of-beer'(root) {
      tumbler(root, .044, .16, 0xc98726, .8);
      cylinder(root, m.white, .041, .04, .021, 0, .146, 0);
    },
    highball(root) {
      tumbler(root, .035, .155, 0xca963e);
      ice(root, .129);
      garnish(root, 0xf3cd4c, .021, .032, .15);
    },
    mojito(root) {
      tumbler(root, .039, .15, 0xbbd88b);
      ice(root, .125);
      garnish(root, 0xa8c65b, .018, .034, .143);
      for (const side of [-1, 1]) {
        const leaf = mesh(root, new THREE.OctahedronGeometry(.02), m.green, side * .014, .155, -.01);
        leaf.scale.set(.6, 1, .2);
        leaf.rotation.z = side * .5;
      }
      box(root, m.dark, .004, .18, .004, -.018, .12, 0).rotation.z = .12;
    },
    sherry: root => stemGlass(root, 0x8f3e2a),
    'saturday-special': root => stemGlass(root, 0x9255ba, true),
    'wednesday-special': root => stemGlass(root, 0x36a8ba, true),
    'orange-juice'(root) {
      tumbler(root, .038, .112, 0xf4a62a, .83);
      garnish(root, 0xf5b33c, .024, .032, .11);
    },
    'apple-juice'(root) {
      tumbler(root, .035, .112, 0xd7a94b, .83);
      garnish(root, 0xf2d2a2, .018, .031, .11);
      mesh(root, new THREE.IcosahedronGeometry(.023, 0), m.red, .066, .023, .015);
      box(root, m.dark, .003, .011, .003, .066, .05, .015);
    },
  };
}
