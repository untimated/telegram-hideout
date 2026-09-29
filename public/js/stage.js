import { createModelKit } from './models/index.js';
import { ROOM } from './config.js';

// Authored in metres from "GossipBar - Layout - Concept.png". Origin is the centre of
// the 13 x 13 m main floor: +x east (stage side), +z south (entrance), -z north (bar).
// Props keep their natural size, so nothing in here is scaled to "fit".
export function buildGossipBarStage(THREE, scene, { Robot, floorEnvironment } = {}) {
  const models = createModelKit(THREE, { Robot });
  if (floorEnvironment) {
    models.materials.floor.envMap = floorEnvironment;
    models.materials.floor.envMapIntensity = 1.1;
    models.materials.water.envMap = floorEnvironment;
    models.materials.water.envMapIntensity = 1.5;
  }
  const level = new THREE.Group();
  level.name = 'GossipBarStage';
  level.userData.kind = 'level';
  scene.add(level);

  const H = ROOM.wallHeight;
  const half = ROOM.width / 2;

  function place(model, x, y, z, yaw = 0) {
    model.position.set(x, y, z);
    model.rotation.y = yaw;
    level.add(model);
    return model;
  }

  // Decorative copies that should not add another dynamic light to the scene.
  function unlit(model) {
    const lights = [];
    model.traverse(object => { if (object.isPointLight) lights.push(object); });
    for (const light of lights) light.parent.remove(light);
    return model;
  }

  scene.add(new THREE.HemisphereLight(0xcfd8f5, 0x4d3327, 1.6));
  const keyLight = new THREE.DirectionalLight(0xffd2a0, 1.5);
  keyLight.position.set(-6, 18, 10);
  keyLight.castShadow = true;
  keyLight.shadow.camera.left = -13;
  keyLight.shadow.camera.right = 13;
  keyLight.shadow.camera.top = 13;
  keyLight.shadow.camera.bottom = -13;
  keyLight.shadow.camera.far = 45;
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
    light.position.set(x, y, z);
    level.add(light);
  }

  // Floors: main room plus the kitchen alcove that juts out to the north.
  const floor = place(models.RoomFloor(ROOM.width, ROOM.depth), 0, 0, 0);
  floor.userData.kind = 'floor';
  place(models.RoomFloor(6, 3), 3.5, 0, -8);

  // Shell. Hard walls north/east/south, glass toward the pool on the west.
  place(models.RoomWall(7, H), -3, 0, -6.5);
  place(models.RoomWall(3, H), .5, 0, -8, Math.PI / 2);
  place(models.RoomWall(6, H), 3.5, 0, -9.5);
  place(models.RoomWall(16, H), half, 0, -1.5, Math.PI / 2);
  place(models.RoomWall(1.3, H), -5.85, 0, half);
  place(models.RoomWall(9.3, H), 1.85, 0, half);
  place(models.EntranceFrame(2.4, H), -4, 0, half - .05);
  place(models.EntranceDoors(1.74, H - .32), -4, 0, half - .05);

  for (let index = 0; index < 10; index++) {
    const z = -5.85 + index * 1.3;
    place(models.WindowGlassPanel(1.24, H - .1), -half, 0, z, Math.PI / 2);
    if (index < 9) place(models.WindowMullion(H), -half, 0, z + .65, Math.PI / 2);
  }
  for (const z of [-half, half]) place(models.WallPillar(H), -half, 0, z);

  // Pool strip: planted deck against the glass, then the water, then a low outer wall.
  // The pool is 1.5x its old 1.9 m width, growing away from the glass (its east edge stays put).
  const poolWidth = 1.9 * 1.5;
  const poolX = -7.7 - poolWidth / 2;
  const outerWallX = poolX - poolWidth / 2 - .35;
  const poolGrowth = poolWidth - 1.9;
  place(models.RoomFloor(1.1, 13.4), -7.05, 0, 0);
  place(models.PoolBasin(poolWidth, 13.2), poolX, 0, 0);
  place(models.PoolWaterSurface(poolWidth - .1, 13.1), poolX, 0, 0);
  for (const x of [poolX - poolWidth / 2 - .09, poolX + poolWidth / 2 + .09]) place(models.PoolCoping(13.2, .18), x, 0, 0, Math.PI / 2);
  for (const z of [-6.69, 6.69]) place(models.PoolCoping(poolWidth + .4, .18), poolX, 0, z);
  for (let index = 0; index < 5; index++) {
    const lamp = place(models.PoolLight(), poolX + poolWidth / 2 - .4, .12, -5 + index * 2.5, Math.PI / 2);
    if (index % 2) unlit(lamp);
  }
  place(models.RoomWall(13.6, 1.3), outerWallX, 0, 0, Math.PI / 2);
  for (const z of [-6.8, 6.8]) place(models.RoomWall(-half - outerWallX + .18, 1.3), (outerWallX - half) / 2, 0, z);
  for (let index = 0; index < 10; index++) {
    place(models.PottedPlant(1, index + 2), -7.05, 0, -5.4 + index * 1.2);
  }

  // Bar: raised platform in the north-west corner, L-shaped counter around the bartender.
  place(models.BarPlatform(6.1, 4.5), -3.45, 0, -4.25);
  place(models.BarPlatformSteps(1.8, 2), -5.4, 0, -1.8, Math.PI);
  const bar = place(models.BarCounterCorner(3.9, 2.3), -2.1, .28, -3.75);
  bar.userData.kind = 'interactable';
  bar.userData.interaction = 'bar';
  place(models.BarBackCabinet(4.8, 1.9), -3.3, .28, -6.2);
  place(models.BarBottleShelf(4.4), -3.3, .38, -6.1);
  place(models.GossipBarSign(4.6), -3.3, 2.35, -6.36);
  for (const x of [-4.6, -3.5, -2.4]) place(models.BarStool(), x, .28, -3);
  for (const z of [-5.4, -4.6, -3.8]) place(models.BarStool(), -1.1, .28, z);
  place(models.TableLamp(), -5.8, 1.32, -3.75);
  place(models.TableLamp(), -2.1, 1.32, -5.8);
  place(models.Bottle(0x36a88c, .34), -5.2, 1.32, -3.75);
  place(models.DrinkingGlass(), -4.9, 1.32, -3.7);
  place(models.Mug(), -2.1, 1.32, -4.6);
  for (const [index, x] of [-4.9, -4.1, -3.3, -2.5, -1.7].entries()) {
    place(models.Bottle(index % 2 ? 0xa73d5a : 0x36a88c, .3), x, .87, -6.08);
    place(models.DrinkingGlass(), x, 1.37, -6.08);
  }
  place(models.PottedPlant(.62, 11), -6.1, .28, -6);

  function addNPC(id, name, x, z, floorY = 0, addHat = false) {
    if (!models.Robot) return;
    const actor = models.Robot({ id, name, x, z, yaw: Math.PI });
    if (addHat) {
      const hat = models.ChefHat();
      hat.position.y = .29;
      actor.userData.head.add(hat);
    }
    scene.remove(actor);
    level.add(actor);
    actor.position.y = floorY;
    actor.userData.kind = 'npc';
  }
  addNPC('npc:wolfred', 'Wolfred', -3.7, -4.9, .28);
  addNPC('npc:pierre', 'Pierre', 3.5, -8, 0, true);

  // Open kitchen against the alcove's back wall, with the buffet line across its mouth.
  const kz = -9.05;
  place(models.KitchenBaseCabinet(1.18), 1.3, 0, kz);
  place(models.KitchenBaseCabinet(1.18), 3.6, 0, kz);
  place(models.KitchenBaseCabinet(1.18), 4.75, 0, kz);
  for (const x of [3.6, 4.75]) place(models.KitchenWorktop(1.18, .73), x, .78, kz);
  place(models.KitchenBacksplash(5.4, .78), 3.55, .96, -9.36);
  place(models.KitchenSink(), 1.3, 0, kz);
  place(models.KitchenFaucet(), 1.3, .88, kz - .07);
  place(models.Stove(), 2.55, 0, kz);
  place(models.ExtractorHood(), 2.55, 1.4, kz - .13);
  place(models.Refrigerator(), 5.85, 0, kz);
  place(models.KitchenShelf(2.2), 4.2, 2.0, -9.3);
  place(models.CookingPot(), 2.4, .97, kz - .07);
  place(models.FryingPan(), 2.7, .98, kz + .1);
  place(models.PotLid(), 3.9, .92, kz);
  place(models.UtensilHolder(), 1.7, .92, kz - .05);
  place(models.CuttingBoard(), 3.5, .92, kz);
  place(models.CookingUtensil('spatula'), 4.2, .94, kz);

  const buffet = place(models.BuffetCounter(5.4), 3.5, 0, -7);
  buffet.userData.kind = 'interactable';
  buffet.userData.interaction = 'buffet';
  for (const x of [2.0, 2.9, 3.8, 4.7]) place(models.ChafingDish(), x, .98, -7);
  place(models.PlateStack(5), 5.6, .98, -7);
  place(models.CupStack(3), 1.2, .98, -7);
  place(models.WallLight('warm'), 5.85, 2.2, -9.36);

  // Jukebox against the glass, café tables, and the east lounge.
  const jukebox = place(models.Jukebox(), -6.2, 0, .9, Math.PI / 2);
  jukebox.scale.set(1, .85, .85);
  jukebox.userData.kind = 'interactable';
  jukebox.userData.interaction = 'jukebox';
  for (const z of [-4.8, -3.15]) {
    place(models.CafeTable(), 3.6, 0, z).scale.set(1.12, 1, 1.12);
    place(models.CafeChair(), 2.6, 0, z, -Math.PI / 2);
    place(models.CafeChair(), 4.6, 0, z, Math.PI / 2);
    place(models.TableLamp(), 3.6, .88, z);
  }
  place(models.Sofa(2.6), 3.2, 0, -1.35);
  place(models.Sofa(2.6), 3.2, 0, 1.6, Math.PI);
  place(models.Sofa(1.8), 5.9, 0, .12, -Math.PI / 2);
  place(models.CoffeeTable(), 3.2, 0, .12).scale.set(1.2, 1, 1.15);
  place(models.TableLamp(), 3.2, .466, .12);

  // A flush tile inset frames the refreshment area without a false sunken pit.
  const fx = -3;
  const fz = .75;
  place(models.FloorInset(3.8, 3.5), fx, 0, fz);
  place(models.FountainPedestal(), fx, .02, fz);
  place(models.ChocolateFountain(), fx - .4, .9, fz).scale.setScalar(.55);
  place(models.DrinkDispenser(), fx + .54, .84, fz, Math.PI).scale.setScalar(.85);
  place(models.Cup(), fx - .74, .84, fz + .36).scale.setScalar(.8);
  place(models.CupStack(3), fx + .7, .84, fz + .34).scale.setScalar(.65);
  for (const [dx, dz] of [[-1.7, -1.4], [1.7, -1.4], [-1.7, 1.4], [1.7, 1.4]]) {
    place(unlit(models.TableLamp()), fx + dx, .02, fz + dz).scale.setScalar(.7);
  }
  for (const [x, z] of [[-3.5, -1.25], [-2.3, -1.25], [-.6, .05], [-.6, 1.25]]) {
    place(models.SquareSeat(), x, 0, z);
  }

  // Stage in the south-east corner, facing north into the room.
  const stage = place(models.StagePlatform(4.2, 3.6), 4.3, 0, 4.6);
  stage.userData.kind = 'interactable';
  stage.userData.interaction = 'stage';
  place(models.StageSteps(1.6, 3), 1.9, 0, 4.6, Math.PI / 2);
  place(models.StageSpeaker(), 3, .4, 5.6);
  place(models.StageSpeaker(), 5.6, .4, 5.6);
  const micStand = place(models.MicrophoneStand(), 4.3, .4, 4.4);
  const microphone = models.Microphone();
  microphone.position.set(.28, 1.25, 0);
  micStand.add(microphone);

  // Plants, wall art and wall lighting.
  for (const [x, z, seed] of [
    [6, -5.6, 17], [6, -1.9, 21], [6, 1.9, 26],
    [-6.05, 2.1, 32], [-5.7, 6.1, 39], [-2.3, 6.1, 42],
  ]) place(models.PottedPlant(.62, seed), x, 0, z);
  for (const z of [-3.4, -.6, 2.2]) place(models.WallArtFrame(.8, .58), 6.37, 1.95, z, -Math.PI / 2);
  for (const [z, tone] of [[-2, 'warm'], [.8, 'magenta'], [3.8, 'warm']]) place(models.WallLight(tone), 6.36, 1.5, z, -Math.PI / 2);
  place(models.WallLight('magenta'), -6.2, 1.85, -6.36);
  place(models.WallLight('cyan'), 0, 1.85, -6.36);

  buildCeiling();
  buildBackdrop();

  // Slowly drift the pool ripples; world.js calls this every frame with elapsed seconds.
  const rippleMap = models.materials.water.normalMap;
  level.userData.animate = time => {
    rippleMap.offset.set(time * .003, time * .005);
    models.materials.water.roughnessMap.offset.copy(rippleMap.offset);
  };

  // Backdrop beyond the glass: dark ground, lit palms by the pool wall, black silhouette rows and
  // a ridge line further out, so the starry sky has layers of depth behind it.
  function buildBackdrop() {
    const backdrop = new THREE.Group();
    backdrop.name = 'Backdrop';
    level.add(backdrop);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(200, 200),
      new THREE.MeshStandardMaterial({ color: 0x0a111c, roughness: .95, metalness: 0 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(outerWallX - .1 - 100, -.05, 0);
    backdrop.add(ground);

    const palm = (options, x, z, yaw = 0) => {
      const model = models.Palm(options);
      model.position.set(x - poolGrowth, -.05, z);
      model.rotation.y = yaw;
      backdrop.add(model);
    };

    // Lit palms leaning their crowns over the pool. The short ones show from mid-room; the tall
    // ones arch into view when standing at the glass.
    for (const [x, z, height, lean, seed] of [
      [-11.0, -4.6, 3.7, 1.3, 3], [-10.9, 3.2, 4.1, 1.5, 8], [-11.2, 7.7, 3.5, 1.1, 14],
      [-12.2, -7.6, 6.6, 2.3, 21], [-11.7, -1.2, 5.4, 2.1, 27], [-12.6, 1.2, 7.0, 2.6, 33],
      [-11.9, 5.4, 5.9, 1.9, 40], [-13.2, 9.6, 6.8, 2.3, 53],
      [-15.6, 4.6, 7.6, 2.6, 65], [-14.4, 13, 6.4, 2.0, 71],
    ]) palm({ height, lean, seed, fronds: 12 + seed % 4 }, x, z, (seed % 5 - 2) * .12);

    // Silhouettes ignore fog and lighting: black shapes standing against the horizon glow.
    for (let index = 0; index < 22; index++) {
      const angle = (index / 22 - .5) * 2.1;
      const distance = 32 + (index % 4) * 8;
      palm({
        height: 9 + (index * 37 % 7), lean: 2.4 + (index % 3), seed: 90 + index * 7,
        fronds: 11, frondLength: 4.6, silhouette: true,
      }, -Math.cos(angle) * distance - 6, Math.sin(angle) * distance, (index % 4 - 1.5) * .3);
    }
    // Ground-level floodlights aimed up the palms. Every fixture gets a fading beam; only three
    // carry a real SpotLight, since each dynamic light costs every pixel on phones.
    const flood = (x, z, tx, ty, tz, color, lit) => {
      const from = new THREE.Vector3(x - poolGrowth, .08, z);
      const to = new THREE.Vector3(tx - poolGrowth, ty, tz);
      const direction = new THREE.Vector3().subVectors(to, from);
      const length = direction.length();
      direction.normalize();
      const fixture = new THREE.Group();
      fixture.position.copy(from);
      fixture.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
      const housing = new THREE.Mesh(new THREE.CylinderGeometry(.09, .12, .3, 14), models.materials.darkMetal);
      housing.position.y = .05;
      const lens = new THREE.Mesh(new THREE.CircleGeometry(.085, 20), new THREE.MeshBasicMaterial({ color }));
      lens.rotation.x = -Math.PI / 2;
      lens.position.y = .205;
      fixture.add(housing, lens);
      backdrop.add(fixture);

      const radius = length * Math.tan(.24);
      const cone = new THREE.ConeGeometry(radius, length, 28, 1, true);
      cone.translate(0, -length / 2, 0);
      const tint = new THREE.Color(color).multiplyScalar(.09);
      const colors = [];
      const positions = cone.attributes.position;
      for (let index = 0; index < positions.count; index++) {
        const strength = positions.getY(index) > -length * .02 ? 1 : 0;
        colors.push(tint.r * strength, tint.g * strength, tint.b * strength);
      }
      cone.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
      const beam = new THREE.Mesh(cone, new THREE.MeshBasicMaterial({
        vertexColors: true, transparent: true, blending: THREE.AdditiveBlending,
        depthWrite: false, side: THREE.DoubleSide,
      }));
      beam.position.copy(from);
      beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), direction);
      backdrop.add(beam);

      if (lit) {
        const spot = new THREE.SpotLight(color, 260, 24, .42, .8, 2);
        spot.position.copy(from);
        spot.target.position.copy(to);
        backdrop.add(spot, spot.target);
      }
    };
    for (const [x, z, tx, ty, tz, color, lit] of [
      [-10.5, -6.2, -11, 4.2, -7.6, 0xffc27a, true],
      [-10.5, -3.4, -10.4, 2.8, -4.6, 0xffc27a, false],
      [-10.5, 1, -11.3, 4.4, 1.2, 0x8fe8ff, true],
      [-10.5, 3.6, -10.2, 3, 3.2, 0x8fe8ff, false],
      [-10.5, 6.4, -10.9, 3.8, 5.4, 0xffc27a, true],
      [-10.6, 8.8, -10.6, 2.6, 7.7, 0xffc27a, false],
    ]) flood(x, z, tx, ty, tz, color, lit);

    const ridge = models.HorizonRidge(95);
    backdrop.add(ridge);
  }

  // Ceiling: slabs around a raised glass skylight over the fountain, coffered with neon-inlaid
  // beams, plus pendants and a truss so the room reads as lit from above.
  function buildCeiling() {
    const ceiling = new THREE.Group();
    ceiling.name = 'Ceiling';
    level.add(ceiling);
    const put = (model, x, y, z, yaw = 0) => {
      model.position.set(x, y, z);
      model.rotation.y = yaw;
      ceiling.add(model);
      return model;
    };

    // Skylight opening: x -5.4..-.6, z -1.4..3.4 (centred over the fountain inset).
    const hole = { x0: -5.4, x1: -.6, z0: -1.4, z1: 3.4 };
    const holeW = hole.x1 - hole.x0;
    const holeD = hole.z1 - hole.z0;
    const holeX = (hole.x0 + hole.x1) / 2;
    const holeZ = (hole.z0 + hole.z1) / 2;
    put(models.CeilingSlab(ROOM.width, hole.z0 + half), 0, H, (-half + hole.z0) / 2);
    put(models.CeilingSlab(ROOM.width, half - hole.z1), 0, H, (hole.z1 + half) / 2);
    put(models.CeilingSlab(hole.x0 + half, holeD), (-half + hole.x0) / 2, H, holeZ);
    put(models.CeilingSlab(half - hole.x1, holeD), (hole.x1 + half) / 2, H, holeZ);
    put(models.CeilingSlab(6, 3), 3.5, H, -8);
    put(models.Skylight(holeW, holeD), holeX, H, holeZ);
    // Eave over the glass wall hides the top of the frame from inside and outside.
    put(models.CeilingSlab(.45, ROOM.depth + .36), -half - .225 + .09, H, 0);

    put(models.CeilingBeam(ROOM.width, 'cyan'), 0, H, -5.6);
    put(models.CeilingBeam(ROOM.width, 'warm'), 0, H, 5.6);
    put(models.CeilingBeam(ROOM.depth, 'magenta'), 2.2, H, 0, Math.PI / 2);
    put(models.CeilingBeam(ROOM.depth, 'warm'), 5, H, 0, Math.PI / 2);

    // Glow along the top of the walls.
    put(models.CoveStrip(15.8, 'warm'), half - .04, H - .12, -1.5, Math.PI / 2);
    put(models.CoveStrip(6.8, 'cyan'), -3, H - .12, -6.38);
    put(models.CoveStrip(5.8, 'warm'), 3.5, H - .12, -9.38);
    put(models.CoveStrip(2.9, 'warm'), .62, H - .12, -7.95, Math.PI / 2);
    put(models.CoveStrip(9.3, 'cyan'), 1.85, H - .12, half - .04);

    // Bar, café, lounge, fountain and stage each get their own light fitting.
    for (const x of [-5.4, -4.2, -3]) put(models.PendantLamp(.65, 'warm'), x, H, -3.75);
    for (const z of [-4.8, -3.15]) put(models.PendantLamp(.75, 'warm', .3), 3.6, H, z);
    put(models.LinearLight(1.7, .7, 'warm'), 3.2, H, .12);
    put(models.RingLight(1.3, .95, 'warm'), fx, 2.75, fz);
    put(models.StageTruss(3.8, .55), 4.3, H, 3.3);
    for (const x of [2.5, 4.5]) put(models.RecessedPanel(.9, .9), x, H, -8);
  }

  return level;
}
