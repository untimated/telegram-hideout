export function createFoodBuilders(t) {
  const { THREE, m, mesh, box, cylinder, dome, plate, egg, material } = t;
  function breakfast(root) {
    plate(root, .15);
    egg(root, -.04, .014, .04, .05);
    const toast = box(root, m.toast, .064, .012, .058, -.046, .023, -.067);
    toast.rotation.y = -.3;
    box(root, m.bread, .05, .003, .045, -.046, .031, -.067).rotation.y = -.3;
    const sausage = mesh(root, new THREE.CapsuleGeometry(.013, .065, 2, 6), m.beef, .054, .03, -.04);
    sausage.rotation.z = Math.PI / 2;
    cylinder(root, m.red, .023, .025, .012, .081, .025, .035, 8);
    for (const [x, z] of [[.025, .065], [.045, .079], [.017, .086], [.044, .054], [.066, .071]]) {
      const bean = mesh(root, new THREE.IcosahedronGeometry(.011, 0), m.red, x, .025, z);
      bean.scale.set(1, .6, .7);
    }
    for (const x of [-.006, .017]) box(root, m.beef, .015, .007, .053, x, .022, -.072).rotation.y = .2;
  }
  function rice(root) {
    plate(root, .14);
    dome(root, m.rice, .087, .065, 0, .014, 0);
    for (const [x, y, z, mat] of [
      [-.042, .052, .024, m.green], [.037, .058, .02, m.red], [.017, .069, -.04, m.green],
      [-.05, .038, -.035, m.red], [.052, .036, -.03, m.green], [0, .053, .057, m.red],
    ]) box(root, mat, .012, .009, .012, x, y, z);
    egg(root, -.01, .077, .004, .034);
  }
  function burger(root) {
    plate(root, .13);
    cylinder(root, m.bread, .064, .058, .023, 0, .024, 0);
    for (const y of [.044, .065]) {
      cylinder(root, m.beef, .068, .065, .016, 0, y, 0);
      const cheese = box(root, m.cheese, .107, .004, .107, 0, y + .011, 0);
      cheese.rotation.y = .3;
    }
    cylinder(root, m.green, .07, .066, .005, 0, .082, 0, 8);
    dome(root, m.bread, .067, .042, 0, .086, 0);
    for (const [x, y, z] of [[-.025, .125, 0], [.02, .125, .015], [0, .122, -.035]]) {
      box(root, m.white, .009, .003, .004, x, y, z);
    }
  }
  function cloche(root, teal = false) {
    plate(root, .16);
    dome(root, teal ? material(0x477d7e, { metalness: .3 }) : m.brass, .13, .1, 0, .014, 0);
    cylinder(root, m.brass, .006, .008, .015, 0, .122, 0, 6);
    mesh(root, new THREE.OctahedronGeometry(.012), m.brass, 0, .14, 0);
  }
  function fondue(root) {
    plate(root, .13);
    cylinder(root, m.brass, .043, .054, .02, 0, .024, 0);
    for (const x of [-.031, .031]) box(root, m.brass, .009, .028, .009, x, .047, 0);
    cylinder(root, m.ceramic, .055, .045, .045, 0, .079, 0);
    cylinder(root, m.chocolate, .05, .05, .006, 0, .104, 0);
    for (const side of [-1, 1]) box(root, m.brass, .018, .012, .012, side * .061, .085, 0);
    const berry = mesh(root, new THREE.IcosahedronGeometry(.019, 0), m.red, -.074, .033, .06);
    berry.scale.y = 1.25;
    cylinder(root, m.white, .013, .013, .022, .052, .028, .073, 6).rotation.z = .5;
    for (const x of [-.069, .048]) box(root, m.metal, .003, .003, .075, x, .024, .037).rotation.y = .2;
  }
  return {
    'english-breakfast': breakfast, 'uncles-fried-rice': rice, 'pierres-smash-burger': burger,
    'saturday-challenge': root => cloche(root), 'thursday-challenge': root => cloche(root, true),
    'chocolate-fondue': fondue,
  };
}
