// Point-and-click picking against everything usable: level interactables, served items and other
// players. Returns plain target descriptions; the HUD (panels.js) decides what to open.
//
// A target is { kind: 'interactable' | 'item' | 'player', id, label, action?, object, distance }.
const PICK_RANGE = 9;

// One rule for everything: a target is usable while the crosshair or a tap hits it within this
// many metres of the eye. That is exactly when the "E · …" hint and the rim light show.
export const INTERACT_RANGE = 3;

export function createPicker(THREE, { camera, getCamera = () => camera, canvas, level, actors, getSelfID }) {
  const raycaster = new THREE.Raycaster();
  raycaster.far = PICK_RANGE;
  const pointer = new THREE.Vector2();

  // Owner lookups from any mesh up to the object that was registered.
  function describe(object) {
    for (let node = object; node; node = node.parent) {
      if (node.userData.served) {
        const served = node.userData.served;
        return { kind: 'item', id: served.id, served, object: node };
      }
      if (node.userData.kind === 'player' && node.userData.playerID) {
        return { kind: 'player', id: node.userData.playerID, object: node };
      }
      if (node.userData.interactable) {
        const entry = level.userData.interactables.find(candidate => candidate.object === node);
        if (entry) return { kind: 'interactable', id: entry.id, label: entry.label, action: entry.action, object: node };
      }
    }
    return null;
  }

  function visible(object) {
    for (let node = object; node; node = node.parent) if (!node.visible) return false;
    return true;
  }

  // The level holds interactables and served items; players live directly in the scene.
  function roots() {
    const list = [level];
    for (const [id, group] of actors) if (id !== getSelfID() && group.userData.kind === 'player') list.push(group);
    return list;
  }

  // Solid meshes occlude clicks. Labels and grid/line helpers are decorative and do not block them.
  function pick(ndcX, ndcY) {
    pointer.set(ndcX, ndcY);
    raycaster.setFromCamera(pointer, getCamera());
    const hits = raycaster.intersectObjects(roots(), true);
    for (const hit of hits) {
      if (!hit.object.isMesh || !visible(hit.object)) continue;
      const target = describe(hit.object);
      // Inspection changes the picking view, while reach stays relative to the player's eye.
      if (target) return { ...target, distance: camera.position.distanceTo(hit.point), point: hit.point };
      // Transparent glass and additive glows should not hide what is behind them.
      if (hit.object.material?.transparent) continue;
      return null;
    }
    return null;
  }

  return {
    pickAt(clientX, clientY) {
      const rect = canvas.getBoundingClientRect();
      return pick((clientX - rect.left) / rect.width * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    },
    pickCenter: () => pick(0, 0),
  };
}

// Rim light on the thing the crosshair can use. Each mesh of the target gets two twins sharing its
// geometry: a Fresnel glow added on top, and a gold outline (a back-face shell pushed out along
// the normals, by a width that grows with distance so it stays a few pixels thick). The target's
// own, often shared, materials are left alone.
export function createRimHighlight(THREE) {
  const strength = { value: 1 };
  const color = { value: new THREE.Color(0xffc978) };
  const glow = new THREE.ShaderMaterial({
    uniforms: { color, strength },
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vView;
      void main() {
        vec4 view = modelViewMatrix * vec4(position, 1.0);
        vNormal = normalize(normalMatrix * normal);
        vView = normalize(-view.xyz);
        gl_Position = projectionMatrix * view;
      }`,
    fragmentShader: `
      uniform vec3 color;
      uniform float strength;
      varying vec3 vNormal;
      varying vec3 vView;
      void main() {
        // A warm wash over the whole object, brightening toward the silhouette.
        float rim = pow(1.0 - abs(dot(normalize(vNormal), vView)), 2.0);
        gl_FragColor = vec4(color * (.16 + rim * .9) * strength, 1.0);
      }`,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const outline = new THREE.ShaderMaterial({
    uniforms: { color, strength },
    vertexShader: `
      void main() {
        vec4 view = modelViewMatrix * vec4(position, 1.0);
        vec3 normalView = normalize(normalMatrix * normal);
        view.xyz += normalView * .0045 * max(.6, -view.z);
        gl_Position = projectionMatrix * view;
      }`,
    fragmentShader: `
      uniform vec3 color;
      uniform float strength;
      void main() { gl_FragColor = vec4(color * (.75 + .25 * strength), 1.0); }`,
    side: THREE.BackSide,
  });
  let owner = null;
  let twins = [];

  function clear() {
    for (const twin of twins) twin.parent?.remove(twin);
    twins = [];
    owner = null;
  }

  return {
    // Pass the object to outline (or null). Cheap to call every hover tick with the same object.
    set(object) {
      if (object === owner) return;
      clear();
      if (!object) return;
      owner = object;
      const meshes = [];
      object.traverse(mesh => {
        if (mesh.isMesh && mesh.material?.blending !== THREE.AdditiveBlending) meshes.push(mesh);
      });
      // Attached after the traversal so the twins are not visited themselves.
      for (const mesh of meshes) {
        for (const material of [outline, glow]) {
          const twin = new THREE.Mesh(mesh.geometry, material);
          twin.raycast = () => {};
          twin.renderOrder = 5;
          mesh.add(twin);
          twins.push(twin);
        }
      }
    },
    // Compiles both shaders up front. Otherwise the first highlight stalls a frame while they
    // compile, and the look-drag input that piles up meanwhile lands at once as a jolt.
    warmUp(renderer, camera) {
      const scene = new THREE.Scene();
      const geometry = new THREE.BoxGeometry();
      scene.add(new THREE.Mesh(geometry, outline), new THREE.Mesh(geometry, glow));
      renderer.compile(scene, camera);
      geometry.dispose();
    },
    // Gentle pulse; call every frame.
    animate(time) {
      strength.value = 1 + Math.sin(time * 4) * .25;
    },
  };
}
