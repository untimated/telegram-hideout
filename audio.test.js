import test from 'node:test';
import assert from 'node:assert/strict';
import { createAudio } from './public/js/audio.js';
import { SLOTS } from './public/js/game/slots.js';
import { BAND } from './public/js/game/catalog.js';

function setup(t, spatial = false, unlock = true) {
  const sounds = new Map();
  const events = new Map();
  const original = Object.fromEntries(['Audio', 'AudioContext', 'document', 'localStorage'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  t.after(() => {
    for (const [key, descriptor] of Object.entries(original)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  });
  globalThis.Audio = class {
    constructor(src) {
      this.paused = true; this.currentTime = 0; this.plays = 0; this.volume = 1; this.readyState = 1;
      this.events = new Map(); sounds.set(src, this);
    }
    play() { this.paused = false; this.plays++; return Promise.resolve(); }
    pause() { this.paused = true; }
    addEventListener(event, callback) { this.events.set(event, callback); }
    removeAttribute(name) { delete this[name]; }
  };
  globalThis.document = { addEventListener: (event, callback) => events.set(event, callback) };
  globalThis.localStorage = { getItem: () => null, setItem() {} };
  const routes = [];
  if (spatial) {
    const node = () => ({ connect(next) { this.next = next; }, disconnect() {} });
    globalThis.AudioContext = class {
      state = 'running';
      destination = {};
      createGain() { return { ...node(), gain: { value: 1 } }; }
      createStereoPanner() { return { ...node(), pan: { value: 0 } }; }
      createMediaElementSource(element) {
        const source = { ...node(), element };
        routes.push(source);
        return source;
      }
    };
  }
  t.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: 10000 });
  const audio = createAudio({ serverNow: () => Date.now() });
  if (unlock) events.get('pointerdown')();
  const reel = sounds.get('/sfx/slot-reel.mp3');
  const payout = sounds.get('/sfx/slot-payout.mp3');
  const win = sounds.get('/sfx/casino-win.mp3');
  const fail = sounds.get('/sfx/trumpet-fail.mp3');
  const spin = (id, award = 15, age = 0) => ({ id, startedAt: Date.now() - age, payout: award });
  return { audio, reel, payout, win, fail, spin, routes, events,
    rouletteButton: sounds.get('/sfx/roulette-button.mp3'),
    rouletteSpin: sounds.get('/sfx/roulette-spin.mp3'),
    rouletteMusic: sounds.get('/sfx/roulette-spin-bgm.mp3'),
    holding: sounds.get('/sfx/holding-paper.mp3'), flip: sounds.get('/sfx/paper-flip.mp3'),
    band: sounds.get(`/music/${BAND.id}.mp3`), music: sounds.get(undefined) };
}

test('roulette starts both spin tracks once, restarts button cues and stops everything on exit', t => {
  const { audio, rouletteButton: button, rouletteSpin: spin, rouletteMusic: music } = setup(t);
  assert.equal(audio.rouletteSpinDuration, 12565);
  spin.duration = 12.564898;
  assert.equal(audio.rouletteSpinDuration, 12564.898);
  audio.pressRouletteButton();
  button.currentTime = .3;
  audio.pressRouletteButton();
  assert.equal(button.plays, 2);
  assert.equal(button.currentTime, 0);
  audio.setRouletteSpin(true);
  assert.equal(spin.plays, 1);
  assert.equal(music.plays, 1);
  t.mock.timers.tick(3000);
  audio.setRouletteSpin(true);
  assert.equal(spin.plays, 1, 'extra presses cannot restart the spin');
  assert.equal(music.plays, 1);
  audio.setRouletteSpin(false);
  for (const sound of [button, spin, music]) {
    assert.equal(sound.paused, true);
    assert.equal(sound.currentTime, 0);
  }
  audio.setRouletteSpin(true);
  assert.equal(spin.plays, 2, 'another round starts from the beginning');
});

test('roulette mute resumes both tracks at elapsed time and never revives a completed or closed spin', t => {
  const { audio, rouletteButton: button, rouletteSpin: spin, rouletteMusic: music } = setup(t);
  audio.setRouletteSpin(true);
  t.mock.timers.tick(1000);
  audio.toggleMute();
  audio.pressRouletteButton();
  assert.equal(button.plays, 0);
  assert.equal(spin.paused, true);
  assert.equal(music.paused, true);
  t.mock.timers.tick(2000);
  audio.toggleMute();
  assert.equal(spin.currentTime, 3);
  assert.equal(music.currentTime, 3);
  assert.equal(spin.plays, 2);
  audio.toggleMute();
  t.mock.timers.tick(12565);
  audio.toggleMute();
  assert.equal(spin.plays, 2, 'expired spin cannot replay after unmuting');
  audio.setRouletteSpin(false);
  audio.toggleMute();
  audio.toggleMute();
  assert.equal(music.plays, 2, 'closed panel cannot revive its music');
});

test('paper holding loops for one reading session and flips restart without layering', t => {
  const { audio, holding, flip } = setup(t);
  assert.equal(holding.loop, true);
  assert.equal(holding.plays, 0);
  audio.setReading(true);
  audio.flipPaper();
  assert.equal(holding.plays, 1);
  assert.equal(flip.plays, 1);
  assert.equal(flip.currentTime, .24, 'first grab skips the quiet lead-in');
  holding.currentTime = 8;
  flip.currentTime = .4;
  audio.setReading(true);
  audio.flipPaper();
  assert.equal(holding.plays, 1, 'changing a story must not restart the holding loop');
  assert.equal(holding.currentTime, 8);
  assert.equal(flip.currentTime, .24, 'each story change starts at the same trimmed position');
  assert.equal(flip.plays, 2);
  audio.setReading(false);
  assert.equal(holding.paused, true);
  assert.equal(flip.paused, true);
  assert.equal(holding.currentTime, 0);
  audio.flipPaper();
  assert.equal(flip.plays, 2, 'closed reader cannot play a flip');
  audio.setReading(true);
  assert.equal(holding.plays, 2);
});

test('muting paper sounds resumes only the holding loop if the reader remains open', t => {
  const { audio, holding, flip } = setup(t);
  audio.setReading(true);
  audio.flipPaper();
  audio.toggleMute();
  assert.equal(holding.paused, true);
  assert.equal(flip.paused, true);
  audio.flipPaper();
  assert.equal(flip.plays, 1);
  audio.toggleMute();
  assert.equal(holding.plays, 2);
  assert.equal(flip.plays, 1, 'unmuting must not replay an old page turn');
  audio.toggleMute();
  audio.setReading(false);
  audio.toggleMute();
  assert.equal(holding.paused, true);
  assert.equal(holding.plays, 2, 'closed reader stays silent after unmuting');
});

test('holding waits for a browser gesture and cannot revive after the reader closes', t => {
  const { audio, holding, flip, events } = setup(t, false, false);
  audio.setReading(true);
  audio.flipPaper();
  assert.equal(holding.plays, 0);
  assert.equal(flip.plays, 0);
  events.get('pointerdown')();
  assert.equal(holding.plays, 1);
  audio.setReading(false);
  events.get('keydown')();
  assert.equal(holding.paused, true);
});

test('jukebox music is routed to stereo, retaining local volume, distance and shared playback', t => {
  const { audio, music, routes } = setup(t, true);
  const musicRoute = routes.find(route => route.element === music);
  assert.ok(musicRoute, 'the jukebox song must actually reach the spatial graph');
  const gain = musicRoute.next.gain;
  const pan = musicRoute.next.next.pan;
  audio.setListener({ x: -5.2, y: 1.3, z: .9 }, { x: 0, y: 0, z: -1 });
  audio.setJukebox({ song: 'determined-vaporwave', startedAt: Date.now(), byID: 'a' });
  assert.equal(pan.value, -.2, 'nearby jukebox panning stays gentle');
  assert.equal(gain.value, .5);
  assert.equal(music.volume, 1, 'gain node owns volume after routing');
  const radians = degrees => degrees * Math.PI / 180;
  // Face the box (-x), then turn slightly so it lies six/twelve degrees to the right.
  audio.setListener({ x: -5.2, y: 1.2, z: .9 }, { x: -Math.cos(radians(6)), y: 0, z: Math.sin(radians(6)) });
  assert.ok(Math.abs(pan.value - .03) < 1e-6);
  audio.setListener({ x: -5.2, y: 1.2, z: .9 }, { x: -Math.cos(radians(12)), y: 0, z: Math.sin(radians(12)) });
  assert.ok(Math.abs(pan.value - .06) < 1e-6, 'small nearby head turns keep music near the centre');
  audio.setMusicLevel(1);
  assert.equal(gain.value, .25);
  audio.setListener({ x: -5.2, y: 1.3, z: .9 }, { x: 0, y: 0, z: 1 });
  assert.equal(pan.value, .2);
  assert.equal(music.plays, 1, 'head turns do not restart the shared song');
  audio.setListener({ x: -.2, y: 1.3, z: .9 });
  assert.ok(Math.abs(pan.value - .6) < 1e-6, 'six metres away retains 60 percent of the stereo bias');
  assert.ok(Math.abs(gain.value - (1.15 - 6 / 14) / 4) < 1e-6, 'pan fading does not change the volume curve');
  audio.setListener({ x: 20, y: 1.3, z: .9 });
  assert.equal(pan.value, 1, 'distant music reaches full directional bias');
  audio.setListener({ x: 20, y: 1.3, z: .9 }, { x: 0, y: 0, z: -1 });
  assert.equal(pan.value, -1, 'distant panning still swaps correctly when turning');
  assert.equal(gain.value, .22 / 4, 'the jukebox retains its distant volume floor');
  audio.toggleMute();
  assert.equal(music.paused, true);
  t.mock.timers.tick(2000);
  audio.toggleMute();
  assert.equal(music.currentTime, 2);
  assert.equal(music.paused, false);
});

test('slot audio skips the lever lead-in and plays the correct win or loss cue at the reel stop', t => {
  const { audio, reel, payout, win, fail, spin } = setup(t);
  const first = spin(1);
  audio.setSlotSpin(first, true);
  assert.equal(reel.currentTime, 2.34);
  assert.equal(reel.paused, false);
  audio.setSlotSpin(first, true);
  assert.equal(reel.plays, 1);
  t.mock.timers.tick(SLOTS.duration - 1);
  assert.equal(payout.plays, 0);
  assert.equal(win.plays, 0);
  t.mock.timers.tick(1);
  assert.equal(reel.paused, true);
  assert.equal(payout.plays, 1);
  assert.equal(win.plays, 1);
  assert.equal(fail.plays, 0);
  audio.setSlotSpin(spin(2, 0), true);
  t.mock.timers.tick(SLOTS.duration - 1);
  assert.equal(fail.plays, 0);
  t.mock.timers.tick(1);
  assert.equal(payout.plays, 1);
  assert.equal(win.plays, 1);
  assert.equal(fail.plays, 1);
  assert.equal(reel.paused, true);
});

test('slot mute, distance, reconnects and cancelled spins do not replay stale awards', t => {
  const { audio, reel, payout, win, spin } = setup(t);
  audio.setListener({ x: SLOTS.x + 4, z: SLOTS.z });
  assert.equal(reel.volume, .325);
  assert.equal(payout.volume, .35);
  assert.equal(win.volume, .225);
  audio.setSlotSpin(spin(1), true);
  t.mock.timers.tick(1000);
  audio.toggleMute();
  assert.equal(reel.paused, true);
  t.mock.timers.tick(SLOTS.duration);
  assert.equal(payout.plays, 0);
  assert.equal(win.plays, 0);
  audio.toggleMute();
  assert.equal(reel.plays, 1);
  audio.setSlotSpin(spin(2, 60, SLOTS.duration + 10));
  assert.equal(payout.plays, 0);
  audio.setSlotSpin(spin(3, 30, 1000));
  assert.ok(Math.abs(reel.currentTime - 3.34) < .000001);
  t.mock.timers.tick(SLOTS.duration - 1000);
  assert.equal(payout.plays, 1);
  assert.equal(win.plays, 1);
  audio.setSlotSpin(spin(4), true);
  audio.setSlotSpin(null);
  t.mock.timers.tick(SLOTS.duration);
  assert.equal(reel.paused, true);
  assert.equal(payout.paused, true);
  assert.equal(win.paused, true);
  assert.equal(payout.plays, 1);
  assert.equal(win.plays, 1);
});

test('loss trumpet follows mute and distance and does not replay old or cancelled results', t => {
  const { audio, fail, spin } = setup(t);
  audio.setListener({ x: SLOTS.x + 4, z: SLOTS.z });
  assert.equal(fail.volume, .25);
  audio.setSlotSpin(spin(1, 0), true);
  audio.toggleMute();
  t.mock.timers.tick(SLOTS.duration);
  assert.equal(fail.plays, 0);
  audio.toggleMute();
  audio.setSlotSpin(spin(2, 0, SLOTS.duration + 10));
  assert.equal(fail.plays, 0);
  audio.setSlotSpin(spin(3, 0, 1000));
  t.mock.timers.tick(SLOTS.duration - 1000);
  assert.equal(fail.plays, 1);
  audio.toggleMute();
  assert.equal(fail.paused, true);
  audio.toggleMute();
  audio.setSlotSpin(spin(4, 0), true);
  audio.setSlotSpin(null);
  t.mock.timers.tick(SLOTS.duration);
  assert.equal(fail.plays, 1);
  audio.setSlotSpin(spin(5, 0, SLOTS.duration + 1600), true);
  assert.equal(fail.plays, 1);
});

test('live band fades with distance, resumes in sync, and never repeats a finished performance', t => {
  const { audio, band } = setup(t);
  const performance = { startedAt: Date.now() - 25000, byID: 'a' };
  audio.setMusicLevel(1);
  audio.setListener({ x: -6, z: -6 });
  audio.setBand(performance);
  assert.equal(band.volume, .22);
  assert.equal(band.currentTime, 25);
  assert.equal(band.plays, 1);
  audio.setBand({ ...performance }); // A reconnect snapshot must not restart the same set.
  assert.equal(band.plays, 1);
  t.mock.timers.tick(5000);
  audio.toggleMute();
  assert.equal(band.paused, true);
  t.mock.timers.tick(3000);
  audio.toggleMute();
  assert.equal(band.currentTime, 33);
  assert.equal(band.plays, 2);
  t.mock.timers.tick(Math.ceil(BAND.duration * 1000));
  assert.equal(band.paused, true);
  audio.setBand(performance);
  audio.toggleMute();
  audio.toggleMute();
  assert.equal(band.plays, 2);
  audio.setBand({ startedAt: Date.now(), byID: 'b' });
  assert.equal(band.currentTime, 0);
  assert.equal(band.plays, 3);
});

test('live band pans from the stage, gently nearby and strongly farther away', t => {
  const { audio, band, routes } = setup(t, true);
  const bandRoute = routes.find(route => route.element === band);
  assert.ok(bandRoute, 'the live performance must reach the spatial graph');
  const gain = bandRoute.next.gain;
  const pan = bandRoute.next.next.pan;
  audio.setListener({ x: BAND.x + 1, y: 1.6, z: BAND.z }, { x: 0, y: 0, z: -1 });
  audio.setBand({ startedAt: Date.now(), byID: 'a' });
  assert.equal(pan.value, -.2);
  assert.equal(gain.value, 1);
  audio.setMusicLevel(1);
  assert.equal(gain.value, 1, 'jukebox volume steps do not turn down the band');
  audio.setListener({ x: BAND.x + 6, y: 1.6, z: BAND.z });
  assert.ok(Math.abs(pan.value + .6) < 1e-6);
  assert.ok(Math.abs(gain.value - (1.15 - 6 / 14)) < 1e-6);
  audio.setListener({ x: BAND.x + 10, y: 1.6, z: BAND.z });
  assert.equal(pan.value, -1);
  audio.setListener({ x: BAND.x + 10, y: 1.6, z: BAND.z }, { x: 0, y: 0, z: 1 });
  assert.equal(pan.value, 1);
  assert.equal(band.plays, 1, 'movement and looking do not restart the performance');
  audio.setListener({ x: BAND.x + 20, y: 1.6, z: BAND.z });
  assert.equal(gain.value, .22, 'the live set remains audible across the room');
});

test('live band waits for metadata, does not start a stale set, and takes priority over the jukebox', t => {
  const { audio, band, music } = setup(t);
  audio.setJukebox({ song: 'determined-vaporwave', startedAt: Date.now(), byID: 'a' });
  assert.equal(music.paused, false);
  band.readyState = 0;
  const performance = { startedAt: Date.now() - 5000, byID: 'a' };
  audio.setBand(performance);
  assert.equal(music.paused, true);
  assert.equal(band.plays, 0);
  t.mock.timers.tick(3000);
  band.readyState = 1;
  band.events.get('loadedmetadata')();
  assert.equal(band.currentTime, 8);
  assert.equal(band.plays, 1);
  audio.setJukebox({ song: 'summer-walk', startedAt: Date.now(), byID: 'b' });
  assert.equal(music.paused, true);
  t.mock.timers.tick(1000);
  audio.setBand(null);
  assert.equal(music.paused, false);
  assert.equal(music.currentTime, 1);
  band.readyState = 0;
  audio.setBand({ startedAt: Date.now(), byID: 'b' });
  t.mock.timers.tick(Math.ceil(BAND.duration * 1000));
  band.readyState = 1;
  band.events.get('loadedmetadata')();
  assert.equal(band.paused, true);
  assert.equal(band.plays, 1);
  assert.equal(music.paused, true); // Its own shared song has also finished.
});
