import { mapFromQuery } from './maps.js';

const GUEST_MOVE_KEY = 'hideout.guestMove';

// Returns null for ordinary chat. Commands are handled locally and never broadcast.
export function moveCommand(text, href) {
  const words = text.trim().split(/\s+/);
  if (words[0].toLowerCase() !== '/move') return null;
  const map = words.length === 2 && mapFromQuery(words[1].toLowerCase());
  if (!map) return { error: 'Use /move prototype or /move main.' };
  const url = new URL(href);
  url.searchParams.set('map', map.id);
  return { map, url: url.href };
}

// Carry the current guest across one page navigation without putting the token in the URL.
export function saveGuestMove(storage, token) {
  storage.setItem(GUEST_MOVE_KEY, token);
}

export function takeGuestMove(storage) {
  const token = storage.getItem(GUEST_MOVE_KEY);
  storage.removeItem(GUEST_MOVE_KEY);
  return token;
}
