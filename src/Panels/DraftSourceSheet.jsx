import { useState } from 'react';
import Sheet from '../Components/Sheet';

// Sleeper draft ids are numeric strings. Validated on `Use` rather than while
// typing, so a half-pasted id isn't flagged as wrong mid-paste.
const isValidDraftId = (value) => /^\d+$/.test(value.trim());

const lastFour = (draftId) => (draftId ? `…${String(draftId).slice(-4)}` : '—');

/** Where the last mock used for this draft is remembered between visits. */
export const mockStorageKey = (leagueDraftId) => `sleeper-app:last-mock-draft:${leagueDraftId}`;

export function readLastMock(leagueDraftId) {
    try {
        return localStorage.getItem(mockStorageKey(leagueDraftId));
    } catch {
        // Private-mode Safari throws on localStorage rather than returning
        // null. A remembered mock is a convenience; losing it is not worth
        // taking the sheet down for.
        return null;
    }
}

export function writeLastMock(leagueDraftId, draftId) {
    try {
        localStorage.setItem(mockStorageKey(leagueDraftId), draftId);
    } catch {
        /* see readLastMock */
    }
}

const SourceRow = ({ active, name, detail, flag, onClick }) => (
    <button
        type="button"
        onClick={onClick}
        className={`rounded-row flex w-full items-center gap-2.5 px-3 py-2.5 text-left ${active ? 'bg-mine-row' : ''}`}
    >
        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${active ? 'bg-mine' : 'bg-transparent'}`} />
        <span className="flex min-w-0 flex-col">
            <span className={`truncate text-[15px] font-semibold ${active ? 'text-ink' : 'text-ink-muted'}`}>
                {name}
            </span>
            <span className="text-ink-quiet truncate font-mono text-[11px]">{detail}</span>
        </span>
        {flag && (
            <span className="text-live ml-auto shrink-0 font-mono text-[10px] font-semibold tracking-[.1em]">
                {flag}
            </span>
        )}
    </button>
);

/**
 * Point sync at any draft id - the league's own, the last mock used, or a
 * freshly pasted one. This is where the panel's old raw "Draft ID" input went;
 * the id itself still lives in DraftPanel as `currentDraftId` and still drives
 * the same poll, only the place it is edited has moved.
 *
 * A mock inherits the league's roster settings, player pool and draft slot,
 * because none of those are re-fetched when the id changes - only the picks
 * are. That is the property the explainer line promises, and it holds by
 * construction rather than by anything this sheet does.
 */
const DraftSourceSheet = ({ leagueDraft, currentDraftId, lastMockId, onSelect, onClose, triggerRef }) => {
    const [pasted, setPasted] = useState('');
    const [error, setError] = useState(null);

    const leagueDraftId = leagueDraft.draft_id;
    const onLeagueDraft = currentDraftId === leagueDraftId;

    const use = () => {
        const value = pasted.trim();
        if (!isValidDraftId(value)) {
            setError('That doesn’t look like a Sleeper draft ID — they are digits only.');
            return;
        }
        setError(null);
        onSelect(value);
    };

    const leagueDetail = [leagueDraft.season, leagueDraft.player_pool].filter(Boolean).join(' ');

    return (
        <Sheet
            title="Draft source"
            subtitle="Sync reads picks from this draft"
            onClose={onClose}
            triggerRef={triggerRef}
            centerOnDesktop
        >
            <div className="flex flex-col gap-0.5 px-2 py-2.5">
                <SourceRow
                    active={onLeagueDraft}
                    name="League draft"
                    detail={`${leagueDetail} · ${lastFour(leagueDraftId)}`}
                    flag={leagueDraft.status === 'drafting' ? 'LIVE' : null}
                    onClick={() => onSelect(leagueDraftId)}
                />
                {lastMockId && (
                    <SourceRow
                        active={currentDraftId === lastMockId}
                        name="Mock · last used"
                        detail={lastFour(lastMockId)}
                        onClick={() => onSelect(lastMockId)}
                    />
                )}
                {!onLeagueDraft && currentDraftId !== lastMockId && (
                    <SourceRow active name="Mock draft" detail={lastFour(currentDraftId)} onClick={() => {}} />
                )}
            </div>

            <div className="border-line-mid flex flex-col gap-2.5 border-t px-4 py-3.5">
                <p className="text-ink-quiet m-0 font-mono text-[10px] font-semibold tracking-[.12em]">
                    PASTE A MOCK DRAFT ID
                </p>
                <div className="flex items-center gap-2.5">
                    <input
                        type="text"
                        inputMode="numeric"
                        aria-label="Mock draft ID"
                        placeholder="1312088290526003201"
                        value={pasted}
                        onChange={(event) => setPasted(event.target.value)}
                        className="border-line bg-raised-2 text-ink caret-ink-muted rounded-row min-w-0 flex-1 border px-3 py-2.5 font-mono text-[13px]"
                    />
                    <button
                        type="button"
                        onClick={use}
                        disabled={pasted.trim().length === 0}
                        className="bg-mine text-ground shrink-0 rounded-full px-4 py-2 text-[13px] font-semibold disabled:opacity-50"
                    >
                        Use
                    </button>
                </div>
                {error && (
                    <p role="alert" className="text-danger m-0 font-mono text-[11px]">
                        {error}
                    </p>
                )}
                <p className="text-ink-quiet m-0 font-mono text-[11px]">
                    A mock keeps this league’s roster settings and your draft slot. Your lineup and ranks are untouched.
                </p>
            </div>
        </Sheet>
    );
};

export default DraftSourceSheet;
