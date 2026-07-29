import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';

// Which rank list the Ranks section is scoped to, read by AppBar so it can
// swap the league pill for a rank-list pill. The state itself is owned by
// RanksPanel - see usePublishRankList below for why it stays there instead of
// moving up, which mirrors SyncStatus.jsx's reasoning almost exactly.
//
// `null` (rather than a default object) means "no provider", which is how
// useRankList tells that case apart from "a provider with nothing published".
const RankListContext = createContext(null);

export const RankListProvider = ({ children }) => {
    const [rankList, setRankList] = useState(null);
    // The published `onChange` lives in a ref, not in state - see
    // usePublishRankList for why that distinction is load-bearing.
    const onChangeRef = useRef(() => {});
    const value = useMemo(() => ({ rankList, setRankList, onChangeRef }), [rankList]);
    return <RankListContext.Provider value={value}>{children}</RankListContext.Provider>;
};

// Read-only access for the top bar. `null` means "nothing to show here" -
// either RanksPanel has never mounted, or it just unmounted - and AppBar
// falls back to the league pill in both cases.
export const useRankList = () => {
    const context = useContext(RankListContext);
    if (!context?.rankList) {
        return null;
    }
    const { rankList, onChangeRef } = context;
    // Re-wrapped rather than handed over directly so the caller always reaches
    // the current handler, not whichever one happened to be published when
    // this value was last written.
    return { ...rankList, onChange: (value) => onChangeRef.current(value) };
};

// Publishes the saved-list selector up to the provider, for RanksPanel, which
// owns `currentListVal`/`allRankLists`/`allListsVals`/`updateRankList` itself
// and only needs the shell above it to see them. Lifting that state into App
// was the more obvious shape and the wrong one, for the same reason
// SyncStatus.jsx gives for isSyncing: RanksPanel unmounts whenever the user
// switches to another section, and the top bar has to stop showing its pill at
// exactly that moment rather than keep showing a selector for a panel that is
// no longer on screen. The cleanup below is what does that.
//
// The rest of this is about not looping. Publishing writes to the provider,
// which re-renders every consumer including the publisher - so if the effect
// depended on the *identity* of `options` or `onChange`, a caller that rebuilt
// either inline would refire it every render, forever. SyncStatus gets away
// with a plain dependency because it publishes one boolean; this publishes an
// array and a function.
//
// So neither identity is a dependency. `onChange` goes into a ref, which
// updates without a render. `options` is compared by value through a
// serialised key, so an equal-but-new array is a no-op. That makes the hook
// safe for any caller rather than only for one that remembers to memoise -
// which the first version was not, and it hung the test worker rather than
// failing an assertion.
export const usePublishRankList = ({ options, currentValue, onChange }) => {
    const context = useContext(RankListContext);
    const setRankList = context?.setRankList;
    const onChangeRef = context?.onChangeRef;

    useEffect(() => {
        if (onChangeRef) {
            onChangeRef.current = onChange;
        }
    });

    const optionsKey = JSON.stringify(options ?? null);

    useEffect(() => {
        if (!setRankList) {
            return;
        }
        setRankList({ options: JSON.parse(optionsKey), currentValue });
    }, [optionsKey, currentValue, setRankList]);

    useEffect(() => {
        if (!setRankList) {
            return undefined;
        }
        return () => setRankList(null);
    }, [setRankList]);
};
