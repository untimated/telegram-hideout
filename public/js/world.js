import { createRobotCharacterFactory } from './characters.js';
import { buildGossipBarStage } from './stage.js';
import { DEFAULT_SPAWN, CHARACTER_SCALE, EYE_HEIGHT } from './config.js';
import { createNightSky, createGlossEnvironment } from './sky.js';

export async function createWorld({ host, input, players, getSelfID, getOrientation, onLook, isLocallyMoving, getMovement, applyMove, walkSpeed, bubbles, addDebug, guestMode, getGuestSessionToken, queueOrientation }) {
  try {
    const THREE = await import('https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js');
    const scene = new THREE.Scene();
    scene.background = createNightSky(THREE);
    scene.fog = new THREE.Fog(0x171d33, 11, 24);
    const eyeHeight = EYE_HEIGHT;
    const camera = new THREE.PerspectiveCamera(70, 1, 0.05, 130);
    camera.position.set(DEFAULT_SPAWN.x, eyeHeight, DEFAULT_SPAWN.z);
    camera.rotation.order = 'YXZ';
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
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
      if (lookPointer || event.button !== 0) return;
      input.blur();
      lookPointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
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
    const stage = buildGossipBarStage(THREE, scene, { Robot: createRobotCharacter, floorEnvironment: createGlossEnvironment(THREE, renderer) });

    function createPlayer(player) {
      return createRobotCharacter(player);
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
      scene.remove(group);
      group.traverse(object => {
        object.geometry?.dispose();
        object.material?.map?.dispose();
        object.material?.dispose();
      });
      actors.delete(id);
    }

    const resize = () => {
      const width = host.clientWidth;
      const height = host.clientHeight;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
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
    };
    for (const player of players.values()) upsertPlayer(player);
    setLocalPlayer(getSelfID());

    const clock = new THREE.Clock();
    renderer.setAnimationLoop(() => {
      const delta = Math.min(clock.getDelta(), .1);
      stage.userData.animate?.(clock.elapsedTime);
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
          // Keep the locally predicted position when input stops. Easing to
          // the last server tick here makes the player drift after keyup.
        } else {
          group.position.lerp(group.userData.target, blend);
        }
        const moving = locallyMoving || (id !== selfID && performance.now() < group.userData.walkUntil);
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
      }
      const local = actors.get(selfID);
      if (local) camera.position.set(local.position.x, eyeHeight, local.position.z);
      camera.rotation.set(orientation.pitch, orientation.yaw, 0, 'YXZ');
      camera.updateMatrixWorld();
      for (const [id, bubble] of bubbles) {
        const group = actors.get(id);
        if (!group) { bubble.element.style.display = 'none'; continue; }
        bubbleAnchor.set(group.position.x, 2.55 * CHARACTER_SCALE, group.position.z);
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
      renderer.render(scene, camera);
    });
    addDebug('three.js: first-person ready', 'muted');
    return world;
  } catch {
    addDebug('three.js: renderer unavailable', 'muted');
  }
}
