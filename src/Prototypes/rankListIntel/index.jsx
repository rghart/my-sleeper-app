import VariantA from './VariantA';
import fixture from './fixture.json';

// THROWAWAY PROTOTYPE — leaguemate intel inside the rank list.
//
// Down to one design; the variant switcher is gone. Settled over four rounds:
//
//   structure  percent chip in the row, tap to push a detail view
//   naming     ADP = dynasty-wide, League ADP = your leaguemates
//   meanings   tap any ? for a Popover (hover does not exist on a phone)
//   threshold  a named manager's own ADP only at >=8 drafts and >=3 picks
//   pick       CHOSEN, not assumed - see PickSelector
//
// Mounted inside BestAvailable, so it renders in the genuine phone bottom
// sheet AND the genuine desktop aside rail. Mobile-first: check at 375px.
//
// Data is frozen (fixture.json) from the live District 13 rookie draft,
// rebuilt 2026-08-04 at pick 35: 70 completed leaguemate rookie drafts, 3,286
// picks, manager rates shrunk toward baseline, pick ownership resolved through
// traded picks, survival precomputed for every remaining pick. Read-only.
//
// Delete this directory at the frontend-swap step. See docs/leaguemate-intel.md.

const RankListIntelPrototype = () => {
    if (import.meta.env.PROD) return null;
    return <VariantA data={fixture} />;
};

export default RankListIntelPrototype;
