import SelectPill from './Pill';

// The league switcher, styled as a pill. Still a plain `<select>` under the
// hood - same accessibility and switching behaviour LeagueBar had - via the
// shared SelectPill geometry (see Pill.jsx). Reports league ids, not names:
// two leagues can share a name.
//
// `leagueName` isn't read here - the select already shows the current
// league's name via its selected option, so a second copy of it would just
// be a redundant, unused prop. It is still accepted (and still passed by
// callers) to keep this a drop-in replacement for LeagueBar's prop shape.
const LeaguePill = ({ leagueID, leagueIds, updateLeagueID }) => (
    <SelectPill
        ariaLabel="League"
        value={leagueID}
        onChange={updateLeagueID}
        options={leagueIds.map((league) => ({ value: league.league_id, label: league.name }))}
    />
);

export default LeaguePill;
