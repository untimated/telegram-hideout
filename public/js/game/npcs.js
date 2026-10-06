import { withinHours } from './clock.js';

// Who works or hangs out at the Gossip Bar, and when (Hideout time, see clock.js). NPCs simply
// appear at their spot during their hours; `activity` picks a looping pose in stage/npcs.js.
// `yaw` follows the camera convention: 0 faces -z (north), Math.PI faces the entrance.
// `y` lifts them onto platforms (bar .28, stage .4).
export const NPCS = Object.freeze([
  {
    id: 'wolfred', name: 'Wolfred', role: 'Bartender', from: 9, to: 24,
    x: -3.7, z: -4.9, y: .28, yaw: Math.PI, activity: 'serve', menu: 'bar',
    lines: ['What will it be?', 'Bar is open, friend.', 'Heard any good gossip?'],
  },
  {
    id: 'pierre', name: 'Pierre', role: 'Cook', from: 8, to: 20, chefHat: true,
    x: 3.5, z: -8, yaw: Math.PI, activity: 'serve', menu: 'food',
    lines: ['Oui? The buffet is hot.', 'Try the smash burger.', 'Nobody leaves my kitchen hungry.'],
  },
  {
    id: 'joe', name: 'Plain Joe', role: 'Regular', shifts: [[11, 15], [17, 19]],
    x: 2.78, z: -3.15, yaw: -Math.PI / 2, activity: 'sit',
    lines: ['Just having lunch.', 'Dinner time already?', 'Same table, every day.', 'The fried rice is good today.'],
  },
  {
    id: 'nicholas', name: 'Nicholas', role: 'Dancer', from: 5, to: 21,
    x: -4.9, z: 3.5, yaw: -2.2, activity: 'dance',
    lines: ['Put a song on!', 'Can you feel the beat?', 'Dance with me!'],
  },
  {
    id: 'yan', name: 'Yan', role: 'Dreamer', from: 9, to: 13,
    x: -5.85, z: 4, yaw: Math.PI / 2, activity: 'idle',
    lines: ['The pool is so calm today.', 'Look at the palms...', '...'],
  },
  {
    id: 'samantha', name: 'Samantha', role: 'Singer', from: 17, to: 23,
    x: 4.5, z: 4.8, y: .4, yaw: 0, activity: 'sing',
    lines: ['Thank you, thank you!', 'This one is for the regulars.', 'Any requests?'],
  },
  {
    id: 'stanley', name: 'Stanley', role: 'Organist', from: 17, to: 23,
    x: 2.95, z: 4.95, y: .4, yaw: .35, activity: 'play',
    lines: ['Keys warmed up.', 'C major, as always.'],
  },
  {
    id: 'harvey', name: 'Harvey', role: 'Percussionist', from: 17, to: 23,
    x: 5.6, z: 4.95, y: .4, yaw: -.35, activity: 'drum',
    lines: ['Ba-dum tss.', 'Keeping time.'],
  },
]);

export const NPC_BY_ID = new Map(NPCS.map(npc => [npc.id, npc]));

// An NPC's shifts as [from, to] pairs: 'shifts' when they come in more than once a day, else
// their single from/to.
export const npcShifts = npc => npc.shifts ?? [[npc.from, npc.to]];

// Whether an NPC is on shift at a Hideout time ({ hour, minute } from hideoutTime()).
export function npcPresent(npc, time) {
  if (typeof npc === 'string') npc = NPC_BY_ID.get(npc);
  const hour = time.hour + time.minute / 60;
  return Boolean(npc) && npcShifts(npc).some(([from, to]) => withinHours(hour, from, to));
}
