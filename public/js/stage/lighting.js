// Ambient, key light and one warm/magenta point light per zone. Each dynamic light costs every
// pixel on phones, so extra glow elsewhere should be emissive materials, not more lights.
export function buildLighting({ THREE, scene, level }) {
  scene.add(new THREE.HemisphereLight(0xcfd8f5, 0x4d3327, 1.6));

  const keyLight = new THREE.DirectionalLight(0xffd2a0, 1.5);
  keyLight.position.set(-6, 18, 10);
  keyLight.castShadow = true;
  Object.assign(keyLight.shadow.camera, { left: -13, right: 13, top: 13, bottom: -13, far: 45 });
  keyLight.shadow.camera.updateProjectionMatrix();
  keyLight.shadow.mapSize.set(2048, 2048);
  keyLight.shadow.bias = -.0003;
  scene.add(keyLight);

  for (const [color, intensity, x, y, z] of [
    [0xffb35c, 5, -3.4, 2.8, -4.2], // bar
    [0xffbb6e, 5, 3.5, 2.7, -7.8], // kitchen
    [0xffaa4d, 4, -3, 2.3, .8], // fountain + jukebox
    [0xffa75a, 4, 3.4, 2.6, -1.4], // lounge
    [0xf06ad0, 5, 4.3, 2.4, 3.9], // stage
  ]) {
    const light = new THREE.PointLight(color, intensity, 7, 2);
    if (color === 0xf06ad0) light.name = 'StageWashLight';
    light.position.set(x, y, z);
    level.add(light);
  }
}
