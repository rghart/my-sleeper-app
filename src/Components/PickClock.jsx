import { useEffect, useState } from 'react';
import { pickClockMode, pickDeadline, formatTimeLeft, URGENT_MS } from '../lib/draftClock.js';

// Re-render cadence per mode: a `live` clock ticking seconds needs a 1s
// timer, `slow` only needs to move once a minute, and `untimed` / `not-started`
// have nothing to count down so no timer runs at all - there is nothing for
// it to invalidate.
const TICK_MS = {
    live: 1000,
    slow: 60000,
};

// The numeral (or the words that replace it) on the clock card. No box of its
// own any more: the card is the surface, and this only owns what is counted -
// see ClockCard.jsx for the eyebrow, the manager and the progress bar.
//
// The three non-counting modes deliberately render text where the numeral
// would be rather than a `0:00` computed off arithmetic that has no meaning
// for them.
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

    const STATIC_TEXT = {
        'not-started': "Draft hasn't started",
        complete: 'Draft complete',
        untimed: 'Untimed draft',
    };

    if (STATIC_TEXT[mode]) {
        return <p className="text-ink-muted m-0 shrink-0 text-right text-[15px] font-medium">{STATIC_TEXT[mode]}</p>;
    }

    const msLeft = pickDeadline(draft) - Date.now();
    const urgent = msLeft <= URGENT_MS;
    // 34px is the design's figure for a `M:SS` countdown. "Time expired" and
    // the coarse `1d 4h` of a slow draft are words, not a numeral, and at 34px
    // they collide with the manager's name beside them.
    const large = mode === 'live' && msLeft > 0;

    return (
        <p
            className={`m-0 shrink-0 text-right font-mono font-medium tracking-[-0.02em] tabular-nums ${
                large ? 'text-[34px]' : 'text-[20px]'
            } ${urgent ? 'text-danger' : 'text-ink'}`}
        >
            {formatTimeLeft(msLeft, mode)}
        </p>
    );
};

export default PickClock;
