import { TIERS } from '../lib/powerRankings.js';

// One stroke glyph per power-rankings tier. Tiers are told apart by shape and
// by their written label, never by colour: saturation in this app is reserved
// for data that has no other encoding (positions) and for "yours", and a
// five-hue tier palette would compete with both.
const PATHS = {
    contender: 'M8 4h8v5a4 4 0 01-8 0zM8 6H5a3 3 0 003 4M16 6h3a3 3 0 01-3 4M12 13v4M9 20h6',
    'all-in': 'M13 3L5 14h6l-1 7 8-11h-6z',
    middle: 'M5 9h14M5 15h14',
    rebuilding: 'M12 20v-8M12 12c0-4 3-6 7-6 0 4-3 6-7 6zM12 14c0-3-2-5-6-5 0 3 2 5 6 5',
    stuck: 'M12 8v12M8 12h8M5 15a7 7 0 0014 0M12 8a2 2 0 100-4 2 2 0 000 4z',
};

export const tierLabel = (tierId) => TIERS.find((tier) => tier.id === tierId)?.label ?? null;

export const TierIcon = ({ tier, className = 'h-3.5 w-3.5' }) =>
    PATHS[tier] ? (
        <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`shrink-0 ${className}`}
        >
            <path d={PATHS[tier]} />
        </svg>
    ) : null;

// The icon and its label together - the icon alone is decoration, which is
// why it is aria-hidden: the label is what carries the tier to a screen
// reader, and to anyone who has not learnt the shapes yet.
export const TierChip = ({ tier }) =>
    tier ? (
        <span className="bg-raised-2 text-ink-muted rounded-tag inline-flex h-5 shrink-0 items-center gap-1 px-1.5 text-[11px] font-semibold">
            <TierIcon tier={tier} />
            {tierLabel(tier)}
        </span>
    ) : null;
