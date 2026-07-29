import { useEffect, useRef } from 'react';
import { useBodyScrollLock } from '../useBodyScrollLock.js';

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
const Sheet = ({ title, subtitle, onClose, triggerRef, centerOnDesktop = false, children }) => {
    const panelRef = useRef(null);

    useBodyScrollLock();

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
                className={`border-line bg-raised fixed inset-x-0 bottom-[var(--tab-bar-h)] flex max-h-[560px] flex-col rounded-t-[16px] border-t outline-none ${
                    centerOnDesktop
                        ? 'md:rounded-card md:inset-x-auto md:top-1/2 md:bottom-auto md:left-1/2 md:w-[420px] md:max-w-[calc(100vw-2rem)] md:-translate-x-1/2 md:-translate-y-1/2 md:border'
                        : ''
                }`}
            >
                <div className="border-line-mid flex shrink-0 flex-col border-b px-4 pt-3.5 pb-3">
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
