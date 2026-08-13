// A player's dynasty market value and which way it is going.
//
// The value alone is nearly useless on a rank list — it restates the ordering
// you are already looking at. The *movement* is the part that is new
// information, and it is the whole reason `player_value_history` exists: a
// buy-low and a sell-high are both claims about a price changing.
//
// So the delta is the loud element and the value is context beneath it,
// which is the opposite of how a market widget usually reads.

// A value is 0–9999 on KTC's scale and four digits is too wide for a row that
// already carries an ADP delta, a position tag and an action button. Thousands
// with one decimal keeps it to four characters and loses nothing a human acts
// on — nobody trades on the difference between 6012 and 6020.
export const formatValue = (value) => {
    if (value == null) return null;
    if (value < 1000) return String(Math.round(value));
    return `${(value / 1000).toFixed(1)}k`;
};

/**
 * The movement, as a signed percentage.
 *
 * Percent rather than points because points are not comparable across the
 * board: 200 points is a rounding error on a 9,000 asset and a third of a
 * late 4th. The percentage is the same question everywhere.
 *
 * `null` when there is nothing to compare against — which is NOT the same as
 * flat, and the API is careful to send `null` rather than `0` for it. A row
 * that has never been seen before must not claim it held steady.
 */
export const formatChange = (changePct) => {
    if (changePct == null) return null;
    const rounded = Math.round(changePct);
    if (rounded === 0) return '±0';
    return rounded > 0 ? `+${rounded}%` : `${rounded}%`;
};

// Movement under this is noise, not a trend — KTC values wobble daily on
// crowd votes. Below it the number is still shown, but in the neutral tone:
// the figure is honest, the *colour* would be the overclaim.
const MEANINGFUL_PCT = 3;

const toneFor = (changePct) => {
    if (changePct == null || Math.abs(changePct) < MEANINGFUL_PCT) return 'text-ink-dim';
    return changePct > 0 ? 'text-live' : 'text-warn';
};

/**
 * Value and movement, inline — sized to sit in a row's meta line rather than
 * in its trailing cluster.
 *
 * **It lives in the meta line because the trailing cluster has no room, and
 * that was measured, not guessed.** As a 46px trailing column it cost ten of
 * fourteen rows their full name at 375px: "Christian McCaffrey" was clipped by
 * 80px, against zero names clipped before this feature. The trailing area
 * already carries an ADP delta, a position tag and an Add button, and the
 * design's own rule from the intel work is that the row's novel signal must
 * fit — here that is the player's name.
 *
 * The team abbreviation this replaces is not lost: it moved onto the avatar as
 * a logo, which is why the space is free.
 */
const ValueChip = ({ value, changePct }) => {
    const shown = formatValue(value);
    if (shown == null) return null;

    const change = formatChange(changePct);

    return (
        <span className="shrink-0">
            <span className="text-ink-quiet font-semibold tabular-nums">{shown}</span>
            {/* Absent, not "—", when there is no reading: a dash in a column
                of percentages reads as a value. The line simply gets shorter. */}
            {change && <span className={`ml-1 tabular-nums ${toneFor(changePct)}`}>{change}</span>}
        </span>
    );
};

export default ValueChip;
