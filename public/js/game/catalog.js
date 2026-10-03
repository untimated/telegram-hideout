// Everything for sale, shared by the server (prices, effects, who must be on shift) and the
// client (menus, icons, 3D models). Effects add to the buyer's drunk and fuel meters (0..1).

export const DAILY_COINS = 100;
export const STARTING_COINS = 100;
// Slot prizes can grow a wallet without a gameplay ceiling, while coins stay exact integers.
export const MAX_COINS = Number.MAX_SAFE_INTEGER;

// Where a menu is used from. Players must stand within `reach` metres of (x, z) to order;
// `vendor` is the NPC who must be on shift; served items land on the `spots` group.
export const MENUS = Object.freeze({
  bar: {
    id: 'bar', title: 'Bar', subtitle: 'Wolfred pours', vendor: 'wolfred',
    x: -3.4, z: -3, reach: 4.5, spots: 'bar', verb: 'Order',
  },
  food: {
    id: 'food', title: 'Buffet', subtitle: "Pierre's kitchen", vendor: 'pierre',
    x: 3.5, z: -6, reach: 4.5, spots: 'table', verb: 'Order',
  },
  refreshments: {
    id: 'refreshments', title: 'Refreshments', subtitle: 'Help yourself', vendor: null,
    x: -3, z: .75, reach: 4.5, spots: 'fountain', verb: 'Take',
  },
});

// `days` limits an item to those weekdays (Hideout time); `special` puts it on the poster.
export const ITEMS = Object.freeze([
  { id: 'coffee', menu: 'bar', name: 'Coffee', price: 5, icon: '☕', drunk: -.1, fuel: .3, model: 'coffee' },
  { id: 'pint-of-beer', menu: 'bar', name: 'Pint of Beer', price: 20, icon: '🍺', drunk: .2, fuel: -.1, model: 'pint' },
  { id: 'highball', menu: 'bar', name: 'Highball', price: 30, icon: '🥃', drunk: .2, fuel: -.2, model: 'highball' },
  { id: 'mojito', menu: 'bar', name: 'Mojito', price: 40, icon: '🍹', drunk: .1, fuel: -.05, model: 'mojito' },
  { id: 'sherry', menu: 'bar', name: 'Sherry', price: 50, icon: '🍷', drunk: .2, fuel: -.2, model: 'sherry' },
  {
    id: 'saturday-special', menu: 'bar', name: "Saturday's Special", price: 50, icon: '🧉', drunk: 1, fuel: -1,
    model: 'special', days: ['saturday'], special: true, blurb: "Wolfred's house knockout. One glass and the night is over.",
  },
  {
    id: 'wednesday-special', menu: 'bar', name: "Wednesday's Special", price: 50, icon: '🧋', drunk: 1, fuel: -1,
    model: 'special', days: ['wednesday'], special: true, blurb: 'Midweek madness in a tall glass. Nap guaranteed.',
  },

  { id: 'english-breakfast', menu: 'food', name: 'English Breakfast', price: 20, icon: '🍳', drunk: -.2, fuel: .2, model: 'breakfast' },
  { id: 'uncles-fried-rice', menu: 'food', name: "Uncle's Fried Rice", price: 30, icon: '🍛', drunk: -.3, fuel: .3, model: 'rice' },
  { id: 'pierres-smash-burger', menu: 'food', name: "Pierre's Smash Burger", price: 15, icon: '🍔', drunk: -.2, fuel: .3, model: 'burger' },
  {
    id: 'saturday-challenge', menu: 'food', name: "Saturday's Challenge", price: 50, icon: '🍱', drunk: -1, fuel: 1,
    model: 'platter', days: ['saturday'], special: true, blurb: 'A platter for the brave. Finish it and you are good for the day.',
  },
  {
    id: 'thursday-challenge', menu: 'food', name: "Thursday's Challenge", price: 50, icon: '🍝', drunk: -1, fuel: 1,
    model: 'platter', days: ['thursday'], special: true, blurb: "Pierre's mountain of pasta. Sobers you up, fills you up.",
  },

  { id: 'chocolate-fondue', menu: 'refreshments', name: 'Chocolate Fondue', price: 10, icon: '🍫', drunk: 0, fuel: .15, model: 'fondue' },
  { id: 'orange-juice', menu: 'refreshments', name: 'Orange Juice', price: 5, icon: '🍊', drunk: -.05, fuel: .05, model: 'orange' },
  { id: 'apple-juice', menu: 'refreshments', name: 'Apple Juice', price: 5, icon: '🍏', drunk: -.05, fuel: .05, model: 'apple' },
]);

export const ITEM_BY_ID = new Map(ITEMS.map(item => [item.id, item]));

// Drinks are slurped, everything else is bitten (sounds, verbs).
export const isDrink = item => item.menu === 'bar' || /juice/.test(item.id);

// Whether an item is on sale on a weekday ('saturday').
export function itemAvailable(item, weekday) {
  return !item.days || item.days.includes(weekday);
}

export const JUKEBOX = Object.freeze({ x: -5.1, z: .9, reach: 4.5 });
export const SONGS = Object.freeze([
  { id: 'determined-vaporwave', title: 'Determined Vaporwave', artist: 'Catch22Music', price: 10, duration: 199, file: 'catch22music - Determined Vaporwave (96K).mp3' },
  { id: 'exploring-vaporwave', title: 'Exploring Vaporwave', artist: 'Catch22Music', price: 10, duration: 193, file: 'catch22music - Exploring Vaporwave (96K).mp3' },
  { id: 'summer-walk', title: 'Summer Walk', artist: 'Folk Acoustic', price: 10, duration: 198, file: 'Folk Accoustic - Summer Walk (96K).mp3' },
]);
export const SONG_BY_ID = new Map(SONGS.map(song => [song.id, song]));
export const AMBIENCE_FILE = 'bar-amb (96K).mp3';

// One paid live performance, shared by everyone in Gossip Bar. Duration is in seconds.
export const BAND = Object.freeze({
  id: 'band-calypso', file: 'The Undynamic Pop Experiment - Calypso (96K).mp3',
  price: 15, duration: 228.937143,
  x: 4.3, z: 4.6, reach: 4.5, members: ['samantha', 'stanley', 'harvey'],
});

// Served items sit on these surfaces until someone consumes them (y is the surface height).
export const SPOTS = Object.freeze({
  bar: [
    { id: 'bar-1', x: -4.45, y: 1.32, z: -3.72 },
    { id: 'bar-2', x: -3.85, y: 1.32, z: -3.72 },
    { id: 'bar-3', x: -3.25, y: 1.32, z: -3.72 },
    { id: 'bar-4', x: -2.65, y: 1.32, z: -3.72 },
    { id: 'bar-5', x: -2.1, y: 1.32, z: -4.15 },
    { id: 'bar-6', x: -2.1, y: 1.32, z: -5.1 },
  ],
  table: [
    // Clear of the table lamps, the decor cups (stage/art-details.js) and Plain Joe's hands.
    { id: 'table-1a', x: 3.22, y: .875, z: -5 },
    { id: 'table-1b', x: 3.98, y: .875, z: -4.6 },
    { id: 'table-2a', x: 3.62, y: .875, z: -2.72 },
    { id: 'table-2b', x: 3.97, y: .875, z: -2.95 },
    { id: 'coffee-a', x: 2.72, y: .466, z: -.08 },
    { id: 'coffee-b', x: 3.7, y: .466, z: .3 },
  ],
  fountain: [
    { id: 'fountain-1', x: -3.15, y: .84, z: 1.2 },
    { id: 'fountain-2', x: -2.75, y: .84, z: 1.2 },
    { id: 'fountain-3', x: -3.2, y: .84, z: .3 },
    { id: 'fountain-4', x: -2.8, y: .84, z: .3 },
  ],
});

// Served items go stale and are cleared after this long.
export const ITEM_LIFETIME_MS = 3 * 3600_000;
