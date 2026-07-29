import { useEffect, useRef, useState } from 'react';

const DEFAULT_ROUTE_NAME = 'default';

// The outlined pill rendered in a Sheet's header (via its `headerAction`
// slot) that lets the Lineup sheet read a different rank list than the one
// Ranks is currently editing. `rankListId` is null for "the live session
// list" (whatever RanksPanel currently has in rankingPlayersIdsList) or a
// saved list's route_name; `onSelect` re-scopes in place without closing the
// sheet - the caller (LineupPanel) is what actually re-filters the rows, this
// component only reports the choice.
const RankListSwitcher = ({
    savedRankLists,
    savedRankListsLoading,
    signedIn,
    rankListId,
    onSelect,
    onPasteNew,
    sessionCount,
    sessionLabel = 'Current list',
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const buttonRef = useRef(null);
    const popoverRef = useRef(null);

    useEffect(() => {
        if (!isOpen) {
            return undefined;
        }
        const onKeyDown = (event) => {
            if (event.key === 'Escape') {
                // Escape closes the popover, not the sheet underneath it -
                // stopPropagation keeps the sheet's own Escape handler (which
                // would otherwise also see this same keydown) from closing
                // the whole sheet in the same keystroke.
                event.stopPropagation();
                setIsOpen(false);
            }
        };
        const onPointerDown = (event) => {
            const popover = popoverRef.current;
            const button = buttonRef.current;
            if (popover && !popover.contains(event.target) && button && !button.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('keydown', onKeyDown, true);
        document.addEventListener('mousedown', onPointerDown);
        return () => {
            document.removeEventListener('keydown', onKeyDown, true);
            document.removeEventListener('mousedown', onPointerDown);
        };
    }, [isOpen]);

    // The placeholder-only entry (route_name 'default') is RanksPanel's
    // "nothing selected yet" state, not a real saved list - it never belongs
    // in this switcher. Signed-out users never have anything else in
    // savedRankLists (see App.loadSavedRankLists), so filtering it out here
    // is also what makes "signed out shows only the session list" true
    // without a separate branch for it.
    const savedEntries = Object.values(savedRankLists || {}).filter((list) => list.route_name !== DEFAULT_ROUTE_NAME);

    const currentLabel = rankListId ? (savedRankLists?.[rankListId]?.pretty_name ?? sessionLabel) : sessionLabel;

    const select = (id) => {
        onSelect(id);
        setIsOpen(false);
    };

    const rowNameClass = (active) => `truncate text-[13px] font-semibold ${active ? 'text-ink' : 'text-ink-muted'}`;
    const rowDotClass = (active) => `h-1.5 w-1.5 shrink-0 rounded-full ${active ? 'bg-mine' : 'bg-transparent'}`;

    return (
        <div className="relative shrink-0">
            {/* aria-label rather than letting the accessible name fall out of
                the visible text: that text is "{current list name}" alone,
                which collides with the popover's own row for the same list
                (both would read as a button named e.g. "My Rankings") once
                the popover is open. */}
            <button
                type="button"
                ref={buttonRef}
                aria-expanded={isOpen}
                aria-label={`Rank list: ${currentLabel}`}
                onClick={() => setIsOpen((open) => !open)}
                className={`flex items-center gap-1 rounded-full border px-2.5 py-1.5 text-[12px] font-semibold ${
                    isOpen ? 'bg-mine-chip border-mine text-mine' : 'border-line text-ink-muted'
                }`}
            >
                <span className="max-w-[110px] truncate" aria-hidden="true">
                    {currentLabel}
                </span>
                <span className="text-[9px]" aria-hidden="true">
                    {isOpen ? '▴' : '▾'}
                </span>
            </button>
            {isOpen && (
                <div
                    ref={popoverRef}
                    role="dialog"
                    aria-label="Choose rank list"
                    tabIndex={-1}
                    className="border-line bg-raised-2 shadow-float absolute top-full right-0 z-50 mt-1.5 box-border w-[236px] rounded-xl border p-1.5"
                >
                    <button
                        type="button"
                        onClick={() => select(null)}
                        className="flex w-full items-center gap-2.5 rounded-lg p-2.5 text-left"
                    >
                        <span className={rowDotClass(rankListId === null)} />
                        <span className="flex min-w-0 flex-col">
                            <span className={rowNameClass(rankListId === null)}>{sessionLabel}</span>
                            <span className="text-ink-quiet font-mono text-[10px]">{sessionCount} players</span>
                        </span>
                    </button>
                    {signedIn && savedRankListsLoading && (
                        <p className="text-ink-dim m-0 px-2.5 py-2 font-mono text-[10px]">Loading your lists…</p>
                    )}
                    {signedIn &&
                        !savedRankListsLoading &&
                        savedEntries.map((list) => (
                            <button
                                key={list.route_name}
                                type="button"
                                onClick={() => select(list.route_name)}
                                className="flex w-full items-center gap-2.5 rounded-lg p-2.5 text-left"
                            >
                                <span className={rowDotClass(rankListId === list.route_name)} />
                                <span className="flex min-w-0 flex-col">
                                    <span className={rowNameClass(rankListId === list.route_name)}>
                                        {list.pretty_name}
                                    </span>
                                    <span className="text-ink-quiet font-mono text-[10px]">
                                        {(list.rank_list || []).length} players
                                    </span>
                                </span>
                            </button>
                        ))}
                    <div className="bg-line mx-1.5 my-1 h-px" />
                    <button
                        type="button"
                        onClick={() => {
                            onPasteNew();
                            setIsOpen(false);
                        }}
                        className="text-mine w-full rounded-lg p-2.5 text-left text-[13px] font-semibold"
                    >
                        Paste a new list
                    </button>
                </div>
            )}
        </div>
    );
};

export default RankListSwitcher;
