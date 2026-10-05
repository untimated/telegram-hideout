// Every place a player can sit, shared by the server (one sitter per seat) and the client (picking,
// seated pose). (x, z) is where the sitter's hips go, y the top of the cushion, yaw the direction
// they face (camera convention: 0 faces -z). Must match the furniture placed in stage/bar.js and
// stage/lounge.js. `npc` marks a seat an NPC uses during their shift.
import { FOUNTAIN } from '../stage/layout.js';
import { ROULETTE } from './roulette.js';

const STOOL_TOP = .28 + .73; // bar platform + stool cushion
const CHAIR_TOP = .51;
const SOFA_TOP = .47;
const CUBE_TOP = .475;

const faceFountain = (x, z) => Math.atan2(-(FOUNTAIN.x - x), -(FOUNTAIN.z - z));

export const SEATS = Object.freeze([
  { id: ROULETTE.seatID, label: 'Roulette chair', kind: 'chair', map: ROULETTE.map,
    x: ROULETTE.x + Math.sin(ROULETTE.yaw) * ROULETTE.seatZ,
    z: ROULETTE.z + Math.cos(ROULETTE.yaw) * ROULETTE.seatZ,
    y: ROULETTE.seatY, yaw: ROULETTE.yaw },
  ...[-4.6, -3.5, -2.4].map((x, index) => ({ id: `stool-front-${index + 1}`, label: 'Bar stool', kind: 'stool', x, z: -3, y: STOOL_TOP, yaw: 0 })),
  ...[-5.4, -4.6, -3.8].map((z, index) => ({ id: `stool-side-${index + 1}`, label: 'Bar stool', kind: 'stool', x: -1.1, z, y: STOOL_TOP, yaw: Math.PI / 2 })),
  ...[-4.8, -3.15].flatMap((z, row) => [
    { id: `cafe-${row + 1}w`, label: 'Café chair', kind: 'chair', x: 2.6, z, y: CHAIR_TOP, yaw: -Math.PI / 2, ...(row === 1 ? { npc: 'joe' } : {}) },
    { id: `cafe-${row + 1}e`, label: 'Café chair', kind: 'chair', x: 4.6, z, y: CHAIR_TOP, yaw: Math.PI / 2 },
  ]),
  ...[[-3.5, -1.25], [-2.3, -1.25], [-.6, .05], [-.6, 1.25]].map(([x, z], index) => (
    { id: `cube-${index + 1}`, label: 'Seat', kind: 'cube', x, z, y: CUBE_TOP, yaw: faceFountain(x, z) })),
  // Sofas: north one faces south, south one faces north (three places each), east one faces west.
  ...[2.467, 3.2, 3.933].map((x, index) => ({ id: `sofa-north-${index + 1}`, label: 'Sofa', kind: 'sofa', x, z: -1.3, y: SOFA_TOP, yaw: Math.PI })),
  ...[2.467, 3.2, 3.933].map((x, index) => ({ id: `sofa-south-${index + 1}`, label: 'Sofa', kind: 'sofa', x, z: 1.55, y: SOFA_TOP, yaw: 0 })),
  ...[-.23, .47].map((z, index) => ({ id: `sofa-east-${index + 1}`, label: 'Sofa', kind: 'sofa', x: 5.85, z, y: SOFA_TOP, yaw: Math.PI / 2 })),
]);

export const SEAT_BY_ID = new Map(SEATS.map(seat => [seat.id, seat]));
