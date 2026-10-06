import { BAND, SONG_BY_ID } from './game/catalog.js';
import { SLOTS } from './game/slots.js';
import { ROULETTE } from './game/roulette.js';
import { createSpatialAudio } from './spatial-audio.js';

const JUKEBOX_POSITION = { x: -6.2, z: 2.3 };
const MUSIC_PANNING = { fullPanDegrees: 40, panFadeStart: 2, panFadeEnd: 10 };
const MUTE_KEY = 'hideout.muted';
// Jukebox volume in steps of 1..MUSIC_STEPS; the top step is the device's full volume.
const MUSIC_KEY = 'hideout.musicLevel';
const SLOT_REEL_START = 2.34; // Just before the lever attack at about 2.35 seconds.
const PAPER_FLIP_START = .24; // About 20% into the 1.2-second clip, skipping the quiet lead-in.
export const MUSIC_STEPS = 4;

// Shared music seeks to the server's start time. Both music sources fade with distance;
// jukebox songs also have a local volume control. A browser gesture unlocks sound.
export function createAudio({ serverNow, onBlocked }) {
  const spatial = createSpatialAudio();
  const ambience = new Audio('/music/ambience.mp3');
  ambience.loop = true;
  ambience.volume = .16;
  ambience.preload = 'none';
  const sfx = Object.fromEntries(['click', 'bell', 'slurp', 'bite', 'footstep'].map(name => [name, new Audio(`/sfx/${name}.mp3`)]));
  const sfxVolume = { click: .5, bell: .6, slurp: .8, bite: .8, footstep: .35 };
  const holdingPaper = new Audio('/sfx/holding-paper.mp3');
  holdingPaper.loop = true;
  holdingPaper.volume = .25;
  const paperFlip = new Audio('/sfx/paper-flip.mp3');
  paperFlip.volume = .6;
  holdingPaper.preload = paperFlip.preload = 'auto';
  let reading = false;
  const slotReel = new Audio('/sfx/slot-reel.mp3');
  const slotPayout = new Audio('/sfx/slot-payout.mp3');
  const slotWin = new Audio('/sfx/casino-win.mp3');
  const slotFail = new Audio('/sfx/trumpet-fail.mp3');
  slotReel.preload = slotPayout.preload = slotWin.preload = slotFail.preload = 'auto';
  for (const [element, volume] of [[slotReel, .65], [slotPayout, .7], [slotWin, .45], [slotFail, .5]]) {
    spatial.addSource(element, { position: { x: SLOTS.x, y: 1.2, z: SLOTS.z }, volume, range: 8 });
  }
  let slot = null;
  let slotTimer;
  const rouletteButton = new Audio('/sfx/roulette-button.mp3');
  const rouletteCoin = new Audio('/sfx/roulette-coin.mp3');
  const rouletteSpin = new Audio('/sfx/roulette-spin.mp3');
  const rouletteMusic = new Audio('/sfx/roulette-spin-bgm.mp3');
  const rouletteWin = new Audio('/sfx/roulette-win.mp3');
  const rouletteFail = new Audio('/sfx/roulette-fail.mp3');
  for (const [element, volume] of [[rouletteButton, .6], [rouletteCoin, .6], [rouletteSpin, .65], [rouletteMusic, .4], [rouletteWin, .7], [rouletteFail, .5]]) {
    element.preload = 'auto';
    spatial.addSource(element, { position: { x: ROULETTE.x, y: .8, z: ROULETTE.z }, volume, range: 8 });
  }
  let rouletteStartedAt = null;
  const rouletteDuration = () => Number.isFinite(rouletteSpin.duration) && rouletteSpin.duration > 0
    ? rouletteSpin.duration * 1000 : ROULETTE.spinDuration;
  const music = new Audio();
  music.preload = 'auto';
  let current = null;
  const bandMusic = new Audio(`/music/${BAND.id}.mp3`);
  bandMusic.preload = 'auto';
  const bandEmitter = spatial.addSource(bandMusic, {
    position: { x: BAND.x, y: 1.6, z: BAND.z }, volume: 1, range: Infinity, ...MUSIC_PANNING,
  });
  let band = null;
  let bandTimer;
  let unlocked = false;
  let muted = false;
  let musicLevel = 2;
  let falloff = 1;
  try {
    const saved = Number(localStorage.getItem(MUSIC_KEY));
    if (Number.isInteger(saved) && saved >= 1 && saved <= MUSIC_STEPS) musicLevel = saved;
  } catch { /* Storage unavailable. */ }
  // This song keeps its own distance curve and volume steps; the shared layer pans it.
  const jukeboxEmitter = spatial.addSource(music, {
    position: { ...JUKEBOX_POSITION, y: 1.2 }, volume: musicLevel / MUSIC_STEPS, range: Infinity,
    ...MUSIC_PANNING,
  });
  const applyMusicVolume = () => jukeboxEmitter.setVolume(falloff * musicLevel / MUSIC_STEPS);
  const volumeAt = (position, source) => Math.max(.22, Math.min(1, 1.15 - Math.hypot(position.x - source.x, position.z - source.z) / 14));
  try { muted = localStorage.getItem(MUTE_KEY) === '1'; } catch { /* Storage unavailable. */ }

  const offsetFor = state => Math.max(0, (serverNow() - state.startedAt) / 1000);

  function tryPlay(element) {
    if (muted) return;
    element.play().then(() => onBlocked?.(spatial.blocked)).catch(() => { if (!unlocked || spatial.blocked) onBlocked?.(true); });
  }

  function startReading() {
    if (reading && unlocked && !muted && holdingPaper.paused) tryPlay(holdingPaper);
  }

  function startMusic() {
    if (!current || !unlocked || muted || (band && offsetFor(band) < BAND.duration)) return;
    const song = SONG_BY_ID.get(current.song);
    const state = current;
    const offset = offsetFor(current);
    if (!song || offset >= song.duration) return;
    const seek = () => {
      if (current !== state || muted || (band && offsetFor(band) < BAND.duration)) return;
      music.currentTime = Math.min(offsetFor(current), Math.max(0, (music.duration || song.duration) - .5));
    };
    if (music.readyState >= 1) seek();
    else music.addEventListener('loadedmetadata', seek, { once: true });
    tryPlay(music);
  }

  function startBand() {
    if (!band || !unlocked || muted || bandMusic.readyState < 1) return;
    const elapsed = offsetFor(band);
    if (elapsed >= Math.min(BAND.duration, bandMusic.duration || BAND.duration)) return;
    bandMusic.currentTime = elapsed;
    tryPlay(bandMusic);
  }
  bandMusic.addEventListener('loadedmetadata', startBand);

  function finishBand() {
    bandMusic.pause();
    band = null;
    // The jukebox clock keeps running during the set; resume only its remaining music.
    startMusic();
  }

  function startSlotReel() {
    if (!slot || !unlocked || muted) return;
    const elapsed = offsetFor(slot);
    if (elapsed * 1000 >= SLOTS.duration) return;
    // Seek into the clip as well as the shared spin, so joining mid-spin skips the lever.
    slotReel.currentTime = SLOT_REEL_START + elapsed;
    tryPlay(slotReel);
  }

  function finishSlot() {
    slotReel.pause();
    // Do not play an old result after a suspended tab wakes much later.
    if (!slot || !unlocked || muted || offsetFor(slot) * 1000 > SLOTS.duration + 1500) return;
    if (slot.payout > 0) {
      slotPayout.currentTime = 0;
      slotWin.currentTime = 0;
      tryPlay(slotWin);
      tryPlay(slotPayout);
    } else {
      slotFail.currentTime = 0;
      tryPlay(slotFail);
    }
  }

  function startRouletteSpin() {
    if (rouletteStartedAt === null || !unlocked || muted) return;
    const elapsed = (Date.now() - rouletteStartedAt) / 1000;
    if (elapsed * 1000 >= rouletteDuration()) return;
    for (const element of [rouletteSpin, rouletteMusic]) {
      element.currentTime = elapsed;
      tryPlay(element);
    }
  }

  function unlock() {
    spatial.unlock().then(ready => { if (!muted) onBlocked?.(!ready); });
    if (unlocked) return;
    unlocked = true;
    onBlocked?.(false);
    if (!muted) tryPlay(ambience);
    startMusic();
    startBand();
    startSlotReel();
    startReading();
    startRouletteSpin();
  }
  for (const eventName of ['pointerdown', 'keydown']) document.addEventListener(eventName, unlock, { capture: true });

  return {
    // Cabinet presses retrigger one cue; spamming never builds up overlapping copies.
    pressRouletteButton() {
      if (!unlocked || muted) return;
      rouletteButton.currentTime = 0;
      tryPlay(rouletteButton);
    },
    addRouletteCoin() {
      if (!unlocked || muted) return;
      rouletteCoin.currentTime = 0;
      tryPlay(rouletteCoin);
    },
    get rouletteSpinDuration() { return rouletteDuration(); },
    // Local preview audio follows the seated panel lifetime and shares its result delay.
    setRouletteSpin(active) {
      if (active) {
        if (rouletteStartedAt !== null) return;
        rouletteWin.pause();
        rouletteFail.pause();
        rouletteStartedAt = Date.now();
        startRouletteSpin();
      } else {
        rouletteStartedAt = null;
        for (const element of [rouletteButton, rouletteCoin, rouletteSpin, rouletteMusic, rouletteWin, rouletteFail]) {
          element.pause();
          element.currentTime = 0;
        }
      }
    },
    // A boolean plays that preview outcome; null clears it when starting another bet.
    setRouletteResult(won) {
      for (const element of [rouletteWin, rouletteFail]) {
        element.pause();
        element.currentTime = 0;
      }
      if (typeof won !== 'boolean' || !unlocked || muted) return;
      tryPlay(won ? rouletteWin : rouletteFail);
    },
    // Local reader sounds follow panel lifetime, independently of shared room music.
    setReading(active) {
      if (reading === active) return;
      reading = active;
      if (reading) {
        holdingPaper.currentTime = 0;
        startReading();
      } else {
        holdingPaper.pause();
        paperFlip.pause();
        holdingPaper.currentTime = paperFlip.currentTime = 0;
      }
    },
    flipPaper() {
      if (!reading || !unlocked || muted) return;
      paperFlip.currentTime = PAPER_FLIP_START;
      tryPlay(paperFlip);
    },
    // There is no stop/restart control: only the server can start a paid performance.
    setBand(state) {
      if (state?.startedAt === band?.startedAt && state?.byID === band?.byID) return;
      clearTimeout(bandTimer);
      bandMusic.pause();
      band = state;
      const remaining = state ? BAND.duration * 1000 - offsetFor(state) * 1000 : 0;
      if (remaining <= 0) { finishBand(); return; }
      music.pause();
      if (unlocked) startBand();
      else onBlocked?.(true);
      bandTimer = setTimeout(finishBand, remaining);
    },
    // Snapshots resume an active spin but never replay a completed result.
    setSlotSpin(state, live = false) {
      if (state && slot?.id === state.id && slot?.startedAt === state.startedAt) return;
      clearTimeout(slotTimer);
      slotReel.pause();
      slotPayout.pause();
      slotWin.pause();
      slotFail.pause();
      slot = state;
      if (!slot) return;
      const remaining = SLOTS.duration - offsetFor(slot) * 1000;
      if (remaining <= 0) { if (live) finishSlot(); return; }
      startSlotReel();
      slotTimer = setTimeout(finishSlot, remaining);
    },
    // state is { song, startedAt, by } or null.
    setJukebox(state) {
      const changed = state?.song !== current?.song || state?.startedAt !== current?.startedAt;
      current = state;
      if (!state) { music.pause(); music.removeAttribute('src'); return; }
      if (changed) music.src = `/music/${state.song}.mp3`;
      if (unlocked) startMusic();
      else onBlocked?.(true);
    },
    // The world supplies the player camera's predicted position, forward and up every frame.
    setListener(position, forward, up) {
      if (!position) return;
      spatial.setListener(position, forward, up);
      falloff = volumeAt(position, JUKEBOX_POSITION);
      applyMusicVolume();
      bandEmitter.setVolume(volumeAt(position, BAND));
      ambience.volume = current || band ? .07 : .16;
    },
    get muted() { return muted; },
    get musicLevel() { return musicLevel; },
    setMusicLevel(level) {
      musicLevel = Math.max(1, Math.min(MUSIC_STEPS, Math.round(level)));
      try { localStorage.setItem(MUSIC_KEY, String(musicLevel)); } catch { /* Storage unavailable. */ }
      applyMusicVolume();
    },
    toggleMute() {
      muted = !muted;
      try { localStorage.setItem(MUTE_KEY, muted ? '1' : '0'); } catch { /* Storage unavailable. */ }
      if (muted) {
        music.pause(); bandMusic.pause(); ambience.pause(); slotReel.pause(); slotPayout.pause(); slotWin.pause(); slotFail.pause();
        holdingPaper.pause(); paperFlip.pause();
        rouletteButton.pause(); rouletteSpin.pause(); rouletteMusic.pause();
        rouletteCoin.pause(); rouletteWin.pause(); rouletteFail.pause();
      } else {
        spatial.unlock().then(ready => onBlocked?.(!ready));
        unlocked = true; tryPlay(ambience); startMusic(); startBand(); startSlotReel();
        startReading();
        startRouletteSpin();
      }
      return muted;
    },
    // Short sounds ('click', 'bell', 'slurp', 'bite') at a 0..1 loudness; overlapping plays are fine.
    sfx(name, loudness = 1, rate = 1) {
      if (muted) return;
      const sound = sfx[name];
      if (!sound) return;
      const copy = sound.paused ? sound : sound.cloneNode();
      copy.volume = Math.max(0, Math.min(1, sfxVolume[name] * loudness));
      copy.currentTime = 0;
      copy.playbackRate = rate;
      copy.play().catch(() => {});
    },
    progress() {
      if (!current) return null;
      const song = SONG_BY_ID.get(current.song);
      return { song, elapsed: Math.min(song.duration, offsetFor(current)) };
    },
  };
}

