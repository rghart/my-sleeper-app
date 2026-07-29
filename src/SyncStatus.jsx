import { createContext, useContext, useEffect, useState } from 'react';

// Whether a live draft sync is running, read by the top bar's sync pill.
// The state itself is owned three components down, by DraftPanel - see
// usePublishSyncStatus below for why it stays there instead of moving up.
const SyncStatusContext = createContext({ isSyncing: false, setIsSyncing: () => {} });

export const SyncStatusProvider = ({ children }) => {
    const [isSyncing, setIsSyncing] = useState(false);
    return <SyncStatusContext.Provider value={{ isSyncing, setIsSyncing }}>{children}</SyncStatusContext.Provider>;
};

// Read-only access for the top bar.
export const useSyncStatus = () => useContext(SyncStatusContext).isSyncing;

// Publishes `isSyncing` up to the provider, for a component - DraftPanel -
// that owns the boolean itself and only needs the shell above it to see it.
// Lifting the state itself into App was the more obvious shape and the wrong
// one: DraftPanel unmounts whenever the user switches to another section,
// which is also what stops its poll, so if the boolean lived in App instead
// it would keep reading true after the poll that justified it was gone. This
// effect's cleanup is what keeps that from happening - it clears the
// published value on unmount, so switching away always reads back to false
// regardless of what DraftPanel's own state held at the time.
export const usePublishSyncStatus = (isSyncing) => {
    const { setIsSyncing } = useContext(SyncStatusContext);

    useEffect(() => {
        setIsSyncing(isSyncing);
    }, [isSyncing, setIsSyncing]);

    useEffect(() => {
        return () => setIsSyncing(false);
    }, [setIsSyncing]);
};
