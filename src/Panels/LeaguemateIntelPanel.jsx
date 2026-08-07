import { useEffect, useState } from 'react';
import ListRow from '../Components/ListRow';
import PositionTag from '../Components/PositionTag';
import Spinner from '../Components/Spinner';
import { agoLabel } from '../lib/relativeTime.js';
import { fetchLeagueIntel } from '../lib/sleeperApi.js';
import {
    countLabel,
    crushesShowPattern,
    managerSignal,
    reachPhrase,
    reachPhraseShort,
    sortManagers,
} from '../lib/leagueIntel.js';

// Who your leaguemates are and what they do in their other leagues
// (docs/leaguemate-intel.md §6 step 4).
//
// League-scoped, not `global`, even though §3 Frontend reserved 'global' for
// it. The endpoint is keyed by league — it answers "the managers in *this*
// league", and the cross-league part is what they do elsewhere, not what the
// view spans. A global section would hide the league switcher (AppShell drops
// the pill for that scope) while still showing per-league content, so the
// screen could not tell you why it was showing what it was showing.
//
// Same drill-down idiom as the rank list's intel: push a profile in place with
// a back control rather than opening a sheet.

// The two samples these figures rest on, and they are not interchangeable:
// `reachVsAdp` is an average per draft, the positional shares are proportions
// of picks. See `managerSignal`.
const THRESHOLDS = { minDrafts: 5, minPicks: 20 };

const Header = ({ corpus }) => {
    const crawled = agoLabel(corpus?.lastCrawledAt ? Date.parse(corpus.lastCrawledAt) : null);

    return (
        <div className="flex flex-col gap-0.5 px-4 pt-4 pb-2">
            <h2 className="text-ink m-0 text-[20px] font-bold tracking-[-.02em]">Leaguemates</h2>
            {/* The sample the whole screen rests on, stated once at the top
                rather than implied. A stale crawl is the difference between
                "they have never taken him" and "we have not looked lately". */}
            <p className="text-ink-dim m-0 font-mono text-[11px]">
                {corpus?.drafts ? `${corpus.drafts} drafts · ${corpus.picks} picks` : 'No drafts observed yet'}
                {crawled && <span className="text-ink-quiet"> · crawled {crawled}</span>}
            </p>
        </div>
    );
};

const Crush = ({ crush }) => (
    <div className="flex items-baseline justify-between gap-2 py-0.5">
        <span className="flex min-w-0 items-center gap-2">
            <PositionTag position={crush.position} />
            <span className="text-ink-quiet truncate text-[13px]">{crush.name}</span>
        </span>
        {/* Always a count over its own denominator, never a rate: "3 of 6"
            carries its sample where "50%" hides it. */}
        <span className="text-ink-dim shrink-0 font-mono text-[11px] tabular-nums">
            {crush.times} of {crush.of}
        </span>
    </div>
);

const Profile = ({ manager, onBack }) => {
    const signal = managerSignal(manager, THRESHOLDS);
    const { crushes = [], positionLean = [], reachVsAdp } = manager.tendencies || {};

    return (
        <div className="px-2 py-2.5">
            <button
                type="button"
                onClick={onBack}
                className="text-ink-quiet hover:text-ink mb-2 -ml-1 flex min-h-11 items-center gap-1.5 px-1.5 py-1 font-mono text-[11px]"
            >
                <span className="text-[13px]">←</span> Leaguemates
            </button>

            <div className="px-1.5">
                <h3 className="text-ink m-0 text-[17px] font-semibold">{manager.displayName}</h3>
                <p className="text-ink-dim m-0 mt-0.5 font-mono text-[11px]">
                    {countLabel(manager.leaguesCount, 'league')} · {countLabel(manager.draftsCount, 'draft')} ·{' '}
                    {manager.draftsComplete} complete
                </p>

                {signal.kind === 'none' ? (
                    <p className="text-ink-muted mt-3 text-[13px] leading-snug">
                        None of their drafts have been seen yet, so there is nothing to read here.
                    </p>
                ) : (
                    <>
                        <div className="bg-raised-2 mt-3 rounded-lg px-3 py-2.5">
                            <p className="text-ink-dim m-0 font-mono text-[9px] tracking-[.08em] uppercase">
                                Vs league ADP
                            </p>
                            {signal.quotesReach ? (
                                <p className="text-ink m-0 mt-0.5 text-[15px] font-semibold">
                                    {reachPhrase(reachVsAdp)}
                                </p>
                            ) : (
                                // Below the threshold the copy changes shape
                                // rather than shrinking: no average, just the
                                // sample that is too small to average over.
                                <p className="text-ink-muted m-0 mt-0.5 text-[13px] leading-snug">
                                    We&rsquo;ve only seen {signal.draftsComplete} of their drafts — not enough to call a
                                    tendency.
                                </p>
                            )}
                        </div>

                        {positionLean.length > 0 && (
                            <div className="mt-3">
                                <p className="text-ink-dim mb-1 font-mono text-[10px] tracking-[.08em] uppercase">
                                    What they spend picks on
                                    <span className="text-ink-quiet"> · {signal.picks} picks</span>
                                </p>
                                {positionLean.map((entry) => (
                                    <div
                                        key={entry.position}
                                        className="flex items-baseline justify-between gap-2 py-0.5"
                                    >
                                        <span className="flex min-w-0 items-center gap-2">
                                            <PositionTag position={entry.position} />
                                        </span>
                                        <span className="text-ink-dim shrink-0 font-mono text-[11px] tabular-nums">
                                            {/* A share is a proportion; below
                                                the pick threshold only the raw
                                                count is defensible. */}
                                            {signal.quotesShares
                                                ? `${Math.round(entry.share * 100)}% · ${entry.picks}`
                                                : `${entry.picks} pick${entry.picks === 1 ? '' : 's'}`}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}

                        {crushes.length > 0 && (
                            <div className="border-line-mid mt-3 border-t pt-2">
                                {/* The counts carry their own denominator,
                                    but this heading is its own claim - and
                                    "keep taking" over a list of "1 of 1" is a
                                    pattern asserted from one observation. */}
                                <p className="text-ink-dim mb-1 font-mono text-[10px] tracking-[.08em] uppercase">
                                    {crushesShowPattern(crushes)
                                        ? 'Players they keep taking'
                                        : 'Players they have taken'}
                                </p>
                                {crushes.map((crush) => (
                                    <Crush key={crush.playerId} crush={crush} />
                                ))}
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

const LeaguemateIntelPanel = ({ leagueID, season }) => {
    const [intel, setIntel] = useState(undefined);
    const [loading, setLoading] = useState(true);
    const [selectedUserId, setSelectedUserId] = useState(null);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);

        fetchLeagueIntel({ leagueId: leagueID, season }).then((response) => {
            if (cancelled) return;
            setIntel(response);
            setLoading(false);
        });

        return () => {
            cancelled = true;
        };
    }, [leagueID, season]);

    if (loading) {
        return (
            <div className="flex min-h-40 items-center justify-center">
                <Spinner />
            </div>
        );
    }

    // Unlike the rank list, intel is not additive here - it is the whole
    // screen, so a failed fetch has to say so rather than render an empty one.
    if (!intel) {
        return (
            <p className="text-ink-muted m-0 flex min-h-11 items-center px-4 text-sm">
                Couldn&rsquo;t load leaguemate intel. It may not have been crawled for this league yet.
            </p>
        );
    }

    const managers = sortManagers(intel.managers);
    const selected = managers.find((manager) => manager.userId === selectedUserId);

    if (selected) {
        return <Profile manager={selected} onBack={() => setSelectedUserId(null)} />;
    }

    return (
        <div>
            <Header corpus={intel.corpus} />
            {managers.length === 0 ? (
                <p className="text-ink-muted m-0 flex min-h-11 items-center px-4 text-sm">
                    No leaguemates found for this league yet.
                </p>
            ) : (
                <ul className="flex list-none flex-col gap-0.5 px-2 py-2.5">
                    {managers.map((manager) => {
                        const signal = managerSignal(manager, THRESHOLDS);
                        // Short form on the row: the long one truncates the
                        // meta line beside it at 375px. The profile uses the
                        // full sentence, where there is room for it.
                        const phrase = signal.quotesReach ? reachPhraseShort(manager.tendencies?.reachVsAdp) : null;

                        return (
                            <li key={manager.userId}>
                                <ListRow
                                    // The accessible name keeps the long
                                    // form - it is read, not laid out.
                                    label={`${manager.displayName}, ${countLabel(manager.draftsComplete, 'draft')} seen${
                                        signal.quotesReach ? `, ${reachPhrase(manager.tendencies?.reachVsAdp)}` : ''
                                    }`}
                                    onClick={() => setSelectedUserId(manager.userId)}
                                    name={manager.displayName}
                                    meta={
                                        <>
                                            <span>{countLabel(manager.leaguesCount, 'league')}</span>
                                            <span> · </span>
                                            <span>{countLabel(manager.draftsComplete, 'draft')} seen</span>
                                        </>
                                    }
                                    trailing={
                                        <span
                                            className={`shrink-0 font-mono text-[11px] ${
                                                phrase ? 'text-ink-quiet' : 'text-ink-dim'
                                            }`}
                                        >
                                            {/* The one comparable line across
                                                rows, and absent rather than
                                                guessed when the sample cannot
                                                support it. */}
                                            {phrase ?? 'no read'}
                                        </span>
                                    }
                                />
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
};

export default LeaguemateIntelPanel;
