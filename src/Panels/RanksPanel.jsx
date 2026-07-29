import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import SearchFilterButton from '../Components/SearchFilterButton';
import OnFocusButton from '../Components/OnFocusButton';
import PlayerInfoItem from '../Components/PlayerInfoItem';
import SegmentedControl from '../Components/SegmentedControl';
import Sheet from '../Components/Sheet';
import { auth } from '../firebase.js';
import APP_DB_URLS from '../urls.js';
import Spinner from '../Components/Spinner';
import { isTaken, rosteredBy } from '../lib/rosterInfo.js';
import { checkErrors, fetchRequest } from '../lib/http.js';
import { positionClass } from './pickLabels.js';
import { usePublishRankList } from '../RankList.jsx';
const { APP_USERS, TYPE_PARAMS, DLF_ADP } = APP_DB_URLS;

const POSITIONS = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'];

const ADP_TYPE_OPTIONS = [
    { value: 'startup_adp', label: 'Startup' },
    { value: 'sf_startup_adp', label: 'SF startup' },
    { value: 'rookie_adp', label: 'Rookie' },
    { value: 'sf_rookie_adp', label: 'SF rookie' },
];
const ADP_TYPE_LABELS = Object.fromEntries(ADP_TYPE_OPTIONS.map((option) => [option.value, option.label]));

// The defaults `filters` starts from, and what "FILTERS" (no count) means -
// see nonDefaultFilterCount below. showTaken/showMyPlayers/showRookiesOnly/
// showAllPlayers only: the position toggles (QB/RB/...) get their own chips
// in the row and are never counted here.
const DEFAULT_FLAG_FILTERS = {
    showTaken: false,
    showMyPlayers: true,
    showRookiesOnly: false,
    showAllPlayers: false,
};

const FLAG_TOGGLES = [
    { label: 'Taken', name: 'showTaken' },
    { label: 'My players', name: 'showMyPlayers' },
    { label: 'Only rookies', name: 'showRookiesOnly' },
    { label: 'All players', name: 'showAllPlayers' },
];

const positionChipClass = (active, position) =>
    `rounded-full px-[11px] py-[7px] font-mono text-[11px] font-semibold tracking-[.08em] ${
        active ? positionClass(position) : 'border-line text-ink-dim border'
    }`;

// The FILTERS chip's popover/sheet body - toggles plus the ADP type control.
// Rendered twice by RanksPanel (an anchored desktop popover and a phone
// Sheet - see the "filters" section below for why), so it's factored out
// once here rather than kept in sync by hand in two places.
const FiltersBody = ({ filters, updateFilters, adpType, setADPType }) => (
    <div className="flex flex-col gap-4 p-4">
        <div className="flex flex-row flex-wrap gap-1.5">
            {FLAG_TOGGLES.map((filter) => (
                <SearchFilterButton
                    key={filter.name}
                    name={filter.label}
                    handleChange={() => updateFilters(filter.name, !filters[filter.name])}
                    labelName={filter.label}
                    checked={filters[filter.name]}
                />
            ))}
        </div>
        <div className="flex flex-col gap-2">
            <p className="text-ink-dim m-0 font-mono text-[11px] tracking-[.08em]">ADP TYPE</p>
            <SegmentedControl label="ADP type" options={ADP_TYPE_OPTIONS} value={adpType} onChange={setADPType} />
        </div>
    </div>
);

// The desktop half of the FILTERS control: anchored under the chip rather
// than centred like Sheet, so it gets its own small close-on-Escape/
// outside-click/focus-return handling instead of reusing Sheet's (which is
// built around the bottom-sheet/centred-modal shape, not an anchored one).
const FiltersDesktopPopover = ({ triggerRef, onClose, children }) => {
    const popoverRef = useRef(null);

    useEffect(() => {
        popoverRef.current?.focus();
        const trigger = triggerRef.current;
        return () => {
            trigger?.focus();
        };
        // Mount/unmount only, same as Sheet's own focus effect.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        const onKeyDown = (event) => {
            if (event.key === 'Escape') {
                onClose();
            }
        };
        const onPointerDown = (event) => {
            const popover = popoverRef.current;
            const trigger = triggerRef.current;
            if (popover && !popover.contains(event.target) && trigger && !trigger.contains(event.target)) {
                onClose();
            }
        };
        document.addEventListener('keydown', onKeyDown);
        document.addEventListener('mousedown', onPointerDown);
        return () => {
            document.removeEventListener('keydown', onKeyDown);
            document.removeEventListener('mousedown', onPointerDown);
        };
    }, [onClose, triggerRef]);

    return (
        <div
            ref={popoverRef}
            role="dialog"
            aria-modal="true"
            aria-label="Filters"
            tabIndex={-1}
            className="border-line bg-raised rounded-card absolute top-full right-0 z-50 mt-2 hidden w-[260px] border outline-none md:block"
        >
            {children}
        </div>
    );
};

const RanksPanel = ({
    isLoading,
    signedIn,
    playerInfo,
    rosterInfo,
    lineupSet,
    updateRankingPlayersIdsList,
    startLoad,
    rankingPlayersIdsList,
    addToRoster,
    updatePlayerId,
    notFoundPlayers,
    myDisplayName,
}) => {
    const defaultSelector = 'default';
    const defaultSelectorObj = {
        pretty_name: '-- Select saved ranks list',
        route_name: defaultSelector,
    };
    const [isNewRankList, setIsNewRankList] = useState(false);
    const [searchText, setSearchText] = useState('');
    const [newRankListName, setNewRankListName] = useState('');
    const [currentListVal, setCurrentListVal] = useState(defaultSelector);
    const [allRankLists, setAllRankLists] = useState({ [defaultSelector]: defaultSelectorObj });
    const [allListsVals, setAllListsVals] = useState([defaultSelector]);
    const [adp, setADP] = useState({});
    const [adpType, setADPType] = useState();
    const [filters, setFilters] = useState({
        showTaken: false,
        showMyPlayers: true,
        showRookiesOnly: false,
        showAllPlayers: false,
        QB: true,
        RB: true,
        WR: true,
        TE: true,
        K: false,
        DEF: false,
    });
    const [showPasteSheet, setShowPasteSheet] = useState(false);
    const [filtersOpen, setFiltersOpen] = useState(false);
    const pasteButtonRef = useRef(null);
    const filtersChipRef = useRef(null);

    const startSearch = () => {
        updateRankingPlayersIdsList([]);
        setCurrentListVal(defaultSelector);
        setIsNewRankList(true);
        startLoad(searchText);
        setSearchText('');
        // The sheet has done its job once the list is in. Leaving it up hides
        // the list the paste just produced behind the thing that produced it.
        setShowPasteSheet(false);
    };

    const saveRankList = async () => {
        let newRankList;
        let rankListData;
        if (isNewRankList && newRankListName.length > 3) {
            newRankList = newRankListName.replace(/([^A-Za-z0-9])/g, '_').toLowerCase();
            rankListData = {
                pretty_name: newRankListName,
                route_name: newRankList,
                rank_list: rankingPlayersIdsList,
            };
        } else if (!isNewRankList) {
            newRankList = currentListVal;
            allRankLists[newRankList].rank_list = rankingPlayersIdsList;
            rankListData = allRankLists[newRankList];
        } else {
            console.log('List not saved: name for a new rank list should be longer than 3 characters');
            return;
        }
        const USER_PATH = `${auth.currentUser.uid}/${newRankList}`;
        const updateResponse = await fetchRequest(
            APP_USERS + USER_PATH + TYPE_PARAMS + (await auth.currentUser.getIdToken(true)),
            'PUT',
            rankListData,
        );
        if (updateResponse && updateResponse.ok) {
            if (isNewRankList) {
                setIsNewRankList(false);
                allListsVals.push(newRankList);
                setAllListsVals(allListsVals);
                setCurrentListVal(newRankList);
                allRankLists[newRankList] = {};
                Object.assign(allRankLists[newRankList], {
                    rank_list: rankingPlayersIdsList,
                    pretty_name: newRankListName,
                    route_name: newRankList,
                });
            }
            setAllRankLists(allRankLists);
            setNewRankListName('');
            console.log(updateResponse.status);
        } else {
            console.log(updateResponse);
        }
    };

    const deleteRankList = async () => {
        // Neee to escape backslashes
        const USER_PATH = `${auth.currentUser.uid}/${currentListVal}`;
        const updateResponse = await fetchRequest(
            APP_USERS + USER_PATH + TYPE_PARAMS + (await auth.currentUser.getIdToken(true)),
            'DELETE',
        );
        if (updateResponse && updateResponse.ok) {
            setIsNewRankList(false);
            const deleteIndex = allListsVals.indexOf(currentListVal);
            allListsVals.splice(deleteIndex, 1);
            if (allListsVals.length > 0) {
                setAllListsVals(allListsVals);
                updateRankList(defaultSelectorObj.route_name);
            }
            console.log(updateResponse.status);
        } else {
            console.log(updateResponse);
        }
    };

    // useCallback here is ordinary hygiene, not a correctness requirement:
    // usePublishRankList holds the handler in a ref precisely so it does not
    // care about this identity. The body is otherwise untouched.
    const updateRankList = useCallback(
        (newListName) => {
            setIsNewRankList(false);
            setCurrentListVal(newListName);
            if (newListName !== defaultSelector) {
                updateRankingPlayersIdsList(allRankLists[newListName].rank_list);
            } else {
                updateRankingPlayersIdsList([]);
            }
        },
        [allRankLists, updateRankingPlayersIdsList],
    );

    const updateFilters = (filterName, filter) => {
        setFilters({ ...filters, [filterName]: filter });
    };

    const filterPlayers = (rankingPlayers) => {
        const { showTaken, showMyPlayers, showAllPlayers } = filters;

        if (showAllPlayers) {
            return true;
        }
        if (rankingPlayers.match_results === undefined) {
            console.log(rankingPlayers);
            return true;
        }
        if (!playerInfo[rankingPlayers.match_results[0][0]]) {
            console.log(
                `Couldn't find player with ID ${rankingPlayers.match_results[0][0]} at rank ${rankingPlayers.match_results[0].ranking} - could be a retired player that was removed from database. Search string: ${rankingPlayers.match_results[0].search_string}`,
            );
            return false;
        }

        const playerId = rankingPlayers.match_results[0][0];

        if (
            !showTaken &&
            showMyPlayers &&
            (!isTaken(rosterInfo, playerId) || rosteredBy(rosterInfo, playerId) === myDisplayName)
        ) {
            return true;
        } else if (showTaken && !showMyPlayers && rosteredBy(rosterInfo, playerId) !== myDisplayName) {
            return true;
        } else if (!showMyPlayers && !showTaken && !isTaken(rosterInfo, playerId)) {
            return true;
        } else if (showTaken && showMyPlayers) {
            return true;
        }

        return false;
    };

    useEffect(() => {
        const getADP = async () => {
            const updateResponse = await fetchRequest(DLF_ADP + (await auth.currentUser.getIdToken(true)), 'GET');
            // The guard has to come before the body is read: fetchRequest
            // resolves to undefined whenever its own catch swallows an error,
            // and checkErrors throws on any non-ok response, so every failure
            // arrives here as undefined. Reading .json() first threw a
            // TypeError out of this effect instead.
            if (!updateResponse || !updateResponse.ok) {
                console.error('Error: could not load ADP data, continuing without it');
                return;
            }
            setADP(await updateResponse.json());
            console.log(updateResponse.status);
        };
        getADP();
    }, []);

    useEffect(() => {
        const defaultSelectorObj = {
            [defaultSelector]: { pretty_name: '-- Select saved ranks list', route_name: defaultSelector },
        };
        const getSavedRankLists = async () => {
            const getSavedRankListsResult = await fetch(
                APP_USERS + auth.currentUser.uid + TYPE_PARAMS + (await auth.currentUser.getIdToken(true)),
            )
                .then(checkErrors)
                .then((response) => response.json())
                .then((data) => {
                    return data;
                })
                .catch((error) => {
                    console.error('Error:', error);
                });

            if (getSavedRankListsResult) {
                const rankListNames = Object.keys(getSavedRankListsResult).map(
                    (key) => getSavedRankListsResult[key].route_name,
                );
                rankListNames.unshift(defaultSelector);
                const updatingRankList = {
                    ...defaultSelectorObj,
                    ...getSavedRankListsResult,
                };
                setAllRankLists(updatingRankList);
                setAllListsVals(rankListNames);
            }
        };
        if (signedIn) {
            getSavedRankLists();
        } else if (!signedIn) {
            setIsNewRankList(false);
            setCurrentListVal(defaultSelector);
            setAllRankLists(defaultSelectorObj);
            setAllListsVals([defaultSelector]);
        }
    }, [signedIn]);

    // Published up to the top bar (see AppBar.jsx/RankList.jsx) so the
    // rank-list selector can live in the pill instead of a dropdown buried in
    // this panel. Memoised to avoid rebuilding the array every render;
    // usePublishRankList compares it by value, so this is an optimisation
    // rather than the thing that keeps it from looping.
    const rankListOptions = useMemo(
        () =>
            allListsVals.map((list) => ({
                value: list,
                label: allRankLists[list] ? allRankLists[list].pretty_name : 'dunno',
            })),
        [allListsVals, allRankLists],
    );
    usePublishRankList({ options: rankListOptions, currentValue: currentListVal, onChange: updateRankList });

    const filteredResults = rankingPlayersIdsList
        .filter(filterPlayers)
        .filter((results) =>
            Object.entries(filters)
                .filter((filter) => filter[1] === true)
                .map((ar) => ar[0])
                .includes(
                    !filters.showAllPlayers ? playerInfo[results.match_results[0][0]].position : 'showAllPlayers',
                ),
        )
        .filter((results) => (filters.showRookiesOnly ? playerInfo[results.match_results[0][0]].years_exp < 1 : true));

    const adpTypeLabel = adpType ? ADP_TYPE_LABELS[adpType] : null;

    const nonDefaultFilterCount =
        Object.entries(DEFAULT_FLAG_FILTERS).filter(([name, def]) => filters[name] !== def).length + (adpType ? 1 : 0);

    const showExistingListControls = !isNewRankList && currentListVal !== defaultSelector;

    return (
        <div className="flex h-full flex-1 flex-col gap-3.5 px-3.5 pt-5 pb-2.5">
            {isLoading ? (
                <Spinner size="panel" />
            ) : (
                <>
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                            <h2 className="text-ink m-0 text-[20px] font-bold tracking-[-0.02em]">Ranks</h2>
                            <p className="text-ink-quiet m-0 truncate font-mono text-[11px]">
                                {filteredResults.length} {filteredResults.length === 1 ? 'player' : 'players'}
                                {adpTypeLabel ? ` · ${adpTypeLabel} ADP` : ''}
                            </p>
                        </div>
                        <button
                            type="button"
                            ref={pasteButtonRef}
                            onClick={() => {
                                // Only one overlay at a time - opening this
                                // over the filters sheet stacks two scrims and
                                // two grab handles on top of each other.
                                setFiltersOpen(false);
                                setShowPasteSheet(true);
                            }}
                            className="bg-mine text-ground shrink-0 rounded-full px-3.5 py-2 text-[13px] font-semibold"
                        >
                            Paste list
                        </button>
                    </div>

                    <div className="no-scrollbar flex flex-row gap-2 overflow-x-auto">
                        {POSITIONS.map((position) => (
                            <button
                                key={position}
                                type="button"
                                aria-pressed={filters[position]}
                                onClick={() => updateFilters(position, !filters[position])}
                                className={positionChipClass(filters[position], position)}
                            >
                                {position}
                            </button>
                        ))}
                        <div className="relative inline-block shrink-0">
                            <button
                                type="button"
                                ref={filtersChipRef}
                                aria-expanded={filtersOpen}
                                onClick={() => {
                                    setShowPasteSheet(false);
                                    setFiltersOpen((open) => !open);
                                }}
                                className="border-line text-ink-dim rounded-full border px-[11px] py-[7px] font-mono text-[11px] font-semibold tracking-[.08em]"
                            >
                                FILTERS{nonDefaultFilterCount > 0 ? ` · ${nonDefaultFilterCount}` : ''}
                            </button>
                            {/* Rendered as two trees (anchored popover for md
                                and up, Sheet for below it) rather than one
                                repositioned element - the same "both exist,
                                only one is visible" shape AppShell already
                                uses for its section nav vs tab bar. */}
                            {filtersOpen && (
                                <FiltersDesktopPopover
                                    triggerRef={filtersChipRef}
                                    onClose={() => setFiltersOpen(false)}
                                >
                                    <FiltersBody
                                        filters={filters}
                                        updateFilters={updateFilters}
                                        adpType={adpType}
                                        setADPType={setADPType}
                                    />
                                </FiltersDesktopPopover>
                            )}
                        </div>
                    </div>

                    {filtersOpen && (
                        // No `centerOnDesktop`, so Sheet already carries its
                        // own `md:hidden` - this is the phone half of the
                        // control; FiltersDesktopPopover above is the other.
                        <Sheet title="Filters" onClose={() => setFiltersOpen(false)} triggerRef={filtersChipRef}>
                            <FiltersBody
                                filters={filters}
                                updateFilters={updateFilters}
                                adpType={adpType}
                                setADPType={setADPType}
                            />
                        </Sheet>
                    )}

                    {showPasteSheet && (
                        <Sheet
                            title="Paste list"
                            subtitle="One player per line."
                            onClose={() => setShowPasteSheet(false)}
                            triggerRef={pasteButtonRef}
                            centerOnDesktop
                        >
                            <div className="flex flex-col gap-3 p-4">
                                {showExistingListControls && (
                                    <div className="border-line rounded-row flex items-center justify-between gap-2 border p-3">
                                        <p className="text-ink m-0 truncate text-[14px] font-semibold">
                                            {allRankLists[currentListVal]?.pretty_name}
                                        </p>
                                        <OnFocusButton event={deleteRankList} saveRankList={saveRankList} />
                                    </div>
                                )}
                                {!isNewRankList && (
                                    <>
                                        <textarea
                                            className="border-line bg-raised-2 text-ink caret-ink-muted rounded-row w-full border p-3"
                                            placeholder="Copy + Paste rankings here..."
                                            value={searchText}
                                            onChange={(e) => setSearchText(e.target.value)}
                                        />
                                        <button
                                            type="button"
                                            disabled={searchText.length < 6}
                                            onClick={startSearch}
                                            className="bg-mine text-ground rounded-full px-3.5 py-2 text-[13px] font-semibold disabled:opacity-50"
                                        >
                                            Submit
                                        </button>
                                    </>
                                )}
                                {signedIn && isNewRankList && (
                                    <div className="flex flex-col gap-2">
                                        <input
                                            type="text"
                                            placeholder="Enter new list name..."
                                            className="border-line bg-raised-2 text-ink caret-ink-muted rounded-row border p-3"
                                            value={newRankListName}
                                            onChange={(e) => setNewRankListName(e.target.value)}
                                        />
                                        <button
                                            type="button"
                                            disabled={newRankListName.length < 3}
                                            onClick={saveRankList}
                                            className="bg-mine text-ground rounded-full px-3.5 py-2 text-[13px] font-semibold disabled:opacity-50"
                                        >
                                            Save
                                        </button>
                                    </div>
                                )}
                            </div>
                        </Sheet>
                    )}

                    <div className="flex flex-col gap-0.5 px-2">
                        {filteredResults.map((results, i) => (
                            <PlayerInfoItem
                                key={`${results.match_results[0]}${i}`}
                                player={playerInfo[results.match_results[0][0]]}
                                playerInfo={playerInfo}
                                rosterInfo={rosterInfo}
                                lineupSet={lineupSet}
                                isNewRankList={isNewRankList}
                                addToRoster={addToRoster}
                                updatePlayerId={updatePlayerId}
                                searchData={results}
                                adpData={adp?.[results.match_results[0][0]]?.[adpType] ?? null}
                                myDisplayName={myDisplayName}
                            />
                        ))}
                        {notFoundPlayers.length > 0 && (
                            <div className="flex flex-col gap-1 px-1 pt-3">
                                <p className="text-ink-dim m-0 font-mono text-[11px]">
                                    {notFoundPlayers.length} pasted line{notFoundPlayers.length === 1 ? '' : 's'}{' '}
                                    matched nothing
                                </p>
                                {notFoundPlayers.map((item, index) => (
                                    <p
                                        key={`${item}-${index}`}
                                        className="text-ink-dim m-0 truncate font-mono text-[11px]"
                                    >
                                        {item}
                                    </p>
                                ))}
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
};

export default RanksPanel;
