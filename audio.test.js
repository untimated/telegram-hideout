import test from 'node:test';
import assert from 'node:assert/strict';
import { createAudio } from './public/js/audio.js';
import { SLOTS } from './public/js/game/slots.js';
import { BAND } from './public/js/game/catalog.js';

function setup(t) {
  const sounds = new Map();
  const events = new Map();
  const original = Object.fromEntries(['Audio', 'document', 'localStorage'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
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
  t.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: 10000 });
  const audio = createAudio({ serverNow: () => Date.now() });
  events.get('pointerdown')();
  const reel = sounds.get('/sfx/slot-reel.mp3');
  const payout = sounds.get('/sfx/slot-payout.mp3');
  const win = sounds.get('/sfx/casino-win.mp3');
  const fail = sounds.get('/sfx/trumpet-fail.mp3');
  const spin = (id, award = 15, age = 0) => ({ id, startedAt: Date.now() - age, payout: award });
  return { audio, reel, payout, win, fail, spin, band: sounds.get(`/music/${BAND.id}.mp3`), music: sounds.get(undefined) };
}

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

test('live band keeps default volume, resumes in sync, and never repeats a finished performance', t => {
  const { audio, band } = setup(t);
  const performance = { startedAt: Date.now() - 25000, byID: 'a' };
  audio.setMusicLevel(1);
  audio.setListener({ x: -6, z: -6 });
  audio.setBand(performance);
  assert.equal(band.volume, 1);
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
