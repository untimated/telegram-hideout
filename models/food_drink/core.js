// Dimensions are metres. Models stand on y=0 and use +y up.
export function createFoodDrinkTools(THREE) {
  const materials = new Map();
  function material(color, options = {}) {
    const key = JSON.stringify([color, options]);
    if (!materials.has(key)) materials.set(key, new THREE.MeshStandardMaterial({
      color, roughness: .72, metalness: 0, flatShading: true, ...options,
    }));
    return materials.get(key);
  }
  const m = {
    ceramic: material(0xf2e5cd, { roughness: .42 }),
    brass: material(0xb99858, { roughness: .4, metalness: .65 }),
    glass: material(0xc6e7ed, { transparent: true, opacity: .3, roughness: .15, depthWrite: false, side: THREE.DoubleSide }),
    ice: material(0xdaeff4, { transparent: true, opacity: .65, roughness: .3 }),
    bread: material(0xda963d), toast: material(0xad6a2f), beef: material(0x603728),
    cheese: material(0xf2bf36), green: material(0x519744), lime: material(0xa2c64e),
    red: material(0xbe4434), white: material(0xfff2d8), yolk: material(0xf0ae27),
    rice: material(0xd9b365), chocolate: material(0x583024, { roughness: .38 }),
    metal: material(0x86969d, { roughness: .4, metalness: .55 }), dark: material(0x283035),
  };
  function mesh(parent, geometry, mat, x, y, z) {
    const part = new THREE.Mesh(geometry, mat);
    part.position.set(x, y, z);
    part.castShadow = part.receiveShadow = true;
    parent.add(part);
    return part;
  }
  function box(parent, mat, w, h, d, x = 0, y = h / 2, z = 0) {
    return mesh(parent, new THREE.BoxGeometry(w, h, d), mat, x, y, z);
  }
  function cylinder(parent, mat, top, bottom, h, x = 0, y = h / 2, z = 0, sides = 10, open = false) {
    return mesh(parent, new THREE.CylinderGeometry(top, bottom, h, sides, 1, open), mat, x, y, z);
  }
  function dome(parent, mat, radius, height, x = 0, y = 0, z = 0) {
    const part = mesh(parent, new THREE.SphereGeometry(radius, 10, 3, 0, Math.PI * 2, 0, Math.PI / 2), mat, x, y, z);
    part.scale.y = height / radius;
    return part;
  }
  function plate(parent, radius = .14) {
    cylinder(parent, m.ceramic, radius, radius * .87, .012);
    const rim = mesh(parent, new THREE.TorusGeometry(radius - .009, .003, 3, 12), m.brass, 0, .014, 0);
    rim.rotation.x = Math.PI / 2;
  }
  function egg(parent, x, y, z, radius = .04) {
    const white = cylinder(parent, m.white, radius, radius * .95, .006, x, y + .003, z);
    white.scale.z = .8;
    dome(parent, m.yolk, radius * .38, radius * .22, x, y + .006, z);
  }
  return { THREE, m, material, mesh, box, cylinder, dome, plate, egg };
}
