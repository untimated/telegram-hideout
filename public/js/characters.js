export function createRobotCharacterFactory(THREE, scene, { guestMode, getGuestSessionToken, addDebug }) {
  const characterPalette = ['#e97858', '#4f8fd8', '#48a88e', '#a06bd2', '#dfa63f', '#d95f91', '#4ba9b8', '#8ba84c'];

  function colorFor(identity) {
    let hash = 2166136261;
    for (const character of String(identity ?? '')) {
      hash ^= character.charCodeAt(0);
      hash = Math.imul(hash, 16777619);
    }
    return characterPalette[(hash >>> 0) % characterPalette.length];
  }

  function avatarTexture(player) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 256;
    const context = canvas.getContext('2d');
    const drawFrame = () => {
      context.lineWidth = 14;
      context.strokeStyle = '#fff8ee';
      context.beginPath();
      context.arc(128, 128, 112, 0, Math.PI * 2);
      context.stroke();
    };
    context.fillStyle = colorFor(player.id);
    context.beginPath();
    context.arc(128, 128, 112, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#fff8ee';
    context.font = '800 78px system-ui';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(player.name.replace(/^@/, '').slice(0, 2).toUpperCase(), 128, 132);
    drawFrame();
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const sources = [player.avatarURL, player.photoURL].filter(Boolean);
    if (sources.length) {
      const image = new Image();
      let disposed = false;
      let objectURL;
      function releaseImageURL() {
        if (objectURL) URL.revokeObjectURL(objectURL);
        objectURL = undefined;
      }
      texture.addEventListener('dispose', () => {
        disposed = true;
        image.onload = image.onerror = null;
        releaseImageURL();
      });
      image.referrerPolicy = 'no-referrer';
      image.onload = () => {
        if (disposed || !image.naturalWidth || !image.naturalHeight) return;
        context.save();
        context.clearRect(0, 0, 256, 256);
        context.beginPath();
        context.arc(128, 128, 105, 0, Math.PI * 2);
        context.clip();
        const size = Math.min(image.naturalWidth, image.naturalHeight);
        const sx = (image.naturalWidth - size) / 2;
        const sy = (image.naturalHeight - size) / 2;
        context.drawImage(image, sx, sy, size, size, 16, 16, 224, 224);
        context.restore();
        drawFrame();
        texture.needsUpdate = true;
        releaseImageURL();
        addDebug(`avatar: ${player.name} photo loaded`, 'muted');
      };
      image.onerror = () => {
        if (disposed) return;
        releaseImageURL();
        loadNext();
      };
      async function loadNext() {
        if (disposed) return;
        const source = sources.shift();
        if (!source) {
          addDebug(`avatar: ${player.name} using initials (photo unavailable)`, 'muted');
          return;
        }
        if (source.startsWith('/avatars/')) {
          try {
            const response = await fetch(source, {
              credentials: 'same-origin',
              headers: guestMode ? { 'X-Debug-Guest-Token': getGuestSessionToken() } : {},
            });
            if (disposed) return;
            if (!response.ok) {
              addDebug(`avatar: ${player.name} photo HTTP ${response.status}`, 'muted');
              loadNext();
              return;
            }
            objectURL = URL.createObjectURL(await response.blob());
            if (disposed) { releaseImageURL(); return; }
            image.src = objectURL;
          } catch {
            loadNext();
          }
        } else {
          image.crossOrigin = 'anonymous';
          image.src = source;
        }
      }
      loadNext();
    }
    return texture;
  }

  function labelTexture(name) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 96;
    const context = canvas.getContext('2d');
    context.fillStyle = 'rgba(20, 15, 34, .82)';
    context.beginPath();
    context.roundRect(8, 8, 496, 80, 30);
    context.fill();
    context.strokeStyle = 'rgba(255, 248, 238, .72)';
    context.lineWidth = 5;
    context.stroke();
    context.fillStyle = '#fff8ee';
    context.font = '700 34px system-ui';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(name, 256, 49, 450);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  function createRobotCharacter(player, { isNPC = false } = {}) {
    const group = new THREE.Group();
    group.position.set(player.x, 0, player.z);
    group.rotation.y = Number.isFinite(player.yaw) ? player.yaw : 0;
    group.userData.target = new THREE.Vector3(player.x, 0, player.z);
    group.userData.kind = isNPC ? 'npc' : 'player';
    group.userData.walkPhase = 0;
    group.userData.walkUntil = 0;

    const accentColor = colorFor(player.id);
    const shell = new THREE.MeshStandardMaterial({ color: accentColor, roughness: .38, metalness: .28 });
    const shellLight = new THREE.MeshStandardMaterial({ color: accentColor, roughness: .3, metalness: .18 });
    const shellDark = new THREE.MeshStandardMaterial({ color: accentColor, roughness: .52, metalness: .4 });
    shellDark.color.multiplyScalar(.48);
    const jointMaterial = new THREE.MeshStandardMaterial({ color: 0x20283c, roughness: .42, metalness: .62 });
    const metalMaterial = new THREE.MeshStandardMaterial({ color: 0x9ba9bd, roughness: .28, metalness: .78 });
    const visorMaterial = new THREE.MeshStandardMaterial({ color: 0x10182c, roughness: .24, metalness: .58 });
    const lensMaterial = new THREE.MeshStandardMaterial({
      color: 0xb9f6ff, emissive: 0x38bfe8, emissiveIntensity: 1.3, roughness: .2, metalness: .15,
    });

    function part(geometry, material, parent, x = 0, y = 0, z = 0) {
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      parent.add(mesh);
      return mesh;
    }

    function capsule(parent, material, radius, length, x, y, z) {
      return part(new THREE.CapsuleGeometry(radius, length, 3, 8), material, parent, x, y, z);
    }

    function ruggedBox(width, height, depth, key, amount = .014) {
      const geometry = new THREE.BoxGeometry(width, height, depth);
      const positions = geometry.attributes.position;
      const offsets = new Map();
      let seed = 2166136261;
      for (const character of `${player.id}:${key}`) {
        seed ^= character.charCodeAt(0);
        seed = Math.imul(seed, 16777619);
      }
      function random() {
        seed = (seed + 0x6d2b79f5) | 0;
        let value = seed;
        value = Math.imul(value ^ (value >>> 15), value | 1);
        value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
        return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
      }
      for (let index = 0; index < positions.count; index++) {
        const x = positions.getX(index);
        const y = positions.getY(index);
        const z = positions.getZ(index);
        const vertex = `${x.toFixed(4)},${y.toFixed(4)},${z.toFixed(4)}`;
        let offset = offsets.get(vertex);
        if (!offset) {
          offset = [(random() * 2 - 1) * amount, (random() * 2 - 1) * amount, (random() * 2 - 1) * amount];
          offsets.set(vertex, offset);
        }
        positions.setXYZ(index, x + offset[0], y + offset[1], z + offset[2]);
      }
      geometry.computeVertexNormals();
      return geometry;
    }

    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(.34, 32),
      new THREE.MeshBasicMaterial({ color: 0x080912, transparent: true, opacity: .34, depthWrite: false }),
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = .02;
    group.add(shadow);

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(.36, .42, 32),
      new THREE.MeshBasicMaterial({ color: 0x91a0c8, side: THREE.DoubleSide }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = .035;
    ring.userData.localMarker = true;
    group.add(ring);

    part(ruggedBox(.34, .2, .25, 'hip', .012), shellDark, group, 0, .62, 0);

    const torso = new THREE.Group();
    torso.position.y = .94;
    group.add(torso);
    part(ruggedBox(.46, .43, .3, 'torso', .016), shell, torso);
    part(new THREE.BoxGeometry(.27, .22, .025), visorMaterial, torso, 0, -.015, -.164);
    part(new THREE.SphereGeometry(.035, 12, 8), lensMaterial, torso, 0, .025, -.185);
    part(new THREE.SphereGeometry(.035, 12, 8), lensMaterial, torso, -.085, .025, -.185);
    part(new THREE.SphereGeometry(.035, 12, 8), lensMaterial, torso, .085, .025, -.185);
    group.userData.torso = torso;

    part(new THREE.CylinderGeometry(.075, .09, .13, 10), metalMaterial, group, 0, 1.22, 0);
    const head = new THREE.Group();
    head.position.y = 1.42;
    group.add(head);
    part(ruggedBox(.48, .38, .34, 'head', .02), shellLight, head);
    part(new THREE.BoxGeometry(.37, .13, .025), visorMaterial, head, 0, -.015, -.178);
    part(new THREE.SphereGeometry(.052, 16, 12), lensMaterial, head, -.105, -.015, -.2);
    part(new THREE.SphereGeometry(.052, 16, 12), lensMaterial, head, .105, -.015, -.2);
    part(new THREE.BoxGeometry(.11, .025, .025), metalMaterial, head, 0, -.105, -.2);
    head.rotation.x = Number.isFinite(player.pitch) ? player.pitch : 0;
    group.userData.head = head;

    const arms = [];
    for (const side of [-1, 1]) {
      const arm = new THREE.Group();
      arm.position.set(side * .31, 1.08, 0);
      group.add(arm);
      part(new THREE.SphereGeometry(.105, 12, 10), metalMaterial, arm);
      capsule(arm, shellDark, .07, .2, 0, -.17, 0);
      part(new THREE.SphereGeometry(.072, 12, 10), jointMaterial, arm, 0, -.31, 0);
      capsule(arm, shell, .058, .17, 0, -.44, 0);
      part(ruggedBox(.12, .1, .13, `hand-${side}`, .008), shellLight, arm, 0, -.57, -.015);
      arms.push(arm);
    }

    const legs = [];
    for (const side of [-1, 1]) {
      const leg = new THREE.Group();
      leg.position.set(side * .12, .56, 0);
      group.add(leg);
      part(new THREE.SphereGeometry(.085, 12, 10), metalMaterial, leg);
      capsule(leg, shellDark, .075, .17, 0, -.13, 0);
      part(new THREE.SphereGeometry(.068, 12, 10), jointMaterial, leg, 0, -.27, 0);
      capsule(leg, metalMaterial, .06, .17, 0, -.4, 0);
      part(ruggedBox(.19, .11, .28, `foot-${side}`, .012), shell, leg, 0, -.51, -.055);
      legs.push(leg);
    }
    group.userData.arms = arms;
    group.userData.legs = legs;

    const avatar = new THREE.Sprite(new THREE.SpriteMaterial({
      map: avatarTexture(player),
      transparent: true,
      alphaTest: .02,
    }));
    avatar.position.y = 1.87;
    avatar.scale.set(.44, .44, 1);
    group.add(avatar);
    group.userData.avatar = avatar;
    group.userData.avatarKey = `${player.avatarURL ?? ''}|${player.photoURL ?? ''}`;

    const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTexture(player.name), transparent: true }));
    label.position.y = 2.16;
    label.scale.set(1.18, .23, 1);
    group.add(label);
      scene.add(group);
      return group;
    }

  function refreshAvatar(group, player) {
    const avatarKey = `${player.avatarURL ?? ''}|${player.photoURL ?? ''}`;
    if (group.userData.avatarKey === avatarKey) return;

    const previousTexture = group.userData.avatar.material.map;
    group.userData.avatar.material.map = avatarTexture(player);
    group.userData.avatarKey = avatarKey;
    previousTexture?.dispose();
  }

  return { create: createRobotCharacter, refreshAvatar };
}
