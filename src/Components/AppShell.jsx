import { useMemo } from 'react';
import { useHashRoute } from '../useHashRoute.js';
import { DEFAULT_SECTION_ID } from '../sections.js';
import AppBar from './AppBar';

// Sections that share the main column with a Ranks aside on wide screens.
// 'ranks' itself is excluded on purpose: when it is active, Ranks already IS
// the main-column content, so a second copy beside it would just duplicate
// the panel.
const SECTIONS_WITH_ASIDE = ['draft', 'lineup'];

const AppShell = ({
    sections,
    renderSection,
    renderAside,
    banner = null,
    identity = {},
    leagueID,
    leagueIds,
    updateLeagueID,
    defaultSectionId = DEFAULT_SECTION_ID,
}) => {
    // Memoised because the hook subscribes to `hashchange` against these: a
    // fresh array every render would tear the listener down and rebuild it on
    // every render.
    const sectionIds = useMemo(() => sections.map((section) => section.id), [sections]);

    // The default only applies if the caller actually has that section. A
    // sections list without it - a test fixture, or a future shell that opens
    // somewhere else - falls back to its own first entry rather than to an id
    // it does not contain. The hash still wins over this whenever it names a
    // real section - see useHashRoute.
    const fallbackId = sectionIds.includes(defaultSectionId) ? defaultSectionId : sectionIds[0];

    const [activeId, goTo] = useHashRoute(sectionIds, fallbackId);

    const activeSection = sections.find((section) => section.id === activeId);
    // A global-scope section operates across every league at once, so it must
    // never show the league pill - there is no single league to switch.
    const showLeaguePill = activeSection?.scope === 'league';
    const showAside = Boolean(renderAside) && SECTIONS_WITH_ASIDE.includes(activeId);

    return (
        <div className="bg-ground text-ink flex min-h-screen flex-col">
            {/* AppShell owns the route (activeId/goTo) and hands it to AppBar so
                the top bar's section pills and the tab bar below share one
                source of truth rather than two hooks that could drift. */}
            <AppBar
                {...identity}
                sections={sections}
                activeId={activeId}
                onNavigate={goTo}
                leagueID={showLeaguePill ? leagueID : undefined}
                leagueIds={showLeaguePill ? leagueIds : undefined}
                updateLeagueID={updateLeagueID}
            />
            <div className="flex flex-1 flex-col md:gap-4 md:p-4">
                {/* The tab bar is fixed, so the body has to end above it. Off
                    the shared custom property rather than a literal, which is
                    what it drifted from before: pb-16 was 64px against a 60px
                    bar. */}
                {/* Above `main` rather than inside it: `main` turns into a row
                    at md, and a banner in there would become a column beside
                    the section instead of a strip across the top of it. */}
                {banner}
                <main className="order-2 flex flex-1 flex-col gap-4 pb-[var(--tab-bar-h)] md:order-2 md:flex-row md:pb-0">
                    <div className="min-w-0 flex-1">{renderSection(activeId)}</div>
                    {/* Wide screens only. `hidden md:block` rather than a JS width
                        check: below 768px the aside would otherwise stack under the
                        active section, which is the two-panel layout the tab bar
                        exists to replace. */}
                    {showAside ? <div className="hidden min-w-0 flex-1 md:block">{renderAside()}</div> : null}
                </main>
                {/* Phone only - the same sections render as pills inside AppBar
                    at md and up (see its "Section switcher" nav), so this bar is
                    hidden rather than replaced: both exist in the DOM, only one
                    is ever visible at a given width. */}
                <nav
                    aria-label="Sections"
                    className="border-line-quiet bg-chrome fixed inset-x-0 bottom-0 z-10 flex h-[var(--tab-bar-h)] border-t md:hidden"
                >
                    {sections.map((section) => {
                        const isActive = section.id === activeId;
                        return (
                            <button
                                key={section.id}
                                type="button"
                                aria-current={isActive ? 'page' : undefined}
                                onClick={() => goTo(section.id)}
                                className="flex flex-1 flex-col items-center justify-center gap-[5px]"
                            >
                                <span
                                    className={`text-xs ${isActive ? 'text-ink font-semibold' : 'text-ink-dim font-medium'}`}
                                >
                                    {section.label}
                                </span>
                                <span
                                    className={`h-[2px] w-4 rounded-full ${isActive ? 'bg-mine' : 'bg-transparent'}`}
                                />
                            </button>
                        );
                    })}
                </nav>
            </div>
        </div>
    );
};

export default AppShell;
