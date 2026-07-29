import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRef } from 'react';
import Sheet from './Sheet';

// A minimal three-button body is enough to prove the Tab cycle wraps at both
// ends without dragging in one of the real callers (BestAvailable or
// ManualPickModal) and their fixtures.
function renderSheet(overrides = {}) {
    const onClose = vi.fn();

    function Harness() {
        const triggerRef = useRef(null);
        return (
            <div>
                <button ref={triggerRef} type="button">
                    Open sheet
                </button>
                <Sheet
                    title="Best available"
                    subtitle="12 ranked"
                    onClose={onClose}
                    triggerRef={triggerRef}
                    {...overrides}
                >
                    <button type="button">First</button>
                    <button type="button">Second</button>
                    <button type="button">Third</button>
                </Sheet>
            </div>
        );
    }

    render(<Harness />);
    return { onClose };
}

describe('Sheet', () => {
    it('is a labelled, modal dialog', () => {
        renderSheet();

        const dialog = screen.getByRole('dialog', { name: 'Best available' });
        expect(dialog).toHaveAttribute('aria-modal', 'true');
    });

    it('closes on a scrim click', async () => {
        const user = userEvent.setup();
        const { onClose } = renderSheet();

        // The scrim is the sibling of the dialog inside the fixed overlay -
        // aria-hidden, so it has to be reached by a plain DOM query rather
        // than a role.
        const scrim = document.querySelector('[aria-hidden="true"]');
        await user.click(scrim);

        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('closes on Escape', async () => {
        const user = userEvent.setup();
        const { onClose } = renderSheet();

        await user.keyboard('{Escape}');

        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('closes on the grab-handle close control', async () => {
        const user = userEvent.setup();
        const { onClose } = renderSheet();

        await user.click(screen.getByRole('button', { name: 'Close' }));

        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('moves focus into the panel on mount', () => {
        renderSheet();

        expect(screen.getByRole('dialog')).toHaveFocus();
    });

    it('returns focus to the trigger on unmount', () => {
        function Harness({ open }) {
            const triggerRef = useRef(null);
            return (
                <div>
                    <button ref={triggerRef} type="button">
                        Open sheet
                    </button>
                    {open && (
                        <Sheet title="Best available" onClose={() => {}} triggerRef={triggerRef}>
                            <button type="button">First</button>
                        </Sheet>
                    )}
                </div>
            );
        }

        const { rerender } = render(<Harness open={true} />);
        rerender(<Harness open={false} />);

        expect(screen.getByRole('button', { name: 'Open sheet' })).toHaveFocus();
    });

    it('traps Tab within the panel, wrapping from the last focusable back to the first', async () => {
        const user = userEvent.setup();
        renderSheet();

        const close = screen.getByRole('button', { name: 'Close' });
        const third = screen.getByRole('button', { name: 'Third' });

        // Forward: the last focusable element wraps to the first (the
        // header's close control, which precedes the body in DOM order).
        third.focus();
        await user.tab();
        expect(document.activeElement).toBe(close);

        // Backward: the first focusable element wraps to the last.
        close.focus();
        await user.tab({ shift: true });
        expect(document.activeElement).toBe(third);
    });

    it('renders no grab handle and a labelled dialog for the centred desktop variant', () => {
        renderSheet({ centerOnDesktop: true });

        expect(screen.getByRole('dialog', { name: 'Best available' })).toBeInTheDocument();
    });
});

// Dragging the top of a sheet is the gesture every bottom sheet on a phone
// implies and this one did not have: pulling down dismissed nothing, pushing
// up expanded nothing, so the grab handle was decoration.
//
// jsdom has no PointerEvent constructor and no pointer capture, so these drive
// the React handlers directly with fireEvent.pointerDown/Move/Up and a plain
// clientY. That tests the state machine, not the browser's gesture routing -
// which is the half that can regress silently.
describe('Sheet drag gesture', () => {
    const header = () => screen.getByText('Best available').closest('div[class*="border-b"]');
    const panel = () => screen.getByRole('dialog');

    const drag = (distance) => {
        const grip = header();
        fireEvent.pointerDown(grip, { clientY: 400, pointerId: 1 });
        fireEvent.pointerMove(grip, { clientY: 400 + distance, pointerId: 1 });
        fireEvent.pointerUp(grip, { clientY: 400 + distance, pointerId: 1 });
    };

    it('closes on a drag down past the dismiss threshold', () => {
        const { onClose } = renderSheet();

        drag(160);

        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('stays open on a short drag that never reaches the threshold', () => {
        const { onClose } = renderSheet();

        drag(20);

        expect(onClose).not.toHaveBeenCalled();
        expect(panel()).toBeInTheDocument();
    });

    it('expands on a drag up, and the first drag down then only collapses it', () => {
        const { onClose } = renderSheet();

        const collapsedMaxHeight = panel().style.maxHeight;
        drag(-80);
        expect(panel().style.maxHeight).not.toBe(collapsedMaxHeight);

        // A single flick must not take an expanded sheet from full height
        // straight to gone.
        drag(160);
        expect(onClose).not.toHaveBeenCalled();
        expect(panel().style.maxHeight).toBe(collapsedMaxHeight);

        drag(160);
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('leaves a drag that starts on a header control alone, so the control still works', () => {
        const { onClose } = renderSheet();

        const close = screen.getByRole('button', { name: 'Close' });
        fireEvent.pointerDown(close, { clientY: 400, pointerId: 1 });
        fireEvent.pointerMove(close, { clientY: 560, pointerId: 1 });
        fireEvent.pointerUp(close, { clientY: 560, pointerId: 1 });

        // No drag ran, so nothing was dismissed by the gesture itself.
        expect(onClose).not.toHaveBeenCalled();
    });
});
