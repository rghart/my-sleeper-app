// The five power-rankings tiers, as the screen names and explains them.
//
// Which tier a team is in is decided by the backend (sleeper-player-be,
// `Intel.PowerRankings`); this is only how a tier id reads. The ids are the
// contract between the two and must match the backend's.
export const TIERS = [
    { id: 'contender', label: 'Contender', description: 'Strong now, future intact' },
    { id: 'all-in', label: 'All-in', description: 'Strong now, future spent to get there' },
    { id: 'middle', label: 'Middle', description: 'Close to the league average for now' },
    { id: 'rebuilding', label: 'Rebuilding', description: 'Weak now, but has bought picks or has depth to build from' },
    { id: 'stuck', label: 'Stuck', description: 'Weak now, with no extra picks and thin depth' },
];
