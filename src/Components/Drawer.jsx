import { useEffect, useRef, useState } from 'react';
import { useBodyScrollLock } from '../useBodyScrollLock.js';
import { SECTIONS, PLANNED_SECTIONS } from '../sections.js';
import { avatarInitials } from './avatarInitials.js';

// The hamburger's drawer. Mounted only while open - AppBar renders this
// conditionally rather than toggling a visibility class - which is what lets
// focus management ride plain mount/unmount effects instead of tracking
// open/closed transitions by hand: the effect below focuses the panel when it
// mounts and returns focus to the hamburger in its cleanup, which runs
// exactly when the drawer closes.
//
// Nav rows are the three real SECTIONS plus PLANNED_SECTIONS (unbuilt), read
// directly from sections.js rather than taken as a prop - this menu is a
// fixed surface, unlike AppBar's own section pills, which mirror whatever
// section list AppShell was actually handed.
const Drawer = ({
    id,
    onClose,
    triggerRef,
    activeId,
    onNavigate,
    myDisplayName,
    leagueCount = 0,
    signedIn,
    signedInEmail,
    sleeperUsername,
    onSignIn,
    onSignOut,
    onDisconnectSleeper,
}) => {
    const panelRef = useRef(null);
    const [confirmingDisconnect, setConfirmingDisconnect] = useState(false);

    useBodyScrollLock();

    useEffect(() => {
        panelRef.current?.focus();
        // Captured now rather than read off the ref in the cleanup: by the
        // time that runs the hamburger it points at could in principle have
        // changed underneath it.
        const trigger = triggerRef?.current;
        return () => {
            trigger?.focus();
        };
        // Mount/unmount only - see the comment above.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        const onKeyDown = (event) => {
            if (event.key === 'Escape') {
                onClose();
            }
        };
        document.addEventListener('keydown', onKeyDown);
        return () => document.removeEventListener('keydown', onKeyDown);
    }, [onClose]);

    const selectSection = (sectionId) => {
        onNavigate?.(sectionId);
        onClose();
    };

    const initials = avatarInitials(myDisplayName);

    return (
        <div className="fixed inset-0 z-20">
            <div className="bg-scrim-heavy absolute inset-0" onClick={onClose} aria-hidden="true" />
            <div
                id={id}
                ref={panelRef}
                role="dialog"
                aria-modal="true"
                aria-label="Menu"
                tabIndex={-1}
                className="bg-chrome border-line relative flex h-full w-[296px] flex-col gap-6 border-r px-4 py-5 outline-none"
            >
                <div>
                    <p className="text-ink m-0 text-[17px] font-bold tracking-[-0.02em]">Team Assistant</p>
                    {myDisplayName ? (
                        <p className="text-ink-dim m-0 font-mono text-[11px]">
                            {myDisplayName} · {leagueCount} {leagueCount === 1 ? 'league' : 'leagues'}
                        </p>
                    ) : null}
                </div>

                {/* Not "Sections" - that is the tab bar's name, and both are in
                    the DOM at once while the drawer is open. */}
                <nav aria-label="Menu" className="flex flex-col gap-1">
                    {SECTIONS.map((section) => {
                        const isActive = section.id === activeId;
                        return (
                            <button
                                key={section.id}
                                type="button"
                                aria-current={isActive ? 'page' : undefined}
                                onClick={() => selectSection(section.id)}
                                className={`rounded-row flex items-center gap-3 p-3 text-left ${
                                    isActive ? 'bg-mine-row' : ''
                                }`}
                            >
                                <span className={`h-1.5 w-1.5 rounded-full ${isActive ? 'bg-mine' : 'bg-mark'}`} />
                                <span
                                    className={`text-[15px] ${
                                        isActive ? 'text-ink font-semibold' : 'text-ink-muted font-medium'
                                    }`}
                                >
                                    {section.label}
                                </span>
                            </button>
                        );
                    })}
                    {/* Unbuilt rows are plain elements, not disabled buttons, so
                        they are inert rather than merely unclickable - a
                        disabled button still sits in some assistive tech's
                        object model as a button that happens to do nothing. */}
                    {PLANNED_SECTIONS.map((section) => (
                        <div key={section.id} className="flex items-center gap-3 p-3">
                            <span className="bg-mark h-1.5 w-1.5 rounded-full" />
                            <span className="text-ink-dim text-[15px] font-medium">{section.label}</span>
                            <span className="text-ink-quiet ml-auto font-mono text-[9px] font-semibold tracking-[.1em]">
                                SOON
                            </span>
                        </div>
                    ))}
                </nav>

                <div className="mt-auto flex flex-col gap-3">
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
                                            onClose();
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
            </div>
        </div>
    );
};

export default Drawer;
