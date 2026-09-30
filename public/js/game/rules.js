// Mood rules shared by the server (authoritative) and the client (UI hints). Both meters run 0..1.
//   drunk  starts at 0; over .5 the view blurs; at 1 the player passes out.
//   fuel   starts at 1; at 0 the player passes out.
// Every wall-clock hour a connected player sobers by .3 and burns .1 fuel. A player who was
// asleep at that hour also wakes with at least a little fuel, so nobody is stuck for good.

export const FRESH_VITALS = Object.freeze({ drunk: 0, fuel: 1 });
export const HOURLY = Object.freeze({ drunk: -.3, fuel: -.1 });
export const NAP_FUEL = .2;
export const BLUR_FROM = .5;

const clamp01 = value => Math.max(0, Math.min(1, Math.round(value * 100) / 100));

export function applyEffects(vitals, { drunk = 0, fuel = 0 }) {
  return { drunk: clamp01(vitals.drunk + drunk), fuel: clamp01(vitals.fuel + fuel) };
}

export function isAsleep({ drunk, fuel }) {
  return drunk >= 1 || fuel <= 0;
}

export function hourlyTick(vitals) {
  const napping = isAsleep(vitals);
  const next = applyEffects(vitals, HOURLY);
  if (napping) next.fuel = Math.max(next.fuel, NAP_FUEL);
  return next;
}

// Another player splashing water on a sleeper: just enough to get them back on their feet.
export function splashAwake(vitals) {
  return { drunk: Math.min(vitals.drunk, .9), fuel: Math.max(vitals.fuel, .1) };
}

// 0 below BLUR_FROM, rising to 1 at fully drunk.
export function blurAmount(drunk) {
  return Math.max(0, (drunk - BLUR_FROM) / (1 - BLUR_FROM));
}
