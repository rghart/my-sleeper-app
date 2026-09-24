// Reading Sleeper's season projections as two Now sources for the power
// rankings: projected points, and redraft ADP.
//
// Pure. Each function returns a lookup from Sleeper player id to a number
// where bigger is better, which is the only shape lib/powerRankings.js asks
// of a source.

/**
 * A player's projected points under one league's scoring.
 *
 * Sleeper's stat keys are the same keys its `scoring_settings` use - `pass_td`,
 * `rec`, `bonus_rec_te`, `rec_0_4` - so scoring is a dot product over the
 * league's settings. That is what makes this better than the precomputed
 * `pts_ppr`: those exist for three stock formats, and a league with TE
 * premium or six-point passing touchdowns is none of them.
 */
export function projectedPoints(stats, scoringSettings) {
    if (!stats || !scoringSettings) return 0;
    return Object.entries(scoringSettings).reduce((sum, [key, points]) => {
        const count = stats[key];
        return typeof count === 'number' && typeof points === 'number' ? sum + count * points : sum;
    }, 0);
}

export function projectionValues(rows, scoringSettings) {
    const byId = {};
    for (const row of rows ?? []) {
        if (row?.player_id != null) byId[String(row.player_id)] = projectedPoints(row.stats, scoringSettings);
    }
    return byId;
}

// Sleeper writes 999 for "no ADP in this format".
const NO_ADP = 999;

/**
 * How deep an ADP still counts for anything. A lineup is built from the top
 * couple of hundred players in any real league; past this a player is worth
 * nothing to the ADP source, the same as one with no ADP at all.
 */
export const ADP_CEILING = 300;

/**
 * Which of Sleeper's redraft ADP columns matches a league. Superflex (and
 * two-QB) leagues draft quarterbacks so differently that `adp_2qb` is the only
 * honest column for them; otherwise the league's reception scoring picks one.
 */
export function adpKey({ superflex, ppr }) {
    if (superflex) return 'adp_2qb';
    if (ppr == null || ppr >= 1) return 'adp_ppr';
    if (ppr > 0) return 'adp_half_ppr';
    return 'adp_std';
}

/**
 * ADP as a value, bigger is better: `ADP_CEILING - adp`, floored at 0.
 *
 * Linear on purpose. It is the "sum the ranks" reading Dynasty Daddy
 * describes for its ADP model, just flipped so the best lineup is the
 * biggest number, which is what every other source here does.
 */
export function adpValues(rows, format) {
    const key = adpKey(format);
    const byId = {};
    for (const row of rows ?? []) {
        const adp = row?.stats?.[key];
        if (row?.player_id == null || typeof adp !== 'number' || adp >= NO_ADP) continue;
        byId[String(row.player_id)] = Math.max(0, ADP_CEILING - adp);
    }
    return byId;
}
