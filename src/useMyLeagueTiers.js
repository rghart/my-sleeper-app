import { useEffect, useRef, useState } from 'react';
import { myTierIn } from './lib/leagueRankings.js';

// Your power-rankings tier in every league you are in, for the menu and the
// league switcher. `{ [league_id]: tier | null }`, filled in as each league
// resolves; a league still loading is simply absent.
//
// Runs once the player database is in, because ranking needs positions to
// build lineups - before that every roster would start nobody. The value
// lists behind it are shared and cached (lib/leagueRankings.js), so six
// leagues cost six rosters and six traded-pick lists, not six of everything.
export function useMyLeagueTiers({ leagues, userId, playerInfo }) {
    const [tiers, setTiers] = useState({});
    // Read through a ref, not a dependency: App hands down a new player
    // database object on changes that have nothing to do with positions, and
    // re-ranking six leagues for each of those is what this used to do - 22
    // roster requests for six leagues, measured.
    const playerInfoRef = useRef(playerInfo);
    playerInfoRef.current = playerInfo;

    const ready = Boolean(userId && playerInfo && Object.keys(playerInfo).length > 0);
    // A string, so a fresh-but-identical league list from a re-render does
    // not refetch everything.
    const leagueKey = (leagues ?? []).map((league) => league.league_id).join(',');

    useEffect(() => {
        if (!ready || !leagueKey) return undefined;
        let cancelled = false;

        (leagues ?? []).forEach((league) => {
            myTierIn(league, { userId, playerInfo: playerInfoRef.current })
                .catch(() => undefined)
                .then((tier) => {
                    // Nothing to record when it could not be worked out; the
                    // chip is simply absent, and the next run tries again.
                    if (!cancelled && tier !== undefined) {
                        setTiers((current) => ({ ...current, [league.league_id]: tier }));
                    }
                });
        });

        return () => {
            cancelled = true;
        };
        // `leagues` is read through leagueKey; its identity changes on every
        // league load without its contents changing.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ready, leagueKey, userId]);

    return tiers;
}
