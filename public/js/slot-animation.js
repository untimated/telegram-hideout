import { SLOT_SYMBOLS, SLOTS, slotResultText } from './game/slots.js';
import { drawDisplay } from './models/slot-machine-art.js';

const TURN = Math.PI * 2;
const angleFor = symbol => TURN * (1 - (SLOT_SYMBOLS.indexOf(symbol) + .5) / SLOT_SYMBOLS.length);

// Brief uneven neon stutters, timed from the shared clock rather than frame randomness.
function marqueeBrightness(now) {
  const seconds = now / 1000;
  const cycle = Math.floor(seconds / 6.7);
  const seed = Math.sin(cycle * 12.9898) * 43758.5453;
  const time = seconds - cycle * 6.7 - (.7 + (seed - Math.floor(seed)) * 4.8);
  const dip = (start, duration) => {
    const progress = (time - start) / duration;
    return progress > 0 && progress < 1 ? Math.sin(progress * Math.PI) : 0;
  };
  const shimmer = .985 + .015 * Math.sin(seconds * 38 + Math.sin(seconds * 7) * 2);
  return shimmer * (1 - .72 * dip(0, .07) - .43 * dip(.14, .11) - .18 * dip(.32, .045));
}

export function createSlotAnimator(object, winEffects = null) {
  if (!object) return null;
  const { visuals, reels, lever, button, lights, display } = object.userData.slotMachine;
  const buttonY = button.position.y;
  const pinkIdle = lights.pink?.emissiveIntensity;
  const marqueeIdle = lights.marquee?.emissiveIntensity;
  const scaleIdle = visuals?.scale.clone();
  let spin = null;
  let paths = [];
  let displayText = '';
  function setDisplay(text) {
    if (text === displayText) return;
    displayText = text;
    drawDisplay(text, display.material.map.image);
    display.material.map.needsUpdate = true;
  }
  function update(now) {
    const age = spin ? Math.max(0, now - spin.startedAt) : 0;
    const running = !!spin && age < SLOTS.duration;
    const winAge = (age - SLOTS.duration) / 1000;
    const celebrating = spin?.payout > 0 && winAge >= 0 && winAge < (spin.kind === 'jackpot' ? 3 : 2.4);
    const flash = celebrating ? Math.sin(winAge * 16) ** 2 : 0;
    const brightness = marqueeBrightness(now);
    if (lights.marquee) {
      lights.marquee.emissiveIntensity = marqueeIdle * brightness + flash * .4;
      lights.marquee.color.setScalar(.55 + brightness * .45);
    }
    if (lights.pink) lights.pink.emissiveIntensity = pinkIdle * (.65 + brightness * .35) + flash * 1.8;
    lights.gold.emissiveIntensity = running ? .55 + .45 * Math.sin(age / 100) ** 2 : .55 + flash * 1.1;
    // A small compression, softer rebound, and quick settle after the final reel stops.
    const squish = celebrating && winAge < .9 ? .032 * Math.sin(winAge * TURN / .42) * Math.exp(-winAge * 4) : 0;
    if (visuals) visuals.scale.set(scaleIdle.x * (1 + squish * .5), scaleIdle.y * (1 - squish), scaleIdle.z * (1 + squish * .5));
    if (!spin) return;
    winEffects?.update(winAge, spin.kind);
    reels.forEach((reel, index) => {
      const progress = Math.min(1, age / (SLOTS.duration - (2 - index) * 450));
      const ease = 1 - (1 - progress) ** 3;
      const { from, to, target } = paths[index];
      reel.rotation.x = progress === 1 ? target : from + (to - from) * ease;
    });
    const pull = age < 650 ? Math.sin(Math.PI * age / 650) : 0;
    lever.rotation.x = pull * 1.1;
    button.position.y = buttonY - pull * .018;
    setDisplay(running ? 'SPINNING...' : slotResultText(spin));
  }
  return {
    setSpin(value, now) {
      if (!value) {
        spin = null;
        reels.forEach((reel, index) => { reel.rotation.x = angleFor(SLOT_SYMBOLS[index]); });
        lever.rotation.x = 0;
        button.position.y = buttonY;
        update(now);
        winEffects?.update(-1, 'loss');
        setDisplay('GOSSIP BAR');
        return;
      }
      if (spin?.id === value.id && spin?.startedAt === value.startedAt) return;
      spin = value;
      paths = reels.map((reel, index) => {
        const from = reel.rotation.x;
        const target = angleFor(spin.symbols[index]);
        const forward = ((target - from) % TURN + TURN) % TURN;
        return { from, target, to: from + forward + TURN * (5 + index) };
      });
      update(now);
    },
    update,
  };
}
