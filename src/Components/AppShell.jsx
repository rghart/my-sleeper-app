import { useMemo } from 'react';
import { useHashRoute } from '../useHashRoute.js';
import { DEFAULT_SECTION_ID, groupLabelFor, groupSectionsFor } from '../sections.js';
import AppBar from './AppBar';
import NavMenu from './NavMenu';
import SectionIcon from './SectionIcon';
import { useMyLeagueTiers } from '../useMyLeagueTiers.js';

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
    sleeperUserId,
    playerInfo,
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

    // The tab bar shows the active section's group, not every section - the
    // side menu is where the rest live. A group with a single live section
    // (League, today) gets no bar: one tab is not a choice.
    const groupSections = groupSectionsFor(sections, activeId);
    const showTabBar = groupSections.length > 1;

    const leagueTiers = useMyLeagueTiers({ leagues: leagueIds, userId: sleeperUserId, playerInfo });

    return (
        // With no tab bar the shared bar height drops to zero on this subtree,
        // so everything anchored above the bar - sheets, the best-available
        // handle, the body's bottom padding - comes down to the screen edge
        // with it instead of floating over an empty strip.
        <div className="bg-ground text-ink flex min-h-screen" style={showTabBar ? undefined : { '--tab-bar-h': '0px' }}>
            {/* Wide screens only: the whole menu, always open. Below lg the
                same menu is the hamburger's drawer. */}
            <aside className="bg-chrome border-line-quiet sticky top-0 hidden h-screen w-60 shrink-0 flex-col gap-5 overflow-y-auto border-r px-3 py-5 lg:flex">
                <NavMenu
                    navLabel="All sections"
                    activeId={activeId}
                    onNavigate={goTo}
                    myDisplayName={identity.myDisplayName}
                    leagueCount={leagueIds ? leagueIds.length : 0}
                    signedIn={identity.signedIn}
                    signedInEmail={identity.signedInEmail}
                    sleeperUsername={identity.sleeperUsername}
                    onSignIn={identity.onSignIn}
                    onSignOut={identity.onSignOut}
                    onDisconnectSleeper={identity.onDisconnectSleeper}
                    leagues={leagueIds ?? []}
                    activeLeagueId={leagueID}
                    onSelectLeague={updateLeagueID}
                    leagueTiers={leagueTiers}
                />
            </aside>
            <div className="flex min-w-0 flex-1 flex-col">
                {/* AppShell owns the route (activeId/goTo) and hands it to
                    AppBar so the top bar's pills and the tab bar below share
                    one source of truth rather than two hooks that could
                    drift. */}
                <AppBar
                    {...identity}
                    groupLabel={groupLabelFor(sections, activeId)}
                    groupSections={groupSections}
                    hasSidebar
                    activeId={activeId}
                    onNavigate={goTo}
                    leagueID={showLeaguePill ? leagueID : undefined}
                    leagueIds={showLeaguePill ? leagueIds : undefined}
                    updateLeagueID={updateLeagueID}
                    leagueTiers={leagueTiers}
                />
                <div className="flex flex-1 flex-col md:gap-4 md:p-4">
                    {/* Above `main` rather than inside it: `main` turns into a
                        row at md, and a banner in there would become a column
                        beside the section instead of a strip across the top
                        of it. */}
                    <div className="px-3.5 pt-3.5 md:p-0">{banner}</div>
                    {/* The tab bar is fixed, so the body has to end above it -
                        off the shared custom property, which is zero when
                        there is no bar. */}
                    <main className="order-2 flex flex-1 flex-col gap-4 pb-[var(--tab-bar-h)] md:order-2 md:flex-row md:pb-0">
                        <div className="min-w-0 flex-1">{renderSection(activeId)}</div>
                        {/* Wide screens only. `hidden md:block` rather than a JS
                            width check: below 768px the aside would otherwise
                            stack under the active section, which is the
                            two-panel layout the tab bar exists to replace. */}
                        {showAside ? (
                            <div className="hidden min-w-0 flex-1 md:block">{renderAside(activeId)}</div>
                        ) : null}
                    </main>
                    {/* Phone only - from md the same group renders as pills in
                        AppBar (its "Section switcher" nav), so this bar is
                        hidden rather than replaced: both exist in the DOM,
                        only one is ever visible at a given width. */}
                    {showTabBar ? (
                        <nav
                            aria-label="Sections"
                            className="border-line-quiet bg-chrome fixed inset-x-0 bottom-0 z-10 flex h-[var(--tab-bar-h)] border-t md:hidden"
                        >
                            {groupSections.map((section) => {
                                const isActive = section.id === activeId;
                                return (
                                    <button
                                        key={section.id}
                                        type="button"
                                        aria-current={isActive ? 'page' : undefined}
                                        onClick={() => goTo(section.id)}
                                        className={`flex flex-1 flex-col items-center justify-center gap-1 ${
                                            isActive ? 'text-ink' : 'text-ink-dim'
                                        }`}
                                    >
                                        <SectionIcon id={section.id} className={isActive ? 'text-mine' : ''} />
                                        <span className={`text-[11px] ${isActive ? 'font-semibold' : 'font-medium'}`}>
                                            {section.label}
                                        </span>
                                    </button>
                                );
                            })}
                        </nav>
                    ) : null}
                </div>
            </div>
        </div>
    );
};

export default AppShell;
