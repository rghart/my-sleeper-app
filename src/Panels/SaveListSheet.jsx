import { useRef, useState } from 'react';
import Sheet from '../Components/Sheet';

// Firebase keys the list by a slug of its name, so a name is required and
// short ones make bad keys. Four characters is the rule saveRankList has
// always applied (`length > 3`); it lives here now so the button can be
// disabled rather than the save failing into a console.log.
export const MIN_NAME_LENGTH = 4;

const primaryPill = 'bg-mine text-ground min-h-11 rounded-full px-3.5 text-[13px] font-semibold disabled:opacity-50';
const fieldClass = 'border-line bg-raised-2 text-ink caret-ink-muted rounded-row w-full border p-3 text-[14px]';

// Naming and saving a pasted list. This is the half of the old Ranks control
// stack that the redesign lost: the name field only ever rendered inside the
// paste sheet, and startSearch closes that sheet the moment a list is pasted -
// so the one affordance that could save a list was behind the button that had
// just dismissed itself. It gets its own sheet, opened from a `Save` pill that
// appears in the Ranks header as soon as there is a list to save.
//
// Three actions, not one, because a saved list is a different situation from a
// fresh paste: overwrite the list you are scoped to, fork it under a new name,
// or delete it. `savedListName` is what tells those apart - null means the
// session list has never been saved, and only the name field shows.
const SaveListSheet = ({ savedListName, playerCount, onSaveNew, onUpdate, onDelete, onClose, triggerRef }) => {
    const [name, setName] = useState('');
    const [pendingAction, setPendingAction] = useState(null);
    const [confirmingDelete, setConfirmingDelete] = useState(false);
    const [error, setError] = useState(null);
    const nameRef = useRef(null);

    const trimmedName = name.trim();
    const canSaveNew = trimmedName.length >= MIN_NAME_LENGTH;

    // Every action reports failure the same way. The old saveRankList/
    // deleteRankList logged a failed PUT to the console and left the sheet
    // looking like it had worked - the one path in the app that still failed
    // silently once the load chain was covered.
    const run = async (action, work) => {
        setError(null);
        setPendingAction(action);
        const ok = await work();
        setPendingAction(null);
        if (ok) {
            onClose();
        } else {
            setError("Couldn't reach the server. Your list is still here - try again.");
        }
    };

    const busy = pendingAction !== null;

    return (
        <Sheet
            title="Save list"
            subtitle={`${playerCount} ${playerCount === 1 ? 'player' : 'players'}`}
            onClose={onClose}
            triggerRef={triggerRef}
            centerOnDesktop
        >
            <div className="flex flex-col gap-3.5 p-4">
                {savedListName && (
                    <>
                        <div className="border-line rounded-row flex items-center justify-between gap-2 border p-3">
                            <span className="flex min-w-0 flex-col">
                                <span className="text-ink truncate text-[14px] font-semibold">{savedListName}</span>
                                <span className="text-ink-quiet font-mono text-[10px] tracking-[.08em] uppercase">
                                    Saved list
                                </span>
                            </span>
                            <button
                                type="button"
                                disabled={busy}
                                onClick={() => run('update', onUpdate)}
                                className={`${primaryPill} shrink-0`}
                            >
                                {pendingAction === 'update' ? 'Saving…' : 'Update'}
                            </button>
                        </div>
                        {/* A rule with a word in it, rather than a second
                            heading: the two halves are alternatives, and the
                            eye needs to be told that much and no more. */}
                        <span className="flex items-center gap-2.5">
                            <span className="bg-line-mid h-px flex-1" />
                            <span className="text-ink-dim font-mono text-[10px] tracking-[.14em] uppercase">or</span>
                            <span className="bg-line-mid h-px flex-1" />
                        </span>
                    </>
                )}

                <div className="flex flex-col gap-2">
                    <label htmlFor="save-list-name" className="text-ink-dim m-0 font-mono text-[11px] tracking-[.08em]">
                        {savedListName ? 'SAVE AS A NEW LIST' : 'LIST NAME'}
                    </label>
                    {/* Never the saved list's own name as the placeholder:
                        sitting under a card that already shows that name, a
                        greyed copy of it reads as a filled-in field. */}
                    <input
                        id="save-list-name"
                        ref={nameRef}
                        type="text"
                        placeholder={savedListName ? 'A different name…' : '2026 Rookie Ranks'}
                        className={fieldClass}
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                    />
                    <button
                        type="button"
                        disabled={!canSaveNew || busy}
                        onClick={() => run('new', () => onSaveNew(trimmedName))}
                        className={primaryPill}
                    >
                        {pendingAction === 'new' ? 'Saving…' : savedListName ? 'Save as new' : 'Save list'}
                    </button>
                    <p className="text-ink-quiet m-0 font-mono text-[10px]">
                        At least {MIN_NAME_LENGTH} characters. Saved lists are yours alone and open from the rank-list
                        pill.
                    </p>
                </div>

                {savedListName &&
                    (confirmingDelete ? (
                        <div className="border-line rounded-row flex flex-col gap-2.5 border p-3">
                            <p className="text-ink m-0 text-[13px]">Delete “{savedListName}”? This can’t be undone.</p>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() => run('delete', onDelete)}
                                    className="bg-danger text-ground min-h-11 rounded-full px-3.5 text-[13px] font-semibold disabled:opacity-50"
                                >
                                    {pendingAction === 'delete' ? 'Deleting…' : 'Delete'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setConfirmingDelete(false)}
                                    className="border-line text-ink-muted min-h-11 rounded-full border px-3.5 text-[13px] font-semibold"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    ) : (
                        <button
                            type="button"
                            onClick={() => setConfirmingDelete(true)}
                            className="text-danger min-h-11 self-start text-[13px] font-semibold"
                        >
                            Delete list
                        </button>
                    ))}

                {error && (
                    <p role="alert" className="text-warn m-0 text-[13px]">
                        {error}
                    </p>
                )}
            </div>
        </Sheet>
    );
};

export default SaveListSheet;
