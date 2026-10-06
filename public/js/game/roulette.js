// Visual pocket layout only. Betting and payout rules will be added later.
export const ROULETTE_POCKETS = Object.freeze(Array.from({ length: 25 }, (_, index) =>
  index === 0 ? 'green' : index % 2 ? 'red' : 'black'));
export const ROULETTE_BETS = Object.freeze([10, 50, 100]);

// Placement, chair attachment and audio preview timing. Betting rules will be added later.
export const ROULETTE = Object.freeze({
  // Against the pool glass beside Gossip Jackpot, facing into the room.
  map: 'main', x: -6.15, z: .75, yaw: Math.PI / 2,
  seatID: 'roulette-chair', seatY: .556, seatZ: 1.03,
  spinDuration: 12565, // Measured clip length in ms; used until audio metadata loads.
  winChance: .7, // Temporary preview boost; a fair color bet would be 12/25.
});
