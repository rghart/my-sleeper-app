import { useEffect, useRef, useState } from 'react';
import { madePickKeys, newPickKeySet } from './lib/seenPicks.js';

const storageKey = (draftId) => `sleeper-app:seen-picks:${draftId}`;

// Never lets a storage failure reach the caller. Safari private mode throws
// on setItem (quota is 0 there), and a value written by some earlier version
// of this feature - or by anything else sharing origin storage - could be
// non-JSON or a non-array. Either way the feature degrades to in-memory only
// for this visit rather than taking the draft board down.
const readStored = (draftId) => {
    try {
        const raw = localStorage.getItem(storageKey(draftId));
        if (!raw) {
            return null;
        }
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : null;
    } catch {
        return null;
    }
};

const writeStored = (draftId, keys) => {
    try {
        localStorage.setItem(storageKey(draftId), JSON.stringify(keys));
    } catch {
        // Swallowed deliberately - see readStored's comment above.
    }
};

// Sentinel distinct from any real draft id (including `undefined` itself),
// so the first render always runs the init check below rather than being
// mistaken for "already initialised to this id".
const NOT_INITIALIZED = Symbol('not-initialized');

export function useSeenPicks({ draftId, builtDraft }) {
    const [seenKeys, setSeenKeys] = useState(null);
    const initializedDraftIdRef = useRef(NOT_INITIALIZED);
    const lastWrittenRef = useRef(null);

    // The snapshot is taken once per draftId, on the first render where a
    // built board is available, and then frozen in state for the rest of the
    // visit: it does NOT advance as the live sync brings more picks in. That
    // is what keeps a marker visible on a pick while the user is still
    // reading it, scrolling, or toggling Feed/Grid, instead of it vanishing
    // out from under them a few seconds later.
    useEffect(() => {
        if (initializedDraftIdRef.current === draftId) {
            return;
        }
        if (!builtDraft) {
            return;
        }
        const stored = readStored(draftId);
        const madeKeys = madePickKeys(builtDraft);
        // A built board arrives with no picks in it. buildDraftRounds only
        // lays out the pick order from the draft's slots; player ids land
        // later, when getLiveDraft runs - the Update button or the sync poll.
        // So on a first visit the board is genuinely empty at mount, and
        // seeding from it snapshots nothing: the first Update then flags every
        // pick on the board as new, which is the exact outcome the seeding
        // below exists to prevent. Measured in a browser against a finished
        // 50-pick league - all 50 lit up. With nothing stored, wait for the
        // board to actually carry picks before taking the snapshot.
        if (!stored && madeKeys.length === 0) {
            return;
        }
        // No stored value means this is the first-ever visit to this draft.
        // Seeding the snapshot with everything already made (rather than an
        // empty set) means a first visit shows nothing as new - it would
        // otherwise flag the entire existing board as "new" the moment
        // someone opens it.
        const initial = stored ? new Set(stored) : new Set(madeKeys);
        setSeenKeys(initial);
        initializedDraftIdRef.current = draftId;
        lastWrittenRef.current = null;
    }, [draftId, builtDraft]);

    // Keeps storage current with the full set of made picks - independent of
    // the frozen snapshot above - so the next visit compares against the
    // latest state rather than this one. Do not write on unmount instead:
    // closing the tab never unmounts anything, so a write there would never
    // fire and the snapshot would never advance.
    //
    // Guarded by a joined-string comparison, not a deep-equal on every
    // render: the live sync poll re-renders every few seconds and most of
    // those renders change nothing, so writing unconditionally would hit
    // localStorage on a timer for the entire draft.
    useEffect(() => {
        if (seenKeys === null) {
            return;
        }
        const madeKeys = madePickKeys(builtDraft);
        const joined = madeKeys.join(',');
        if (lastWrittenRef.current === joined) {
            return;
        }
        lastWrittenRef.current = joined;
        writeStored(draftId, madeKeys);
    }, [draftId, builtDraft, seenKeys]);

    const newPickKeys = seenKeys === null ? new Set() : newPickKeySet(builtDraft, seenKeys);

    const markSeen = (key) => {
        setSeenKeys((prev) => {
            const next = new Set(prev ?? []);
            next.add(key);
            return next;
        });
    };

    return { newPickKeys, markSeen };
}
