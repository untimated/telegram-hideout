// Decorative dressing only: no lights, interactions or changes to the room footprint.
export function buildArtDetails({ THREE, models, level, place }) {
  const m = models.materials;
  const details = new THREE.Group();
  details.name = 'LoungeArtDetails';
  level.add(details);

  function mesh(geometry, material, x, y, z) {
    const object = new THREE.Mesh(geometry, material);
    object.position.set(x, y, z);
    object.castShadow = object.receiveShadow = true;
    details.add(object);
    return object;
  }

  // Low wall panels give the lounge a warmer base beneath the neon and paintings.
  for (const z of [-1.4, -.3, .8, 1.9]) {
    mesh(new THREE.BoxGeometry(.025, .94, 1.06), m.barBase, 6.39, .7, z);
  }
  mesh(new THREE.BoxGeometry(.04, .035, 4.48), m.brass, 6.375, 1.19, .25);

  function drink(x, y, z, mug = false) {
    mesh(new THREE.CylinderGeometry(.09, .09, .008, 12), m.woodLight, x, y + .004, z);
    const glass = mug ? models.Mug() : models.DrinkingGlass();
    glass.scale.setScalar(.7);
    place(glass, x, y + .008, z, mug ? -.7 : 0, details);
  }

  // Leave the table centres clear for their lamps, with a few signs of use at the edges.
  drink(3.33, .867, -4.55);
  drink(3.86, .867, -3.38, true);
  drink(2.76, .466, .29);
  drink(3.66, .466, -.04, true);

  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 192;
  const context = canvas.getContext('2d');
  context.fillStyle = '#30213c';
  context.fillRect(0, 0, 256, 192);
  context.fillStyle = '#d686a7';
  context.fillRect(16, 16, 224, 5);
  context.font = 'bold 35px sans-serif';
  context.fillText('GOSSIP', 18, 66);
  context.fillStyle = '#e8c58b';
  context.font = '14px sans-serif';
  context.fillText('AFTER HOURS', 20, 91);
  context.strokeStyle = '#68bfc3';
  context.lineWidth = 3;
  for (let i = 0; i < 4; i++) {
    context.beginPath();
    context.arc(179, 155, 23 + i * 13, Math.PI, Math.PI * 2);
    context.stroke();
  }
  const cover = new THREE.CanvasTexture(canvas);
  cover.colorSpace = THREE.SRGBColorSpace;
  cover.anisotropy = 4;
  const magazine = mesh(new THREE.BoxGeometry(.25, .012, .19), m.ceramic, 3.28, .472, .39);
  magazine.rotation.y = -.18;
  const jacket = new THREE.Mesh(new THREE.PlaneGeometry(.25, .19),
    new THREE.MeshStandardMaterial({ map: cover, roughness: .85 }));
  jacket.rotation.x = -Math.PI / 2;
  jacket.position.y = .0065;
  magazine.add(jacket);
}
