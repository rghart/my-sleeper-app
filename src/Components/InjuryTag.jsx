import { useRef, useState } from 'react';
import Popover from './Popover';
import { injuryBadge, injuryDetailLines } from './injuryLabels.js';

// The injury badge that sits beside a player's name, in the idiom every
// fantasy app uses: a short letter code, coloured by severity. Amber for
// questionable (he may well play), red for the statuses that mean he will not.
//
// Text, not a tint block like `PositionTag`. A filled badge here reads as loud
// as the position tag and there are two of them on a row.
//
// **The detail is a popover, because the meta line has no room for it.**
// Measured at 375px against a real rank list: that line has 155px of width and
// the value chip plus the manager's name already need 145 of it, so appending
// "· Q · Knee - ACL · back Aug 22" truncated 7 of 14 rows and clipped away the
// return date — the one part of this KeepTradeCut publishes and nothing else
// does. Tap-for-detail is what the app already does with `TermTip` when a
// figure needs more words than a row can hold.
//
// Without `detail` this renders as plain text. That is not a fallback: a row
// that is *itself* a button (SlotRow) cannot legally nest one, so the lineup
// carries the same detail on its own meta line, which has the room this one
// does not.
const TONE = {
    warn: 'text-warn',
    danger: 'text-danger',
};

const InjuryTag = ({ player, injuryReturn = null, detail = false }) => {
    const ref = useRef(null);
    const [open, setOpen] = useState(false);
    const badge = injuryBadge(player);

    if (!badge) return null;

    const className = `shrink-0 font-mono text-[9px] font-semibold tracking-[.1em] ${TONE[badge.tone]}`;

    if (!detail) {
        return (
            <span data-testid="injury-tag" className={className}>
                {badge.badge}
            </span>
        );
    }

    const lines = injuryDetailLines(player, injuryReturn);

    return (
        <>
            <button
                ref={ref}
                type="button"
                data-testid="injury-tag"
                onClick={(event) => {
                    // Defensive, and currently unreachable: this sits in
                    // ListRow's `nameAfter` slot, which is a *sibling* of the
                    // name button rather than inside it, and the only row that
                    // renders this variant is a `div`. So there is nothing
                    // above to swallow the click today — sabotaging this line
                    // fails no test, deliberately noted rather than papered
                    // over with a contrived one. It stays because the slot's
                    // contract does not promise either of those things, and
                    // the row it lands on is one prop away from being a
                    // button.
                    event.stopPropagation();
                    setOpen((isOpen) => !isOpen);
                }}
                aria-label={`${badge.label}, more detail`}
                className={`${className} hover:underline`}
            >
                {badge.badge}
            </button>
            {open && (
                <Popover triggerRef={ref} onClose={() => setOpen(false)} label={badge.label} width={200}>
                    <div className="px-2 py-1.5">
                        <p
                            className={`m-0 font-mono text-[10px] font-semibold tracking-[.06em] uppercase ${TONE[badge.tone]}`}
                        >
                            {lines.headline}
                        </p>
                        {lines.body.map((line) => (
                            <p key={line} className="text-ink-muted m-0 mt-1 text-[11px] leading-snug">
                                {line}
                            </p>
                        ))}
                    </div>
                </Popover>
            )}
        </>
    );
};

export default InjuryTag;
