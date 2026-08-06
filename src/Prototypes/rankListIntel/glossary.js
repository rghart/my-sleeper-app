// THROWAWAY PROTOTYPE — one place for what every number actually means.
//
// The first round of this prototype showed raw stat soup ("ADP 26.7 ±5.7 ·
// n=67 · league 7%") and the honest feedback was that none of it was legible.
// Two separate problems hid in there:
//
//  1. Nothing was labelled, so you had to already know what each figure was.
//  2. "ADP" was ONE label doing TWO jobs. There are genuinely two different
//     ADPs in play and conflating them is the actual confusion:
//
//       MARKET  - where the wider dynasty market values him. Real, public,
//                 joined on sleeperId (FantasyCalc rookie pool by trade value).
//                 Nothing to do with your leagues.
//       CIRCLE  - where YOUR 13 leaguemates actually draft him, measured over
//                 70 completed rookie drafts they ran in their other leagues.
//
//     The GAP between the two is the interesting part: it is the only number
//     here that says "your circle disagrees with the market about this guy".

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
        long: 'Where your leaguemates actually take him, measured across 70 completed rookie drafts they ran in their other leagues this year.',
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

// Plain-English rendering of the circle-vs-market gap. Deliberately hedged
// language at small gaps: below a few picks this is noise, not a read.
export const gapPhrase = (gap) => {
    if (gap === undefined || gap === null) return null;
    if (gap <= -8) return 'your leaguemates reach way earlier than that';
    if (gap <= -3) return 'your leaguemates take him earlier than that';
    if (gap < 3) return 'your leaguemates agree';
    if (gap < 8) return 'your leaguemates let him slide';
    return 'your leaguemates fade him hard';
};

// Row-width version. The long phrases above truncated on every single row at
// 375px, which meant the gap - the one genuinely novel signal here - was the
// thing that never survived. Short enough to always fit beside a name.
export const gapPhraseShort = (gap) => {
    if (gap === undefined || gap === null) return null;
    if (gap <= -8) return 'league reaches hard';
    if (gap <= -3) return 'league reaches';
    if (gap < 3) return 'matches ADP';
    if (gap < 8) return 'league lets him slide';
    return 'league fades him';
};

export const gapTone = (gap) => {
    if (gap === undefined || gap === null) return 'text-ink-dim';
    if (gap <= -3) return 'text-danger';
    if (gap < 3) return 'text-ink-dim';
    return 'text-live';
};

// "still there" in words. A bare percentage invites false precision; these
// buckets are what the number is actually good for.
export const survivalPhrase = (p) => {
    if (p < 0.15) return 'almost certainly gone';
    if (p < 0.35) return 'probably gone';
    if (p < 0.55) return 'coin flip';
    if (p < 0.8) return 'probably there';
    return 'almost certainly there';
};

export const survivalTone = (p) => (p >= 0.66 ? 'text-live' : p >= 0.33 ? 'text-warn' : 'text-danger');
export const survivalColor = (p) =>
    p >= 0.66 ? 'var(--raw-live)' : p >= 0.33 ? 'var(--raw-warn)' : 'var(--raw-danger)';
