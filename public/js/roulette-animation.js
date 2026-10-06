import { ROULETTE_POCKETS } from './game/roulette.js';

const TURN = Math.PI * 2;
const DROP_AT = .6;
const CATCH_AT = .88;
const TRACK_RADIUS = .417;
const POCKET_RADIUS = .315;
const BALL_Z = .106;
const WIN_SECONDS = 2.4;
const ease = t => t * t * (3 - 2 * t);
const wheelEase = t => 1 - (1 - t) ** 3;
const wrap = angle => ((angle % TURN) + TURN) % TURN;

// Smoothly join the free orbit to a moving pocket, including their angular speeds.
function join(from, to, fromSpeed, toSpeed, t) {
  return (2 * t ** 3 - 3 * t * t + 1) * from + (t ** 3 - 2 * t * t + t) * fromSpeed
    + (-2 * t ** 3 + 3 * t * t) * to + (t ** 3 - t * t) * toSpeed;
}

// Scripted visual preview: no collisions, wallet changes or authoritative outcome.
export function createRouletteAnimator(machine, { now = () => performance.now(), random = Math.random } = {}) {
  const { cabinet, wheel, ball, effects, lighting, winEffects } = machine.userData.roulette;
  const idleScale = cabinet?.scale.clone();
  const idleRoll = cabinet?.rotation.z;
  let spin = null;
  let win = null;

  // Like the slot machine: a squash and rebound, plus a decaying rock from the cabinet base.
  // Only the cabinet moves, so the chair and seated player stay put.
  function celebrate(age) {
    const active = age >= 0 && age < WIN_SECONDS;
    if (cabinet) {
      const squish = active && age < .9 ? .032 * Math.sin(age * TURN / .42) * Math.exp(-age * 4) : 0;
      const rock = active ? .03 * Math.sin(age * TURN / .3) * Math.exp(-age * 2.2) : 0;
      cabinet.scale.set(idleScale.x * (1 + squish * .5), idleScale.y * (1 - squish), idleScale.z * (1 + squish * .5));
      cabinet.rotation.z = idleRoll + rock;
    }
    if (active) lighting?.celebrate(age, 1 - ease(Math.max(0, (age - WIN_SECONDS + .6) / .6)));
    else lighting?.clear();
    winEffects?.update(active ? age : -1, active ? 'win' : 'loss');
  }
  // With a bet color, the preview lands on it at winChance; otherwise any pocket is equally likely.
  function pickPocket({ color, winChance } = {}) {
    if (!color || winChance === undefined) return Math.floor(random() * ROULETTE_POCKETS.length);
    const won = random() < winChance;
    const choices = [...ROULETTE_POCKETS.keys()].filter(index => (ROULETTE_POCKETS[index] === color) === won);
    return choices[Math.floor(random() * choices.length)];
  }
  function stopCelebrating() {
    if (win) celebrate(WIN_SECONDS);
    win = null;
  }

  function sample(t, position) {
    let angle, radius, hop = 0;
    if (t < DROP_AT) {
      // Launch from the previous resting position instead of teleporting to the rim.
      angle = spin.ballFrom - spin.ballTravel * (2 * t - t * t);
      radius = spin.radiusFrom + (TRACK_RADIUS - spin.radiusFrom) * ease(Math.min(1, t / .08));
    } else if (t < CATCH_AT) {
      const s = (t - DROP_AT) / (CATCH_AT - DROP_AT);
      const bounce = Math.sin(Math.PI * s) ** 2;
      const knocks = Math.sin(s * TURN * spin.bounces);
      angle = join(spin.dropAngle, spin.catchAngle, spin.dropSpeed, spin.catchSpeed, s)
        + .09 * bounce * knocks;
      radius = TRACK_RADIUS + (POCKET_RADIUS - TRACK_RADIUS) * ease(s)
        + .027 * bounce * Math.abs(knocks);
      // Depth and radial hops suggest contact with the dividers; stay behind the glass.
      hop = .009 * bounce * knocks * knocks;
    } else {
      // Captured: follow this exact pocket through the wheel's last slow fraction of a turn.
      angle = spin.wheelFrom + spin.wheelTravel * wheelEase(t) + spin.pocketAngle;
      radius = POCKET_RADIUS;
    }
    position.set(Math.cos(angle) * radius, Math.sin(angle) * radius, BALL_Z + hop);
  }

  function update(time = now()) {
    if (win) {
      const age = (time - win.startedAt) / 1000;
      celebrate(age);
      if (age >= WIN_SECONDS) win = null;
    }
    if (!spin) return;
    const t = Math.max(0, Math.min(1, (time - spin.startedAt) / spin.duration));
    wheel.rotation.z = spin.wheelFrom + spin.wheelTravel * wheelEase(t);
    sample(t, ball.position);
    effects?.update(t, spin.duration, spin.bounces, sample);
    lighting?.update(t, spin.duration);
  }

  return {
    start(duration, odds) {
      stopCelebrating();
      effects?.clear();
      lighting?.clear();
      const pocket = pickPocket(odds);
      const pocketAngle = Math.PI / 2 + pocket * TURN / ROULETTE_POCKETS.length;
      const wheelFrom = wrap(wheel.rotation.z);
      const wheelTarget = random() * TURN;
      const wheelTravel = TURN * (4 + Math.floor(random() * 3)) + wrap(wheelTarget - wheelFrom);
      const ballFrom = Math.atan2(ball.position.y, ball.position.x);
      const ballTravel = TURN * (8 + random() * 3);
      const dropAngle = ballFrom - ballTravel * (2 * DROP_AT - DROP_AT ** 2);
      const catchTarget = wheelFrom + wheelTravel * wheelEase(CATCH_AT) + pocketAngle;
      // Continue in the ball's direction for at least one more turn before pocket capture.
      const catchAngle = catchTarget - TURN * (Math.ceil((catchTarget - dropAngle) / TURN) + 1);
      const span = CATCH_AT - DROP_AT;
      spin = {
        startedAt: now(), duration, pocketAngle, wheelFrom, wheelTravel, ballFrom, ballTravel,
        radiusFrom: Math.hypot(ball.position.x, ball.position.y), dropAngle, catchAngle,
        dropSpeed: -ballTravel * 2 * (1 - DROP_AT) * span,
        catchSpeed: wheelTravel * 3 * (1 - CATCH_AT) ** 2 * span,
        bounces: 3 + Math.floor(random() * 3),
      };
      update(spin.startedAt);
      return { color: ROULETTE_POCKETS[pocket] };
    },
    update,
    // A win shakes the cabinet briefly after the ball settles.
    finish(won = false) {
      if (spin) update(spin.startedAt + spin.duration);
      spin = null;
      effects?.clear();
      lighting?.clear();
      if (won) {
        win = { startedAt: now() };
        update(win.startedAt);
      }
    },
    cancel() {
      update();
      spin = null;
      stopCelebrating();
      effects?.clear();
      lighting?.clear();
    },
  };
}
