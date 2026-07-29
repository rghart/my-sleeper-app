import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

// Gap between the trigger and the panel, and the margin the panel keeps from
// the viewport edge when it would otherwise hang off it.
const OFFSET_PX = 6;
const EDGE_PX = 8;

// The floating layer: a small panel anchored under its trigger, with no scrim
// of its own - which is exactly why it is the one thing in the system that
// earns a shadow (`shadow-float`, see theme.css).
//
// Rendered into a portal on `document.body` and positioned from the trigger's
// own rect, rather than absolutely inside the trigger's parent. Both places
// this is used sit inside a clipping ancestor - the Ranks chip row is
// `overflow-x-auto` so it can scroll sideways, and the sheet's body is
// `overflow-y-auto` - and an absolutely positioned popover inside either is
// cut off at that box's edge. The Ranks one lost everything below its first
// row that way.
//
// Rendered at every viewport width, not just `md` and up. The Ranks FILTERS
// control used to be two trees - an anchored popover behind `hidden md:block`
// plus a bottom Sheet below it - and the hidden half was still mounted on a
// phone, still listening on `document` for a `mousedown` outside itself. Every
// tap on a control inside the Sheet counted as "outside" and closed the whole
// thing on mousedown, before the click that would have toggled the filter ever
// landed. One popover at all widths is both the design (see the handoff's
// frames 6 and 7, which show a popover on the phone too) and the fix.
//
// Escape is captured and stopped rather than left to bubble: a popover opened
// from inside a Sheet shares the document with the Sheet's own Escape handler,
// and one keystroke must close the popover only. Same reasoning as
// RankListSwitcher's, which is the third instance of this shape.
const Popover = ({ triggerRef, onClose, label, width = 252, children }) => {
    const popoverRef = useRef(null);
    const [position, setPosition] = useState(null);

    const reposition = useCallback(() => {
        const trigger = triggerRef.current;
        if (!trigger) {
            return;
        }
        const rect = trigger.getBoundingClientRect();
        const clampedWidth = Math.min(width, window.innerWidth - EDGE_PX * 2);
        // Right-aligned to the trigger, then pulled back inside the viewport -
        // the Ranks chip lives at the right end of a row that can itself be
        // scrolled off-screen, so neither edge can be assumed to be in view.
        const left = Math.min(Math.max(EDGE_PX, rect.right - clampedWidth), window.innerWidth - clampedWidth - EDGE_PX);

        // Flip above the trigger when there is not room below it. The sheet's
        // FILTERS chip sits two thirds of the way down a phone screen, so
        // "below" leaves the last two options and Reset off the bottom - and
        // an internally scrolling popover hides that there is anything there.
        // Height is only known from the second pass onward (the panel has to
        // exist to be measured); the first pass places it below, and both
        // passes run in a layout effect, so nothing is painted in between.
        // `scrollHeight`, not the rendered box: the box is already clamped by
        // last pass's maxHeight, so measuring it would report "it fits" about
        // the very constraint that made it fit and never flip.
        const natural = popoverRef.current?.scrollHeight ?? 0;
        const spaceBelow = window.innerHeight - (rect.bottom + OFFSET_PX) - EDGE_PX;
        const spaceAbove = rect.top - OFFSET_PX - EDGE_PX;
        const placeAbove = natural > spaceBelow && spaceAbove > spaceBelow;
        const top = placeAbove ? Math.max(EDGE_PX, rect.top - OFFSET_PX - natural) : rect.bottom + OFFSET_PX;
        const maxHeight = placeAbove ? spaceAbove : spaceBelow;

        setPosition((previous) =>
            previous &&
            previous.top === top &&
            previous.left === left &&
            previous.width === clampedWidth &&
            previous.maxHeight === maxHeight
                ? previous
                : { top, left, width: clampedWidth, maxHeight },
        );
    }, [triggerRef, width]);

    // Layout effect, so the panel is never painted at the wrong place first.
    // It re-runs on `position` as well, which is the second pass described in
    // reposition - and settles immediately, because reposition returns the
    // previous object unchanged once nothing moves.
    useLayoutEffect(reposition, [reposition, position]);

    useEffect(() => {
        popoverRef.current?.focus();
        const trigger = triggerRef.current;
        return () => {
            trigger?.focus();
        };
        // Mount/unmount only, same as Sheet's own focus effect.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        const onKeyDown = (event) => {
            if (event.key === 'Escape') {
                event.stopPropagation();
                onClose();
            }
        };
        const onPointerDown = (event) => {
            const popover = popoverRef.current;
            const trigger = triggerRef.current;
            if (popover && !popover.contains(event.target) && trigger && !trigger.contains(event.target)) {
                onClose();
            }
        };
        document.addEventListener('keydown', onKeyDown, true);
        document.addEventListener('mousedown', onPointerDown);
        // `true` so a scroll inside the sheet's own scroller re-anchors this,
        // not only a scroll of the page.
        window.addEventListener('scroll', reposition, true);
        window.addEventListener('resize', reposition);
        return () => {
            document.removeEventListener('keydown', onKeyDown, true);
            document.removeEventListener('mousedown', onPointerDown);
            window.removeEventListener('scroll', reposition, true);
            window.removeEventListener('resize', reposition);
        };
    }, [onClose, triggerRef, reposition]);

    if (!position) {
        return null;
    }

    return createPortal(
        <div
            ref={popoverRef}
            role="dialog"
            aria-label={label}
            tabIndex={-1}
            style={{
                position: 'fixed',
                top: `${position.top}px`,
                left: `${position.left}px`,
                width: `${position.width}px`,
                maxHeight: `${position.maxHeight}px`,
            }}
            className="border-line bg-raised-2 shadow-float z-[1000] box-border overflow-y-auto rounded-xl border p-1.5 outline-none"
        >
            {children}
        </div>,
        document.body,
    );
};

export default Popover;
