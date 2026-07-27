import { useMemo } from 'react';
import { useHashRoute } from '../useHashRoute.js';
import { DEFAULT_SECTION_ID } from '../sections.js';

// Sections that share the main column with a Ranks aside on wide screens.
// 'ranks' itself is excluded on purpose: when it is active, Ranks already IS
// the main-column content, so a second copy beside it would just duplicate
// the panel.
const SECTIONS_WITH_ASIDE = ['draft', 'lineup'];

const AppShell = ({ sections, renderSection, renderAside, leagueBar, defaultSectionId = DEFAULT_SECTION_ID }) => {
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
    const showLeagueBar = activeSection?.scope === 'league';
    const showAside = Boolean(renderAside) && SECTIONS_WITH_ASIDE.includes(activeId);

    return (
        <div className="bg-ground text-ink flex min-h-screen flex-col">
            {showLeagueBar ? leagueBar : null}
            <div className="flex flex-1 flex-col md:gap-4 md:p-4">
                <main className="order-2 flex flex-1 flex-col gap-4 pb-16 md:order-2 md:flex-row md:pb-0">
                    <div className="min-w-0 flex-1">{renderSection(activeId)}</div>
                    {/* Wide screens only. `hidden md:block` rather than a JS width
                        check: below 768px the aside would otherwise stack under the
                        active section, which is the two-panel layout the tab bar
                        exists to replace. */}
                    {showAside ? <div className="hidden min-w-0 flex-1 md:block">{renderAside()}</div> : null}
                </main>
                <nav
                    aria-label="Sections"
                    className="border-line bg-raised fixed inset-x-0 bottom-0 z-10 flex border-t border-solid md:static md:order-1 md:border-t-0 md:border-b md:border-solid"
                >
                    {sections.map((section) => {
                        const isActive = section.id === activeId;
                        return (
                            <button
                                key={section.id}
                                type="button"
                                aria-current={isActive ? 'page' : undefined}
                                onClick={() => goTo(section.id)}
                                // `appearance-none bg-transparent` because preflight is not
                                // loaded: without it a bare <button> keeps the UA's own
                                // border, background and rounded corners, and every tab
                                // renders as a grey box.
                                className={`m-0 min-h-11 flex-1 cursor-pointer appearance-none rounded-none border-t-2 border-r-0 border-b-0 border-l-0 border-solid bg-transparent px-4 py-2 text-sm md:flex-none ${
                                    isActive ? 'border-mine text-mine' : 'text-ink-muted border-transparent'
                                }`}
                            >
                                {section.label}
                            </button>
                        );
                    })}
                </nav>
            </div>
        </div>
    );
};

export default AppShell;
