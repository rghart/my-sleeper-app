import { useEffect, useState } from 'react';
import PlayerAvatar from '../Components/PlayerAvatar';
import PositionTag from '../Components/PositionTag';
import Spinner from '../Components/Spinner';
import { usesSuperflexValues } from '../lib/dynastyValues.js';
import { fetchLeagueTrades } from '../lib/sleeperApi.js';

// Trades this manager and their leaguemates might both want.
//
// The strongest claim this app makes, and the one that most needs hedging.
// Every other screen reports a measurement; this one proposes an action. So
// the framing is deliberately "these two rosters fit, here is the arithmetic"
// rather than "send this offer" — whether a trade is good for you depends on
// whether you are contending, which nothing here knows.
//
// That is why the roster shape is rendered at the top rather than hidden: a
// suggestion says "you are deep at RB and thin at WR", and the counts behind
// that are what let someone disagree with it.

const POSITION_ORDER = ['QB', 'RB', 'WR', 'TE'];

// Below this the two sides are close enough that the difference is not the
// story. Above it, the gap is worth naming rather than leaving to be read off
// two numbers.
const NOTABLE_GAP = 40;

const Shape = ({ shape }) => {
    if (!shape?.depth) return null;

    return (
        <div className="flex flex-wrap gap-1.5 px-4 pb-3">
            {POSITION_ORDER.filter((position) => shape.depth[position] != null).map((position) => {
                const mine = shape.depth[position];
                const league = shape.leagueAverage?.[position];
                // Deep and thin are relative to the league, not to the
                // starting lineup — in dynasty everyone is past their
                // starters everywhere. See the backend's TradeFinder.
                const tone =
                    league == null
                        ? 'text-ink-dim'
                        : mine > league + 0.5
                          ? 'text-live'
                          : mine < league - 0.5
                            ? 'text-warn'
                            : 'text-ink-dim';

                return (
                    <span key={position} className="bg-raised-2 flex items-center gap-1.5 rounded-full px-2 py-1">
                        <PositionTag position={position} />
                        <span className={`font-mono text-[11px] tabular-nums ${tone}`}>
                            {mine}
                            {league != null && <span className="text-ink-quiet"> vs {league.toFixed(1)}</span>}
                        </span>
                    </span>
                );
            })}
        </div>
    );
};

// "2027 2nd". The tier is not shown: every pick the finder offers is priced
// at mid, because a Sleeper pick knows its season and round and nothing else,
// and printing "2027 Mid 2nd" would present an assumption as a fact.
const ORDINALS = { 1: '1st', 2: '2nd', 3: '3rd', 4: '4th' };
const pickLabel = (pick) => `${pick.season} ${ORDINALS[pick.round] || `R${pick.round}`}`;

const Side = ({ label, ids, picks = [], playerInfo, tone }) => (
    <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-ink-dim font-mono text-[9px] tracking-[.08em] uppercase">{label}</span>
        {ids.map((id) => {
            const player = playerInfo?.[id];
            return (
                <span key={id} className="flex min-w-0 items-center gap-2">
                    <PlayerAvatar playerId={id} name={player?.full_name} team={player?.team} size={24} />
                    <span className={`min-w-0 truncate text-[13px] font-semibold ${tone}`}>
                        {/* An id rather than a blank when the pool has never
                            heard of him: a row that silently drops one side of
                            a trade is worse than one showing a number. */}
                        {player?.full_name || id}
                    </span>
                </span>
            );
        })}
        {picks.map((pick) => (
            <span key={`${pick.season}-${pick.round}`} className="flex min-w-0 items-center gap-2">
                {/* A pick gets the same 24px lead as a player so the two
                    columns stay aligned, but carries a mark rather than a
                    face - there is nobody to show yet. */}
                <span className="bg-raised-2 text-ink-dim flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-mono text-[9px]">
                    PK
                </span>
                <span className={`min-w-0 truncate text-[13px] font-semibold ${tone}`}>{pickLabel(pick)}</span>
            </span>
        ))}
    </div>
);

const Suggestion = ({ suggestion, playerInfo }) => {
    const gap = Math.round(suggestion.getValue - suggestion.giveValue);
    const notable = Math.abs(gap) >= NOTABLE_GAP;

    return (
        <div className="bg-raised rounded-row flex flex-col gap-2 px-3 py-2.5">
            <div className="flex items-baseline justify-between gap-2">
                <span className="text-ink truncate text-[13px] font-semibold">{suggestion.partnerName}</span>
                {/* Named only when it is worth naming. Below the threshold two
                    adjusted totals a few points apart is not a finding. */}
                <span
                    className={`shrink-0 font-mono text-[10px] tabular-nums ${
                        notable ? (gap > 0 ? 'text-live' : 'text-warn') : 'text-ink-dim'
                    }`}
                >
                    {notable ? `${gap > 0 ? '+' : ''}${gap} for you` : 'even'}
                </span>
            </div>

            <div className="flex items-start gap-3">
                <Side
                    label="You send"
                    ids={suggestion.give}
                    picks={suggestion.givePicks}
                    playerInfo={playerInfo}
                    tone="text-ink-quiet"
                />
                <span className="text-ink-dim shrink-0 self-center text-[13px]">→</span>
                <Side
                    label="You get"
                    ids={suggestion.get}
                    picks={suggestion.getPicks}
                    playerInfo={playerInfo}
                    tone="text-ink"
                />
            </div>

            {/* Both numbers, because on a package trade the interesting thing
                is how far they differ: raw sums are what make eight spare
                parts look like a fair offer, and the adjusted pair is what
                says they are not. */}
            <p className="text-ink-quiet m-0 font-mono text-[10px] tabular-nums">
                adjusted {Math.round(suggestion.giveValue)} vs {Math.round(suggestion.getValue)} · raw gap{' '}
                {Math.round(suggestion.rawGap)}
            </p>
        </div>
    );
};

const TradesPanel = ({ leagueID, sleeperUserId, marketSettings, playerInfo }) => {
    const [response, setResponse] = useState(undefined);
    const [loading, setLoading] = useState(true);

    const superflex = usesSuperflexValues(marketSettings);

    useEffect(() => {
        if (!leagueID || !sleeperUserId) {
            setLoading(false);
            return undefined;
        }

        let cancelled = false;
        setLoading(true);

        fetchLeagueTrades({ leagueId: leagueID, userId: sleeperUserId, superflex }).then((body) => {
            if (cancelled) return;
            setResponse(body);
            setLoading(false);
        });

        return () => {
            cancelled = true;
        };
    }, [leagueID, sleeperUserId, superflex]);

    if (!sleeperUserId) {
        return (
            <p className="text-ink-muted m-0 flex min-h-11 items-center px-4 text-sm">
                Connect your Sleeper account to see trades for your roster.
            </p>
        );
    }

    if (loading) {
        return (
            <div className="flex min-h-40 items-center justify-center">
                <Spinner />
            </div>
        );
    }

    if (!response) {
        return (
            <p className="text-ink-muted m-0 flex min-h-11 items-center px-4 text-sm">
                Couldn&rsquo;t load trade suggestions. The value service may be unavailable.
            </p>
        );
    }

    const suggestions = response.suggestions || [];

    return (
        <div>
            <div className="flex flex-col gap-0.5 px-4 pt-4 pb-2">
                <h2 className="text-ink m-0 text-[20px] font-bold tracking-[-.02em]">Trades</h2>
                <p className="text-ink-dim m-0 font-mono text-[11px]">Your roster vs the league average</p>
            </div>

            <Shape shape={response.rosterShape} />

            {suggestions.length === 0 ? (
                <p className="text-ink-muted m-0 px-4 text-sm leading-snug">
                    Nothing fits right now. That usually means your roster is shaped like everyone else&rsquo;s — a
                    trade needs one side deep where the other is thin.
                </p>
            ) : (
                <ul className="flex list-none flex-col gap-2 px-3 py-2">
                    {suggestions.map((suggestion, index) => (
                        <li key={`${suggestion.partnerId}-${index}`}>
                            <Suggestion suggestion={suggestion} playerInfo={playerInfo} />
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

export default TradesPanel;
