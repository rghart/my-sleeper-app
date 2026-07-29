import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { render } from '@testing-library/react';
import { useBodyScrollLock } from './useBodyScrollLock.js';

const Locker = () => {
    useBodyScrollLock();
    return null;
};

// jsdom implements neither real scrolling nor `window.scrollTo` - `scrollY`
// stays 0 whatever you call, so the offset has to be stood up by hand for the
// hook to have anything to capture, and the restore has to be asserted on the
// call rather than on the resulting position.
let scrollY = 0;
let scrollToSpy;

const setScroll = (value) => {
    scrollY = value;
};

describe('useBodyScrollLock', () => {
    beforeEach(() => {
        document.body.style.cssText = '';
        scrollY = 0;
        vi.spyOn(window, 'scrollY', 'get').mockImplementation(() => scrollY);
        scrollToSpy = vi.fn();
        window.scrollTo = scrollToSpy;
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('takes the body out of flow while mounted', () => {
        render(<Locker />);

        expect(document.body.style.position).toBe('fixed');
        expect(document.body.style.overflow).toBe('hidden');
    });

    // The half that actually bites: `position: fixed` on the body drops the
    // page to the top, so the offset has to be held as a negative `top` and
    // put back afterwards. Without it, opening and closing a sheet halfway
    // down the lineup jumps the page to the top.
    it('holds the scroll offset while locked and restores it on unmount', () => {
        setScroll(240);
        const { unmount } = render(<Locker />);

        expect(document.body.style.top).toBe('-240px');

        unmount();

        expect(document.body.style.position).toBe('');
        expect(document.body.style.top).toBe('');
        expect(scrollToSpy).toHaveBeenCalledWith(0, 240);
    });

    it('leaves no inline styles behind after unmount', () => {
        const { unmount } = render(<Locker />);
        unmount();

        expect(document.body.getAttribute('style')).toBe('');
    });
});
