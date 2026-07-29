import PickClock from './PickClock';
import { pickProgress, pickDeadline, URGENT_MS } from '../lib/draftClock.js';

// The one always-elevated surface on the draft screen (the other is a sheet).
// Everything the old panel header said in a stack of paragraphs and a bordered
// clock box - whose turn it is, which pick, how long is left, and where sync is
// reading from - reads across three rows here.
//
// The draft-source pill is the only way to point sync somewhere else now: the
// raw "Draft ID" text input that used to sit at the top of the panel body moved
// behind it (see DraftSourceSheet.jsx), so a mock draft id is still one tap
// away without a bare id field on the main screen.
const ClockCard = ({
    draft,
    onTheClockName,
    pickLabel,
    picksUntilMine,
    sourceLabel,
    sourceRef,
    isSourceOpen,
    onOpenSource,
    isSyncing,
    onToggleSync,
}) => {
    const progress = pickProgress(draft);
    const deadline = pickDeadline(draft);
    const urgent = deadline !== null && deadline - Date.now() <= URGENT_MS;

    // "YOU IN 0" is nonsense for the case that matters most, so zero gets its
    // own words. `null` (no pick of yours left on the board, or no display
    // name yet) shows nothing at all rather than a guess.
    const yourTurnLabel =
        picksUntilMine === null ? null : picksUntilMine === 0 ? 'YOUR PICK' : `YOU IN ${picksUntilMine}`;

    return (
        <div className="bg-raised border-line rounded-card m-3.5 flex flex-col gap-3.5 border p-4">
            <div className="flex items-center gap-2.5">
                <span className="text-ink-quiet font-mono text-[10px] font-semibold tracking-[.14em] uppercase">
                    On the clock
                </span>
                <span className="ml-auto flex items-center gap-2.5">
                    {yourTurnLabel && (
                        <span className="text-mine font-mono text-[10px] font-semibold tracking-[.14em]">
                            {yourTurnLabel}
                        </span>
                    )}
                    <button
                        type="button"
                        ref={sourceRef}
                        aria-expanded={isSourceOpen}
                        aria-label={`Draft source: ${sourceLabel}`}
                        onClick={onOpenSource}
                        className={`shrink-0 rounded-full border px-2 py-1 font-mono text-[10px] font-semibold tracking-[.06em] ${
                            isSourceOpen ? 'border-mine bg-mine-chip text-mine' : 'border-line text-ink-quiet'
                        }`}
                    >
                        <span aria-hidden="true">
                            {sourceLabel} {isSourceOpen ? '▴' : '▾'}
                        </span>
                    </button>
                </span>
            </div>

            <div className="flex items-end justify-between gap-3">
                <span className="flex min-w-0 flex-col">
                    <span className="text-ink truncate text-[19px] font-semibold tracking-[-0.02em]">
                        {onTheClockName}
                    </span>
                    {pickLabel && <span className="text-ink-quiet font-mono text-[12px]">{pickLabel}</span>}
                </span>
                <PickClock draft={draft} />
            </div>

            {progress !== null && (
                <div className="bg-line-mid h-[3px] w-full overflow-hidden rounded-full">
                    <div
                        className={`h-full rounded-full ${urgent ? 'bg-danger' : 'bg-mine'}`}
                        style={{ width: `${Math.round(progress * 100)}%` }}
                    />
                </div>
            )}

            <button
                type="button"
                onClick={onToggleSync}
                className={`min-h-11 w-full rounded-full text-[13px] font-semibold ${
                    isSyncing ? 'border-line text-ink-muted border' : 'bg-mine text-ground'
                }`}
            >
                {isSyncing ? 'Stop sync' : 'Sync draft'}
            </button>
        </div>
    );
};

export default ClockCard;
