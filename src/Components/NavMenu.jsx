import { useState } from 'react';
import { SECTIONS, PLANNED_SECTIONS, SECTION_GROUPS } from '../sections.js';
import { avatarInitials } from './avatarInitials.js';
import SectionIcon from './SectionIcon';

// Everything the side menu holds: the app's name, every section under its
// group heading, and the two identities at the foot. Rendered by the phone
// drawer (Drawer.jsx) and by the permanent desktop sidebar (AppShell.jsx),
// so the two can't drift into listing different things.
//
// Sections are read directly from sections.js rather than taken as a prop:
// this menu is a fixed surface, unlike the tab bar, which mirrors whatever
// section list AppShell was actually handed. `onDone` runs after anything
// that should dismiss a drawer - the sidebar has nothing to dismiss and
// leaves it out.
const NavMenu = ({
    navLabel,
    activeId,
    onNavigate,
    onDone,
    myDisplayName,
    leagueCount = 0,
    signedIn,
    signedInEmail,
    sleeperUsername,
    onSignIn,
    onSignOut,
    onDisconnectSleeper,
}) => {
    const [confirmingDisconnect, setConfirmingDisconnect] = useState(false);

    const selectSection = (sectionId) => {
        onNavigate?.(sectionId);
        onDone?.();
    };

    const initials = avatarInitials(myDisplayName);

    return (
        <>
            <div className="px-1.5">
                <p className="text-ink m-0 text-[17px] font-bold tracking-[-0.02em]">Team Assistant</p>
                {myDisplayName ? (
                    <p className="text-ink-dim m-0 font-mono text-[11px]">
                        {myDisplayName} · {leagueCount} {leagueCount === 1 ? 'league' : 'leagues'}
                    </p>
                ) : null}
            </div>

            <nav aria-label={navLabel} className="flex flex-col gap-[18px]">
                {SECTION_GROUPS.map((group) => {
                    const live = SECTIONS.filter((section) => section.group === group.id);
                    const planned = PLANNED_SECTIONS.filter((section) => section.group === group.id);
                    const headingId = `${navLabel}-${group.id}`.replace(/\s+/g, '-').toLowerCase();
                    return (
                        <div key={group.id} role="group" aria-labelledby={headingId} className="flex flex-col gap-0.5">
                            <p
                                id={headingId}
                                className="text-ink-dim m-0 px-3 pb-1.5 font-mono text-[10px] font-semibold tracking-[.1em] uppercase"
                            >
                                {group.label}
                            </p>
                            {live.map((section) => {
                                const isActive = section.id === activeId;
                                return (
                                    <button
                                        key={section.id}
                                        type="button"
                                        aria-current={isActive ? 'page' : undefined}
                                        aria-label={section.label}
                                        onClick={() => selectSection(section.id)}
                                        className={`rounded-row flex min-h-11 items-center gap-3 px-3 py-1.5 text-left ${
                                            isActive ? 'bg-mine-row text-ink' : 'text-ink-muted'
                                        }`}
                                    >
                                        <SectionIcon id={section.id} className={isActive ? 'text-mine' : ''} />
                                        <span className="min-w-0 flex-1">
                                            <span
                                                className={`block text-[15px] ${
                                                    isActive ? 'font-semibold' : 'font-medium'
                                                }`}
                                            >
                                                {section.label}
                                            </span>
                                            {section.description ? (
                                                <span className="text-ink-dim block text-xs">
                                                    {section.description}
                                                </span>
                                            ) : null}
                                        </span>
                                    </button>
                                );
                            })}
                            {/* Unbuilt rows are plain elements, not disabled
                                buttons, so they are inert rather than merely
                                unclickable - a disabled button still sits in
                                some assistive tech's object model as a button
                                that happens to do nothing. */}
                            {planned.map((section) => (
                                <div key={section.id} className="text-ink-dim flex min-h-11 items-center gap-3 px-3">
                                    <SectionIcon id={section.id} />
                                    <span className="flex-1 text-[15px] font-medium">{section.label}</span>
                                    <span className="text-ink-quiet font-mono text-[9px] font-semibold tracking-[.1em]">
                                        SOON
                                    </span>
                                </div>
                            ))}
                        </div>
                    );
                })}
            </nav>

            <div className="mt-auto flex flex-col gap-3 px-1.5">
                <div className="bg-line-mid h-px w-full" />

                {/* The connected Sleeper account, kept visually separate
                    from the sign-in block below because they are two
                    different identities: this one decides whose leagues
                    you are looking at, that one decides where your rank
                    lists are saved. Disconnecting clears the account
                    everywhere, not just on this device, which is why it
                    asks first. */}
                {sleeperUsername ? (
                    confirmingDisconnect ? (
                        <div className="border-line rounded-row flex flex-col gap-2.5 border p-3">
                            <p className="text-ink m-0 text-[13px]">
                                Disconnect “{sleeperUsername}”? Your saved rank lists stay.
                            </p>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setConfirmingDisconnect(false);
                                        onDisconnectSleeper?.();
                                        onDone?.();
                                    }}
                                    className="bg-danger text-ground min-h-11 rounded-full px-3.5 text-[13px] font-semibold"
                                >
                                    Disconnect
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setConfirmingDisconnect(false)}
                                    className="border-line text-ink-muted min-h-11 rounded-full border px-3.5 text-[13px] font-semibold"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="min-w-0">
                            <p className="text-ink m-0 truncate text-[13px] font-medium">{sleeperUsername}</p>
                            <p className="text-ink-quiet m-0 font-mono text-[10px]">
                                Sleeper ·{' '}
                                <button
                                    type="button"
                                    onClick={() => setConfirmingDisconnect(true)}
                                    className="underline"
                                >
                                    disconnect
                                </button>
                            </p>
                        </div>
                    )
                ) : null}

                {signedIn ? (
                    <div className="flex items-center gap-3">
                        <span className="bg-raised-2 border-line text-ink-muted flex h-8 w-8 shrink-0 items-center justify-center rounded-full border font-mono text-[11px] font-semibold">
                            {initials}
                        </span>
                        <div className="min-w-0">
                            <p className="text-ink m-0 truncate text-[13px] font-medium">{signedInEmail}</p>
                            <p className="text-ink-quiet m-0 font-mono text-[10px]">
                                Signed in ·{' '}
                                <button type="button" onClick={onSignOut} className="underline">
                                    sign out
                                </button>
                            </p>
                        </div>
                    </div>
                ) : (
                    <button type="button" onClick={onSignIn} className="text-ink text-left text-[13px] font-medium">
                        Sign in
                    </button>
                )}
            </div>
        </>
    );
};

export default NavMenu;
