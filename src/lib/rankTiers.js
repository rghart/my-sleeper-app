// Working out which tier each player in a pasted list belongs to.
//
// Two ways a list says it: a heading (`Tier 3`, `--- Tier 2 - Elite ---`), or
// a blank line between groups. Both are things the parser used to throw away -
// a heading became a bogus player and a blank became nothing at all.

/**
 * The tier state of one pass over a pasted list.
 *
 * A run rather than a pure function because tiers are inherently positional:
 * what tier a player is in depends on every heading and blank above them, and
 * the caller is already walking the list once to count ranks. This keeps that
 * one walk and holds the awkward parts - which blanks count, when a heading
 * opens a tier rather than renaming one - in a place they can be tested.
 */
export class TierRun {
    constructor(items) {
        // A blank line only divides tiers in a list that has no headings. In
        // one that has them the headings are the structure, and the blank
        // lines around them are just typography - counting both would open a
        // second, empty tier at every heading.
        this.blanksDivide = !items.some((item) => item.kind === 'tier');
        this.index = 1;
        this.label = null;
        this.occupied = false;
        this.pendingBreak = false;
    }

    /**
     * A heading. It opens a new tier only if the current one already holds
     * somebody - a heading above the first player is naming tier 1, not
     * creating an empty one before it.
     */
    heading(tier) {
        if (this.occupied) {
            this.index += 1;
            this.occupied = false;
        }
        this.label = tier.label;
        this.pendingBreak = false;
    }

    /** A blank line. Consecutive ones collapse: `pendingBreak` is a flag. */
    blank() {
        if (this.blanksDivide) this.pendingBreak = true;
    }

    /**
     * The tier fields to stamp on the next player, advancing first if a blank
     * line has divided them from the last one.
     *
     * The `occupied` test is what stops leading and trailing blanks opening
     * empty tiers: a break only counts when there is something to break from.
     */
    forNextPlayer() {
        if (this.pendingBreak && this.occupied) {
            this.index += 1;
            this.label = null;
            this.occupied = false;
        }
        this.pendingBreak = false;
        this.occupied = true;
        return { tier: this.index, tier_label: this.label ?? `Tier ${this.index}` };
    }

    /**
     * The entries, with the tier fields dropped if the list turned out to have
     * only one tier.
     *
     * A list with no tier structure must come out exactly as it did before any
     * of this existed - same fields, so the same thing is saved to Firebase
     * and the panel has nothing to draw a divider from. One tier is not a tier;
     * it is just a list.
     */
    settle(entries) {
        if (this.index > 1) return entries;
        return entries.map((entry) => {
            const bare = { ...entry };
            delete bare.tier;
            delete bare.tier_label;
            return bare;
        });
    }
}

/**
 * The entries grouped for rendering, as `[{ tier, label, entries }]`, or null
 * where the list is not tiered.
 *
 * Null rather than one group covering everything, so the panel renders exactly
 * what it used to for an untiered list rather than a single pointless heading.
 * Groups are built by walking in order rather than by bucketing, because the
 * list is already in rank order and that is the order tiers come in.
 */
export function groupByTier(entries) {
    if (!entries.some((entry) => entry.tier)) return null;

    const groups = [];
    entries.forEach((entry) => {
        const last = groups[groups.length - 1];
        if (last && last.tier === entry.tier) {
            last.entries.push(entry);
            return;
        }
        groups.push({ tier: entry.tier, label: entry.tier_label ?? `Tier ${entry.tier}`, entries: [entry] });
    });
    return groups;
}
