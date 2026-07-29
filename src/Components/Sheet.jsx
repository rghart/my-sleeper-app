import { useEffect, useRef, useState } from 'react';
import { useBodyScrollLock } from '../useBodyScrollLock.js';

// How far down the header has to travel before letting go dismisses the sheet
// (or collapses an expanded one), and how far up before it expands. Down needs
// the larger figure: dismissing loses whatever the sheet was showing, while
// expanding is free to undo.
const DISMISS_PX = 90;
const EXPAND_PX = 40;

// Two heights, so a drag up has somewhere to go. The collapsed one is the
// design's `max-height: 560px`; the expanded one leaves the top bar visible so
// the sheet still reads as a sheet rather than a page.
const COLLAPSED_MAX_H = '560px';
const EXPANDED_MAX_H = 'calc(100dvh - var(--tab-bar-h) - 56px)';

// Elements inside the header that own their own taps - the close button, the
// rank-list switcher pill. A drag that starts on one of those must stay a
// click, so the gesture never begins there.
const HEADER_CONTROL_SELECTOR = 'button, a, input, select, textarea, [role="dialog"]';

// Focusable elements worth trapping Tab within - close enough to the real
// definition for a sheet's contents (rows, chips, an input, buttons) without
// dragging in a full tabindex-parsing library for it.
const FOCUSABLE_SELECTOR =
    'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

// The shared sheet/modal chrome: a bottom sheet on phones, pinned above the
// tab bar, and - when `centerOnDesktop` is set - a centred panel from `md`
// up instead. The Draft and Lineup best-available sheets never go centred
// (the aside covers `md` and up for them), so they leave it at the default
// and the whole sheet disappears above `md` instead.
//
// Focus handling mirrors Drawer.jsx rather than reinventing it: focus the
// panel on mount, return it to the trigger on unmount (a plain mount/unmount
// effect, since this is only ever rendered while open - see PickFeed and
// LineupPanel, which mount it conditionally same as Drawer.jsx's caller
// mounts that). The one thing Drawer doesn't do is trap Tab within the
// panel - this does, via a small manual cycle rather than a library, since
// the set of focusable things in any of these three callers is short.
const Sheet = ({ title, subtitle, onClose, triggerRef, centerOnDesktop = false, headerAction, children }) => {
    const panelRef = useRef(null);
    const [expanded, setExpanded] = useState(false);
    // Live finger offset while a drag is in progress, null the rest of the
    // time - which is also what tells the transition below whether to animate
    // (it must not, while the sheet is tracking a finger).
    const [dragY, setDragY] = useState(null);
    const dragStartY = useRef(0);

    useBodyScrollLock();

    // Pointer events rather than touch events: one code path covers a finger,
    // a trackpad drag and a mouse, and pointer capture means the gesture keeps
    // being delivered here even once the finger leaves the header - which it
    // does immediately, since the header is what is moving.
    const onPointerDown = (event) => {
        // Scoped to the header, because `closest` walks all the way up: the
        // sheet's own panel carries `role="dialog"`, so an unscoped match
        // would find it from anywhere in the header and no drag could ever
        // start. What this is really asking is "did the gesture begin on a
        // control the header owns" - a popover open inside the header counts,
        // the panel wrapping it does not.
        const control = event.target.closest(HEADER_CONTROL_SELECTOR);
        if (control && event.currentTarget.contains(control)) {
            return;
        }
        // A `centerOnDesktop` sheet is a centred panel above `md`, held there
        // by a translate of its own - dragging it would fight that transform
        // rather than move a sheet, and there is no bottom edge to drag it
        // towards anyway.
        if (centerOnDesktop && window.matchMedia?.('(min-width: 768px)').matches) {
            return;
        }
        dragStartY.current = event.clientY;
        setDragY(0);
        event.currentTarget.setPointerCapture?.(event.pointerId);
    };

    const onPointerMove = (event) => {
        if (dragY === null) {
            return;
        }
        const delta = event.clientY - dragStartY.current;
        // Upward travel is resisted once there is nowhere further to expand
        // to, so the sheet never detaches from the bottom of the screen.
        setDragY(delta < 0 && expanded ? delta / 4 : delta);
    };

    const endDrag = (event) => {
        if (dragY === null) {
            return;
        }
        event.currentTarget.releasePointerCapture?.(event.pointerId);
        const delta = dragY;
        setDragY(null);
        if (delta > DISMISS_PX) {
            // An expanded sheet collapses first: a single flick should not be
            // able to take it from full height to gone.
            if (expanded) {
                setExpanded(false);
            } else {
                onClose();
            }
        } else if (delta < -EXPAND_PX) {
            setExpanded(true);
        }
    };

    useEffect(() => {
        panelRef.current?.focus();
        const trigger = triggerRef?.current;
        return () => {
            trigger?.focus();
        };
        // Mount/unmount only - see the comment above.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        const onKeyDown = (event) => {
            if (event.key === 'Escape') {
                onClose();
                return;
            }
            if (event.key !== 'Tab') {
                return;
            }
            const panel = panelRef.current;
            if (!panel) {
                return;
            }
            const focusable = Array.from(panel.querySelectorAll(FOCUSABLE_SELECTOR));
            if (focusable.length === 0) {
                event.preventDefault();
                return;
            }
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        };
        document.addEventListener('keydown', onKeyDown);
        return () => document.removeEventListener('keydown', onKeyDown);
    }, [onClose]);

    return (
        <div className={`fixed inset-0 z-[999] ${centerOnDesktop ? '' : 'md:hidden'}`}>
            <div className="bg-scrim absolute inset-0" onClick={onClose} aria-hidden="true" />
            <div
                ref={panelRef}
                role="dialog"
                aria-modal="true"
                aria-label={title}
                tabIndex={-1}
                style={{
                    maxHeight: expanded ? EXPANDED_MAX_H : COLLAPSED_MAX_H,
                    // Only ever pushed *down* by a drag; upward travel is what
                    // the max-height swap above expresses, so translating up
                    // as well would double-count it.
                    transform: dragY > 0 ? `translateY(${dragY}px)` : undefined,
                    transition: dragY === null ? 'transform 180ms ease-out, max-height 180ms ease-out' : 'none',
                }}
                className={`border-line bg-raised fixed inset-x-0 bottom-[var(--tab-bar-h)] flex flex-col rounded-t-[16px] border-t outline-none ${
                    centerOnDesktop
                        ? 'md:rounded-card md:inset-x-auto md:top-1/2 md:bottom-auto md:left-1/2 md:w-[420px] md:max-w-[calc(100vw-2rem)] md:-translate-x-1/2 md:-translate-y-1/2 md:border'
                        : ''
                }`}
            >
                {/* The whole header is the grab area, not just the 36px handle
                    - the handle is too small a target to be the only way in,
                    and the design's affordance reads as "the top of the sheet
                    moves". `touch-none` is what stops the browser claiming the
                    gesture as a page scroll before the handlers below see it. */}
                <div
                    onPointerDown={onPointerDown}
                    onPointerMove={onPointerMove}
                    onPointerUp={endDrag}
                    onPointerCancel={endDrag}
                    className="border-line-mid flex shrink-0 touch-none flex-col border-b px-4 pt-3.5 pb-3"
                >
                    <div
                        className={`bg-mark mx-auto mb-3 h-[3px] w-9 rounded-full ${centerOnDesktop ? 'md:hidden' : ''}`}
                    />
                    <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                            <p className="text-ink m-0 truncate text-[16px] font-semibold">{title}</p>
                            {subtitle && (
                                <p className="text-ink-quiet m-0 truncate font-mono text-[11px]">{subtitle}</p>
                            )}
                        </div>
                        {headerAction}
                        <button
                            type="button"
                            onClick={onClose}
                            aria-label="Close"
                            className="text-ink-quiet shrink-0 text-[10px]"
                        >
                            ▼
                        </button>
                    </div>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
            </div>
        </div>
    );
};

export default Sheet;
