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
];

export const DEFAULT_SECTION_ID = 'draft';

// Which section a fresh load should open on, based on where the current
// league's draft stands. A completed draft has nothing left to do on the
// draft board, so the lineup is the more useful landing spot; anything else
// (including no draft data yet) opens on the draft.
export const defaultSectionFor = (draftStatus) => (draftStatus === 'complete' ? 'lineup' : 'draft');
