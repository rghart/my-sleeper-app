import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Popover from '../Components/Popover';
import SearchFilterButton from '../Components/SearchFilterButton';
import PlayerInfoItem from '../Components/PlayerInfoItem';
import SaveListSheet from './SaveListSheet';
import SegmentedControl from '../Components/SegmentedControl';
import Sheet from '../Components/Sheet';
import ColumnMapper from '../Components/ColumnMapper';
import PlayerSearch from '../Components/PlayerSearch';
import { detectColumns, detectDelimiter, toRows } from '../lib/rankColumns.js';
import { auth } from '../firebase.js';
import APP_DB_URLS from '../urls.js';
import Spinner from '../Components/Spinner';
import { isTaken, rosteredBy } from '../lib/rosterInfo.js';
import { fetchRequest } from '../lib/http.js';
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

// The FILTERS chip's popover body - toggles plus the ADP type control. Kept
// out of the render below purely for legibility now; it used to be factored
// out because RanksPanel rendered it twice, which is the thing Popover.jsx
// exists to have stopped.
const FiltersBody = ({ filters, updateFilters, adpType, setADPType }) => (
    <div className="flex flex-col gap-4 p-2.5">
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
            {/* Four segments do not fit the popover's width on a phone, and a
                segmented control that wraps stops reading as one control -
                the pill shape ends up around two rows. It scrolls instead. */}
            <div className="no-scrollbar -mx-0.5 overflow-x-auto px-0.5">
                <SegmentedControl label="ADP type" options={ADP_TYPE_OPTIONS} value={adpType} onChange={setADPType} />
            </div>
        </div>
    </div>
);

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
    resolveMissingPlayer,
    notFoundPlayers,
    myDisplayName,
    savedRankLists,
    updateSavedRankLists,
}) => {
    const defaultSelector = 'default';
    const [isNewRankList, setIsNewRankList] = useState(false);
    const [searchText, setSearchText] = useState('');
    const [currentListVal, setCurrentListVal] = useState(defaultSelector);
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
    const [showSaveSheet, setShowSaveSheet] = useState(false);
    const [filtersOpen, setFiltersOpen] = useState(false);
    // The confirmed column map, or null for a plain one-per-line list. Held
    // beside the text rather than derived from it on every render: the guess
    // is a starting point the user edits, so re-deriving would undo their
    // edits on the next keystroke.
    const [columnMap, setColumnMap] = useState(null);
    const [fileError, setFileError] = useState(null);
    const pasteButtonRef = useRef(null);
    const saveButtonRef = useRef(null);
    const filtersChipRef = useRef(null);
    const fileInputRef = useRef(null);

    // Text arriving from anywhere - typed, pasted, or read out of a file -
    // goes through here, so a dropped CSV and a spreadsheet paste get the same
    // treatment. A list that is not a table leaves columnMap null and falls
    // through to the flat-line parser exactly as before.
    const takeText = (text) => {
        setSearchText(text);
        setFileError(null);
        const delimiter = detectDelimiter(text);
        const rows = delimiter && toRows(text, delimiter);
        // The delimiter rides along on the map because everything downstream -
        // the preview here, and createRankings later - has to split the text
        // the same way it was split when the columns were guessed. Re-detecting
        // it against half-edited text is how the preview and the result drift
        // apart.
        setColumnMap(rows ? { ...detectColumns(rows), delimiter } : null);
    };

    const takeFile = (file) => {
        if (!file) return;
        const reader = new FileReader();
        reader.onerror = () => setFileError(`Couldn't read ${file.name}.`);
        reader.onload = () => takeText(String(reader.result ?? ''));
        reader.readAsText(file);
    };

    const startSearch = () => {
        updateRankingPlayersIdsList([]);
        setCurrentListVal(defaultSelector);
        setIsNewRankList(true);
        startLoad(searchText, columnMap);
        setSearchText('');
        setColumnMap(null);
        setFileError(null);
        // The sheet has done its job once the list is in. Leaving it up hides
        // the list the paste just produced behind the thing that produced it.
        setShowPasteSheet(false);
    };

    // savedRankLists is a prop now (lifted to App - see §6 of the redesign
    // doc), so every write to it goes through updateSavedRankLists rather
    // than a local setter. The old version mutated allRankLists in place
    // (`allRankLists[newRankList].rank_list = ...`, `allRankLists[newRankList]
    // = {}` + Object.assign) and then called setAllRankLists with that same
    // reference - which only re-rendered anything because some other state
    // change happened to force it. Lifted, that bug would have meant nothing
    // downstream (the switcher, this panel's own selector) ever saw the
    // update: React bails out of a setState whose value is `===` the
    // previous one. Both branches below build a brand new object instead.
    // The one write both save paths go through. Returns whether it landed
    // rather than logging the failure and returning nothing: SaveListSheet
    // keeps itself open and says so when this is false, which is what makes a
    // failed save visible at all.
    const putRankList = async (routeName, rankListData) => {
        const USER_PATH = `${auth.currentUser.uid}/${routeName}`;
        const updateResponse = await fetchRequest(
            APP_USERS + USER_PATH + TYPE_PARAMS + (await auth.currentUser.getIdToken(true)),
            'PUT',
            rankListData,
        );
        if (!updateResponse || !updateResponse.ok) {
            console.error('Error: could not save rank list', updateResponse);
            return false;
        }
        updateSavedRankLists((prevSavedRankLists) => ({ ...prevSavedRankLists, [routeName]: rankListData }));
        return true;
    };

    const saveNewRankList = async (prettyName) => {
        const routeName = prettyName.replace(/([^A-Za-z0-9])/g, '_').toLowerCase();
        const saved = await putRankList(routeName, {
            pretty_name: prettyName,
            route_name: routeName,
            rank_list: rankingPlayersIdsList,
        });
        if (saved) {
            // The pasted list stops being an unsaved one the moment it has a
            // name, and the panel (plus the top bar's pill) is scoped to it
            // from here on - same as picking it from the selector would.
            setIsNewRankList(false);
            setCurrentListVal(routeName);
        }
        return saved;
    };

    const updateCurrentRankList = () =>
        putRankList(currentListVal, { ...savedRankLists[currentListVal], rank_list: rankingPlayersIdsList });

    const deleteRankList = async () => {
        // Neee to escape backslashes
        const USER_PATH = `${auth.currentUser.uid}/${currentListVal}`;
        const updateResponse = await fetchRequest(
            APP_USERS + USER_PATH + TYPE_PARAMS + (await auth.currentUser.getIdToken(true)),
            'DELETE',
        );
        if (!updateResponse || !updateResponse.ok) {
            console.error('Error: could not delete rank list', updateResponse);
            return false;
        }
        setIsNewRankList(false);
        const deletedListVal = currentListVal;
        updateSavedRankLists((prevSavedRankLists) => {
            const nextSavedRankLists = { ...prevSavedRankLists };
            delete nextSavedRankLists[deletedListVal];
            return nextSavedRankLists;
        });
        updateRankList(defaultSelector);
        return true;
    };

    // useCallback here is ordinary hygiene, not a correctness requirement:
    // usePublishRankList holds the handler in a ref precisely so it does not
    // care about this identity. The body is otherwise untouched.
    const updateRankList = useCallback(
        (newListName) => {
            setIsNewRankList(false);
            setCurrentListVal(newListName);
            if (newListName !== defaultSelector) {
                updateRankingPlayersIdsList(savedRankLists[newListName].rank_list);
            } else {
                updateRankingPlayersIdsList([]);
            }
        },
        [savedRankLists, updateRankingPlayersIdsList],
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

    // The saved-lists fetch itself now lives in App (loadSavedRankLists) - it
    // resets isNewRankList/currentListVal back to the default whenever
    // signedIn goes false, which App's version of this effect can't reach
    // into this panel's local state to do, so that half stays here.
    useEffect(() => {
        if (!signedIn) {
            setIsNewRankList(false);
            setCurrentListVal(defaultSelector);
        }
    }, [signedIn]);

    // Published up to the top bar (see AppBar.jsx/RankList.jsx) so the
    // rank-list selector can live in the pill instead of a dropdown buried in
    // this panel. Memoised to avoid rebuilding the array every render;
    // usePublishRankList compares it by value, so this is an optimisation
    // rather than the thing that keeps it from looping. Order follows
    // savedRankLists' own key order - `default` first, since App always
    // spreads it as the base of that map - rather than a separately lifted
    // list of ids.
    const rankListOptions = useMemo(
        () =>
            Object.keys(savedRankLists).map((list) => ({
                value: list,
                label: savedRankLists[list] ? savedRankLists[list].pretty_name : 'dunno',
            })),
        [savedRankLists],
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
                        <div className="flex shrink-0 items-center gap-2">
                            {/* Only offered to a signed-in user with something
                                to save: saved lists are per-account, so for
                                anyone else this pill would open a sheet whose
                                every action fails. */}
                            {signedIn && rankingPlayersIdsList.length > 0 && (
                                <button
                                    type="button"
                                    ref={saveButtonRef}
                                    onClick={() => {
                                        setFiltersOpen(false);
                                        setShowPasteSheet(false);
                                        setShowSaveSheet(true);
                                    }}
                                    className="border-line text-ink-muted rounded-full border px-3.5 py-2 text-[13px] font-semibold"
                                >
                                    Save
                                </button>
                            )}
                            <button
                                type="button"
                                ref={pasteButtonRef}
                                onClick={() => {
                                    // Only one overlay at a time - opening this
                                    // over the filters sheet stacks two scrims and
                                    // two grab handles on top of each other.
                                    setFiltersOpen(false);
                                    setShowSaveSheet(false);
                                    setShowPasteSheet(true);
                                }}
                                className="bg-mine text-ground rounded-full px-3.5 py-2 text-[13px] font-semibold"
                            >
                                Paste list
                            </button>
                        </div>
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
                            {/* One anchored popover at every width, not a
                                desktop popover plus a phone Sheet. The two-tree
                                version left the hidden desktop half mounted on
                                a phone, where its outside-click listener saw
                                every tap inside the Sheet as "outside" and
                                closed the whole control on mousedown - before
                                the click that would have toggled a filter could
                                land. See Popover.jsx. */}
                            {filtersOpen && (
                                <Popover
                                    triggerRef={filtersChipRef}
                                    onClose={() => setFiltersOpen(false)}
                                    label="Filters"
                                    width={280}
                                >
                                    <FiltersBody
                                        filters={filters}
                                        updateFilters={updateFilters}
                                        adpType={adpType}
                                        setADPType={setADPType}
                                    />
                                </Popover>
                            )}
                        </div>
                    </div>

                    {showPasteSheet && (
                        <Sheet
                            title="Paste list"
                            subtitle="One player per line."
                            onClose={() => setShowPasteSheet(false)}
                            triggerRef={pasteButtonRef}
                            centerOnDesktop
                        >
                            {/* Paste and nothing else now. Naming, updating and
                                deleting moved to SaveListSheet - they used to
                                be conditional halves of this one body, and the
                                naming half was unreachable in practice because
                                startSearch closes this sheet the moment a list
                                lands in it. The textarea is no longer hidden
                                once a list exists either: replacing the list
                                you are looking at is the normal second use of
                                this sheet. */}
                            <div
                                className="flex flex-col gap-3 p-4"
                                onDragOver={(event) => event.preventDefault()}
                                onDrop={(event) => {
                                    event.preventDefault();
                                    takeFile(event.dataTransfer.files?.[0]);
                                }}
                            >
                                <textarea
                                    className="border-line bg-raised-2 text-ink caret-ink-muted rounded-row w-full border p-3"
                                    placeholder="Copy + Paste rankings here..."
                                    value={searchText}
                                    onChange={(e) => takeText(e.target.value)}
                                />

                                {/* The file picker is a second door onto the
                                    same text, not a second code path: the file
                                    is read straight into the textarea, so what
                                    gets matched is always what is on screen. */}
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => fileInputRef.current?.click()}
                                        className="border-line text-ink-muted min-h-11 rounded-full border px-3.5 text-[13px] font-semibold"
                                    >
                                        Choose a file
                                    </button>
                                    <span className="text-ink-quiet font-mono text-[10px]">or drop a .csv here</span>
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept=".csv,.tsv,.txt,text/csv,text/plain,text/tab-separated-values"
                                        className="hidden"
                                        onChange={(event) => {
                                            takeFile(event.target.files?.[0]);
                                            // Cleared so choosing the same file
                                            // twice in a row still fires change.
                                            event.target.value = '';
                                        }}
                                    />
                                </div>

                                {fileError && (
                                    <p role="alert" className="text-warn m-0 text-[13px]">
                                        {fileError}
                                    </p>
                                )}

                                {columnMap && (
                                    <ColumnMapper
                                        rows={toRows(searchText, columnMap.delimiter) ?? []}
                                        mapping={columnMap}
                                        onChange={setColumnMap}
                                    />
                                )}

                                {/* Pinned to the bottom of the sheet's scroll
                                    area. The column mapper is tall enough to
                                    push Submit past the fold on a phone - the
                                    body does scroll, so it was reachable, but
                                    the primary action disappearing the moment
                                    you paste a CSV is not a thing to leave to
                                    a scroll gesture. */}
                                <div className="bg-raised sticky bottom-0 -mx-4 -mb-4 px-4 pt-3 pb-4">
                                    <button
                                        type="button"
                                        disabled={searchText.length < 6}
                                        onClick={startSearch}
                                        className="bg-mine text-ground w-full rounded-full px-3.5 py-2 text-[13px] font-semibold disabled:opacity-50"
                                    >
                                        Submit
                                    </button>
                                </div>
                            </div>
                        </Sheet>
                    )}

                    {showSaveSheet && (
                        <SaveListSheet
                            savedListName={
                                showExistingListControls ? savedRankLists[currentListVal]?.pretty_name : null
                            }
                            playerCount={rankingPlayersIdsList.length}
                            onSaveNew={saveNewRankList}
                            onUpdate={updateCurrentRankList}
                            onDelete={deleteRankList}
                            onClose={() => setShowSaveSheet(false)}
                            triggerRef={saveButtonRef}
                        />
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
                            <div className="flex flex-col gap-2 px-1 pt-4">
                                <p className="text-ink-dim m-0 font-mono text-[11px]">
                                    {notFoundPlayers.length} pasted line{notFoundPlayers.length === 1 ? '' : 's'}{' '}
                                    matched nothing
                                </p>
                                {/* A miss used to be a sentence and nothing
                                    more, so the only way to fix one was to
                                    re-paste the whole list with the name spelt
                                    differently. Each one carries the rank it
                                    was going to occupy, so a player picked
                                    here drops into that slot. */}
                                {notFoundPlayers.map((item) => (
                                    <div
                                        key={item.ranking}
                                        className="border-line rounded-row flex flex-col gap-1.5 border border-dashed p-2.5"
                                    >
                                        <span className="flex items-baseline justify-between gap-2">
                                            <span className="text-ink-muted truncate text-[13px]">
                                                {item.search_string}
                                            </span>
                                            <span className="text-ink-quiet shrink-0 font-mono text-[10px] tracking-[.08em]">
                                                RANK {item.ranking}
                                            </span>
                                        </span>
                                        <PlayerSearch
                                            playerInfo={playerInfo}
                                            onPick={(playerId) => resolveMissingPlayer(item, playerId)}
                                            placeholder="Find this player…"
                                            label={`Find a player for “${item.search_string}”`}
                                        />
                                    </div>
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
