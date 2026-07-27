import { describe, expect, it } from 'vitest';
import { pickClockMode, pickDeadline, formatTimeLeft, pollIntervalMs } from './draftClock';

const NOW = Date.UTC(2026, 6, 27, 12, 0, 0);

describe('pickClockMode', () => {
    it('is not-started for a pre_draft league regardless of pick_timer', () => {
        expect(
            pickClockMode({ status: 'pre_draft', start_time: null, last_picked: null, settings: { pick_timer: 60 } }),
        ).toBe('not-started');
    });

    it('is not-started when neither last_picked nor start_time exists, even mid-draft status', () => {
        expect(
            pickClockMode({
                status: 'drafting',
                start_time: null,
                last_picked: null,
                settings: { pick_timer: 60 },
            }),
        ).toBe('not-started');
    });

    // Three of the five real leagues are complete. Their last_picked and
    // pick_timer are both real, so the arithmetic yields a deadline that
    // expired when the draft ended - a finished board would have read
    // "Time expired" indefinitely.
    it('is complete for a finished draft that still carries a timer', () => {
        expect(
            pickClockMode({
                status: 'complete',
                start_time: NOW - 86400000,
                last_picked: NOW - 3600000,
                settings: { pick_timer: 43200 },
            }),
        ).toBe('complete');
    });

    it('has no deadline to count down to once the draft is complete', () => {
        expect(
            pickDeadline({
                status: 'complete',
                start_time: NOW - 86400000,
                last_picked: NOW - 3600000,
                settings: { pick_timer: 43200 },
            }),
        ).toBeNull();
    });

    it('is untimed when pick_timer is 0', () => {
        expect(
            pickClockMode({ status: 'drafting', start_time: NOW, last_picked: null, settings: { pick_timer: 0 } }),
        ).toBe('untimed');
    });

    it('is untimed when pick_timer is missing entirely', () => {
        expect(pickClockMode({ status: 'drafting', start_time: NOW, last_picked: null, settings: {} })).toBe('untimed');
    });

    it('is live at 899 seconds', () => {
        expect(
            pickClockMode({ status: 'drafting', start_time: NOW, last_picked: null, settings: { pick_timer: 899 } }),
        ).toBe('live');
    });

    it('is slow at exactly 900 seconds - the boundary belongs to slow', () => {
        expect(
            pickClockMode({ status: 'drafting', start_time: NOW, last_picked: null, settings: { pick_timer: 900 } }),
        ).toBe('slow');
    });

    it('is slow for a 24-hour dynasty rookie pace', () => {
        expect(
            pickClockMode({
                status: 'drafting',
                start_time: NOW,
                last_picked: null,
                settings: { pick_timer: 86400 },
            }),
        ).toBe('slow');
    });
});

describe('pickDeadline', () => {
    it('is null when not-started', () => {
        expect(pickDeadline({ status: 'pre_draft', start_time: null, last_picked: null, settings: {} })).toBeNull();
    });

    it('is null when untimed', () => {
        expect(
            pickDeadline({ status: 'drafting', start_time: NOW, last_picked: null, settings: { pick_timer: 0 } }),
        ).toBeNull();
    });

    it('bases the deadline on last_picked over start_time once a pick has landed', () => {
        const lastPicked = NOW;
        const deadline = pickDeadline({
            status: 'drafting',
            start_time: NOW - 100000,
            last_picked: lastPicked,
            settings: { pick_timer: 60 },
        });
        expect(deadline).toBe(lastPicked + 60000);
    });

    it('falls back to start_time before the first pick', () => {
        const deadline = pickDeadline({
            status: 'drafting',
            start_time: NOW,
            last_picked: null,
            settings: { pick_timer: 60 },
        });
        expect(deadline).toBe(NOW + 60000);
    });

    it('leaves the deadline untouched when autopause_enabled is falsy, even with a window that would otherwise apply', () => {
        // last_picked lands right at local midnight; autopause window is
        // 07:00-13:00 the same day, so a naive deadline shortly after
        // midnight would NOT fall in the window anyway. Use a base that
        // lands inside 07:00-13:00 to prove the flag - not the window - is
        // what gates the shift.
        const midnight = new Date(2026, 6, 27, 0, 0, 0).getTime();
        const lastPicked = midnight + 8 * 3600000; // 08:00 local
        const deadline = pickDeadline({
            status: 'drafting',
            start_time: null,
            last_picked: lastPicked,
            settings: {
                pick_timer: 60,
                autopause_enabled: 0,
                autopause_start_time: 420, // 07:00
                autopause_end_time: 780, // 13:00
            },
        });
        // Naive deadline, no shift applied because autopause is disabled.
        expect(deadline).toBe(lastPicked + 60000);
    });

    it('pushes the deadline out by the window length when autopause is enabled and the deadline lands inside it', () => {
        const midnight = new Date(2026, 6, 27, 0, 0, 0).getTime();
        const lastPicked = midnight + 8 * 3600000; // 08:00 local
        const windowStart = midnight + 420 * 60000; // 07:00
        const windowEnd = midnight + 780 * 60000; // 13:00
        const deadline = pickDeadline({
            status: 'drafting',
            start_time: null,
            last_picked: lastPicked,
            settings: {
                pick_timer: 60,
                autopause_enabled: 1,
                autopause_start_time: 420,
                autopause_end_time: 780,
            },
        });
        const naiveDeadline = lastPicked + 60000;
        expect(naiveDeadline).toBeGreaterThanOrEqual(windowStart);
        expect(naiveDeadline).toBeLessThan(windowEnd);
        expect(deadline).toBe(naiveDeadline + (windowEnd - windowStart));
    });

    it('does not shift a deadline that falls outside the autopause window even when enabled', () => {
        const midnight = new Date(2026, 6, 27, 0, 0, 0).getTime();
        const lastPicked = midnight + 20 * 3600000; // 20:00 local, well after the window
        const deadline = pickDeadline({
            status: 'drafting',
            start_time: null,
            last_picked: lastPicked,
            settings: {
                pick_timer: 60,
                autopause_enabled: 1,
                autopause_start_time: 420,
                autopause_end_time: 780,
            },
        });
        expect(deadline).toBe(lastPicked + 60000);
    });
});

describe('formatTimeLeft', () => {
    it('formats live mode as M:SS', () => {
        expect(formatTimeLeft(88000, 'live')).toBe('1:28');
    });

    it('floors a small positive remainder to 0:00 rather than showing a negative', () => {
        expect(formatTimeLeft(400, 'live')).toBe('0:00');
    });

    it('reports Time expired once truly past the deadline in live mode', () => {
        expect(formatTimeLeft(-1, 'live')).toBe('Time expired');
        expect(formatTimeLeft(0, 'live')).toBe('Time expired');
    });

    it('formats slow mode with the largest two coarse units - hours and minutes', () => {
        const msLeft = 3 * 3600000 + 42 * 60000;
        expect(formatTimeLeft(msLeft, 'slow')).toBe('3h 42m');
    });

    it('formats slow mode with days and hours once a full day is left', () => {
        const msLeft = 1 * 86400000 + 4 * 3600000;
        expect(formatTimeLeft(msLeft, 'slow')).toBe('1d 4h');
    });

    it('formats slow mode with just minutes under an hour', () => {
        expect(formatTimeLeft(12 * 60000, 'slow')).toBe('12m');
    });

    it('reports Time expired for a past deadline in slow mode too', () => {
        expect(formatTimeLeft(-60000, 'slow')).toBe('Time expired');
    });
});

describe('pollIntervalMs', () => {
    it('polls every 3 seconds in live mode', () => {
        expect(
            pollIntervalMs({ status: 'drafting', start_time: NOW, last_picked: null, settings: { pick_timer: 30 } }),
        ).toBe(3000);
    });

    it('polls every 30 seconds in slow mode', () => {
        expect(
            pollIntervalMs({
                status: 'drafting',
                start_time: NOW,
                last_picked: null,
                settings: { pick_timer: 86400 },
            }),
        ).toBe(30000);
    });

    it('polls every 30 seconds when untimed', () => {
        expect(
            pollIntervalMs({ status: 'drafting', start_time: NOW, last_picked: null, settings: { pick_timer: 0 } }),
        ).toBe(30000);
    });

    it('polls every 30 seconds when not-started', () => {
        expect(pollIntervalMs({ status: 'pre_draft', start_time: null, last_picked: null, settings: {} })).toBe(30000);
    });
});
