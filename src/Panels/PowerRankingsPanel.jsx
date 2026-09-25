import { useEffect, useMemo, useRef, useState } from 'react';
import SegmentedControl from '../Components/SegmentedControl';
import Sheet from '../Components/Sheet';
import Spinner from '../Components/Spinner';
import { TierChip, TierIcon, tierLabel } from '../Components/TierIcon';
import { agoLabel } from '../lib/relativeTime.js';
import { asOfMillis } from '../lib/dynastyValues.js';
import { fetchRankingInputs, isMyRoster, rankLeague } from '../lib/leagueRankings.js';
import { ranksBy, THRESHOLDS, TIERS } from '../lib/powerRankings.js';

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

// The two scores as a picture: Future across, Now up. The Middle band is
// drawn where the Now thresholds cut; the vertical line is the league-average
// Future, a reference rather than a tier line. It used to be two lines at
// the two Future cutoffs (All-in's -0.5 above the band, Rebuilding's 0 below),
// which read as a chart drawn out of alignment - and once bought picks could
// make a team Rebuilding, the lower one was not even where the cut is. The
// tier chip in the list is the authority on any one team.
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
            <div className="border-mark absolute inset-y-0 left-1/2 border-l border-dashed" />

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

            {/* Both captions sit on the centre line, backed with the chart's own
                surface so the dashes stop short of the text. */}
            <span className="bg-raised text-ink-quiet absolute bottom-1.5 left-1/2 -translate-x-1/2 px-1 font-mono text-[10px]">
                FUTURE →
            </span>
            {/* Top centre rather than rotated down the left edge, where it
                sat on the Middle label and on any team pinned to that edge. */}
            <span className="bg-raised text-ink-quiet absolute top-1.5 left-1/2 -translate-x-1/2 px-1 font-mono text-[10px]">
                ↑ NOW
            </span>
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

// `draft` is the league's own rookie draft. Once its order is set, picks in it
// are priced at their exact slot rather than estimated - see lib/pickSlots.js.
const PowerRankingsPanel = ({
    leagueID,
    league,
    rosterData,
    playerInfo,
    sleeperUserId,
    currentDraftComplete,
    draft,
}) => {
    const [data, setData] = useState(undefined);
    const [loading, setLoading] = useState(true);
    const [source, setSource] = useState('blend');
    const [selectedId, setSelectedId] = useState(null);
    const [tiersOpen, setTiersOpen] = useState(false);
    const tiersButtonRef = useRef(null);

    // Keyed on the league OBJECT's id, not the `leagueID` prop. On a league
    // switch App updates the id first and the league object a beat later, so
    // an effect keyed on the prop fetched the new league's inputs with the old
    // league's object - the previous league's traded picks - and never ran
    // again once the right object arrived. That showed kpresley, holding most
    // of TBD's 2027 firsts, as Stuck: his picks had been credited from
    // another league's trades.
    const inputsLeagueId = league?.league_id;
    useEffect(() => {
        if (!inputsLeagueId) return undefined;
        let cancelled = false;
        setLoading(true);

        fetchRankingInputs(league).then((inputs) => {
            if (cancelled) return;
            setData({ ...inputs, leagueId: inputsLeagueId });
            setLoading(false);
        });

        return () => {
            cancelled = true;
        };
        // App rebuilds the league object on every load; refetching on a new
        // object with the same id would be waste.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [inputsLeagueId, league?.season]);

    // Everything on screen has to be about one league. Until the fetched
    // inputs, the league object and the prop all agree, this is mid-switch,
    // and the honest thing to show is the spinner.
    const inSync = data?.leagueId === inputsLeagueId && inputsLeagueId === leagueID;

    const teams = useMemo(
        () =>
            inSync
                ? rankLeague({ league, rosters: rosterData, playerInfo, inputs: data, currentDraftComplete, draft })
                : null,
        [inSync, data, rosterData, league, playerInfo, currentDraftComplete, draft],
    );

    if (loading || !inSync) {
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

    const myRosterId = rosterData.find((roster) => isMyRoster(roster, sleeperUserId))?.roster_id;
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
                <div className="[scrollbar-width:none] overflow-x-auto px-4 [&::-webkit-scrollbar]:hidden">
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
