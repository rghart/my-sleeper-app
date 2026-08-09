import { useId, useRef, useState } from 'react';
import LeaguePill from './LeaguePill';
import SelectPill from './Pill';
import Drawer from './Drawer';
import { avatarInitials } from './avatarInitials.js';
import { useSyncStatus } from '../SyncStatus.jsx';
import { useRankList } from '../RankList.jsx';

// The top bar. Rendered twice in this app on purpose: bare, by App, above
// the loading spinner and the error banner (no league yet, so no nav and no
// league pill to show); and by AppShell, with the nav and league-pill props
// filled in, once a shell actually exists to navigate.
//
// The hamburger's drawer lives here too, since the hamburger is what opens
// it - see Drawer.jsx for why it is mounted only while open.
const AppBar = ({
    signedIn,
    signedInEmail,
    myDisplayName,
    sleeperUsername,
    onSignIn,
    onSignOut,
    onDisconnectSleeper,
    sections,
    activeId,
    onNavigate,
    leagueID,
    leagueIds,
    updateLeagueID,
}) => {
    const [drawerOpen, setDrawerOpen] = useState(false);
    const hamburgerRef = useRef(null);
    const drawerId = useId();
    const isSyncing = useSyncStatus();
    const rankList = useRankList();

    const showLeaguePill = Boolean(leagueIds && leagueIds.length);
    const showSectionPills = Boolean(sections && sections.length);
    const initials = avatarInitials(myDisplayName);

    return (
        <>
            <div className="bg-chrome border-line-quiet flex h-14 items-center gap-2.5 border-b px-3.5 md:h-[60px] md:gap-4 md:px-5">
                <button
                    type="button"
                    aria-label="Open menu"
                    aria-expanded={drawerOpen}
                    aria-controls={drawerId}
                    ref={hamburgerRef}
                    onClick={() => setDrawerOpen(true)}
                    className="flex min-h-11 min-w-11 flex-col items-center justify-center gap-1 py-1.5"
                >
                    <span className="bg-ink-muted block h-[1.5px] w-[18px] rounded-[2px]" />
                    <span className="bg-ink-muted block h-[1.5px] w-[18px] rounded-[2px]" />
                    <span className="bg-ink-muted block h-[1.5px] w-[18px] rounded-[2px]" />
                </button>

                <span className="text-ink hidden text-[15px] font-bold tracking-[-0.02em] md:block">
                    Team Assistant
                </span>

                <span className="bg-line-mid hidden h-[22px] w-px md:block" />

                {/* On the Ranks section, RanksPanel publishes a rank list -
                    see RankList.jsx - and that replaces the league pill
                    rather than sitting beside it: the list is what you're
                    scoped to there, not the league. It disappears by itself
                    when RanksPanel unmounts, which is also what brings the
                    league pill back. */}
                {rankList ? (
                    <SelectPill
                        ariaLabel="Rank list"
                        value={rankList.currentValue}
                        onChange={rankList.onChange}
                        options={rankList.options}
                    />
                ) : showLeaguePill ? (
                    <LeaguePill leagueID={leagueID} leagueIds={leagueIds} updateLeagueID={updateLeagueID} />
                ) : null}

                {showSectionPills ? (
                    <nav aria-label="Section switcher" className="ml-5 hidden items-center gap-0.5 md:flex">
                        {sections.map((section) => {
                            const isActive = section.id === activeId;
                            return (
                                <button
                                    key={section.id}
                                    type="button"
                                    aria-current={isActive ? 'page' : undefined}
                                    onClick={() => onNavigate(section.id)}
                                    className={`rounded-full px-3.5 py-[7px] text-[13px] ${
                                        isActive ? 'bg-selected text-ink font-semibold' : 'text-ink-dim font-medium'
                                    }`}
                                >
                                    {section.label}
                                </button>
                            );
                        })}
                    </nav>
                ) : null}

                <div className="ml-auto flex items-center gap-2.5">
                    {isSyncing ? (
                        <span className="bg-live-tint flex items-center gap-1.5 rounded-full px-2.5 py-1">
                            <span className="bg-live animate-live-pulse h-1.5 w-1.5 rounded-full motion-reduce:animate-none" />
                            <span className="text-live font-mono text-[10px] font-semibold tracking-[.1em]">
                                <span className="md:hidden">SYNC</span>
                                <span className="hidden md:inline">SYNCING</span>
                            </span>
                        </span>
                    ) : null}

                    <span className="bg-raised-2 border-line text-ink-muted flex h-[30px] w-[30px] items-center justify-center rounded-full border font-mono text-[11px] font-semibold md:h-8 md:w-8">
                        {initials}
                    </span>
                </div>
            </div>

            {drawerOpen ? (
                <Drawer
                    id={drawerId}
                    onClose={() => setDrawerOpen(false)}
                    triggerRef={hamburgerRef}
                    activeId={activeId}
                    onNavigate={onNavigate}
                    myDisplayName={myDisplayName}
                    leagueCount={leagueIds ? leagueIds.length : 0}
                    signedIn={signedIn}
                    signedInEmail={signedInEmail}
                    sleeperUsername={sleeperUsername}
                    onSignIn={onSignIn}
                    onSignOut={onSignOut}
                    onDisconnectSleeper={onDisconnectSleeper}
                />
            ) : null}
        </>
    );
};

export default AppBar;
