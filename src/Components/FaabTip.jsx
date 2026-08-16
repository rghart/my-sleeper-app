import { useRef, useState } from 'react';
import Popover from './Popover';
import { faabFailedText, faabHeadline, faabRangeText, faabSample, faabSampleText } from '../lib/faab.js';

// What a player actually cost in FAAB, as a marker beside his name.
//
// **This started as the existing "Free agent" text made tappable, and that
// did not work.** The rank row's meta line has 155px and the value chip plus
// the availability words already fill it, so on every row carrying a value
// *and* a change ("1.3k +487%") the words ellipsised to "…" and the trigger
// became unreachable. Worth recording how that was found: `scrollWidth >
// clientWidth` on the meta span reported those rows as *not* clipped, because
// the overflow was inside a nested inline child rather than in the span's own
// text. Two screenshots said otherwise and the screenshots were right. Check
// what renders, not a proxy for it.
//
// So it sits in `nameAfter` beside the injury badge, where width is measured
// and available, and it is immune to whatever the meta line is carrying.
//
// It appears only for players who can actually be added. A price on someone
// locked up on another roster is trivia; on a free agent it is the number you
// are otherwise about to guess.
const FaabTip = ({ price, windowText }) => {
    const ref = useRef(null);
    const [open, setOpen] = useState(false);
    const sample = faabSample(price);

    // No entry, or none of these leagues ever bid on him. Renders nothing, so
    // a row without a price is the row that existed before this feature.
    if (sample.kind === 'none') return null;

    const headline = faabHeadline(sample);
    const range = faabRangeText(sample);
    const failed = faabFailedText(sample);

    return (
        <>
            <button
                ref={ref}
                type="button"
                data-testid="faab-tip"
                onClick={(event) => {
                    event.stopPropagation();
                    setOpen((isOpen) => !isOpen);
                }}
                aria-label={`FAAB: ${headline}, ${faabSampleText(sample)}`}
                // Same geometry as the injury badge next to it, in the muted
                // ink that says "reference, not warning" — an injury changes
                // whether you want him, a price only changes what you bid.
                //
                // A glyph rather than the word "FAAB", and that is measured:
                // at 375px the name sits at *exactly* its limit on a
                // single-badge row (right edge equal to the container's, zero
                // slack), and spelling it out pushed the one row carrying both
                // badges 10px over — "Zavion Thomas" lost its last letter. The
                // popover and the aria-label carry the meaning; the row only
                // has room for a mark.
                className="text-ink-dim shrink-0 font-mono text-[11px] font-semibold"
            >
                $
            </button>
            {open && (
                <Popover triggerRef={ref} onClose={() => setOpen(false)} label="FAAB" width={232}>
                    <div className="px-2 py-1.5">
                        <p className="text-ink m-0 font-mono text-[10px] font-semibold tracking-[.06em] uppercase">
                            {headline}
                        </p>
                        {range && <p className="text-ink-muted m-0 mt-1 font-mono text-[11px]">{range}</p>}
                        {/* The denominator, never optional. */}
                        <p className="text-ink-dim m-0 mt-1 text-[11px] leading-snug">{faabSampleText(sample)}</p>
                        {failed && <p className="text-ink-dim m-0 mt-1 text-[11px] leading-snug">{failed}</p>}
                        {/* Which market these prices are from. Every bid in
                            the corpus was made outside the season, and a price
                            rendered without saying so is overclaiming. */}
                        {windowText && (
                            <p className="text-ink-dim m-0 mt-1.5 border-t border-[var(--color-line)] pt-1.5 text-[10px] leading-snug">
                                Offseason claims, {windowText}
                            </p>
                        )}
                    </div>
                </Popover>
            )}
        </>
    );
};

export default FaabTip;
