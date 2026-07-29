// Pure helpers for reading the pick clock off a draft object. No React here -
// PickClock.jsx owns the timer and the rendering, this module only owns the
// arithmetic, so the arithmetic can be tested without mounting anything.
//
// The API facts this module encodes, established against the five real
// leagues rather than assumed:
//   - `settings.pick_timer` of `0` (or missing) means untimed - a first-class
//     state, not a null to route around.
//   - `last_picked` is absent (`null`) before the first pick lands.
//   - `start_time` is also `null` while `status` is `pre_draft` - a clock
//     that assumes it exists renders garbage on exactly the draft you are
//     waiting on.
//   - `settings.autopause_enabled` is `0` on all five real leagues, so the
//     pause maths below is unexercised in practice. See the comment on
//     `applyAutopauseShift` for what that means for confidence in it.

const LIVE_THRESHOLD_SECONDS = 900; // 15 minutes

/**
 * `'not-started' | 'complete' | 'untimed' | 'slow' | 'live'`.
 *
 * The two terminal states take priority over everything else. A `pre_draft`
 * draft (or one with neither `last_picked` nor `start_time` to count from)
 * has nothing to clock yet, and a finished one has nothing left to clock -
 * its `last_picked` is real and its `pick_timer` is real, so the arithmetic
 * happily produces a deadline that expired whenever the draft ended. Three
 * of the five real leagues are `complete`, and every one of them would read
 * "Time expired" without this.
 */
export function pickClockMode(draft) {
    const { status, last_picked: lastPicked, start_time: startTime } = draft;

    if (status === 'pre_draft' || (lastPicked == null && startTime == null)) {
        return 'not-started';
    }

    if (status === 'complete') {
        return 'complete';
    }

    const pickTimer = draft.settings?.pick_timer;
    if (!pickTimer) {
        // `0` and "missing" both read as untimed - Sleeper uses `0` for the
        // one untimed real league, but a defensively-missing field should not
        // be treated as a live, near-instant clock.
        return 'untimed';
    }

    return pickTimer < LIVE_THRESHOLD_SECONDS ? 'live' : 'slow';
}

/**
 * Autopause shift: if the naive deadline lands inside the pause window, push
 * it out by the window's length so the countdown does not run down during a
 * pause.
 *
 * `autopause_start_time` / `autopause_end_time` are read here as minutes
 * since local midnight (e.g. 420 -> 07:00, 780 -> 13:00). That reading is an
 * assumption, not a verified fact - every one of the five real leagues has
 * `autopause_enabled: 0`, so this path has never been exercised against a
 * real pause window. Because it is only ever reached when the flag is
 * truthy, every real league today gets the naive deadline computed above,
 * untouched.
 */
function applyAutopauseShift(deadline, settings) {
    const startMinutes = settings.autopause_start_time;
    const endMinutes = settings.autopause_end_time;
    if (startMinutes == null || endMinutes == null) {
        return deadline;
    }

    const deadlineDate = new Date(deadline);
    const localMidnight = new Date(
        deadlineDate.getFullYear(),
        deadlineDate.getMonth(),
        deadlineDate.getDate(),
    ).getTime();
    const windowStart = localMidnight + startMinutes * 60000;
    const windowEnd = localMidnight + endMinutes * 60000;

    if (deadline >= windowStart && deadline < windowEnd) {
        return deadline + (windowEnd - windowStart);
    }
    return deadline;
}

/**
 * Ms timestamp the current pick is due, or `null` when there is nothing to
 * count from (`not-started`, `untimed`). Base is `last_picked ?? start_time`,
 * plus `pick_timer` seconds, shifted for autopause when the league has it on.
 */
export function pickDeadline(draft) {
    const mode = pickClockMode(draft);
    if (mode === 'not-started' || mode === 'complete' || mode === 'untimed') {
        return null;
    }

    const settings = draft.settings ?? {};
    const base = draft.last_picked ?? draft.start_time;
    const naiveDeadline = base + settings.pick_timer * 1000;

    if (!settings.autopause_enabled) {
        return naiveDeadline;
    }
    return applyAutopauseShift(naiveDeadline, settings);
}

function formatCoarse(msLeft) {
    const totalMinutes = Math.floor(msLeft / 60000);
    const days = Math.floor(totalMinutes / 1440);
    const hours = Math.floor((totalMinutes % 1440) / 60);
    const minutes = totalMinutes % 60;

    if (days > 0) {
        return `${days}d ${hours}h`;
    }
    if (hours > 0) {
        return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
}

/**
 * Renders time remaining for `live`/`slow` modes. `live` counts seconds as
 * `M:SS`; `slow` uses the largest two coarse units (`3h 42m`, `1d 4h`,
 * `12m`). Anything at or past the deadline reads `'Time expired'` - the one
 * exception is a `live` countdown whose true remainder has floored to
 * (0, 1000)ms, which still reads as the terminal `0:00` rather than jumping
 * straight to the expired message.
 */
export function formatTimeLeft(msLeft, mode) {
    if (msLeft <= 0) {
        return 'Time expired';
    }

    if (mode === 'live') {
        const totalSeconds = Math.floor(msLeft / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes}:${String(seconds).padStart(2, '0')}`;
    }

    return formatCoarse(msLeft);
}

/** Under this much time left, the clock card's bar and numeral go `danger`. */
export const URGENT_MS = 30000;

/**
 * How much of the current pick's timer is gone, `0`..`1`, or `null` when there
 * is no timer to be a fraction of (`not-started`, `complete`, `untimed`) -
 * which is also the signal to render no progress bar at all rather than an
 * empty one.
 */
export function pickProgress(draft, now = Date.now()) {
    const deadline = pickDeadline(draft);
    if (deadline === null) {
        return null;
    }
    const total = (draft.settings?.pick_timer ?? 0) * 1000;
    if (total <= 0) {
        return null;
    }
    const elapsed = total - (deadline - now);
    return Math.min(1, Math.max(0, elapsed / total));
}

/**
 * How often to re-poll the sync endpoint: fast for a live-paced draft, slow
 * otherwise. Hammering the endpoint every 3 seconds against a 24-hour clock
 * is wasted battery on the device that matters.
 */
export function pollIntervalMs(draft) {
    return pickClockMode(draft) === 'live' ? 3000 : 30000;
}
