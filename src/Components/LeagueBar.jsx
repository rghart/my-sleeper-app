import Dropdown from './Dropdown';

// The league switcher, lifted out of LeaguePanel so AppShell can render it
// once per league-scoped section instead of once per panel. The dropdown
// shows league names but reports ids: switching leagues by display name
// would break the moment two leagues shared one.
const LeagueBar = ({ leagueName, leagueID, leagueIds, updateLeagueID }) => {
    return (
        <div className="border-line bg-raised flex flex-row items-center gap-3 border-b border-solid px-4 py-2">
            <p className="m-0 font-bold">{leagueName}</p>
            {/* Dropdown still carries its own w-[85%] (converted from the old
                `.dropdown` rule, not dropped), so it is boxed here rather than
                left to fill the bar. */}
            <span className="ml-auto w-full max-w-56">
                <Dropdown currentValue={leagueID} updateCurrentValue={updateLeagueID}>
                    {leagueIds.map((league) => (
                        <option key={league.league_id} value={league.league_id}>
                            {league.name}
                        </option>
                    ))}
                </Dropdown>
            </span>
        </div>
    );
};

export default LeagueBar;
