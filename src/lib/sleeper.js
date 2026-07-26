const resolveLeagueSeason = (nflState) => {
    if (nflState && nflState.league_season) {
        return nflState.league_season;
    }
    if (nflState && nflState.season) {
        return nflState.season;
    }
    return String(new Date().getFullYear());
};

const resolveMyDisplayName = (managerData, userId) => {
    if (!managerData) {
        return null;
    }
    const manager = managerData.find((manager) => manager.user_id === userId);
    return manager ? manager.display_name : null;
};

export { resolveLeagueSeason, resolveMyDisplayName };
