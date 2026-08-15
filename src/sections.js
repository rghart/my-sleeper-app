// The catalogue of top-level sections the app can show, and what shell
// chrome each one needs. `scope` distinguishes sections that operate within
// a single league ('league') from ones that operate across every league at
// once ('global') - cross-league manager analytics, for instance. A global
// section must never render the league switcher, since there is no single
// league to switch: AppShell reads this field to decide whether `leagueBar`
// appears at all, even though nothing uses 'global' yet.
export const SECTIONS = [
    { id: 'draft', label: 'Draft', scope: 'league' },
    { id: 'lineup', label: 'Lineup', scope: 'league' },
    { id: 'ranks', label: 'Ranks', scope: 'league' },
    // Leaguemate intel is 'league' scope despite being the "cross-league"
    // view the docstring above imagines: /intel is keyed by league, so it
    // answers "the managers in *this* league", and the cross-league part is
    // what those managers do elsewhere. Hiding the league switcher for it
    // would leave per-league content depending on a league you can neither
    // see nor change. 'global' is still unused.
    { id: 'leaguemates', label: 'Leaguemates', scope: 'league' },
    // Movers is 'league' scope for the same reason, and it is the less
    // obvious case: the values are market-wide, so this looks like the
    // 'global' section the docstring above imagines. But *which* set of
    // values is true for you depends on whether your league can start a
    // second quarterback - KeepTradeCut prices 1QB and superflex as separate
    // lists - so hiding the league switcher would leave the numbers
    // depending on a league you could neither see nor change.
    { id: 'movers', label: 'Movers', scope: 'league' },
    // Trades is about these twelve rosters specifically, so 'league' is the
    // obvious scope here rather than the argued one it is for Movers.
    { id: 'trades', label: 'Trades', scope: 'league' },
];

export const DEFAULT_SECTION_ID = 'draft';

// Sections the drawer advertises but that don't exist yet. Kept separate from
// SECTIONS, which drives routing and the tab bar - adding these to SECTIONS
// would make useHashRoute treat their ids as valid routes with nothing to
// render for them.
export const PLANNED_SECTIONS = [{ id: 'league-history', label: 'League history' }];

// Which section a fresh load should open on, based on where the current
// league's draft stands. A completed draft has nothing left to do on the
// draft board, so the lineup is the more useful landing spot; anything else
// (including no draft data yet) opens on the draft.
export const defaultSectionFor = (draftStatus) => (draftStatus === 'complete' ? 'lineup' : 'draft');
