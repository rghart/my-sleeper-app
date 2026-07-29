import { useEffect } from 'react';

// Freezes the page behind an open overlay, and puts it back exactly where it
// was on close. Called by Sheet and Drawer, both of which are mounted only
// while open, so the lock rides their mount/unmount.
//
// `overflow: hidden` on the body alone is the usual advice and it does not
// work on iOS Safari: the page keeps scrolling under a fixed-position
// overlay, which is what made dragging inside the rank sheet on an iPhone
// scroll the lineup behind it instead of the sheet's own rows. Taking the
// body out of flow with `position: fixed` is what actually stops it - at the
// cost of losing the scroll offset, since a fixed body jumps to the top. So
// the offset is captured first, held as a negative `top` while the overlay is
// up, and restored with an explicit scrollTo afterwards.
//
// The sheet's scrolling region also needs `overscroll-contain`, so that
// reaching the end of the rows does not chain the gesture onward. The two are
// complementary: containment handles the scrollable case, this handles the
// case where the sheet's content is shorter than its box and there is nothing
// to scroll at all.
export function useBodyScrollLock() {
    useEffect(() => {
        const { body } = document;
        const scrollY = window.scrollY;
        const previous = {
            position: body.style.position,
            top: body.style.top,
            left: body.style.left,
            right: body.style.right,
            width: body.style.width,
            overflow: body.style.overflow,
        };

        body.style.position = 'fixed';
        body.style.top = `-${scrollY}px`;
        body.style.left = '0';
        body.style.right = '0';
        body.style.width = '100%';
        body.style.overflow = 'hidden';

        return () => {
            Object.assign(body.style, previous);
            // Instant rather than smooth: this is restoring a position the
            // user never left, not navigating to a new one.
            window.scrollTo(0, scrollY);
        };
    }, []);
}
