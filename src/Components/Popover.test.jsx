import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useRef } from 'react';
import Popover from './Popover';

// jsdom has no layout, so placement itself (the flip above a trigger with no
// room below, the clamped max-height) is browser-verified rather than asserted
// here. What this file pins is the one piece of that logic with a real API
// behind it: the visibility guard.

const Harness = ({ onClose = () => {} }) => {
    const triggerRef = useRef(null);
    return (
        <>
            <button type="button" ref={triggerRef}>
                Open
            </button>
            <Popover triggerRef={triggerRef} onClose={onClose} label="Filters">
                <p>Body</p>
            </Popover>
        </>
    );
};

afterEach(() => {
    delete Element.prototype.checkVisibility;
});

describe('Popover', () => {
    it('renders next to its trigger by default', () => {
        render(<Harness />);

        expect(screen.getByRole('dialog', { name: 'Filters' })).toBeInTheDocument();
    });

    // A portal is not a DOM descendant of its trigger, so a trigger hidden by
    // a media query - which is what the draft and lineup sheets are at `md`
    // and up, `md:hidden` rather than unmounted - leaves the popover floating
    // over the page by itself. Seen in the browser, in the top-left corner.
    it('renders nothing while its trigger has been hidden by a stylesheet', () => {
        Element.prototype.checkVisibility = () => false;

        render(<Harness />);

        expect(screen.queryByRole('dialog', { name: 'Filters' })).toBeNull();
    });

    // The guard is feature-detected because jsdom does not implement
    // checkVisibility: assuming it exists would have hidden every popover in
    // every test in this suite, which is a failure mode worth a test of its own.
    it('treats a trigger as visible where checkVisibility does not exist', () => {
        expect(Element.prototype.checkVisibility).toBeUndefined();

        render(<Harness />);

        expect(screen.getByRole('dialog', { name: 'Filters' })).toBeInTheDocument();
    });

    it('closes on Escape without letting the keystroke reach anything else', async () => {
        const onClose = vi.fn();
        const outer = vi.fn();
        document.addEventListener('keydown', outer, true);
        render(<Harness onClose={onClose} />);

        screen
            .getByRole('dialog', { name: 'Filters' })
            .dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

        expect(onClose).toHaveBeenCalledTimes(1);
        document.removeEventListener('keydown', outer, true);
    });
});
