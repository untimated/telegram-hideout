import { SONG_BY_ID } from './game/catalog.js';

const JUKEBOX_POSITION = { x: -6.2, z: .9 };
const MUTE_KEY = 'hideout.muted';
// Jukebox volume in steps of 1..MUSIC_STEPS; the top step is the device's full volume.
const MUSIC_KEY = 'hideout.musicLevel';
export const MUSIC_STEPS = 4;

// Bar ambience plus the shared jukebox. The jukebox plays whatever the server says, seeked to the
// song's shared start time, and gets quieter away from the box. Browsers only allow sound after a
// user gesture, so both wait for the first tap/key and report when they are blocked.
export function createAudio({ serverNow, onBlocked }) {
  const ambience = new Audio('/music/ambience.mp3');
  ambience.loop = true;
  ambience.volume = .16;
  ambience.preload = 'none';
  const sfx = Object.fromEntries(['click', 'bell', 'slurp', 'bite', 'footstep'].map(name => [name, new Audio(`/sfx/${name}.mp3`)]));
  const sfxVolume = { click: .5, bell: .6, slurp: .8, bite: .8, footstep: .35 };
  const music = new Audio();
  music.preload = 'auto';
  let current = null;
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
    if (!current || muted) return;
    const song = SONG_BY_ID.get(current.song);
    const offset = offsetFor(current);
    if (!song || offset > song.duration) return;
    const seek = () => {
      music.currentTime = Math.min(offsetFor(current), Math.max(0, (music.duration || song.duration) - .5));
    };
    if (music.readyState >= 1) seek();
    else music.addEventListener('loadedmetadata', seek, { once: true });
    tryPlay(music);
  }

  function unlock() {
    if (unlocked) return;
    unlocked = true;
    onBlocked?.(false);
    if (!muted) tryPlay(ambience);
    startMusic();
  }
  for (const eventName of ['pointerdown', 'keydown']) document.addEventListener(eventName, unlock, { capture: true });

  return {
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
      ambience.volume = current ? .07 : .16;
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
      if (muted) { music.pause(); ambience.pause(); } else { unlocked = true; tryPlay(ambience); startMusic(); }
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

