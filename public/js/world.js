import { createRobotCharacterFactory } from './characters.js';
import { buildGossipBarStage } from './stage.js';
import { buildPrototypeStage } from './stage/prototype.js';
import { CHARACTER_SCALE, EYE_HEIGHT } from './config.js';
import { MAPS } from './maps.js';
import { createNightSky, createGlossEnvironment } from './sky.js';
import { createServedItems } from './items.js';
import { createPicker, createRimHighlight, INTERACT_RANGE } from './interaction.js';
import { bakeStaticMeshes, mergeRigidParts } from './stage/bake.js';
import { createQualityGovernor } from './quality.js';
import { blurAmount } from './game/rules.js';
import { floorHeightAt } from './stage/layout.js';
import { createJukeboxNotes } from './models/music-notes.js';
import { createConsumptionAnimator } from './character-consumption.js';
import { createSlotAnimator } from './slot-animation.js';
import { createSlotWinEffects } from './models/slot-win-effects.js';

const TAP_SLOP = 8;
const TAP_MS = 450;
const SLEEP_EYE_HEIGHT = .32;
const SWAY_SECONDS = 4;
// Seated robots: how far below the cushion top the feet origin sits (hip height minus thigh).
const SEAT_DROP = .46;
const SEATED_EYE = .62;
// Close-up of a freshly served order: seconds on screen, and the orbit it dollies along.
const SHOWCASE_SECONDS = 3.2;

// onPick(target) fires for a tap/click on the scene (target is null for empty space); onHover(target)
// reports what the reticle points at, a few times a second. getSelfState() -> { asleep, drunk }.
export async function createWorld({ host, input, players, getSelfID, getOrientation, onLook, isLocallyMoving, getMovement, applyMove, walkSpeed, bubbles, addDebug, guestMode, getGuestSessionToken, queueOrientation, onPick, onHover, getSelfState, now, slotNow = now, isJukeboxPlaying, isBandPlaying, onStats, onProgress, map = MAPS.main }) {
  // Reports a loading step, then yields a frame so the loading screen can repaint before the next
  // blocking step.
  const progress = async (text, fraction) => {
    onProgress?.(text, fraction);
    await new Promise(resolve => { requestAnimationFrame(() => setTimeout(resolve)); setTimeout(resolve, 60); });
  };
  try {
    await progress('Loading the 3D engine', .05);
    const THREE = await import('https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js');
    const scene = new THREE.Scene();
    const consumption = createConsumptionAnimator(THREE);
    scene.background = createNightSky(THREE);
    scene.fog = new THREE.Fog(0x171d33, 11, 24);
    const eyeHeight = EYE_HEIGHT;
    const camera = new THREE.PerspectiveCamera(70, 1, 0.05, 130);
    camera.position.set(map.spawn.x, eyeHeight, map.spawn.z);
    camera.rotation.order = 'YXZ';
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    host.prepend(renderer.domElement);
    let lookPointer;
    function stopLooking() {
      if (lookPointer && renderer.domElement.hasPointerCapture(lookPointer.id)) {
        renderer.domElement.releasePointerCapture(lookPointer.id);
      }
      lookPointer = undefined;
    }
    renderer.domElement.addEventListener('pointerdown', event => {
      endShowcase();
      if (lookPointer || event.button !== 0) return;
      input.blur();
      lookPointer = { id: event.pointerId, x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY, at: performance.now() };
      renderer.domElement.setPointerCapture(event.pointerId);
      event.preventDefault();
    });
    renderer.domElement.addEventListener('pointermove', event => {
      if (event.pointerId !== lookPointer?.id) return;
      const current = getOrientation();
      let yaw = current.yaw - (event.clientX - lookPointer.x) * .005;
      yaw = Math.atan2(Math.sin(yaw), Math.cos(yaw));
      const pitch = Math.max(-1.25, Math.min(1.25, current.pitch - (event.clientY - lookPointer.y) * .005));
      onLook(yaw, pitch);
      lookPointer.x = event.clientX;
      lookPointer.y = event.clientY;
    });
    // A short press that barely moved is a tap: pick whatever is under it.
    renderer.domElement.addEventListener('pointerup', event => {
      if (event.pointerId !== lookPointer?.id) return;
      if (Math.hypot(event.clientX - lookPointer.startX, event.clientY - lookPointer.startY) < TAP_SLOP &&
          performance.now() - lookPointer.at < TAP_MS) {
        onPick?.(picker?.pickAt(event.clientX, event.clientY) ?? null);
      }
    });
    for (const eventName of ['pointerup', 'pointercancel', 'lostpointercapture']) {
      renderer.domElement.addEventListener(eventName, event => {
        if (event.pointerId === lookPointer?.id) {
          queueOrientation();
          stopLooking();
        }
      });
    }
    window.addEventListener('blur', stopLooking);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) stopLooking();
    });

    const actors = new Map();
    const bubbleAnchor = new THREE.Vector3();
    const bubbleView = new THREE.Vector3();
    const bubbleScreen = new THREE.Vector3();

    const characterFactory = createRobotCharacterFactory(THREE, scene, { guestMode, getGuestSessionToken, addDebug });
    const createRobotCharacter = characterFactory.create;
    await progress(`Building ${map.label}`, .25);
    const buildStage = map.id === 'prototype' ? buildPrototypeStage : buildGossipBarStage;
    const stage = buildStage(THREE, scene, { Robot: createRobotCharacter, floorEnvironment: createGlossEnvironment(THREE, renderer), now, isBandPlaying });
    const musicNotes = createJukeboxNotes(THREE);
    musicNotes.object.userData.dynamic = true;
    stage.userData.interactables.find(entry => entry.id === 'jukebox')?.object.add(musicNotes.object);
    const slotMachine = stage.userData.interactables.find(entry => entry.id === 'gossip-jackpot')?.object;
    const slotWinEffects = slotMachine ? createSlotWinEffects(THREE) : null;
    if (slotWinEffects) slotMachine.add(slotWinEffects.object);
    const slotAnimator = createSlotAnimator(slotMachine, slotWinEffects);
    const servedGroup = new THREE.Group();
    servedGroup.name = 'ServedItems';
    stage.add(servedGroup);
    const servedItems = createServedItems(THREE, servedGroup);
    // Merge the static level into a few hundred draw calls, then render its shadows once: only
    // characters and props move, and they carry blob shadows instead.
    await progress('Baking the room', .5);
    const { mergeGeometries } = await import('https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/utils/BufferGeometryUtils.js');
    stage.traverse(object => { if (object.userData.kind === 'npc') object.traverse(part => { part.castShadow = false; }); });
    const baked = bakeStaticMeshes(THREE, stage, mergeGeometries);
    let robotParts = { before: 0, after: 0 };
    const npcs = [];
    stage.traverse(object => { if (object.userData.kind === 'npc') npcs.push(object); });
    // Furniture and fixtures you can use stay separate objects (picking, rim light) but still get
    // their own parts merged.
    for (const { object } of stage.userData.interactables) {
      if (object.userData.kind !== 'npc') mergeRigidParts(THREE, object, mergeGeometries);
    }
    for (const npc of npcs) {
      const { before, after } = mergeRigidParts(THREE, npc, mergeGeometries);
      robotParts = { before: robotParts.before + before, after: robotParts.after + after };
    }
    addDebug(`render: merged ${robotParts.before} NPC parts into ${robotParts.after}`, 'muted');
    addDebug(`render: baked ${baked.merged} static meshes into ${baked.meshes}`, 'muted');
    renderer.shadowMap.autoUpdate = false;
    renderer.shadowMap.needsUpdate = true;
    const picker = createPicker(THREE, { camera, canvas: renderer.domElement, level: stage, actors, getSelfID });
    const rim = createRimHighlight(THREE);
    rim.warmUp(renderer, camera);
    servedItems.warmUp(renderer, scene, camera);
    // Compile every shader the room needs (in parallel where the browser supports it) and draw one
    // frame, so the first seconds of play do not stutter.
    await progress('Warming up shaders', .7);
    await renderer.compileAsync(scene, camera);
    await progress('Almost there', .95);
    renderer.render(scene, camera);

    function createPlayer(player) {
      const group = createRobotCharacter(player);
      mergeRigidParts(THREE, group, mergeGeometries);
      return group;
    }

    let localPlayerID;

    function setLocalPlayer(id) {
      localPlayerID = id;
      for (const [playerID, group] of actors) {
        group.visible = playerID !== id;
        const ring = group.children.find(child => child.userData.localMarker);
        if (ring) ring.material.color.set(playerID === id ? 0xffca71 : 0x91a0c8);
      }
    }

    function upsertPlayer(player, moving = false) {
      let group = actors.get(player.id);
      if (!group) {
        group = createPlayer(player);
        actors.set(player.id, group);
      }
      group.userData.playerID = player.id;
      characterFactory.refreshAvatar(group, player);
      group.userData.target.set(player.x, 0, player.z);
      if (Number.isFinite(player.yaw)) group.rotation.y = player.yaw;
      if (Number.isFinite(player.pitch)) group.userData.head.rotation.x = player.pitch;
      if (moving) group.userData.walkUntil = performance.now() + 260;
      setLocalPlayer(localPlayerID);
    }

    let nextNPCID = 0;
    function addNPC(npc) {
      const id = `npc:${npc.id ?? ++nextNPCID}`;
      const actor = {
        id,
        name: npc.name ?? 'Robot NPC',
        x: Number.isFinite(npc.x) ? npc.x : 0,
        z: Number.isFinite(npc.z) ? npc.z : 0,
        yaw: Number.isFinite(npc.yaw) ? npc.yaw : 0,
        pitch: Number.isFinite(npc.pitch) ? npc.pitch : 0,
        photoURL: npc.photoURL ?? null,
        avatarURL: npc.avatarURL ?? null,
      };
      players.set(id, actor);
      actors.set(id, createRobotCharacter(actor, { isNPC: true }));
      return id;
    }

    function removePlayer(id) {
      const group = actors.get(id);
      if (!group) return;
      consumption.clear(group);
      scene.remove(group);
      group.traverse(object => {
        object.geometry?.dispose();
        object.material?.map?.dispose();
        object.material?.dispose();
      });
      actors.delete(id);
    }

    // The showcase: a second camera that circles a served item for a few seconds.
    const showcaseCamera = new THREE.PerspectiveCamera(45, 1, .02, 60);
    let showcase = null;
    function endShowcase() {
      if (!showcase) return;
      showcase.object.userData.showcased = false;
      showcase = null;
      host.classList.remove('showcase');
    }

    const resize = () => {
      const width = host.clientWidth;
      const height = host.clientHeight;
      renderer.setSize(width, height, false);
      camera.aspect = showcaseCamera.aspect = width / height;
      camera.updateProjectionMatrix();
      showcaseCamera.updateProjectionMatrix();
    };
    new ResizeObserver(resize).observe(host);
    resize();
    const world = {
      stage,
      upsertPlayer,
      removePlayer,
      setLocalPlayer,
      setOrientation(id, heading, lookPitch) {
        const character = actors.get(id);
        if (character) {
          character.rotation.y = heading;
          if (Number.isFinite(lookPitch)) character.userData.head.rotation.x = lookPitch;
        }
      },
      addNPC,
      items: servedItems,
      // A short model inspection using the same camera as served-item showcases.
      inspect(object, duration = 6) {
        const anchors = object.userData.slotMachine;
        if (!anchors) return;
        object.updateWorldMatrix(true, true);
        showcase = {
          object, start: clock.elapsedTime, duration,
          focus: anchors.cameraFocus.getWorldPosition(new THREE.Vector3()),
          viewpoint: anchors.cameraPosition.getWorldPosition(new THREE.Vector3()),
        };
        object.userData.showcased = true;
        rim.set(null);
        onHover?.(null);
        host.classList.add('showcase');
      },
      endInspect: endShowcase,
      isInspecting: () => Boolean(showcase?.focus),
      setSlotSpin: (spin, time) => slotAnimator?.setSpin(spin, time),
      consume(id, itemID) {
        consumption.start(actors.get(id), itemID, clock.elapsedTime);
      },
      // First person: the local player's item flies into the camera instead of vanishing.
      consumeOwn(servedID) {
        const target = new THREE.Vector3();
        servedItems.consume(servedID, () => target.set(0, -.12, -.25).applyMatrix4(camera.matrixWorld));
      },
      // Cuts to a close-up of a served item (by id) for a few seconds; any input cuts back.
      showcase(id) {
        const object = servedItems.get(id);
        if (!object) return;
        endShowcase();
        const from = Math.atan2(camera.position.x - object.position.x, camera.position.z - object.position.z);
        object.userData.showcased = true;
        showcase = { object, from, start: clock.elapsedTime };
        host.classList.add('showcase');
      },
      pickCenter: () => picker.pickCenter(),
      // Where the local player is drawn (predicted), for UI distance checks.
      localPosition: () => actors.get(getSelfID())?.position,
      // Other players lie on the floor while passed out (the local player sees it through the camera).
      setAsleep(id, asleep) {
        const group = actors.get(id);
        if (group) group.userData.asleep = asleep;
      },
      // seat is an entry from game/seats.js, or null to stand up where they are.
      setSeat(id, seat) {
        const group = actors.get(id);
        if (!group) return;
        group.userData.seat = seat;
        if (seat) group.userData.target.set(seat.x, 0, seat.z);
      },
    };
    for (const player of players.values()) upsertPlayer(player);
    setLocalPlayer(getSelfID());

    const clock = new THREE.Clock();
    let nextHover = 0;
    let lastBlur = '';
    let lastDrunk = null;
    let swayUntil = -Infinity;
    const stats = { frames: 0, since: 0 };
    const quality = createQualityGovernor({ renderer, scene, addDebug });
    renderer.setAnimationLoop(() => {
      const delta = Math.min(clock.getDelta(), .1);
      stage.userData.animate?.(clock.elapsedTime);
      servedItems.animate(clock.elapsedTime, delta);
      rim.animate(clock.elapsedTime);
      musicNotes.update(clock.elapsedTime, !isBandPlaying?.() && isJukeboxPlaying?.());
      slotAnimator?.update(slotNow());
      const selfState = getSelfState?.() ?? { asleep: false, drunk: 0 };
      const orientation = getOrientation();
      const selfID = getSelfID();
      const blend = 1 - Math.exp(-10 * delta);
      for (const [id, group] of actors) {
        let locallyMoving = false;
        if (id === selfID) {
          if (isLocallyMoving()) {
            const { forward, strafe } = getMovement();
            const next = applyMove(group.position, forward, strafe, orientation.yaw, walkSpeed * delta);
            group.position.set(next.x, 0, next.z);
            locallyMoving = true;
          }
          // The local player is never pulled toward the server's copy (that rubber-bands). The
          // client reports where it is and the server follows (see the move handler in server.js).
        } else {
          group.position.lerp(group.userData.target, blend);
        }
        const moving = locallyMoving || (id !== selfID && performance.now() < group.userData.walkUntil);
        if (group.userData.consumption) group.userData.arms[1].rotation.set(0, 0, 0);
        if (moving) {
          group.userData.walkPhase += delta * 11;
          const swing = Math.sin(group.userData.walkPhase) * .48;
          group.userData.arms[0].rotation.x = swing;
          group.userData.arms[1].rotation.x = -swing;
          group.userData.legs[0].rotation.x = -swing;
          group.userData.legs[1].rotation.x = swing;
          group.userData.torso.position.y = .94 + Math.abs(Math.sin(group.userData.walkPhase * 2)) * .025;
          group.userData.head.rotation.z = Math.sin(group.userData.walkPhase) * .025;
        } else {
          for (const limb of [...group.userData.arms, ...group.userData.legs]) limb.rotation.x = 0;
          group.userData.torso.position.y = .94;
          group.userData.head.rotation.z = 0;
        }
        if (id === selfID) group.rotation.y = orientation.yaw;
        // Passed out: flat on the back, feet where they stood.
        const asleep = id === selfID ? selfState.asleep : group.userData.asleep;
        consumption.update(group, clock.elapsedTime, asleep);
        group.rotation.order = 'YXZ';
        group.rotation.x = asleep ? -Math.PI / 2 : 0;
        group.position.y = (map.id === 'main' ? floorHeightAt(group.position.x, group.position.z) : 0) + (asleep ? .16 : 0);
        if (asleep) for (const limb of [...group.userData.arms, ...group.userData.legs]) limb.rotation.x = 0;
        // Seated: hips on the cushion, thighs forward (dangling a little on bar stools), hands on
        // the lap. The local player keeps free look; others face the way the seat faces.
        const seat = !asleep && group.userData.seat;
        if (seat) {
          group.position.set(seat.x, seat.y - SEAT_DROP, seat.z);
          if (id !== selfID) group.rotation.y = seat.yaw;
          for (const leg of group.userData.legs) leg.rotation.x = seat.kind === 'stool' ? 1.2 : Math.PI / 2;
          for (const arm of group.userData.arms) arm.rotation.x = .45;
          group.userData.torso.position.y = .94;
        }
      }
      const local = actors.get(selfID);
      // Seated eyes sit a fixed height over the cushion (the robots' short legs would otherwise put
      // bar-stool sitters above standing height).
      const seatedEye = local?.userData.seat && !selfState.asleep ? local.userData.seat.y + SEATED_EYE : null;
      if (local) camera.position.set(local.position.x, seatedEye ?? local.position.y + (selfState.asleep ? SLEEP_EYE_HEIGHT - .16 : eyeHeight), local.position.z);
      // Drunk players sway; the blur itself is a CSS filter on the canvas.
      const drunk = blurAmount(selfState.drunk);
      const time = clock.elapsedTime;
      // Below 50% drunk a drink only makes the room sway for a few seconds (fading out); above
      // it the sway stays.
      if (lastDrunk === null || selfState.drunk < lastDrunk) lastDrunk = selfState.drunk;
      if (selfState.drunk > lastDrunk) {
        lastDrunk = selfState.drunk;
        swayUntil = time + SWAY_SECONDS;
      }
      const swayFade = selfState.drunk > .5 ? 1 : Math.max(0, Math.min(1, (swayUntil - time) / 1.5));
      const sway = selfState.asleep ? 0 : Math.min(1, selfState.drunk * 1.4) * swayFade;
      camera.rotation.set(
        orientation.pitch + Math.sin(time * .83) * .035 * sway,
        orientation.yaw + Math.sin(time * .61) * .05 * sway,
        (selfState.asleep ? .5 : 0) + Math.sin(time * .97) * .06 * sway,
        'YXZ',
      );
      camera.updateMatrixWorld();
      const blur = drunk > 0 ? `blur(${(drunk * 3.2).toFixed(1)}px)` : '';
      if (blur !== lastBlur) renderer.domElement.style.filter = lastBlur = blur;
      if (onHover && time >= nextHover) {
        nextHover = time + .2;
        const target = picker.pickCenter();
        rim.set(target && !showcase?.focus && target.distance <= INTERACT_RANGE && !selfState.asleep ? target.object : null);
        onHover(showcase?.focus ? null : target);
      }
      for (const [id, bubble] of bubbles) {
        const group = actors.get(id);
        if (!group) { bubble.element.style.display = 'none'; continue; }
        bubbleAnchor.set(group.position.x, group.position.y + 2.55 * CHARACTER_SCALE, group.position.z);
        bubbleView.copy(bubbleAnchor).applyMatrix4(camera.matrixWorldInverse);
        bubbleScreen.copy(bubbleAnchor).project(camera);
        if (bubbleView.z >= -camera.near || bubbleView.z <= -camera.far ||
            Math.abs(bubbleScreen.x) > 1 || Math.abs(bubbleScreen.y) > 1) {
          bubble.element.style.display = 'none';
          continue;
        }
        const scale = Math.max(.78, Math.min(1.15, 3.2 / -bubbleView.z));
        bubble.element.style.display = '';
        bubble.element.style.left = `${(bubbleScreen.x + 1) * host.clientWidth / 2}px`;
        bubble.element.style.top = `${(1 - bubbleScreen.y) * host.clientHeight / 2}px`;
        bubble.element.style.transform = `translate(-50%, -100%) scale(${scale})`;
        bubble.element.style.zIndex = String(Math.round(1000 + bubbleView.z * 10));
      }
      let view = camera;
      if (showcase && (!showcase.object.parent || isLocallyMoving() || clock.elapsedTime - showcase.start > (showcase.duration ?? SHOWCASE_SECONDS))) endShowcase();
      if (showcase) {
        if (showcase.focus) {
          showcaseCamera.position.copy(showcase.viewpoint);
          showcaseCamera.lookAt(showcase.focus);
        } else {
          // Dolly in along a slow orbit, starting from the player's side of the item.
          const age = clock.elapsedTime - showcase.start;
          const ease = 1 - (1 - Math.min(1, age / 1.2)) ** 3;
          const angle = showcase.from + age * .45;
          const radius = .95 - .42 * ease;
          const { position } = showcase.object;
          showcaseCamera.position.set(position.x + Math.sin(angle) * radius, position.y + .42 - .1 * ease, position.z + Math.cos(angle) * radius);
          showcaseCamera.lookAt(position.x, position.y + .08, position.z);
        }
        view = showcaseCamera;
      }
      renderer.render(scene, view);
      // Rolling render stats for the log panel: fps and frame time over half a second, plus the
      // last frame's draw calls and triangles (shadow passes included).
      stats.frames++;
      if (time - stats.since >= .5) {
        const { render, memory, programs } = renderer.info;
        const fps = stats.frames / (time - stats.since);
        quality.sample(fps, time);
        onStats?.({
          fps,
          ms: (time - stats.since) * 1000 / stats.frames,
          calls: render.calls,
          triangles: render.triangles,
          geometries: memory.geometries,
          textures: memory.textures,
          programs: programs?.length ?? 0,
          pixelRatio: renderer.getPixelRatio(),
        });
        stats.frames = 0;
        stats.since = time;
      }
    });
    addDebug('three.js: first-person ready', 'muted');
    return world;
  } catch {
    addDebug('three.js: renderer unavailable', 'muted');
  }
}
