import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import PickClock from './PickClock';

// draftClock.js itself is tested exhaustively in src/lib/draftClock.test.js -
// this file only has to prove PickClock wires it up correctly: the right
// text per mode, the right timer cadence (or none), and that the interval is
// torn down on unmount and swapped when the mode changes.

const NOW = Date.UTC(2026, 6, 27, 12, 0, 0);

describe('PickClock', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(NOW);
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('reads not-started for a pre_draft league and starts no timer', () => {
        render(<PickClock draft={{ status: 'pre_draft', start_time: null, last_picked: null, settings: {} }} />);

        expect(screen.getByText("Draft hasn't started")).toBeTruthy();
        expect(vi.getTimerCount()).toBe(0);
    });

    it('says a finished draft is finished rather than counting down to a past deadline', () => {
        render(
            <PickClock
                draft={{
                    status: 'complete',
                    start_time: NOW - 86400000,
                    last_picked: NOW - 3600000,
                    settings: { pick_timer: 43200 },
                }}
            />,
        );

        expect(screen.getByText('Draft complete')).toBeTruthy();
        expect(screen.queryByText(/Time expired/)).toBeNull();
        expect(screen.queryByText(/Time left/)).toBeNull();
        expect(vi.getTimerCount()).toBe(0);
    });

    it('reads untimed without rendering any countdown, NaN, or bare 0:00', () => {
        render(
            <PickClock
                draft={{ status: 'drafting', start_time: NOW, last_picked: null, settings: { pick_timer: 0 } }}
            />,
        );

        expect(screen.getByText('Untimed draft')).toBeTruthy();
        expect(screen.queryByText(/NaN/)).toBeNull();
        expect(screen.queryByText(/0:00/)).toBeNull();
        expect(vi.getTimerCount()).toBe(0);
    });

    it('counts down seconds in live mode and ticks every second', () => {
        render(
            <PickClock
                draft={{ status: 'drafting', start_time: NOW, last_picked: null, settings: { pick_timer: 90 } }}
            />,
        );

        expect(screen.getByText('1:30')).toBeTruthy();

        act(() => {
            vi.advanceTimersByTime(1000);
        });
        expect(screen.getByText('1:29')).toBeTruthy();
    });

    it('counts down coarsely in slow mode and ticks every minute, not every second', () => {
        render(
            <PickClock
                draft={{ status: 'drafting', start_time: NOW, last_picked: null, settings: { pick_timer: 86400 } }}
            />,
        );

        expect(screen.getByText('1d 0h')).toBeTruthy();

        act(() => {
            vi.advanceTimersByTime(1000);
        });
        // A 1s tick must not move a slow-mode clock.
        expect(screen.getByText('1d 0h')).toBeTruthy();

        act(() => {
            vi.advanceTimersByTime(59000);
        });
        expect(screen.getByText('23h 59m')).toBeTruthy();
    });

    it('clears the interval on unmount', () => {
        const { unmount } = render(
            <PickClock
                draft={{ status: 'drafting', start_time: NOW, last_picked: null, settings: { pick_timer: 90 } }}
            />,
        );

        expect(vi.getTimerCount()).toBe(1);
        unmount();
        expect(vi.getTimerCount()).toBe(0);
    });

    it('swaps the interval rather than stacking one when the mode changes', () => {
        const { rerender } = render(
            <PickClock
                draft={{ status: 'drafting', start_time: NOW, last_picked: null, settings: { pick_timer: 90 } }}
            />,
        );
        expect(vi.getTimerCount()).toBe(1);

        rerender(
            <PickClock
                draft={{ status: 'drafting', start_time: NOW, last_picked: null, settings: { pick_timer: 0 } }}
            />,
        );

        // untimed runs no timer at all - the live one must have been cleared,
        // not left running alongside nothing.
        expect(vi.getTimerCount()).toBe(0);
    });
});
