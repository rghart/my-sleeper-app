import { useRef, useState } from 'react';
import Popover from './Popover';
import { TERMS } from './intelGlossary.js';

// Tap-for-meaning, built on the app's own Popover rather than a `title`
// attribute or a hover tooltip. Three reasons, all load-bearing here:
//
//   1. Hover does not exist on the phone this is designed for. Tap does.
//   2. Popover portals to document.body, and this lives inside the sheet's
//      own scroller - an absolutely positioned tooltip is clipped at the
//      sheet edge (the exact bug Popover's own comment records).
//   3. Popover already stops Escape from bubbling to the Sheet, so one
//      keystroke closes the tip and not the whole sheet underneath it.

/** A `?` against one figure. */
export function TermTip({ termKey, label }) {
    const ref = useRef(null);
    const [open, setOpen] = useState(false);
    const term = TERMS[termKey];

    return (
        <>
            <button
                ref={ref}
                type="button"
                onClick={(event) => {
                    // The row behind this is itself a button that pushes the
                    // detail view - a tap on the tip must not also navigate.
                    event.stopPropagation();
                    setOpen((isOpen) => !isOpen);
                }}
                aria-label={`What is ${term.short}?`}
                className="text-ink-dim hover:text-ink-quiet border-line ml-1 grid h-[13px] w-[13px] shrink-0 place-items-center rounded-full border align-middle text-[8px] leading-none"
            >
                ?
            </button>
            {open && (
                <Popover triggerRef={ref} onClose={() => setOpen(false)} label={term.short} width={230}>
                    <div className="px-2 py-1.5">
                        <p className="text-ink m-0 font-mono text-[10px] font-semibold tracking-[.06em] uppercase">
                            {label ?? term.short}
                        </p>
                        <p className="text-ink-muted m-0 mt-1 text-[11px] leading-snug">{term.long}</p>
                    </div>
                </Popover>
            )}
        </>
    );
}

/** The whole key - the one "what am I looking at?" entry point. */
export default function IntelKey({ children = 'What do these mean?' }) {
    const ref = useRef(null);
    const [open, setOpen] = useState(false);

    return (
        <>
            <button
                ref={ref}
                type="button"
                onClick={() => setOpen((isOpen) => !isOpen)}
                aria-label="What do these numbers mean?"
                className="text-ink-quiet hover:text-ink flex items-center gap-1.5 font-mono text-[10px]"
            >
                <span className="border-line grid h-[13px] w-[13px] place-items-center rounded-full border text-[8px]">
                    ?
                </span>
                {children}
            </button>
            {open && (
                <Popover triggerRef={ref} onClose={() => setOpen(false)} label="What these numbers mean" width={268}>
                    <dl className="m-0 px-2 py-1.5">
                        {Object.values(TERMS).map((term) => (
                            <div key={term.short} className="py-1">
                                <dt className="text-ink m-0 font-mono text-[10px] font-semibold">{term.short}</dt>
                                <dd className="text-ink-muted m-0 text-[11px] leading-snug">{term.long}</dd>
                            </div>
                        ))}
                    </dl>
                </Popover>
            )}
        </>
    );
}
