// Positions use the same metre coordinates as the scene: +y up, forward toward -z.
// Playback, server-clock seeking and mute stay with audio.js; this only routes sound.
// Effects default to full speaker separation at 30 degrees; music can use a softer curve.
const DEFAULT_FULL_PAN_DEGREES = 30;

export function createSpatialAudio() {
  let context;
  let blocked = false;
  const emitters = new Set();
  const listener = {
    position: { x: 0, y: 0, z: 0 },
    forward: { x: 0, y: 0, z: -1 },
    up: { x: 0, y: 1, z: 0 },
  };

  function panFor(emitter) {
    const { position } = emitter;
    const { forward: f, up: u } = listener;
    const dx = position.x - listener.position.x;
    const dy = position.y - listener.position.y;
    const dz = position.z - listener.position.z;
    // Camera-right is forward cross up; world x alone reverses incorrectly when turning.
    const side = dx * (f.y * u.z - f.z * u.y) + dy * (f.z * u.x - f.x * u.z) + dz * (f.x * u.y - f.y * u.x);
    const ahead = dx * f.x + dy * f.y + dz * f.z;
    // Fold the rear hemisphere so sounds behind still favour their camera-relative side.
    return Math.max(-1, Math.min(1, Math.atan2(side, Math.abs(ahead)) / emitter.fullPanAngle));
  }

  function updateEmitter(emitter) {
    // Keep the room's existing horizontal distance curve, including silence at range.
    // StereoPannerNode handles left/right balance only; distance is never applied twice.
    const distance = Math.hypot(listener.position.x - emitter.position.x, listener.position.z - emitter.position.z);
    const volume = emitter.volume * Math.max(0, 1 - distance / emitter.range);
    if (emitter.gain) {
      emitter.gain.gain.value = volume;
      // Nearby music spreads toward the centre; its directional cue strengthens farther away.
      // Apply this after angular clamping so even a source directly beside you softens nearby.
      const panFade = Math.max(0, Math.min(1, (distance - emitter.panFadeStart) / (emitter.panFadeEnd - emitter.panFadeStart)));
      const panStrength = emitter.panFadeEnd === Infinity ? 1 : .2 + .8 * panFade;
      emitter.panner.pan.value = panFor(emitter) * panStrength;
    } else {
      emitter.element.volume = volume;
    }
  }

  function connect(emitter) {
    if (!context || emitter.source) return;
    emitter.panner = context.createStereoPanner();
    // A fixture is a point source, even when its clip was recorded in stereo.
    emitter.panner.channelCount = 1;
    emitter.panner.channelCountMode = 'explicit';
    emitter.gain = context.createGain();
    emitter.source = context.createMediaElementSource(emitter.element);
    emitter.source.connect(emitter.gain);
    emitter.gain.connect(emitter.panner);
    emitter.panner.connect(context.destination);
    emitter.element.volume = 1;
    updateEmitter(emitter);
  }

  return {
    get blocked() { return blocked; },
    // Call from every user gesture: mobile browsers can suspend an unlocked context later.
    async unlock() {
      if (!context) {
        const AudioContext = globalThis.AudioContext ?? globalThis.webkitAudioContext;
        if (!AudioContext) return true; // Distance-only fallback.
        try { context = new AudioContext(); } catch { return true; }
        for (const emitter of emitters) connect(emitter);
      }
      try {
        if (context.state !== 'running') await context.resume();
        blocked = context.state !== 'running';
      } catch { blocked = true; }
      return !blocked;
    },
    setListener(position, forward = listener.forward, up = listener.up) {
      Object.assign(listener.position, { x: position.x, y: position.y ?? 0, z: position.z });
      Object.assign(listener.forward, forward);
      Object.assign(listener.up, up);
      for (const emitter of emitters) updateEmitter(emitter);
    },
    // Register each Audio element once. Reuse it for loops or sequential cues; overlapping
    // one-shots need separate elements/emitters, disposed after their last play.
    addSource(element, { position, volume = 1, range = 8, fullPanDegrees = DEFAULT_FULL_PAN_DEGREES, panFadeStart = 0, panFadeEnd = Infinity }) {
      const emitter = { element, position: { y: 0, ...position }, volume, range, fullPanAngle: fullPanDegrees * Math.PI / 180, panFadeStart, panFadeEnd };
      emitters.add(emitter);
      connect(emitter);
      updateEmitter(emitter);
      return {
        setPosition(position) {
          Object.assign(emitter.position, position);
          updateEmitter(emitter);
        },
        setVolume(volume) {
          emitter.volume = Math.max(0, Math.min(1, volume));
          updateEmitter(emitter);
        },
        dispose() {
          element.pause();
          emitter.source?.disconnect();
          emitter.gain?.disconnect();
          emitter.panner?.disconnect();
          emitters.delete(emitter);
        },
      };
    },
  };
}
