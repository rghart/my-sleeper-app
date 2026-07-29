// The league switcher, styled as a pill. Still a plain `<select>` under the
// hood - same accessibility and switching behaviour LeagueBar had - with
// `appearance-none` to drop the native arrow and a `▾` rendered ourselves in
// its place. Reports league ids, not names: two leagues can share a name.
//
// `leagueName` isn't read here - the select already shows the current
// league's name via its selected option, so a second copy of it would just
// be a redundant, unused prop. It is still accepted (and still passed by
// callers) to keep this a drop-in replacement for LeagueBar's prop shape.
const LeaguePill = ({ leagueID, leagueIds, updateLeagueID }) => {
    return (
        <span className="relative inline-flex items-center">
            <select
                aria-label="League"
                value={leagueID}
                onChange={(e) => updateLeagueID(e.target.value)}
                className="border-line text-ink max-w-[150px] appearance-none truncate rounded-full border bg-transparent py-1 pr-5 pl-2.5 text-[13px] font-semibold tracking-[-0.01em] md:max-w-none"
            >
                {leagueIds.map((league) => (
                    <option key={league.league_id} value={league.league_id}>
                        {league.name}
                    </option>
                ))}
            </select>
            <span aria-hidden="true" className="text-ink-dim pointer-events-none absolute right-2.5 text-[9px]">
                ▾
            </span>
        </span>
    );
};

export default LeaguePill;
