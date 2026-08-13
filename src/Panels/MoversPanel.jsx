import { useEffect, useState } from 'react';
import ListRow from '../Components/ListRow';
import PlayerAvatar from '../Components/PlayerAvatar';
import PositionTag from '../Components/PositionTag';
import SegmentedControl from '../Components/SegmentedControl';
import Spinner from '../Components/Spinner';
import ValueChip from '../Components/ValueChip';
import { agoLabel } from '../lib/relativeTime.js';
import { asOfMillis, usesSuperflexValues, valuesByPlayerId } from '../lib/dynastyValues.js';
import { movers, readingCoverage } from '../lib/movers.js';
import { isTaken, rosteredBy } from '../lib/rosterInfo.js';
import { fetchDynastyValues } from '../lib/sleeperApi.js';

// Who the dynasty market is moving on, and which way.
//
// This is what `player_value_history` was built for. Every other screen in
// this app answers a question about a list you supplied — your ranks, your
// lineup, your leaguemates. This one answers a question you did not ask: the
// market repriced somebody while you were not looking.
//
// League-scoped, like Leaguemates and for the same reason: the values
// themselves are market-wide, but *which* set of values is true for you
// depends on whether your league can start a second quarterback. Hiding the
// league switcher would leave the numbers depending on a league you could
// neither see nor change.

const WINDOWS = [
    { value: 7, label: '7d' },
    { value: 30, label: '30d' },
    { value: 90, label: '90d' },
];

const DIRECTIONS = [
    { value: 'up', label: 'Rising' },
    { value: 'down', label: 'Falling' },
];

const BASES = [
    { value: 'percent', label: '%' },
    { value: 'points', label: 'Pts' },
];

// Enough to scroll through with intent, short enough that the tail is still
// meaningful movement rather than noise.
const LIMIT = 40;

const Header = ({ response, window: days, coverage }) => {
    const asOf = agoLabel(asOfMillis(response));

    return (
        <div className="flex flex-col gap-0.5 px-4 pt-4 pb-2">
            <h2 className="text-ink m-0 text-[20px] font-bold tracking-[-.02em]">Movers</h2>
            {/* The sample the whole screen rests on. A list of movers over 460
                priced players and one over 12 are different claims, and only
                this line can say which. */}
            <p className="text-ink-dim m-0 font-mono text-[11px]">
                {coverage.withReading} of {coverage.total} priced · {days}d
                {asOf && <span className="text-ink-quiet"> · {asOf}</span>}
            </p>
        </div>
    );
};

const MoverRow = ({ entry, playerInfo, rosterInfo, myDisplayName, basis }) => {
    const player = playerInfo?.[entry.playerId];
    if (!player) return null;

    const taken = isTaken(rosterInfo, entry.playerId);
    const rosteredByName = rosteredBy(rosterInfo, entry.playerId);
    const isMine = taken && rosteredByName === myDisplayName;

    // Ownership is the whole reason this screen is actionable rather than
    // trivia: a faller you own is a sell decision, a riser nobody owns is an
    // add, and a riser on someone else's roster is a buy target. Stated in
    // words rather than a colour, same rule the rank row follows.
    const ownership = isMine ? 'Yours' : taken ? rosteredByName : 'Free agent';

    return (
        <ListRow
            as="div"
            label={`${player.full_name}, ${ownership}, ${entry.changePct > 0 ? 'up' : 'down'} ${Math.abs(
                Math.round(entry.changePct),
            )} percent`}
            leading={<PlayerAvatar playerId={entry.playerId} name={player.full_name} team={player.team} />}
            name={player.full_name}
            nameTone={taken && !isMine ? 'muted' : 'default'}
            flag={isMine ? { text: 'YOU', tone: 'mine' } : undefined}
            meta={
                <>
                    <ValueChip value={entry.value} changePct={entry.changePct} />
                    <span> · </span>
                    <span>{ownership}</span>
                </>
            }
            trailing={
                <>
                    {/* The points figure is the one thing the meta line does
                        not already carry, and on the points sort it is the
                        column being ranked - so it earns the space only
                        there. */}
                    {basis === 'points' && (
                        <span className="text-ink-quiet w-[42px] shrink-0 text-right font-mono text-[11px] tabular-nums">
                            {entry.change > 0 ? '+' : ''}
                            {Math.round(entry.change)}
                        </span>
                    )}
                    <PositionTag position={player.position} />
                </>
            }
        />
    );
};

const MoversPanel = ({ marketSettings, playerInfo, rosterInfo, myDisplayName }) => {
    const [response, setResponse] = useState(undefined);
    const [loading, setLoading] = useState(true);
    const [days, setDays] = useState(30);
    const [direction, setDirection] = useState('up');
    const [basis, setBasis] = useState('percent');

    const superflex = usesSuperflexValues(marketSettings);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);

        fetchDynastyValues({ superflex, window: days }).then((body) => {
            if (cancelled) return;
            setResponse(body);
            setLoading(false);
        });

        return () => {
            cancelled = true;
        };
    }, [superflex, days]);

    if (loading) {
        return (
            <div className="flex min-h-40 items-center justify-center">
                <Spinner />
            </div>
        );
    }

    // Unlike the rank list's value chips, this is not additive - the values
    // *are* the screen, so a failed fetch has to say so rather than render an
    // empty list that looks like a quiet market.
    if (!response) {
        return (
            <p className="text-ink-muted m-0 flex min-h-11 items-center px-4 text-sm">
                Couldn&rsquo;t load market values. The value service may be unavailable.
            </p>
        );
    }

    const values = response.values || [];
    const coverage = readingCoverage(values);
    const ranked = movers(values, { direction, basis, limit: LIMIT });
    const byId = valuesByPlayerId(response);

    return (
        <div>
            <Header response={response} window={days} coverage={coverage} />

            <div className="flex flex-wrap items-center gap-2 px-4 pb-2">
                <SegmentedControl label="Direction" options={DIRECTIONS} value={direction} onChange={setDirection} />
                <SegmentedControl label="Window" options={WINDOWS} value={days} onChange={setDays} />
                {/* Both bases are offered rather than a value floor being
                    hidden inside the ranking - see lib/movers.js for the
                    measurement behind that. */}
                <SegmentedControl label="Sort by" options={BASES} value={basis} onChange={setBasis} />
            </div>

            {ranked.length === 0 ? (
                <p className="text-ink-muted m-0 flex min-h-11 items-center px-4 text-sm">
                    {coverage.withReading === 0
                        ? 'No movement recorded yet over this window.'
                        : 'Nothing has moved in this direction over this window.'}
                </p>
            ) : (
                <ul className="flex list-none flex-col gap-0.5 px-2 py-2.5">
                    {ranked.map((entry) => (
                        <li key={entry.playerId}>
                            <MoverRow
                                entry={byId[entry.playerId] || entry}
                                playerInfo={playerInfo}
                                rosterInfo={rosterInfo}
                                myDisplayName={myDisplayName}
                                basis={basis}
                            />
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

export default MoversPanel;
