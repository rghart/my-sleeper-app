import SelectPill from './Pill';
import { TierIcon } from './TierIcon';

// The league switcher, styled as a pill. Still a plain `<select>` under the
// hood - same accessibility and switching behaviour LeagueBar had - via the
// shared SelectPill geometry (see Pill.jsx). Reports league ids, not names:
// two leagues can share a name.
//
// `leagueName` isn't read here - the select already shows the current
// league's name via its selected option, so a second copy of it would just
// be a redundant, unused prop. It is still accepted (and still passed by
// callers) to keep this a drop-in replacement for LeagueBar's prop shape.
//
// `tier` is your power-rankings tier in the selected league, drawn as its icon
// inside the pill. Decorative here - the menu's league list names it in words.
const LeaguePill = ({ leagueID, leagueIds, updateLeagueID, tier = null }) => (
    <SelectPill
        ariaLabel="League"
        value={leagueID}
        leading={tier ? <TierIcon tier={tier} /> : null}
        onChange={updateLeagueID}
        options={leagueIds.map((league) => ({ value: league.league_id, label: league.name }))}
    />
);

export default LeaguePill;
