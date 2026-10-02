// Shared rules and placement for Gossip Bar's single machine.
export const SLOT_SYMBOLS = Object.freeze(['beer', 'robot', 'jukebox', 'fountain', 'coin', 'gossip']);
export const SLOTS = Object.freeze({
  minBet: 7, duration: 3200, x: -6.15, z: -.6, yaw: Math.PI / 2, map: 'main', jackpot: 'gossip',
  lossFuel: .02,
  odds: Object.freeze({ pair: 20, triple: 10, jackpot: 5, loss: 65 }),
  payouts: Object.freeze({ pair: 3, triple: 6, jackpot: 12, loss: 0 }),
});

// No gameplay bet ceiling: only the balance and exact whole-coin arithmetic limit it.
export const maxSlotBet = coins => Math.min(coins, Math.floor((Number.MAX_SAFE_INTEGER - coins) / (SLOTS.payouts.jackpot - 1)));

// The server secures the award immediately; reveal it in the HUD at the final reel stop.
export function slotDisplayCoins(self, now) {
  const pending = self.pendingSlotPayout;
  return pending && now < pending.revealAt ? Math.max(0, self.coins - pending.amount) : self.coins;
}

// Choose the award first, so the stated odds do not depend on the number of reel symbols.
// Outcomes are exclusive: 20% pair, 10% triple, 5% jackpot, 65% loss.
export function rollSlots(bet = SLOTS.minBet, random = Math.random) {
  const pick = values => values[Math.floor(random() * values.length)];
  const regular = SLOT_SYMBOLS.filter(symbol => symbol !== SLOTS.jackpot);
  const chance = random() * 100;
  if (chance < SLOTS.odds.pair) {
    const symbol = pick(regular);
    const other = pick(SLOT_SYMBOLS.filter(value => value !== symbol));
    const symbols = [symbol, symbol, symbol];
    symbols[Math.floor(random() * 3)] = other;
    return { kind: 'pair', symbols, payout: bet * SLOTS.payouts.pair };
  }
  if (chance < SLOTS.odds.pair + SLOTS.odds.triple) {
    const symbol = pick(regular);
    return { kind: 'triple', symbols: [symbol, symbol, symbol], payout: bet * SLOTS.payouts.triple };
  }
  if (chance < SLOTS.odds.pair + SLOTS.odds.triple + SLOTS.odds.jackpot) {
    return { kind: 'jackpot', symbols: Array(3).fill(SLOTS.jackpot), payout: bet * SLOTS.payouts.jackpot };
  }
  const remaining = [...SLOT_SYMBOLS];
  const symbols = Array.from({ length: 3 }, () => remaining.splice(Math.floor(random() * remaining.length), 1)[0]);
  return { kind: 'loss', symbols, payout: 0 };
}

export function slotResultText(spin) {
  if (spin.kind === 'jackpot') return `JACKPOT! ${spin.payout} coins`;
  if (spin.kind === 'pair') return `Two match! ${spin.payout} coins`;
  if (spin.kind === 'triple') return `Three match! ${spin.payout} coins`;
  return 'No match this time';
}
