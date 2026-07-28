import { useEffect, useState } from 'react';
import { pickClockMode, pickDeadline, formatTimeLeft } from '../lib/draftClock.js';

// Re-render cadence per mode: a `live` clock ticking seconds needs a 1s
// timer, `slow` only needs to move once a minute, and `untimed` / `not-started`
// have nothing to count down so no timer runs at all - there is nothing for
// it to invalidate.
const TICK_MS = {
    live: 1000,
    slow: 60000,
};

const PickClock = ({ draft }) => {
    const mode = pickClockMode(draft);
    const [, forceTick] = useState(0);

    useEffect(() => {
        const interval = TICK_MS[mode];
        if (!interval) {
            return undefined;
        }
        const timer = setInterval(() => forceTick((n) => n + 1), interval);
        return () => clearInterval(timer);
    }, [mode]);

    const WRAPPER = 'border border-line rounded-[5px] bg-raised px-3 py-2';

    if (mode === 'not-started') {
        return (
            <div className={WRAPPER}>
                <p className="text-ink-muted text-sm">Draft hasn&apos;t started</p>
            </div>
        );
    }

    if (mode === 'complete') {
        // A finished draft still carries a real `last_picked` and a real
        // `pick_timer`, so the arithmetic produces a deadline that expired
        // when the draft did. Saying so beats counting down to it.
        return (
            <div className={WRAPPER}>
                <p className="text-ink-muted text-sm">Draft complete</p>
            </div>
        );
    }

    if (mode === 'untimed') {
        // Never render a countdown here - there is no deadline to count down
        // to, and rendering the raw arithmetic anyway is exactly how a bare
        // `0:00` or `NaN` would leak onto an untimed draft's screen.
        return (
            <div className={WRAPPER}>
                <p className="text-ink-muted text-sm">Untimed draft</p>
            </div>
        );
    }

    const deadline = pickDeadline(draft);
    const msLeft = deadline - Date.now();
    // Deliberately not "until autopick": whether an expired pick is
    // auto-made depends on league settings nobody here has verified.
    const label = 'Time left';

    return (
        <div className={WRAPPER}>
            <p className="text-ink text-sm">
                <span className="text-ink-muted">{label}: </span>
                <span className="font-semibold tabular-nums">{formatTimeLeft(msLeft, mode)}</span>
            </p>
        </div>
    );
};

export default PickClock;
