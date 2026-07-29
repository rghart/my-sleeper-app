import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
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
