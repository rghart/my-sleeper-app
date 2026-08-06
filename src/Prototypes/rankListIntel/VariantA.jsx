import { useState } from 'react';
import PositionTag from '../../Components/PositionTag';
import Gauntlet from './Gauntlet';
import InfoTip from './InfoTip';
import PickSelector from './PickSelector';
import { survivalPhrase, survivalTone } from './glossary.js';

// THROWAWAY PROTOTYPE — leaguemate intel in the rank list.
//
// Settled shape: percent chip in the row, tap to push a detail view; ADP /
// League ADP naming; tap-a-? for meanings; a leaguemate's own ADP only above
// the signal threshold.
//
// New here: the pick being analyzed is CHOSEN, not assumed. Every number on
// the screen is scoped to `atPick` - the chip, the ordering, the gauntlet -
// so picking a different pick re-answers the whole list against it. That
// makes the "which of these two lasts longer?" question answerable by reading
// two rows, without a dedicated compare mode.

const bandBg = (p) => (p >= 0.66 ? 'rgba(95,208,138,.14)' : p >= 0.33 ? 'rgba(224,165,74,.14)' : 'rgba(255,95,86,.14)');

const survivalAt = (target, atPick) => target.byPick[String(atPick)]?.adjSurvival ?? 1;

const Detail = ({ target, data, atPick, onBack }) => (
    <div className="px-2 py-2.5">
        <button
            type="button"
            onClick={onBack}
            className="text-ink-quiet hover:text-ink mb-2 -ml-1 flex items-center gap-1.5 px-1.5 py-1 font-mono text-[11px]"
        >
            <span className="text-[13px]">←</span> Ranks
        </button>
        <div className="px-1.5 pb-3">
            <div className="flex min-w-0 items-center gap-2">
                <PositionTag position={target.position} />
                <span className="text-ink truncate text-[17px] font-semibold">{target.name}</span>
            </div>
            <p className="mt-2 text-[15px] leading-snug">
                <span className={`font-semibold ${survivalTone(survivalAt(target, atPick))}`}>
                    {survivalPhrase(survivalAt(target, atPick))}
                </span>
                <span className="text-ink-quiet"> at pick {atPick} — </span>
                <span className={`font-mono font-semibold ${survivalTone(survivalAt(target, atPick))}`}>
                    {Math.round(survivalAt(target, atPick) * 100)}%
                </span>
                <span className="text-ink-quiet"> of the time.</span>
            </p>
        </div>
        <div className="px-1.5">
            <Gauntlet target={target} data={data} atPick={atPick} />
        </div>
    </div>
);

const VariantA = ({ data }) => {
    // Default to your own next pick when you have one; otherwise the next pick
    // on the board. Never the current pick - "will he last until right now" is
    // not a question, and answering it renders every player at 100%.
    const defaultPick = data.myPicks.find((p) => p > data.currentPick) ?? data.currentPick + 1;
    const [atPick, setAtPick] = useState(Math.min(defaultPick, data.lastPick));
    const [selectedId, setSelectedId] = useState(null);
    const selected = data.targets.find((t) => t.id === selectedId);

    if (selected) {
        return <Detail target={selected} data={data} atPick={atPick} onBack={() => setSelectedId(null)} />;
    }

    // Ordered by the chosen pick, so the top of the list is always "most
    // likely to be gone by then" - which is what the ordering should mean.
    const rows = [...data.targets].sort((a, b) => survivalAt(a, atPick) - survivalAt(b, atPick));

    return (
        <div className="px-2 py-2.5">
            <div className="flex items-center justify-between px-0.5 pb-1.5">
                <span className="text-ink text-[13px] font-semibold">Still there at…</span>
                <InfoTip />
            </div>
            <PickSelector board={data.board} selected={atPick} onSelect={setAtPick} currentPick={data.currentPick} />
            <ul className="flex list-none flex-col gap-0.5 pt-1.5">
                {rows.map((target) => {
                    const p = survivalAt(target, atPick);
                    return (
                        <li key={target.id}>
                            <button
                                type="button"
                                onClick={() => setSelectedId(target.id)}
                                className="rounded-row flex min-h-[46px] w-full items-center gap-3 px-2.5 py-[11px] text-left"
                            >
                                <span className="flex min-w-0 flex-1 flex-col">
                                    <span className="flex min-w-0 items-center gap-2">
                                        <span className="text-ink min-w-0 truncate text-[15px] leading-5 font-semibold tracking-[-0.01em]">
                                            {target.name}
                                        </span>
                                        <PositionTag position={target.position} />
                                    </span>
                                    <span className="flex min-w-0 items-center gap-1.5 leading-[14px]">
                                        <span className="text-ink-dim shrink-0 font-mono text-[11px] tabular-nums">
                                            ADP {target.marketPick ? target.marketPick : '—'}
                                            <span className="text-ink-dim"> · Lg </span>
                                            <span className="text-ink-quiet">{target.leagueAdp}</span>
                                        </span>
                                        {target.notable && (
                                            <span className="bg-mine-chip text-mine flex min-w-0 items-center gap-1 rounded-full px-1.5 py-px font-mono text-[10px] font-semibold">
                                                <span className="max-w-[62px] min-w-0 truncate">
                                                    {target.notable.manager}
                                                </span>
                                                <span className="shrink-0 tabular-nums">{target.notable.adp}</span>
                                            </span>
                                        )}
                                    </span>
                                </span>
                                <span
                                    className={`w-[52px] shrink-0 rounded-full py-1 text-center font-mono text-[12px] font-semibold tabular-nums ${survivalTone(p)}`}
                                    style={{ background: bandBg(p) }}
                                >
                                    {Math.round(p * 100)}%
                                </span>
                                <span className="text-ink-dim shrink-0 text-[10px]">›</span>
                            </button>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
};

export default VariantA;
