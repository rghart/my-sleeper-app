import { TERMS, gapPhrase, gapTone } from './glossary.js';
import { TermTip } from './InfoTip';

// THROWAWAY PROTOTYPE — the drill-down body.
//
// Now scoped to a CHOSEN pick rather than a hardcoded "your next pick": the
// caller passes `atPick`, and the gauntlet walks the board from the current
// pick up to it. Everything here reads out of `target.byPick[atPick]`, which
// the fixture precomputes for every remaining pick.

const danger = (p) => (p >= 0.25 ? 'var(--raw-danger)' : p >= 0.1 ? 'var(--raw-warn)' : 'var(--raw-mark)');

const Stat = ({ label, value, sub, tone = 'text-ink' }) => (
    <div className="min-w-0">
        <p className="text-ink-dim m-0 flex items-center font-mono text-[9px] tracking-[.08em] uppercase">{label}</p>
        <p className={`m-0 font-mono text-[15px] font-semibold tabular-nums ${tone}`}>{value}</p>
        {sub && <p className="text-ink-dim m-0 font-mono text-[9px]">{sub}</p>}
    </div>
);

const soloPick = (mate) => {
    const match = /@(\d+)/.exec(mate?.picks?.[0] ?? '');
    return match ? match[1] : null;
};

const Station = ({ threat, survivalAfter, isLast, mate, isMine }) => {
    const p = threat.prob ?? 0;
    const live = p > 0.08;
    // Sample size travels with every claim. A manager we have never observed
    // gets the league baseline back from the shrinkage, and presenting that as
    // if it were about them is the trap this exists to stop.
    const evidence =
        threat.drafts === 0
            ? 'no drafts of theirs seen — league average'
            : threat.tookCount > 0
              ? `took him ${threat.tookCount}× of ${threat.drafts} drafts`
              : `never taken him · ${threat.drafts} draft${threat.drafts === 1 ? '' : 's'} seen`;

    // One pick is not an average, so a single take names the actual pick
    // rather than dressing it up as an ADP.
    const own =
        threat.tookCount === 1
            ? soloPick(mate) && `at ${soloPick(mate)}`
            : threat.tookCount > 1 && mate
              ? `their ADP ${mate.adp}`
              : null;

    return (
        <li className="relative flex items-start gap-2.5">
            {!isLast && <span className="bg-line absolute top-6 left-[10px] h-[calc(100%-12px)] w-px" aria-hidden />}
            <span
                className="relative z-10 mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full font-mono text-[9px] font-semibold"
                style={{
                    background: isMine ? 'var(--raw-mine)' : live ? danger(p) : 'var(--raw-raised-2)',
                    color: isMine || live ? '#0a0e14' : 'var(--raw-ink-dim)',
                }}
            >
                {threat.pick}
            </span>
            <div className="min-w-0 flex-1 pb-2.5">
                <div className="flex items-baseline justify-between gap-2">
                    <span
                        className={`truncate text-[13px] ${
                            isMine ? 'text-mine font-semibold' : live ? 'text-ink font-semibold' : 'text-ink-quiet'
                        }`}
                    >
                        {isMine ? 'You' : threat.manager}
                    </span>
                    <span className="text-ink-dim shrink-0 font-mono text-[10px] tabular-nums">
                        {survivalAfter}% left
                    </span>
                </div>
                <div className="mt-1 flex items-center gap-2">
                    <div className="bg-line-mid h-1 w-full max-w-[110px] overflow-hidden rounded-full">
                        <div
                            className="h-full rounded-full"
                            style={{ width: `${Math.min(100, p * 200)}%`, background: danger(p) }}
                        />
                    </div>
                    <span className="text-ink-dim shrink-0 font-mono text-[10px] tabular-nums">
                        {p >= 0.01 ? `${Math.round(p * 100)}% to take him` : 'no read'}
                    </span>
                </div>
                <p className="text-ink-dim mt-0.5 font-mono text-[10px]">
                    {evidence}
                    {own && (
                        <>
                            <span> · </span>
                            <span className="text-mine font-semibold">{own}</span>
                        </>
                    )}
                </p>
            </div>
        </li>
    );
};

/** The picks between now and `atPick` (exclusive), with survival decaying. */
export const stationsFor = (target, board, atPick) => {
    const between = board.filter((slot) => slot.pick < atPick);
    const byManager = new Map((target.perManager ?? []).map((m) => [m.manager, m]));
    // `byPick[n].threats` holds every pick BEFORE n - which is exactly the set
    // of stations being rendered - so read the threat list once from the
    // target pick rather than per station. Looking it up under the station's
    // own pick number silently found nothing and rendered "no read" on every
    // row while survival visibly decayed.
    const threatByPick = new Map((target.byPick[String(atPick)]?.threats ?? []).map((threat) => [threat.pick, threat]));
    return between.map((slot) => {
        const threat = threatByPick.get(slot.pick) ?? { prob: 0, tookCount: 0, drafts: slot.drafts };
        // Survival *after* this pick is the value stored at the following one.
        const next = target.byPick[String(slot.pick + 1)];
        return {
            threat: { ...threat, pick: slot.pick, manager: slot.manager },
            mate: byManager.get(slot.manager),
            isMine: slot.mine,
            survivalAfter: Math.round((next?.adjSurvival ?? 0) * 100),
        };
    });
};

const Gauntlet = ({ target, data, atPick, showKey = false }) => {
    const stations = stationsFor(target, data.board, atPick);
    const gap = target.adpGap;

    return (
        <div>
            <div className="bg-raised-2 mb-3 grid grid-cols-3 gap-3 rounded-lg px-3 py-2.5">
                <Stat
                    label={
                        <>
                            ADP
                            <TermTip termKey="adp" />
                        </>
                    }
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
                    value={gap === undefined ? '—' : `${gap > 0 ? '+' : ''}${gap}`}
                    sub={gap === undefined ? 'no ADP data' : gap > 0 ? 'slides' : 'reached'}
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
                    {stations.map((s, i) => (
                        <Station
                            key={s.threat.pick}
                            threat={s.threat}
                            mate={s.mate}
                            isMine={s.isMine}
                            survivalAfter={s.survivalAfter}
                            isLast={i === stations.length - 1}
                        />
                    ))}
                </ol>
            )}

            {target.perManager.length > 0 && (
                <div className="border-line-mid border-t pt-2">
                    <p className="text-ink-dim mb-1 font-mono text-[10px] tracking-[.08em] uppercase">
                        Everyone who has drafted him
                    </p>
                    {target.perManager.slice(0, 4).map((m) => (
                        <div key={m.manager} className="flex items-baseline justify-between gap-2 py-0.5">
                            <span className="text-ink-quiet truncate text-[12px]">
                                {m.manager}{' '}
                                <span className="text-ink-dim">
                                    {m.times} of {m.of}
                                </span>
                            </span>
                            <span className="text-ink-dim shrink-0 font-mono text-[10px] tabular-nums">
                                {m.picks.slice(0, 3).join('  ')}
                            </span>
                        </div>
                    ))}
                    <p className="text-ink-dim mt-1 font-mono text-[9px]">round.slot @ overall pick</p>
                </div>
            )}

            {showKey && (
                <dl className="border-line-mid mt-3 border-t pt-2">
                    {Object.values(TERMS).map((term) => (
                        <div key={term.short} className="py-1">
                            <dt className="text-ink-quiet font-mono text-[10px] font-semibold">{term.short}</dt>
                            <dd className="text-ink-dim m-0 text-[11px] leading-snug">{term.long}</dd>
                        </div>
                    ))}
                </dl>
            )}
        </div>
    );
};

export default Gauntlet;
