// Bulletin board prop for the Gossip Jackpot Leaderboard.
export function buildLeaderboard({ models, place, interactable }, x, z, yaw = 0) {
  const board = place(models.Leaderboard(), x, 0, z, yaw);
  const approach = { x: x + Math.sin(yaw) * 1.4, z: z + Math.cos(yaw) * 1.4, yaw };
  interactable('leaderboard', board, {
    label: 'View Rankings',
    approach,
    action: { type: 'leaderboard' },
  });
  return board;
}
