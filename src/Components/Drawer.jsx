import { useEffect, useRef } from 'react';
import { useBodyScrollLock } from '../useBodyScrollLock.js';
import NavMenu from './NavMenu';

// The hamburger's drawer. Mounted only while open - AppBar renders this
// conditionally rather than toggling a visibility class - which is what lets
// focus management ride plain mount/unmount effects instead of tracking
// open/closed transitions by hand: the effect below focuses the panel when it
// mounts and returns focus to the hamburger in its cleanup, which runs
// exactly when the drawer closes.
//
// What the drawer lists lives in NavMenu, which the desktop sidebar renders
// too; this file is only the modal around it.
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
    leagues,
    activeLeagueId,
    onSelectLeague,
    leagueTiers,
}) => {
    const panelRef = useRef(null);

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
                className="bg-chrome border-line relative flex h-full w-[316px] max-w-[85vw] flex-col gap-5 overflow-y-auto overscroll-contain border-r px-3.5 py-5 outline-none"
            >
                <NavMenu
                    navLabel="Menu"
                    activeId={activeId}
                    onNavigate={onNavigate}
                    onDone={onClose}
                    myDisplayName={myDisplayName}
                    leagueCount={leagueCount}
                    signedIn={signedIn}
                    signedInEmail={signedInEmail}
                    sleeperUsername={sleeperUsername}
                    onSignIn={onSignIn}
                    onSignOut={onSignOut}
                    onDisconnectSleeper={onDisconnectSleeper}
                    leagues={leagues}
                    activeLeagueId={activeLeagueId}
                    onSelectLeague={onSelectLeague}
                    leagueTiers={leagueTiers}
                />
            </div>
        </div>
    );
};

export default Drawer;
