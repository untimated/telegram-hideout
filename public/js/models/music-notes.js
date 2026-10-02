// Small solid notes, fitted to the jukebox by default. No textures or extra lights.
export function createJukeboxNotes(THREE, { spread = .32 } = {}) {
  const object = new THREE.Group();
  object.name = 'JukeboxMusicNotes';
  object.userData.dynamic = true;
  object.position.set(0, 2.05, .3);
  object.visible = false;
  const colors = [0xf5c36d, 0xe781bb, 0x75d6de];
  const notes = [];
  function part(parent, geometry, material, x, y, z = 0) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    // Floating decoration should not intercept clicks aimed at the fixture below.
    mesh.raycast = () => {};
    parent.add(mesh);
    return mesh;
  }
  for (let i = 0; i < 3; i++) {
    const note = new THREE.Group();
    const material = new THREE.MeshStandardMaterial({
      color: colors[i], emissive: colors[i], emissiveIntensity: .35,
      roughness: .48, metalness: .15,
    });
    const head = part(note, new THREE.SphereGeometry(.055, 8, 4), material, 0, 0);
    head.scale.set(1.2, .7, .35);
    head.rotation.z = .2;
    part(note, new THREE.BoxGeometry(.018, .28, .025), material, .052, .14);
    if (i === 1) {
      const second = part(note, new THREE.SphereGeometry(.055, 8, 4), material, .16, .025);
      second.scale.copy(head.scale);
      second.rotation.z = .2;
      part(note, new THREE.BoxGeometry(.018, .28, .025), material, .212, .165);
      part(note, new THREE.BoxGeometry(.178, .04, .025), material, .132, .283).rotation.z = .155;
    } else {
      part(note, new THREE.BoxGeometry(.085, .035, .025), material, .088, .252).rotation.z = -.45;
    }
    note.scale.setScalar(i === 1 ? 1 : .8);
    object.add(note);
    notes.push(note);
  }
  function update(time, playing) {
    object.visible = Boolean(playing);
    if (!object.visible) return;
    for (let i = 0; i < notes.length; i++) {
      const phase = time * 1.7 + i * 1.9;
      notes[i].position.set((i - 1) * spread, .06 + i * .04 + Math.sin(phase) * .045, 0);
      notes[i].rotation.set(Math.sin(phase * .7) * .08, Math.sin(phase * .55) * .6, Math.sin(phase) * .14);
    }
  }
  return { object, update };
}
