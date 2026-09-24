// One stroke icon per section, for the tab bar and the menus. Drawn in
// `currentColor` so each caller decides the colour - the active tab tints
// its icon with `mine`, everything else inherits the row's ink.
const PATHS = {
    draft: (
        <>
            <rect x="4" y="4" width="7" height="7" rx="1.5" />
            <rect x="13" y="4" width="7" height="7" rx="1.5" />
            <rect x="4" y="13" width="7" height="7" rx="1.5" />
            <rect x="13" y="13" width="7" height="7" rx="1.5" />
        </>
    ),
    lineup: (
        <>
            <rect x="4" y="4" width="16" height="4" rx="1" />
            <rect x="4" y="10" width="16" height="4" rx="1" />
            <rect x="4" y="16" width="16" height="4" rx="1" />
        </>
    ),
    ranks: <path d="M9 6h11M9 12h11M9 18h11M4 6h1M4 12h1M4 18h1" />,
    movers: (
        <>
            <path d="M3 17l6-6 4 4 8-8" />
            <path d="M15 7h6v6" />
        </>
    ),
    trades: <path d="M7 7h13l-4-4M17 17H4l4 4" />,
    leaguemates: (
        <>
            <circle cx="9" cy="8" r="3.5" />
            <path d="M2.5 20c.8-3.5 3.4-5.5 6.5-5.5s5.7 2 6.5 5.5" />
            <path d="M16 4.5a3.5 3.5 0 010 7M18 14.8c1.9.8 3.1 2.6 3.5 5.2" />
        </>
    ),
    power: <path d="M5 20V10M12 20V4M19 20v-7" />,
    'league-history': (
        <>
            <circle cx="12" cy="12" r="8.5" />
            <path d="M12 7.5V12l3 2" />
        </>
    ),
};

// A section with no drawn icon still gets a mark, so a new section never
// renders a tab with a hole where its icon should be.
const FALLBACK = <circle cx="12" cy="12" r="3" />;

const SectionIcon = ({ id, className = '' }) => (
    <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={`h-5 w-5 shrink-0 ${className}`}
    >
        {PATHS[id] ?? FALLBACK}
    </svg>
);

export default SectionIcon;
