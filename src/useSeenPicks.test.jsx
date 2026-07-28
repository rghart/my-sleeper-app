import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useSeenPicks } from './useSeenPicks.js';

const round = (roundNumber, picks) => ({ round: roundNumber, picks });
const pick = (pickNumber, playerId = null) => ({ pick_number: pickNumber, player_id: playerId });

const STORAGE_KEY = (draftId) => `sleeper-app:seen-picks:${draftId}`;

beforeEach(() => {
    localStorage.clear();
});

describe('useSeenPicks first visit', () => {
    it('shows nothing as new on a first-ever visit, even though the board already has picks made', () => {
        const builtDraft = [round(1, [pick(1, 'p1'), pick(2, 'p2'), pick(3, null)])];

        const { result } = renderHook(() => useSeenPicks({ draftId: 'draft-1', builtDraft }));

        expect(result.current.newPickKeys).toEqual(new Set());
    });

    it('persists the current made picks as the seen snapshot for next time', () => {
        const builtDraft = [round(1, [pick(1, 'p1')])];

        renderHook(() => useSeenPicks({ draftId: 'draft-1', builtDraft }));

        expect(JSON.parse(localStorage.getItem(STORAGE_KEY('draft-1')))).toEqual(['1.1']);
    });
});

describe('useSeenPicks before the board arrives', () => {
    it('defers the snapshot until a built board exists, rather than snapshotting an empty one', () => {
        localStorage.setItem(STORAGE_KEY('draft-1'), JSON.stringify(['1.1']));

        const { result, rerender } = renderHook(({ builtDraft }) => useSeenPicks({ draftId: 'draft-1', builtDraft }), {
            initialProps: { builtDraft: null },
        });

        // Nothing to compare against yet - and crucially the stored snapshot
        // must not have been consumed against a null board, which would have
        // latched an empty seen set for the whole visit and flagged the entire
        // board as new the moment it loaded.
        expect(result.current.newPickKeys).toEqual(new Set());

        rerender({ builtDraft: [round(1, [pick(1, 'p1'), pick(2, 'p2')])] });

        expect(result.current.newPickKeys).toEqual(new Set(['1.2']));
    });

    it('does not write a snapshot over the stored one before the board arrives', () => {
        localStorage.setItem(STORAGE_KEY('draft-1'), JSON.stringify(['1.1']));

        renderHook(() => useSeenPicks({ draftId: 'draft-1', builtDraft: null }));

        // An unguarded write here would store [] and destroy the record of
        // what the user had already seen.
        expect(JSON.parse(localStorage.getItem(STORAGE_KEY('draft-1')))).toEqual(['1.1']);
    });
});

describe('useSeenPicks when the board arrives before its picks do', () => {
    // The real load order, and the one the fixtures above do not reproduce:
    // buildDraftRounds hands back a full board of *unmade* picks, and the
    // player ids only arrive when getLiveDraft runs. Every test that mounts
    // with a pre-filled board misses this entirely - it was found in a
    // browser, where a finished 50-pick league lit all 50 rows as new.
    const emptyBoard = [round(1, [pick(1), pick(2), pick(3)])];
    const filledBoard = [round(1, [pick(1, 'p1'), pick(2, 'p2'), pick(3, 'p3')])];

    it('does not treat the first Update as fifty new picks on a first visit', () => {
        const { result, rerender } = renderHook(({ builtDraft }) => useSeenPicks({ draftId: 'draft-1', builtDraft }), {
            initialProps: { builtDraft: emptyBoard },
        });

        expect(result.current.newPickKeys).toEqual(new Set());

        rerender({ builtDraft: filledBoard });

        expect(result.current.newPickKeys).toEqual(new Set());
        expect(JSON.parse(localStorage.getItem(STORAGE_KEY('draft-1')))).toEqual(['1.1', '1.2', '1.3']);
    });

    it('does not store an empty snapshot at mount, which would poison the next visit', () => {
        renderHook(() => useSeenPicks({ draftId: 'draft-1', builtDraft: emptyBoard }));

        // Writing [] here would count as "something is stored" next time, so
        // the first-visit branch would never run again and the whole board
        // would flag as new on the second visit instead of the first.
        expect(localStorage.getItem(STORAGE_KEY('draft-1'))).toBeNull();
    });

    it('still reports genuinely new picks to a returning visitor after Update fills the board', () => {
        localStorage.setItem(STORAGE_KEY('draft-1'), JSON.stringify(['1.1']));

        const { result, rerender } = renderHook(({ builtDraft }) => useSeenPicks({ draftId: 'draft-1', builtDraft }), {
            initialProps: { builtDraft: emptyBoard },
        });

        rerender({ builtDraft: filledBoard });

        expect(result.current.newPickKeys).toEqual(new Set(['1.2', '1.3']));
    });
});

describe('useSeenPicks storage writes', () => {
    it('writes once and then stays quiet while the live poll re-renders with an unchanged board', () => {
        const builtDraft = [round(1, [pick(1, 'p1')])];
        const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');

        const { rerender } = renderHook(({ builtDraft }) => useSeenPicks({ draftId: 'draft-1', builtDraft }), {
            initialProps: { builtDraft },
        });
        const writesAfterMount = setItemSpy.mock.calls.length;

        // syncLiveDraft hands back a fresh array every poll even when nothing
        // changed, so identity is not a usable guard - the made-key list is.
        rerender({ builtDraft: [round(1, [pick(1, 'p1')])] });
        rerender({ builtDraft: [round(1, [pick(1, 'p1')])] });

        expect(setItemSpy.mock.calls.length).toBe(writesAfterMount);

        rerender({ builtDraft: [round(1, [pick(1, 'p1'), pick(2, 'p2')])] });
        expect(setItemSpy.mock.calls.length).toBe(writesAfterMount + 1);

        setItemSpy.mockRestore();
    });
});

describe('useSeenPicks returning visit', () => {
    it('reports picks made since the stored snapshot as new', () => {
        localStorage.setItem(STORAGE_KEY('draft-1'), JSON.stringify(['1.1']));
        const builtDraft = [round(1, [pick(1, 'p1'), pick(2, 'p2')])];

        const { result } = renderHook(() => useSeenPicks({ draftId: 'draft-1', builtDraft }));

        expect(result.current.newPickKeys).toEqual(new Set(['1.2']));
    });

    it('keeps the snapshot frozen across a rerender with more live picks, so markers do not disappear mid-visit', () => {
        localStorage.setItem(STORAGE_KEY('draft-1'), JSON.stringify([]));
        const builtDraft = [round(1, [pick(1, 'p1')])];

        const { result, rerender } = renderHook(({ builtDraft }) => useSeenPicks({ draftId: 'draft-1', builtDraft }), {
            initialProps: { builtDraft },
        });

        expect(result.current.newPickKeys).toEqual(new Set(['1.1']));

        const moreLivePicks = [round(1, [pick(1, 'p1'), pick(2, 'p2')])];
        rerender({ builtDraft: moreLivePicks });

        // Both picks are new: the snapshot did not advance just because a
        // live poll re-rendered with an extra pick.
        expect(result.current.newPickKeys).toEqual(new Set(['1.1', '1.2']));
    });

    it('reports a manual pick projected into a later round while an earlier real pick is still unseen', () => {
        localStorage.setItem(STORAGE_KEY('draft-1'), JSON.stringify([]));
        const builtDraft = [round(1, [pick(1, 'p1'), pick(2, null)]), round(2, [pick(1, 'manual-p')])];

        const { result } = renderHook(() => useSeenPicks({ draftId: 'draft-1', builtDraft }));

        expect(result.current.newPickKeys).toEqual(new Set(['1.1', '2.1']));
    });
});

describe('useSeenPicks markSeen', () => {
    it('removes a key from newPickKeys once marked seen', () => {
        localStorage.setItem(STORAGE_KEY('draft-1'), JSON.stringify([]));
        const builtDraft = [round(1, [pick(1, 'p1')])];

        const { result } = renderHook(() => useSeenPicks({ draftId: 'draft-1', builtDraft }));

        expect(result.current.newPickKeys).toEqual(new Set(['1.1']));

        act(() => {
            result.current.markSeen('1.1');
        });

        expect(result.current.newPickKeys).toEqual(new Set());
    });
});

describe('useSeenPicks draft switching', () => {
    it('re-initialises against the new draft id when draftId changes', () => {
        localStorage.setItem(STORAGE_KEY('draft-1'), JSON.stringify(['1.1']));
        localStorage.setItem(STORAGE_KEY('draft-2'), JSON.stringify([]));

        const { result, rerender } = renderHook(({ draftId, builtDraft }) => useSeenPicks({ draftId, builtDraft }), {
            initialProps: {
                draftId: 'draft-1',
                builtDraft: [round(1, [pick(1, 'p1'), pick(2, 'p2')])],
            },
        });

        expect(result.current.newPickKeys).toEqual(new Set(['1.2']));

        rerender({ draftId: 'draft-2', builtDraft: [round(1, [pick(1, 'other-player')])] });

        expect(result.current.newPickKeys).toEqual(new Set(['1.1']));
    });
});

describe('useSeenPicks localStorage failures', () => {
    it('degrades to in-memory when setItem throws (Safari private mode)', () => {
        const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
            throw new Error('QuotaExceededError');
        });

        const builtDraft = [round(1, [pick(1, 'p1')])];

        expect(() => renderHook(() => useSeenPicks({ draftId: 'draft-1', builtDraft }))).not.toThrow();

        setItemSpy.mockRestore();
    });

    it('degrades to a fresh snapshot when the stored value is corrupt JSON', () => {
        localStorage.setItem(STORAGE_KEY('draft-1'), 'not json{{{');
        const builtDraft = [round(1, [pick(1, 'p1'), pick(2, 'p2')])];

        const { result } = renderHook(() => useSeenPicks({ draftId: 'draft-1', builtDraft }));

        // Treated as a first-ever visit: nothing flagged as new, rather than
        // the corrupt value taking the board down.
        expect(result.current.newPickKeys).toEqual(new Set());
    });

    it('degrades to a fresh snapshot when the stored value is valid JSON but not an array', () => {
        localStorage.setItem(STORAGE_KEY('draft-1'), JSON.stringify({ not: 'an array' }));
        const builtDraft = [round(1, [pick(1, 'p1')])];

        const { result } = renderHook(() => useSeenPicks({ draftId: 'draft-1', builtDraft }));

        expect(result.current.newPickKeys).toEqual(new Set());
    });
});
