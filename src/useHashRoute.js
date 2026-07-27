import { useCallback, useEffect, useState } from 'react';

// Reads the active section id out of `window.location.hash` (`#/draft` ->
// `draft`). No router dependency: this is the entire routing layer.
function readHashId() {
    return window.location.hash.replace(/^#\/?/, '');
}

export function useHashRoute(validIds, fallbackId) {
    const [hashId, setHashId] = useState(readHashId);

    useEffect(() => {
        const onHashChange = () => setHashId(readHashId());
        window.addEventListener('hashchange', onHashChange);
        return () => window.removeEventListener('hashchange', onHashChange);
    }, []);

    // Derived, not stored. Holding the resolved id in state snapshots
    // `fallbackId` at mount, and the shell mounts while data is still
    // arriving - so a default that resolved a moment later was silently
    // ignored. Deriving means the hash wins as soon as there is one, and the
    // current default applies until then.
    const activeId = validIds.includes(hashId) ? hashId : fallbackId;

    const goTo = useCallback((id) => {
        window.location.hash = '#/' + id;
    }, []);

    return [activeId, goTo];
}
