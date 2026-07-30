import PickClock from './PickClock';
import { pickClockMode, pickProgress, pickDeadline, URGENT_MS } from '../lib/draftClock.js';

// The clock's four modes collapse into two card shapes. A `live`/`slow` draft
// is counting something down, so it gets the eyebrow, the countdown numeral,
// the progress bar and a primary sync action. The other three - complete,
// untimed, not-yet-started - have nothing to count, and dressing them in the
// countdown's chrome is what produced the card Ryan screenshotted: `ON THE
// CLOCK` over `No pick on the clock`, saying the same non-fact twice, under a
// full-width violet button competing with a board that had already finished.
//
// So in those modes the eyebrow becomes the draft's own identity (`2026
// ROOKIE`), the headline is the state itself (`Draft complete`), the subtitle
// counts what there is to count (`48 picks · synced 2m ago`), and sync drops to
// a secondary outlined pill.
const isCountingDown = (mode) => mode === 'live' || mode === 'slow';

const STATE_HEADLINE = {
    complete: 'Draft complete',
    untimed: 'Untimed draft',
    'not-started': "Draft hasn't started",
};

const ClockCard = ({
    draft,
    onTheClockName,
    pickLabel,
    picksUntilMine,
    picksMade,
    syncedLabel,
    sourceLabel,
    sourceRef,
    isSourceOpen,
    onOpenSource,
    isSyncing,
    onToggleSync,
}) => {
    const mode = pickClockMode(draft);
    const counting = isCountingDown(mode);
    const progress = counting ? pickProgress(draft) : null;
    const deadline = pickDeadline(draft);
    const urgent = counting && deadline !== null && deadline - Date.now() <= URGENT_MS;

    // "YOU IN 0" is nonsense for the case that matters most, so zero gets its
    // own words. `null` (no pick of yours left on the board, or no display
    // name yet) shows nothing at all rather than a guess. A draft that is not
    // counting down has nobody on the clock, so it never applies.
    const yourTurnLabel =
        !counting || picksUntilMine === null ? null : picksUntilMine === 0 ? 'YOUR PICK' : `YOU IN ${picksUntilMine}`;

    const seasonLabel = [draft.season, draft.player_pool].filter(Boolean).join(' ');
    const eyebrow = counting ? 'On the clock' : seasonLabel || 'Draft';

    // `48 picks · synced 2m ago` - the two things still worth knowing once
    // there is no clock. The sync half is omitted until a sync has actually
    // landed, rather than claiming "never".
    const restingSubtitle = [
        picksMade === null ? null : `${picksMade} ${picksMade === 1 ? 'pick' : 'picks'}`,
        syncedLabel,
    ]
        .filter(Boolean)
        .join(' · ');

    const syncLabel = isSyncing ? 'Stop sync' : 'Sync draft';

    return (
        <div className="bg-raised border-line rounded-card m-3.5 flex flex-col gap-3.5 border p-4">
            <div className="flex items-center gap-2.5">
                <span className="text-ink-quiet font-mono text-[10px] font-semibold tracking-[.14em] uppercase">
                    {eyebrow}
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
                        {counting ? onTheClockName : STATE_HEADLINE[mode]}
                    </span>
                    {counting
                        ? pickLabel && <span className="text-ink-quiet font-mono text-[12px]">{pickLabel}</span>
                        : restingSubtitle && (
                              <span className="text-ink-quiet font-mono text-[12px]">{restingSubtitle}</span>
                          )}
                </span>
                {counting ? (
                    <PickClock draft={draft} />
                ) : (
                    // Secondary, and beside the headline rather than under it:
                    // on a finished draft, re-syncing is a thing you might do,
                    // not the thing to do.
                    <button
                        type="button"
                        onClick={onToggleSync}
                        // The pill reads `SYNC`, but the action is the same one
                        // the counting-down card spells out in full - so it
                        // keeps that name rather than making a screen reader
                        // (or a test) treat the two shapes as two features.
                        aria-label={syncLabel}
                        className="border-line text-ink-muted min-h-11 shrink-0 rounded-full border px-3 font-mono text-[11px] font-semibold tracking-[.08em] uppercase"
                    >
                        <span aria-hidden="true">{isSyncing ? 'Stop' : 'Sync'}</span>
                    </button>
                )}
            </div>

            {progress !== null && (
                <div className="bg-line-mid h-[3px] w-full overflow-hidden rounded-full">
                    <div
                        className={`h-full rounded-full ${urgent ? 'bg-danger' : 'bg-mine'}`}
                        style={{ width: `${Math.round(progress * 100)}%` }}
                    />
                </div>
            )}

            {counting && (
                <button
                    type="button"
                    onClick={onToggleSync}
                    className={`min-h-11 w-full rounded-full text-[13px] font-semibold ${
                        isSyncing ? 'border-line text-ink-muted border' : 'bg-mine text-ground'
                    }`}
                >
                    {syncLabel}
                </button>
            )}
        </div>
    );
};

export default ClockCard;
