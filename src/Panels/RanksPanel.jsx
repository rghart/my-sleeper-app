import { useState, useEffect } from 'react';
import SearchFilterButton from '../Components/SearchFilterButton';
import OnFocusButton from '../Components/OnFocusButton';
import PlayerInfoItem from '../Components/PlayerInfoItem';
import Dropdown from '../Components/Dropdown';
import SegmentedControl from '../Components/SegmentedControl';
import { auth } from '../firebase.js';
import APP_DB_URLS from '../urls.js';
import Button from '../Components/Button';
import Spinner from '../Components/Spinner';
import { isTaken, rosteredBy } from '../lib/rosterInfo.js';
import { checkErrors, fetchRequest } from '../lib/http.js';
const { APP_USERS, TYPE_PARAMS, DLF_ADP } = APP_DB_URLS;

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
    const [rankListType, setRankListType] = useState('new');
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

    const startSearch = () => {
        updateRankingPlayersIdsList([]);
        setCurrentListVal(defaultSelector);
        setIsNewRankList(true);
        startLoad(searchText);
        setSearchText('');
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
                if (allListsVals.length < 2) {
                    setRankListType('new');
                }
            }
            console.log(updateResponse.status);
        } else {
            console.log(updateResponse);
        }
    };

    const updateRankList = (newListName) => {
        setIsNewRankList(false);
        setCurrentListVal(newListName);
        if (newListName !== defaultSelector) {
            updateRankingPlayersIdsList(allRankLists[newListName].rank_list);
        } else {
            updateRankingPlayersIdsList([]);
        }
    };

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
                if (rankListNames.length > 1) {
                    setRankListType('saved');
                }
            }
        };
        if (signedIn) {
            getSavedRankLists();
        } else if (!signedIn) {
            setIsNewRankList(false);
            setCurrentListVal(defaultSelector);
            setAllRankLists(defaultSelectorObj);
            setAllListsVals([defaultSelector]);
            setRankListType('new');
        }
    }, [signedIn]);

    return (
        // Panel chrome copied from LeaguePanel rather than reinvented: both
        // panels are `.panel` in the old sheet, and this is the surviving
        // instance of that shared geometry now that it's gone. `mt-2` is a
        // Tailwind spacing-scale match for the old 8px top margin; the other
        // three sides use arbitrary 3px values because 3px isn't on the scale.
        <div className="bg-raised mt-2 mr-[3px] mb-[3px] ml-[3px] flex h-full flex-1 flex-col rounded-[10px] pt-[5px] pr-[15px] pb-[15px] pl-[15px] max-md:p-[5px]">
            {isLoading ? (
                <Spinner size="panel" />
            ) : (
                <>
                    <div className="flex flex-col">
                        <p>
                            <b>Player filters</b>
                        </p>
                        <div className="flex flex-row" style={{ overflow: 'scroll' }}>
                            {['QB', 'RB', 'WR', 'TE', 'K', 'DEF'].map((pos, i) => (
                                <SearchFilterButton
                                    name={pos}
                                    handleChange={() => updateFilters(pos, !filters[pos])}
                                    labelName={pos}
                                    key={pos + i}
                                    checked={filters[pos]}
                                />
                            ))}
                        </div>
                        <div className="flex flex-row">
                            {[
                                { label: 'Taken', name: 'showTaken' },
                                { label: 'My players', name: 'showMyPlayers' },
                            ].map((filter) => (
                                <SearchFilterButton
                                    name={filter.label}
                                    handleChange={() => updateFilters(filter.name, !filters[filter.name])}
                                    labelName={filter.label}
                                    checked={filters[filter.name]}
                                    key={filter.name}
                                />
                            ))}
                        </div>
                        <div className="flex flex-row">
                            <SearchFilterButton
                                name={'Only rookies'}
                                handleChange={() => updateFilters('showRookiesOnly', !filters['showRookiesOnly'])}
                                labelName={'Only rookies'}
                                checked={filters['showRookiesOnly']}
                            />
                            <SearchFilterButton
                                name={'All players'}
                                handleChange={() => updateFilters('showAllPlayers', !filters['showAllPlayers'])}
                                labelName={'All players'}
                                checked={filters['showAllPlayers']}
                            />
                        </div>
                        <p>
                            <b>ADP type</b>
                        </p>
                        {/* Same shape as the view-toggle SegmentedControl already used in
                            DraftPanel, reused rather than re-styled: four flat text
                            options standing in for what used to be four `.radio-label`
                            divs wired up by hand. */}
                        <SegmentedControl
                            label="ADP type"
                            options={[
                                { value: 'startup_adp', label: 'Startup' },
                                { value: 'sf_startup_adp', label: 'SF startup' },
                                { value: 'rookie_adp', label: 'Rookie' },
                                { value: 'sf_rookie_adp', label: 'SF rookie' },
                            ]}
                            value={adpType}
                            onChange={setADPType}
                        />
                        {signedIn && allListsVals.length > 1 && (
                            <SegmentedControl
                                label="Rank list source"
                                options={[
                                    {
                                        value: 'new',
                                        label: (
                                            <>
                                                <span className="block">New</span>
                                                <span className="block text-xs font-normal">Rank list</span>
                                            </>
                                        ),
                                    },
                                    {
                                        value: 'saved',
                                        label: (
                                            <>
                                                <span className="block">Saved</span>
                                                <span className="block text-xs font-normal">Rank lists</span>
                                            </>
                                        ),
                                    },
                                ]}
                                value={rankListType}
                                onChange={setRankListType}
                            />
                        )}
                        {rankListType === 'saved' && (
                            <div>
                                <Dropdown currentValue={currentListVal} updateCurrentValue={updateRankList}>
                                    {allListsVals.map((list) => (
                                        <option key={list} value={list}>
                                            {allRankLists[list] ? allRankLists[list].pretty_name : 'dunno'}
                                        </option>
                                    ))}
                                </Dropdown>
                                {currentListVal !== defaultSelector && (
                                    <OnFocusButton event={deleteRankList} saveRankList={saveRankList} />
                                )}
                            </div>
                        )}
                        {rankListType === 'new' && (
                            <>
                                {signedIn && isNewRankList && (
                                    <div>
                                        <input
                                            type="text"
                                            placeholder="Enter new list name..."
                                            className="border-line text-ink caret-ink-muted m-0 rounded-[10px] border-2 bg-transparent"
                                            value={newRankListName}
                                            onChange={(e) => setNewRankListName(e.target.value)}
                                        />
                                        <Button
                                            text="Save"
                                            btnStyle="primary"
                                            isDisabled={newRankListName.length < 3 ? true : false}
                                            onClick={saveRankList}
                                        />
                                    </div>
                                )}
                                {!isNewRankList && (
                                    <>
                                        <textarea
                                            className="border-line text-ink caret-ink-muted mt-2 mr-[3px] h-[100px] w-[85%] rounded-[10px] border-2 bg-transparent"
                                            placeholder="Copy + Paste rankings here..."
                                            value={searchText}
                                            onChange={(e) => setSearchText(e.target.value)}
                                        />
                                        <Button
                                            text="Submit"
                                            btnStyle="primary-large"
                                            isDisabled={searchText.length < 6 ? true : false}
                                            onClick={startSearch}
                                        />
                                    </>
                                )}
                            </>
                        )}
                    </div>
                    <div className="max-h-[600px] overflow-x-visible overflow-y-scroll">
                        {rankingPlayersIdsList
                            .filter(filterPlayers)
                            .filter((results) =>
                                Object.entries(filters)
                                    .filter((filter) => filter[1] === true)
                                    .map((ar) => ar[0])
                                    .includes(
                                        !filters.showAllPlayers
                                            ? playerInfo[results.match_results[0][0]].position
                                            : 'showAllPlayers',
                                    ),
                            )
                            .filter((results) =>
                                filters.showRookiesOnly ? playerInfo[results.match_results[0][0]].years_exp < 1 : true,
                            )
                            .map((results, i) => (
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
                        {notFoundPlayers.map((item, index) => (
                            <p key={`${item}-${index}`}>{item}</p>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
};

export default RanksPanel;
