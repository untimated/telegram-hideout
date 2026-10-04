// Shared presentation for the bulletin-board texture and the live ranking panel.
export function leaderboardRankings(spenders = [], visitors = []) {
  return [
    {
      title: 'Top Spenders', metric: 'Coins', note: 'TOTAL SPENT', empty: 'No spending yet',
      entries: spenders.map(entry => ({ name: entry.name, value: entry.spent.toLocaleString('en-US') })),
    },
    {
      title: 'Top Visitors', metric: 'Visits', note: 'ONCE PER HIDEOUT DAY', empty: 'No visits yet',
      entries: visitors.map(entry => ({ name: entry.name, value: entry.visits.toLocaleString('en-US') })),
    },
  ];
}
