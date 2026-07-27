import { useCallback, useEffect, useState } from 'react';

// Reads the active section id out of `window.location.hash` (`#/draft` ->
// `draft`), falling back to `fallbackId` whenever the hash is empty or names
// a section that isn't in `validIds`. No router dependency: this is the
// entire routing layer.
function readHash(validIds, fallbackId) {
    const raw = window.location.hash.replace(/^#\/?/, '');
    return validIds.includes(raw) ? raw : fallbackId;
}

export function useHashRoute(validIds, fallbackId) {
    const [activeId, setActiveId] = useState(() => readHash(validIds, fallbackId));

    useEffect(() => {
        const onHashChange = () => setActiveId(readHash(validIds, fallbackId));
        window.addEventListener('hashchange', onHashChange);
        return () => window.removeEventListener('hashchange', onHashChange);
    }, [validIds, fallbackId]);

    const goTo = useCallback((id) => {
        window.location.hash = '#/' + id;
    }, []);

    return [activeId, goTo];
}
