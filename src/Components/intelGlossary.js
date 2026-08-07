// What every leaguemate-intel number means, in one place
// (docs/leaguemate-intel.md §3 Frontend).
//
// The naming here is the settled decision, not a preference: `ADP` is
// dynasty-wide and `League ADP` is your leaguemates. One label doing both
// jobs was the single biggest source of confusion in testing - and the gap
// between the two is the only number here that says "your circle disagrees
// with the market about this guy", which is the product.

export const TERMS = {
    still: {
        short: 'Still there',
        long: 'Chance he is still undrafted when your pick comes around.',
    },
    adp: {
        short: 'ADP',
        long: 'Average draft position across dynasty as a whole — where the wider market takes him. Nothing to do with your leagues.',
    },
    leagueAdp: {
        short: 'League ADP',
        long: 'Where your leaguemates actually take him, measured across the completed rookie drafts they ran in their other leagues this year.',
    },
    managerAdp: {
        short: "A manager's ADP",
        long: 'One specific leaguemate’s own average pick on him. Only shown when we have seen enough of their drafts to mean something.',
    },
    gap: {
        short: 'Gap',
        long: 'League ADP minus ADP. Negative means your leaguemates reach earlier than the market; positive means they let him slide.',
    },
    spread: {
        short: 'Spread (±)',
        long: 'How much his draft slot bounces around. A small spread is a lock; a big one means he could go anywhere.',
    },
    threat: {
        short: 'Threat',
        long: 'A manager picking before you, and how likely they are to take him if he is on the board.',
    },
    seen: {
        short: 'Drafts seen',
        long: 'How many drafts a number is measured from. Small numbers mean the estimate is soft — treat single digits as a hint, not a fact.',
    },
};

// "Still there" in words. A bare percentage invites false precision; these
// buckets are what the number is actually good for. Deliberately a statement
// of fact rather than advice - §3g: the same number means "wait" or "don't
// spend this pick on him" depending on which question is being asked, and the
// app cannot know which.
export function survivalPhrase(probability) {
    if (probability < 0.15) return 'almost certainly gone';
    if (probability < 0.35) return 'probably gone';
    if (probability < 0.55) return 'coin flip';
    if (probability < 0.8) return 'probably there';
    return 'almost certainly there';
}

export function survivalTone(probability) {
    if (probability >= 0.66) return 'text-live';
    if (probability >= 0.33) return 'text-warn';
    return 'text-danger';
}

// The chip's fill. `bg-danger/15` rather than a `--raw-danger-tint` token
// because the design system defines tints for live and warn only, and an
// opacity modifier on the token is the idiom already in use for danger
// (LineupPanel's "Taken" pill) - no invented hex either way.
export function survivalBand(probability) {
    if (probability >= 0.66) return 'bg-live-tint';
    if (probability >= 0.33) return 'bg-warn-tint';
    return 'bg-danger/15';
}

// Plain-English rendering of the circle-vs-market gap. Hedged at small gaps
// on purpose: below a few picks this is noise, not a read.
export function gapPhrase(gap) {
    if (gap == null) return null;
    if (gap <= -8) return 'your leaguemates reach way earlier than that';
    if (gap <= -3) return 'your leaguemates take him earlier than that';
    if (gap < 3) return 'your leaguemates agree';
    if (gap < 8) return 'your leaguemates let him slide';
    return 'your leaguemates fade him hard';
}

export function gapTone(gap) {
    if (gap == null) return 'text-ink-dim';
    if (gap <= -3) return 'text-danger';
    if (gap < 3) return 'text-ink-dim';
    return 'text-live';
}
