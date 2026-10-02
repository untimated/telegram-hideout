import { BAND } from '../game/catalog.js';
import { createJukeboxNotes } from '../models/music-notes.js';

// Reuse the stage's existing light and isolate its neon from the rest of the room.
export function buildBandEffects({ THREE, models, level, animators, now, isBandPlaying }) {
  const light = level.getObjectByName('StageWashLight');
  const glow = models.materials.neonMagenta.clone();
  level.traverse(object => {
    if (!['StagePlatform', 'StageTruss', 'StageSpeaker'].includes(object.name)) return;
    object.traverse(part => {
      if (part.material === models.materials.neonMagenta) part.material = glow;
    });
  });
  const idleColor = glow.color.clone();
  const idleEmissive = glow.emissive.clone();
  const idleLight = light.color.clone();
  const idleIntensity = light.intensity;
  const colors = [0xff3d50, 0x42ee77, 0x477dff].map(color => new THREE.Color(color));

  const notes = createJukeboxNotes(THREE, { spread: .9 });
  notes.object.name = 'BandMusicNotes';
  notes.object.position.set(BAND.x, 2.55, BAND.z - .15);
  notes.object.rotation.y = Math.PI; // Face the audience north of the stage.
  notes.object.scale.setScalar(1.2);
  level.add(notes.object);

  let wasPlaying = false;
  animators.push(time => {
    const playing = isBandPlaying();
    notes.update(time, playing);
    if (!playing) {
      if (wasPlaying) {
        light.color.copy(idleLight);
        light.intensity = idleIntensity;
        glow.color.copy(idleColor);
        glow.emissive.copy(idleEmissive);
      }
      wasPlaying = false;
      return;
    }
    wasPlaying = true;
    // Hold each RGB color, then blend gently into the next; the shared clock keeps viewers in sync.
    const phase = (now() / 2000) % colors.length;
    const index = Math.floor(phase);
    const fade = Math.max(0, (phase - index - .75) * 4);
    light.color.copy(colors[index]).lerp(colors[(index + 1) % colors.length], fade * fade * (3 - 2 * fade));
    light.intensity = idleIntensity * 1.4;
    glow.color.copy(light.color);
    glow.emissive.copy(light.color);
  });
}
