import { ITEM_BY_ID } from './game/catalog.js';

// Small procedural models for served food and drinks, plus the manager that keeps the served
// items in the scene in step with the server. Models are drawn ~1.25x life size so they read
// from a few metres away. Each model's origin sits on the surface it stands on.
export function createItemModels(THREE) {
  const cache = new Map();
  const material = (key, options) => {
    if (!cache.has(key)) cache.set(key, new THREE.MeshStandardMaterial(options));
    return cache.get(key);
  };
  const glass = () => material('glass', { color: 0xdff4ff, transparent: true, opacity: .28, roughness: .05, metalness: .1, depthWrite: false });
  const liquid = color => material(`liquid-${color}`, { color, transparent: true, opacity: .88, roughness: .15, emissive: color, emissiveIntensity: .12 });
  const solid = (color, roughness = .6) => material(`solid-${color}-${roughness}`, { color, roughness });
  const ceramic = () => material('ceramic', { color: 0xf6f1e8, roughness: .35 });

  function mesh(parent, geometry, mat, x = 0, y = 0, z = 0) {
    const part = new THREE.Mesh(geometry, mat);
    part.position.set(x, y, z);
    part.castShadow = true;
    parent.add(part);
    return part;
  }
  const cylinder = (parent, rTop, rBottom, height, mat, y = 0, x = 0, z = 0, segments = 20) =>
    mesh(parent, new THREE.CylinderGeometry(rTop, rBottom, height, segments), mat, x, y + height / 2, z);

  function tumbler(parent, radius, height, color, fill = .78) {
    cylinder(parent, radius, radius * .88, height, glass());
    cylinder(parent, radius * .92, radius * .82, height * fill, liquid(color), .004);
  }
  function straw(parent, x, height, color = 0xff5a7a) {
    const part = cylinder(parent, .004, .004, height, solid(color, .4), .02, x);
    part.rotation.z = .2;
  }
  function plate(parent, radius = .12) {
    cylinder(parent, radius, radius * .8, .014, ceramic(), 0, 0, 0, 28);
  }

  const builders = {
    coffee(root) {
      const cup = material('coffee-cup', { color: 0xf6f1e8, roughness: .35, side: THREE.DoubleSide, flatShading: true });
      const accent = solid(0xb65b75, .4);
      // A shallow saucer, a tapered open cup, and a loop handle read from across the bar.
      cylinder(root, .085, .072, .009, ceramic(), 0, 0, 0, 16);
      cylinder(root, .041, .036, .008, ceramic(), .009, 0, 0, 16);
      mesh(root, new THREE.CylinderGeometry(.055, .041, .1, 16, 1, true), cup, 0, .067, 0);
      cylinder(root, .048, .038, .086, solid(0x352014, .22), .018, 0, 0, 16);
      mesh(root, new THREE.TorusGeometry(.055, .004, 6, 16), ceramic(), 0, .117, 0).rotation.x = Math.PI / 2;
      mesh(root, new THREE.TorusGeometry(.029, .006, 6, 16), ceramic(), .06, .073, 0);
      mesh(root, new THREE.TorusGeometry(.0535, .0018, 4, 16), accent, 0, .107, 0).rotation.x = Math.PI / 2;
      mesh(root, new THREE.TorusGeometry(.075, .0015, 4, 16), accent, 0, .01, 0).rotation.x = Math.PI / 2;
      mesh(root, new THREE.TorusGeometry(.046, .0013, 4, 16), solid(0x995725, .45), 0, .1045, 0).rotation.x = Math.PI / 2;
    },
    pint(root) {
      tumbler(root, .045, .15, 0xe0a126, .82);
      cylinder(root, .043, .043, .025, solid(0xfff6e6, .9), .125);
    },
    highball(root) {
      tumbler(root, .034, .17, 0x9b5a22);
      for (const [x, y] of [[-.01, .1], [.012, .12], [0, .14]]) {
        mesh(root, new THREE.BoxGeometry(.022, .022, .022), glass(), x, y, 0).rotation.set(.4, .6, .2);
      }
    },
    mojito(root) {
      tumbler(root, .04, .13, 0xb8f5a0);
      for (const [x, z] of [[-.015, .01], [.014, -.01], [0, .016]]) mesh(root, new THREE.SphereGeometry(.012, 8, 6), solid(0x2f9e4a), x, .11, z);
      mesh(root, new THREE.CylinderGeometry(.012, .012, .006, 12), solid(0xc6e86a), .03, .128, 0).rotation.z = 1.2;
      straw(root, -.012, .19, 0x2a2a2a);
    },
    sherry(root) {
      cylinder(root, .03, .03, .004, glass());
      cylinder(root, .004, .004, .07, glass(), .004);
      const bowl = mesh(root, new THREE.SphereGeometry(.036, 20, 12, 0, Math.PI * 2, Math.PI / 2.4, Math.PI / 1.8), glass(), 0, .11, 0);
      bowl.rotation.x = Math.PI;
      mesh(root, new THREE.SphereGeometry(.031, 16, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), liquid(0x7a1230), 0, .104, 0);
    },
    special(root) {
      tumbler(root, .036, .19, 0xff8a3d, .85);
      cylinder(root, .034, .034, .05, liquid(0xffd166), .12);
      straw(root, .01, .24);
      const umbrella = mesh(root, new THREE.ConeGeometry(.05, .025, 10), solid(0x39c2d7, .5), -.02, .23, 0);
      umbrella.rotation.z = .35;
    },
    breakfast(root) {
      plate(root);
      mesh(root, new THREE.CylinderGeometry(.04, .045, .008, 16), solid(0xfffbf0, .5), -.03, .018, .02);
      mesh(root, new THREE.SphereGeometry(.018, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), solid(0xffb300, .3), -.03, .02, .02);
      for (const z of [-.04, -.015]) {
        const sausage = mesh(root, new THREE.CapsuleGeometry(.012, .06, 4, 8), solid(0x8a4a2b, .5), .04, .026, z);
        sausage.rotation.z = Math.PI / 2;
      }
      mesh(root, new THREE.BoxGeometry(.06, .012, .05), solid(0xd9a55a, .8), -.03, .02, -.05).rotation.y = .3;
      for (const [x, z] of [[.03, .04], [.045, .05], [.02, .055], [.05, .035]]) mesh(root, new THREE.SphereGeometry(.008, 6, 4), solid(0xd8581c, .4), x, .02, z);
    },
    rice(root) {
      const bowl = mesh(root, new THREE.SphereGeometry(.07, 20, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), ceramic(), 0, .07, 0);
      bowl.material = material('bowl', { color: 0xf6f1e8, roughness: .35, side: THREE.DoubleSide });
      mesh(root, new THREE.SphereGeometry(.064, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2.2), solid(0xe8b75a, .9), 0, .055, 0).scale.y = .6;
      for (const [x, z, color] of [[.02, .01, 0x5fbf3f], [-.02, .02, 0xff6b3d], [0, -.025, 0x5fbf3f], [.028, -.018, 0xff6b3d]]) {
        mesh(root, new THREE.SphereGeometry(.007, 6, 4), solid(color, .5), x, .085, z);
      }
      mesh(root, new THREE.SphereGeometry(.018, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), solid(0xffb300, .3), -.005, .088, .005);
    },
    burger(root) {
      plate(root);
      cylinder(root, .05, .048, .02, solid(0xc98a3d, .7), .014);
      cylinder(root, .054, .054, .016, solid(0x5a3020, .8), .034);
      mesh(root, new THREE.BoxGeometry(.085, .004, .085), solid(0xffc83a, .4), 0, .052, 0).rotation.y = .5;
      cylinder(root, .055, .055, .005, solid(0x6ccf4f, .6), .054);
      mesh(root, new THREE.SphereGeometry(.052, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), solid(0xd9953f, .6), 0, .058, 0).scale.y = .7;
    },
    platter(root) {
      cylinder(root, .16, .14, .016, ceramic(), 0, 0, 0, 32);
      mesh(root, new THREE.ConeGeometry(.11, .12, 18), solid(0xe0a64a, .85), 0, .075, 0);
      for (let index = 0; index < 7; index++) {
        const angle = index / 7 * Math.PI * 2;
        mesh(root, new THREE.SphereGeometry(.018, 10, 8), solid(index % 2 ? 0xb4412b : 0x7a3a22, .5), Math.cos(angle) * .12, .03, Math.sin(angle) * .12);
      }
      mesh(root, new THREE.SphereGeometry(.014, 10, 8), solid(0x3fae4a, .5), 0, .14, 0);
    },
    fondue(root) {
      cylinder(root, .045, .035, .05, ceramic());
      cylinder(root, .041, .041, .01, solid(0x4a2412, .25), .042);
      for (const [x, z, tilt] of [[.012, 0, .3], [-.012, .01, -.25]]) {
        const skewer = cylinder(root, .002, .002, .11, solid(0xd9c29a, .8), .03, x, z);
        skewer.rotation.z = tilt;
        mesh(root, new THREE.SphereGeometry(.013, 10, 8), solid(0xd8233a, .45), x - tilt * .09, .128, z).scale.y = 1.2;
      }
    },
    orange(root) { tumbler(root, .035, .12, 0xffa21f, .85); },
    apple(root) { tumbler(root, .035, .12, 0xe8e27a, .85); },
  };

  // Returns a Group for a catalog item id; a soft glowing coaster marks it as something to use.
  return function createItemModel(itemID) {
    const item = ITEM_BY_ID.get(itemID);
    const root = new THREE.Group();
    root.name = `Served:${itemID}`;
    const coaster = new THREE.Mesh(
      new THREE.CircleGeometry(.13, 28),
      material('coaster', { color: 0xffca71, emissive: 0xffa640, emissiveIntensity: .9, transparent: true, opacity: .35, depthWrite: false }),
    );
    coaster.rotation.x = -Math.PI / 2;
    coaster.position.y = .003;
    root.add(coaster);
    const body = new THREE.Group();
    body.scale.setScalar(1.25);
    root.add(body);
    (builders[item?.model] ?? builders.pint)(body);
    return root;
  };
}

// Keeps served items in the level in step with server messages, and exposes them as pick targets.
export function createServedItems(THREE, parent) {
  const createItemModel = createItemModels(THREE);
  const served = new Map();

  function add(item) {
    if (served.has(item.id) || !ITEM_BY_ID.has(item.item)) return;
    const object = createItemModel(item.item);
    object.position.set(item.x, item.y, item.z);
    object.rotation.y = (Number(item.id) * 2.4) % (Math.PI * 2);
    object.userData.served = item;
    parent.add(object);
    served.set(item.id, { item, object });
  }

  function remove(id) {
    const entry = served.get(id);
    if (!entry) return;
    parent.remove(entry.object);
    entry.object.traverse(object => object.geometry?.dispose());
    served.delete(id);
  }

  function reset(items) {
    for (const id of [...served.keys()]) remove(id);
    for (const item of items) add(item);
  }

  // The consumer's own view: the item lifts off its spot and flies into the camera, shrinking,
  // then is removed. `target()` returns the point to fly to (just below the eye).
  function consume(id, target) {
    const entry = served.get(id);
    if (!entry) return;
    served.delete(id);
    flying.push({ object: entry.object, from: entry.object.position.clone(), target, start: null });
  }
  const flying = [];

  // Served items turn slowly on their spot (faster while showcased), and the coaster breathes a
  // little so they catch the eye.
  function animate(time, delta) {
    for (const { object } of served.values()) {
      object.children[0].material.opacity = .25 + Math.sin(time * 2.4) * .1;
      object.rotation.y += delta * (object.userData.showcased ? 1.6 : .5);
    }
    for (const flight of [...flying]) {
      flight.start ??= time;
      const t = Math.min(1, (time - flight.start) / .55);
      const ease = t * t * (3 - 2 * t);
      flight.object.position.lerpVectors(flight.from, flight.target(), ease);
      flight.object.position.y += Math.sin(t * Math.PI) * .15;
      flight.object.scale.setScalar(1 - .75 * ease);
      if (t >= 1) {
        flying.splice(flying.indexOf(flight), 1);
        parent.remove(flight.object);
        flight.object.traverse(object => object.geometry?.dispose());
      }
    }
  }

  const get = id => served.get(id)?.object;

  // Compiles every item's materials with the scene's lights up front, so the first order does not
  // stall a frame.
  function warmUp(renderer, scene, camera) {
    const samples = new THREE.Group();
    for (const id of ITEM_BY_ID.keys()) samples.add(createItemModel(id));
    parent.add(samples);
    renderer.compile(scene, camera);
    parent.remove(samples);
    samples.traverse(object => object.geometry?.dispose());
  }

  return { add, remove, reset, animate, warmUp, get, consume, entries: () => served.values() };
}
