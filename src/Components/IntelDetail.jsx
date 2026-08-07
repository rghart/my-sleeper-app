import PositionTag from './PositionTag';
import { TermTip } from './IntelTermTip';
import { gapPhrase, gapTone, survivalPhrase, survivalTone } from './intelGlossary.js';
import { managerSample, stationsFor, survivalAt } from '../lib/availability.js';

// The drill-down (docs/leaguemate-intel.md §3 Frontend).
//
// Pushed in place with a `← Ranks` back control rather than opened as a
// second Sheet: on a phone the rank list is already inside a sheet, so a
// sheet-on-a-sheet reads as a replacement with no way back. Not an accordion
// either - there is no room for the gauntlet inside a row.
//
// Everything is scoped to `atPick`, which the selector owns. Nothing here
// computes a survival number a second way: the station decay is read from the
// same `byPick` matrix the row chip reads, so the two cannot disagree.

// Threat severity for the station dot and its bar. `--raw-mark` is the
// "nothing to see here" end of the scale, not a colour of its own.
function threatFill(probability) {
    if (probability >= 0.25) return 'var(--raw-danger)';
    if (probability >= 0.1) return 'var(--raw-warn)';
    return 'var(--raw-mark)';
}

const Stat = ({ label, value, sub, tone = 'text-ink' }) => (
    <div className="min-w-0">
        <p className="text-ink-dim m-0 flex items-center font-mono text-[9px] tracking-[.08em] uppercase">{label}</p>
        <p className={`m-0 font-mono text-[15px] font-semibold tabular-nums ${tone}`}>{value}</p>
        {sub && <p className="text-ink-dim m-0 font-mono text-[9px]">{sub}</p>}
    </div>
);

/**
 * One manager's history with this player, in words. This is the §3 copy-rules
 * table reaching the screen: `managerSample` decides what may be said, and
 * each branch here says only that. The recurring failure in this feature was
 * never the maths - it was the sentence next to the number.
 */
function evidenceFor(sample) {
    switch (sample.kind) {
        case 'none':
            return 'no drafts of theirs seen — league average';
        case 'never':
            return `never taken him · ${sample.of} draft${sample.of === 1 ? '' : 's'} seen`;
        case 'singlePick':
            return sample.pick
                ? `took him once — at ${sample.pick}`
                : `took him once of ${sample.of} draft${sample.of === 1 ? '' : 's'}`;
        case 'thin':
            return `took him ${sample.times}× · we've only seen ${sample.of} of their drafts`;
        case 'countOnly':
            return `took him ${sample.times}× of ${sample.of} drafts`;
        default:
            return `took him ${sample.times}× of ${sample.of} drafts · their ADP ${sample.adp}`;
    }
}

const Station = ({ station, threshold, isLast }) => {
    const { probability, isMine, mate, tookCount, draftsSeen } = station;
    const live = probability > 0.08;
    const sample = managerSample({ times: tookCount, of: draftsSeen, adp: mate?.adp, picks: mate?.picks }, threshold);

    return (
        <li className="relative flex items-start gap-2.5">
            {!isLast && <span className="bg-line absolute top-6 left-[10px] h-[calc(100%-12px)] w-px" aria-hidden />}
            <span
                className={`relative z-10 mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full font-mono text-[9px] font-semibold ${
                    isMine || live ? 'text-ground' : 'text-ink-dim'
                }`}
                style={{ background: isMine ? 'var(--raw-mine)' : live ? threatFill(probability) : 'var(--raw-mark)' }}
            >
                {station.pick}
            </span>
            <div className="min-w-0 flex-1 pb-2.5">
                <div className="flex items-baseline justify-between gap-2">
                    <span
                        className={`truncate text-[13px] ${
                            isMine ? 'text-mine font-semibold' : live ? 'text-ink font-semibold' : 'text-ink-quiet'
                        }`}
                    >
                        {isMine ? 'You' : station.manager}
                    </span>
                    <span className="text-ink-dim shrink-0 font-mono text-[10px] tabular-nums">
                        {station.survivalAfter == null ? 'no read' : `${Math.round(station.survivalAfter * 100)}% left`}
                    </span>
                </div>
                <div className="mt-1 flex items-center gap-2">
                    <div className="bg-line-mid h-1 w-full max-w-[110px] overflow-hidden rounded-full">
                        <div
                            className="h-full rounded-full"
                            style={{
                                width: `${Math.min(100, probability * 200)}%`,
                                background: threatFill(probability),
                            }}
                        />
                    </div>
                    <span className="text-ink-dim shrink-0 font-mono text-[10px] tabular-nums">
                        {probability >= 0.01 ? `${Math.round(probability * 100)}% to take him` : 'no read'}
                    </span>
                </div>
                <p className="text-ink-dim mt-0.5 font-mono text-[10px]">{evidenceFor(sample)}</p>
            </div>
        </li>
    );
};

const IntelDetail = ({ target, board, atPick, threshold, onBack }) => {
    const survival = survivalAt(target, atPick);
    const stations = stationsFor(target, board, atPick);
    const gap = target.adpGap;
    const perManager = target.perManager || [];

    return (
        <div className="px-2 py-2.5">
            <button
                type="button"
                onClick={onBack}
                className="text-ink-quiet hover:text-ink mb-2 -ml-1 flex min-h-11 items-center gap-1.5 px-1.5 py-1 font-mono text-[11px]"
            >
                <span className="text-[13px]">←</span> Ranks
            </button>

            <div className="px-1.5 pb-3">
                <div className="flex min-w-0 items-center gap-2">
                    <PositionTag position={target.position} />
                    <span className="text-ink truncate text-[17px] font-semibold">{target.name}</span>
                </div>
                {/* A statement of fact, never a recommendation (§3g). */}
                {survival == null ? (
                    <p className="text-ink-muted mt-2 text-[15px] leading-snug">
                        {atPick == null ? 'No further picks this draft.' : `No read for pick ${atPick}.`}
                    </p>
                ) : (
                    <p className="mt-2 text-[15px] leading-snug">
                        <span className={`font-semibold ${survivalTone(survival)}`}>{survivalPhrase(survival)}</span>
                        <span className="text-ink-quiet"> at pick {atPick} — </span>
                        <span className={`font-mono font-semibold ${survivalTone(survival)}`}>
                            {Math.round(survival * 100)}%
                        </span>
                        <span className="text-ink-quiet"> of the time.</span>
                    </p>
                )}
            </div>

            <div className="px-1.5">
                <div className="bg-raised-2 mb-3 grid grid-cols-3 gap-3 rounded-lg px-3 py-2.5">
                    <Stat
                        label={
                            <>
                                ADP
                                <TermTip termKey="adp" />
                            </>
                        }
                        // Null for real: a player FantasyCalc tracks but has no
                        // draft-year info for. An em dash, not a zero.
                        value={target.marketPick ? `#${target.marketPick}` : '—'}
                        sub="dynasty-wide"
                        tone="text-ink-muted"
                    />
                    <Stat
                        label={
                            <>
                                League ADP
                                <TermTip termKey="leagueAdp" />
                            </>
                        }
                        value={target.leagueAdp}
                        sub={`±${target.sd} · ${target.n} drafts`}
                        tone="text-ink"
                    />
                    <Stat
                        label={
                            <>
                                Gap
                                <TermTip termKey="gap" />
                            </>
                        }
                        value={gap == null ? '—' : `${gap > 0 ? '+' : ''}${gap}`}
                        sub={gap == null ? 'no ADP data' : gap > 0 ? 'slides' : 'reached'}
                        tone={gapTone(gap)}
                    />
                </div>

                {gapPhrase(gap) && (
                    <p className="text-ink-quiet -mt-1 mb-3 text-[12px] leading-snug">
                        Dynasty ADP has him <span className="text-ink font-semibold">#{target.marketPick}</span> in this
                        rookie class, but {gapPhrase(gap)} — they spend pick{' '}
                        <span className="text-ink font-semibold">{target.leagueAdp}</span> on him on average.
                    </p>
                )}

                {target.notable && (
                    <div className="border-mine/30 bg-mine-row mb-3 rounded-lg border px-3 py-2.5">
                        <p className="text-ink-dim m-0 flex items-center font-mono text-[9px] tracking-[.08em] uppercase">
                            {target.notable.manager}’s own ADP
                            <TermTip termKey="managerAdp" />
                        </p>
                        <p className="m-0 mt-0.5 text-[13px] leading-snug">
                            <span className="text-ink font-mono text-[15px] font-semibold tabular-nums">
                                {target.notable.adp}
                            </span>
                            <span className="text-ink-quiet">
                                {' '}
                                — took him {target.notable.times} of {target.notable.of} drafts.
                            </span>
                        </p>
                    </div>
                )}

                <p className="text-ink-dim mb-2 font-mono text-[10px] tracking-[.08em] uppercase">
                    {stations.length === 0
                        ? `Nothing between now and ${atPick}`
                        : `Who picks before ${atPick} (${stations.length} pick${stations.length === 1 ? '' : 's'})`}
                </p>
                {stations.length > 0 && (
                    <ol className="m-0 list-none p-0">
                        {stations.map((station, index) => (
                            <Station
                                key={station.pick}
                                station={station}
                                threshold={threshold}
                                isLast={index === stations.length - 1}
                            />
                        ))}
                    </ol>
                )}

                {perManager.length > 0 && (
                    <div className="border-line-mid border-t pt-2">
                        <p className="text-ink-dim mb-1 font-mono text-[10px] tracking-[.08em] uppercase">
                            Everyone who has drafted him
                        </p>
                        {perManager.slice(0, 4).map((entry) => (
                            <div key={entry.manager} className="flex items-baseline justify-between gap-2 py-0.5">
                                <span className="text-ink-quiet truncate text-[12px]">
                                    {entry.manager}{' '}
                                    <span className="text-ink-dim">
                                        {entry.times} of {entry.of}
                                    </span>
                                </span>
                                <span className="text-ink-dim shrink-0 font-mono text-[10px] tabular-nums">
                                    {entry.picks.slice(0, 3).join('  ')}
                                </span>
                            </div>
                        ))}
                        <p className="text-ink-dim mt-1 font-mono text-[9px]">round.slot @ overall pick</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default IntelDetail;
