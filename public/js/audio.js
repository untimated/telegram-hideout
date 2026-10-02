import { BAND, SONG_BY_ID } from './game/catalog.js';
import { SLOTS } from './game/slots.js';

const JUKEBOX_POSITION = { x: -6.2, z: .9 };
const MUTE_KEY = 'hideout.muted';
// Jukebox volume in steps of 1..MUSIC_STEPS; the top step is the device's full volume.
const MUSIC_KEY = 'hideout.musicLevel';
const SLOT_REEL_START = 2.34; // Just before the lever attack at about 2.35 seconds.
export const MUSIC_STEPS = 4;

// Shared music seeks to the server's start time. Live sets use the device's default volume;
// jukebox songs have a local volume control and distance falloff. A browser gesture unlocks sound.
export function createAudio({ serverNow, onBlocked }) {
  const ambience = new Audio('/music/ambience.mp3');
  ambience.loop = true;
  ambience.volume = .16;
  ambience.preload = 'none';
  const sfx = Object.fromEntries(['click', 'bell', 'slurp', 'bite', 'footstep'].map(name => [name, new Audio(`/sfx/${name}.mp3`)]));
  const sfxVolume = { click: .5, bell: .6, slurp: .8, bite: .8, footstep: .35 };
  const slotReel = new Audio('/sfx/slot-reel.mp3');
  const slotPayout = new Audio('/sfx/slot-payout.mp3');
  const slotWin = new Audio('/sfx/casino-win.mp3');
  const slotFail = new Audio('/sfx/trumpet-fail.mp3');
  slotReel.preload = slotPayout.preload = slotWin.preload = slotFail.preload = 'auto';
  slotReel.volume = .65;
  slotPayout.volume = .7;
  slotWin.volume = .45;
  slotFail.volume = .5;
  let slot = null;
  let slotTimer;
  let slotFalloff = 1;
  const music = new Audio();
  music.preload = 'auto';
  let current = null;
  const bandMusic = new Audio(`/music/${BAND.id}.mp3`);
  bandMusic.preload = 'auto';
  bandMusic.volume = 1;
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
  const applyMusicVolume = () => { music.volume = falloff * musicLevel / MUSIC_STEPS; };
  try { muted = localStorage.getItem(MUTE_KEY) === '1'; } catch { /* Storage unavailable. */ }

  const offsetFor = state => Math.max(0, (serverNow() - state.startedAt) / 1000);

  function tryPlay(element) {
    if (muted) return;
    element.play().then(() => onBlocked?.(false)).catch(() => { if (!unlocked) onBlocked?.(true); });
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

  function unlock() {
    if (unlocked) return;
    unlocked = true;
    onBlocked?.(false);
    if (!muted) tryPlay(ambience);
    startMusic();
    startBand();
    startSlotReel();
  }
  for (const eventName of ['pointerdown', 'keydown']) document.addEventListener(eventName, unlock, { capture: true });

  return {
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
    // Distance falloff from the jukebox; call a few times a second with the listener position.
    setListener(position) {
      if (!position) return;
      const distance = Math.hypot(position.x - JUKEBOX_POSITION.x, position.z - JUKEBOX_POSITION.z);
      falloff = Math.max(.22, Math.min(1, 1.15 - distance / 14));
      applyMusicVolume();
      ambience.volume = current || band ? .07 : .16;
      slotFalloff = Math.max(0, 1 - Math.hypot(position.x - SLOTS.x, position.z - SLOTS.z) / 8);
      slotReel.volume = .65 * slotFalloff;
      slotPayout.volume = .7 * slotFalloff;
      slotWin.volume = .45 * slotFalloff;
      slotFail.volume = .5 * slotFalloff;
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
      } else {
        unlocked = true; tryPlay(ambience); startMusic(); startBand(); startSlotReel();
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

