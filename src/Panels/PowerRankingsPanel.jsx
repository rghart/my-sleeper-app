import { useEffect, useMemo, useRef, useState } from 'react';
import SegmentedControl from '../Components/SegmentedControl';
import Sheet from '../Components/Sheet';
import Spinner from '../Components/Spinner';
import { TierChip, TierIcon, tierLabel } from '../Components/TierIcon';
import { agoLabel } from '../lib/relativeTime.js';
import { asOfMillis, pickValue, usesSuperflexValues, valuesByPlayerId } from '../lib/dynastyValues.js';
import { leagueMarketSettings } from '../lib/marketValues.js';
import { pickSeasonsInScope, rankTeams, ranksBy, THRESHOLDS, TIERS } from '../lib/powerRankings.js';
import { adpValues, projectionValues } from '../lib/projections.js';
import {
    fetchDynastyValues,
    fetchLeagueTradedPicks,
    fetchMarketValues,
    fetchSeasonProjections,
} from '../lib/sleeperApi.js';

// Where every team in the league stands: now, for the future, and the tier
// the two put it in. The maths lives in lib/powerRankings.js; this screen
// fetches the values it needs and shows its working.
//
// League-scoped for the same reason as Movers: which value list is true
// depends on whether this league can start a second quarterback.

// Future is always KTC - it is the source that prices picks and discounts
// age - so KTC is required and every other source is additive. Losing one of
// those costs a Now source; losing KTC costs the screen.
const SOURCE_ORDER = ['blend', 'proj', 'adp', 'ktc', 'fc'];
const SOURCE_LABELS = { blend: 'Blend', proj: 'Projections', adp: 'ADP', ktc: 'KTC', fc: 'FantasyCalc' };

// What each source is actually measuring, shown under the switch. Two of
// them are dynasty values, which is worth saying: they price a 22-year-old on
// his next five years, not on this season.
const SOURCE_NOTES = {
    blend: 'The average of every source below. Where they disagree, a team lands in between.',
    proj: 'Sleeper’s season-long projection for the best lineup, scored with this league’s settings.',
    adp: 'Redraft ADP of the best lineup: how early this season’s drafts take those players.',
    ktc: 'KeepTradeCut dynasty value of the best lineup. Flatters young players who aren’t producing yet.',
    fc: 'FantasyCalc dynasty value of the best lineup. Flatters young players who aren’t producing yet.',
};

// The chart's reach, in standard deviations either side of average. Wide
// enough that a genuine outlier in a 12-team league still lands inside;
// anything further out is pinned to the edge rather than lost.
const REACH = 2.2;
// Kept 7% in from each edge, so a team pinned at the reach still shows a
// whole dot rather than half of one clipped by the frame.
const INSET = 7;
const toPercent = (z) => 50 + (Math.max(-REACH, Math.min(REACH, z)) / REACH) * (50 - INSET);

// Signed to one decimal. Rounded before the sign is chosen, so a score of
// -0.04 reads as 0.0 rather than as a negative zero.
const fmtZ = (z) => {
    const rounded = Math.round(z * 10) / 10;
    if (rounded === 0) return '0.0';
    return `${rounded > 0 ? '+' : '−'}${Math.abs(rounded).toFixed(1)}`;
};

const ordinal = (n) => {
    const tail = n % 100 >= 11 && n % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] ?? 'th');
    return `${n}${tail}`;
};

const isMine = (roster, userId) =>
    userId != null && (roster.owner_id === userId || (roster.co_owners ?? []).includes(userId));

// The two scores as a picture: Future across, Now up. The tier lines are
// drawn where the tier rules actually cut - the Middle band between the two
// Now thresholds, and a Future split that sits at a different place above the
// band (All-in) than below it (Rebuilding), because the rules differ.
const TierChart = ({ teams, source, myRosterId, selectedId, onSelect }) => {
    const y = (now) => 100 - toPercent(now);
    const bandTop = y(THRESHOLDS.strongNow);
    const bandBottom = y(THRESHOLDS.weakNow);

    const labelled = teams.filter((team) => team.rosterId === myRosterId || team.rosterId === selectedId);

    return (
        <div className="bg-raised rounded-card relative h-[300px] w-full overflow-hidden md:h-[420px]">
            <div
                className="bg-empty absolute inset-x-0"
                style={{ top: `${bandTop}%`, height: `${bandBottom - bandTop}%` }}
            />
            <div
                className="border-mark absolute top-0 border-l border-dashed"
                style={{ left: `${toPercent(THRESHOLDS.allInFuture)}%`, height: `${bandTop}%` }}
            />
            <div
                className="border-mark absolute bottom-0 border-l border-dashed"
                style={{ left: `${toPercent(THRESHOLDS.rebuildingFuture)}%`, top: `${bandBottom}%` }}
            />

            {/* Quadrant names sit in the corners, clear of where teams land
                most often (the middle). */}
            <span className="text-ink-dim absolute top-2.5 left-3 font-mono text-[10px] font-semibold tracking-[.1em] uppercase">
                All-in
            </span>
            <span className="text-ink-dim absolute top-2.5 right-3 font-mono text-[10px] font-semibold tracking-[.1em] uppercase">
                Contender
            </span>
            <span
                // Right, not left: a team far enough out to be pinned to the
                // chart's edge is almost always pinned to the left one.
                className="text-ink-dim absolute right-3 -translate-y-1/2 font-mono text-[10px] font-semibold tracking-[.1em] uppercase"
                style={{ top: `${(bandTop + bandBottom) / 2}%` }}
            >
                Middle
            </span>
            <span className="text-ink-dim absolute bottom-7 left-3 font-mono text-[10px] font-semibold tracking-[.1em] uppercase">
                Stuck
            </span>
            <span className="text-ink-dim absolute right-3 bottom-7 font-mono text-[10px] font-semibold tracking-[.1em] uppercase">
                Rebuilding
            </span>

            {teams.map((team) => {
                const mine = team.rosterId === myRosterId;
                const selected = team.rosterId === selectedId;
                return (
                    <button
                        key={team.rosterId}
                        type="button"
                        aria-label={`${team.name}${mine ? ', you' : ''}, ${tierLabel(team.tiers[source])}`}
                        aria-pressed={selected}
                        onClick={() => onSelect(team.rosterId)}
                        // A 28px hit target around a 10-12px dot: the dot is
                        // the mark, the button is the finger.
                        className="absolute flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center"
                        style={{ left: `${toPercent(team.future)}%`, top: `${y(team.now[source])}%` }}
                    >
                        <span
                            className={`rounded-full ring-2 ${mine ? 'bg-mine h-3 w-3' : 'bg-ink-muted h-2.5 w-2.5'} ${
                                selected && !mine ? 'ring-ink' : 'ring-raised'
                            }`}
                        />
                    </button>
                );
            })}

            {labelled.map((team) => (
                <span
                    key={team.rosterId}
                    aria-hidden="true"
                    className={`bg-raised pointer-events-none absolute max-w-[40%] truncate rounded px-1 text-xs font-semibold ${
                        team.rosterId === myRosterId ? 'text-mine' : 'text-ink'
                    }`}
                    style={{
                        top: `${y(team.now[source])}%`,
                        // Flip to the dot's left once it is past the middle,
                        // so a label never runs off the right edge.
                        ...(team.future > 0
                            ? { right: `${100 - toPercent(team.future) + 3}%` }
                            : { left: `${toPercent(team.future) + 3}%` }),
                        transform: 'translateY(-50%)',
                    }}
                >
                    {team.name}
                </span>
            ))}

            <span className="text-ink-quiet absolute inset-x-0 bottom-1.5 text-center font-mono text-[10px]">
                FUTURE →
            </span>
            {/* Top centre rather than rotated down the left edge, where it
                sat on the Middle label and on any team pinned to that edge. */}
            <span className="text-ink-quiet absolute inset-x-0 top-1.5 text-center font-mono text-[10px]">↑ NOW</span>
        </div>
    );
};

const TiersSheet = ({ onClose, triggerRef }) => (
    <Sheet title="How tiers work" onClose={onClose} triggerRef={triggerRef} centerOnDesktop>
        <div className="flex flex-col gap-4 px-4 pb-6">
            <p className="text-ink-muted m-0 text-sm leading-relaxed">
                Every team gets two scores, each measured against the rest of this league.
            </p>
            <div className="bg-raised-2 rounded-row p-3">
                <p className="text-ink m-0 text-sm font-semibold">Now</p>
                <p className="text-ink-muted m-0 text-[13px] leading-relaxed">
                    The best legal starting lineup, leaving out injured-reserve, taxi and suspended players. Blend
                    averages every source; the switch shows one on its own.
                </p>
            </div>
            <div className="bg-raised-2 rounded-row p-3">
                <p className="text-ink m-0 text-sm font-semibold">Future</p>
                <p className="text-ink-muted m-0 text-[13px] leading-relaxed">
                    Everything outside that lineup - bench, taxi and injured players, and draft picks - valued by KTC. A
                    young star who already starts counts toward Now, not here.
                </p>
            </div>
            <ul className="m-0 flex list-none flex-col p-0">
                {TIERS.map((tier) => (
                    <li
                        key={tier.id}
                        className="border-line-mid flex min-h-12 items-center gap-3 border-b last:border-0"
                    >
                        <TierIcon tier={tier.id} className="text-ink-muted h-[18px] w-[18px]" />
                        <div>
                            <p className="text-ink m-0 text-sm font-semibold">{tier.label}</p>
                            <p className="text-ink-quiet m-0 text-xs">{tier.description}</p>
                        </div>
                    </li>
                ))}
            </ul>
        </div>
    </Sheet>
);

const PowerRankingsPanel = ({ leagueID, league, rosterData, playerInfo, sleeperUserId, currentDraftComplete }) => {
    const [data, setData] = useState(undefined);
    const [loading, setLoading] = useState(true);
    const [source, setSource] = useState('blend');
    const [selectedId, setSelectedId] = useState(null);
    const [tiersOpen, setTiersOpen] = useState(false);
    const tiersButtonRef = useRef(null);

    const settings = leagueMarketSettings(league);
    const superflex = usesSuperflexValues(settings);
    // A string so the effect re-runs when the league's shape changes, not on
    // every render's fresh settings object.
    const settingsKey = JSON.stringify(settings);
    const season = league?.season;

    useEffect(() => {
        let cancelled = false;
        setLoading(true);

        Promise.all([
            fetchDynastyValues({ superflex }),
            fetchMarketValues(JSON.parse(settingsKey)),
            fetchLeagueTradedPicks(leagueID),
            season ? fetchSeasonProjections(season) : Promise.resolve(undefined),
        ]).then(([ktc, fc, tradedPicks, projections]) => {
            if (cancelled) return;
            // An empty array is a failure in all but name - a season with no
            // projections cannot rank anyone - so it is dropped like one.
            setData({ ktc, fc, tradedPicks, projections: projections?.length ? projections : undefined });
            setLoading(false);
        });

        return () => {
            cancelled = true;
        };
    }, [leagueID, superflex, settingsKey, season]);

    const teams = useMemo(() => {
        if (!data?.ktc || !rosterData?.length || !league) return null;

        const ktcById = valuesByPlayerId(data.ktc);
        const fcById = valuesByPlayerId(data.fc);
        const ktcValue = (id) => ktcById[id]?.value;

        const sources = {};
        if (data.projections) {
            const points = projectionValues(data.projections, league.scoring_settings);
            const adp = adpValues(data.projections, { superflex, ppr: league.scoring_settings?.rec });
            sources.proj = { valueOf: (id) => points[id] };
            sources.adp = { valueOf: (id) => adp[id] };
        }
        sources.ktc = { valueOf: ktcValue };
        if (data.fc) sources.fc = { valueOf: (id) => fcById[id]?.value };

        return rankTeams({
            rosters: rosterData,
            rosterPositions: league.roster_positions,
            playerInfo,
            sources,
            future: { valueOf: ktcValue },
            // Without the traded-picks list every team would be credited with
            // its own picks - a claim this screen cannot back - so picks are
            // left out entirely instead, and the header says so.
            picks: data.tradedPicks
                ? {
                      seasons: pickSeasonsInScope({
                          pricedSeasons: (data.ktc.picks ?? []).map((pick) => pick.season),
                          leagueSeason: league.season,
                          currentDraftComplete,
                      }),
                      rounds: league.settings?.draft_rounds ?? 0,
                      tradedPicks: data.tradedPicks,
                      valueOf: (pick) => pickValue(data.ktc, pick)?.value,
                  }
                : null,
        });
    }, [data, rosterData, league, playerInfo, currentDraftComplete, superflex]);

    if (loading) {
        return (
            <div className="flex min-h-40 items-center justify-center">
                <Spinner />
            </div>
        );
    }

    if (!teams) {
        return (
            <p className="text-ink-muted m-0 flex min-h-11 items-center px-4 text-sm">
                Couldn&rsquo;t load KTC values, which the Future score needs. The value service may be unavailable.
            </p>
        );
    }

    const available = { blend: true, proj: !!data.projections, adp: !!data.projections, ktc: true, fc: !!data.fc };
    const sourceOptions = SOURCE_ORDER.filter((id) => available[id]).map((value) => ({
        value,
        label: SOURCE_LABELS[value],
    }));
    const unavailable = [!data.projections && 'projections', !data.fc && 'FantasyCalc'].filter(Boolean);
    const activeSource = sourceOptions.some((option) => option.value === source) ? source : 'blend';

    const myRosterId = rosterData.find((roster) => isMine(roster, sleeperUserId))?.roster_id;
    const nowRanks = ranksBy(teams, (team) => team.now[activeSource]);
    const futureRanks = ranksBy(teams, (team) => team.future);
    const ordered = [...teams].sort((a, b) => nowRanks.get(a.rosterId) - nowRanks.get(b.rosterId));

    const ktcAge = agoLabel(asOfMillis(data.ktc));
    const fcAge = data.fc ? agoLabel(asOfMillis(data.fc)) : null;

    return (
        <div className="flex flex-col gap-3 pb-4">
            <div className="flex items-end gap-3 px-4 pt-4">
                <div className="min-w-0 flex-1">
                    <h2 className="text-ink m-0 text-[20px] font-bold tracking-[-.02em]">Power rankings</h2>
                    {/* How old each value list is. KTC drives Future on its
                        own, so a stale KTC list is worth being able to see. */}
                    <p className="text-ink-dim m-0 font-mono text-[11px]">
                        {teams.length} teams{ktcAge && ` · KTC ${ktcAge}`}
                        {fcAge && ` · FantasyCalc ${fcAge}`}
                        {unavailable.length > 0 && ` · ${unavailable.join(' and ')} unavailable`}
                        {!data.tradedPicks && ' · picks not counted'}
                    </p>
                </div>
                <button
                    ref={tiersButtonRef}
                    type="button"
                    onClick={() => setTiersOpen(true)}
                    className="border-line text-ink-muted min-h-11 shrink-0 rounded-full border px-3.5 text-xs font-semibold"
                >
                    How tiers work
                </button>
            </div>

            <div className="flex flex-col gap-1.5">
                {/* Scrolls sideways rather than wrapping: five sources do not
                    fit across a phone, and a second row of segments would
                    read as a second control. */}
                <div className="overflow-x-auto px-4">
                    <SegmentedControl
                        label="Now scored by"
                        options={sourceOptions}
                        value={activeSource}
                        onChange={setSource}
                    />
                </div>
                <p className="text-ink-quiet m-0 px-4 text-xs">{SOURCE_NOTES[activeSource]}</p>
            </div>

            <div className="flex flex-col gap-4 px-4 md:flex-row md:items-start">
                <div className="md:w-[420px] md:shrink-0">
                    <TierChart
                        teams={teams}
                        source={activeSource}
                        myRosterId={myRosterId}
                        selectedId={selectedId}
                        onSelect={setSelectedId}
                    />
                </div>

                <div className="min-w-0 flex-1">
                    <div className="text-ink-dim flex items-center gap-3 px-3 pb-2 font-mono text-[10px] font-semibold tracking-[.1em]">
                        <span className="w-6">#</span>
                        <span className="flex-1">TEAM</span>
                        <span className="w-12 text-right">NOW</span>
                        <span className="w-14 text-right">FUTURE</span>
                    </div>
                    <ol aria-label="Teams by Now score" className="m-0 flex list-none flex-col gap-0.5 p-0">
                        {ordered.map((team) => {
                            const mine = team.rosterId === myRosterId;
                            const tier = team.tiers[activeSource];
                            const nowRank = nowRanks.get(team.rosterId);
                            const futureRank = futureRanks.get(team.rosterId);
                            return (
                                <li key={team.rosterId}>
                                    <button
                                        type="button"
                                        aria-pressed={team.rosterId === selectedId}
                                        aria-label={`${team.name}${mine ? ', you' : ''}, ${tierLabel(tier)}, ${ordinal(
                                            nowRank,
                                        )} for Now, ${ordinal(futureRank)} for Future`}
                                        onClick={() => setSelectedId(team.rosterId)}
                                        className={`rounded-row flex min-h-14 w-full items-center gap-3 px-3 py-1.5 text-left ${
                                            mine ? 'bg-mine-row' : team.rosterId === selectedId ? 'bg-raised' : ''
                                        }`}
                                    >
                                        <span className="text-ink-quiet w-6 font-mono text-xs">{nowRank}</span>
                                        <span className="flex min-w-0 flex-1 flex-col items-start gap-1">
                                            <span className="text-ink w-full truncate text-[15px] font-semibold">
                                                {team.name}
                                                {mine && <span className="text-mine"> · you</span>}
                                            </span>
                                            <TierChip tier={tier} />
                                        </span>
                                        <span className="text-ink w-12 text-right font-mono text-[13px] font-semibold tabular-nums">
                                            {fmtZ(team.now[activeSource])}
                                        </span>
                                        <span className="text-ink-muted w-14 text-right font-mono text-[13px] tabular-nums">
                                            {fmtZ(team.future)}
                                        </span>
                                    </button>
                                </li>
                            );
                        })}
                    </ol>
                    <p className="text-ink-quiet m-0 px-3 pt-2 text-xs">
                        Scores are standard deviations from this league&rsquo;s average.
                    </p>
                </div>
            </div>

            {tiersOpen && <TiersSheet onClose={() => setTiersOpen(false)} triggerRef={tiersButtonRef} />}
        </div>
    );
};

export default PowerRankingsPanel;
