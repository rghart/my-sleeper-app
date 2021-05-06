import React, { useState, useEffect } from 'react';
import SearchFilterButton from '../Components/SearchFilterButton';
import OnFocusButton from '../Components/OnFocusButton';
import PlayerInfoItem from '../Components/PlayerInfoItem';
import Dropdown from '../Components/Dropdown';
import { auth } from '../firebase.js';
import APP_DB_URLS from '../urls.js';
import Button from '../Components/Button';
const { APP_USERS, TYPE_PARAMS } = APP_DB_URLS;

const RanksPanel = ({
    loadingMessage,
    signedIn,
    playerInfo,
    updateFilter,
    startLoad,
    fetchRequest,
    checkErrors,
    rankingPlayersIdsList,
    addToRoster,
    updatePlayerId,
    notFoundPlayers,
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
        updateFilter('rankingPlayersIdsList', []);
        setCurrentListVal(defaultSelector);
        setIsNewRankList(true);
        startLoad('Loading search panel...', searchText);
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
            updateFilter('rankingPlayersIdsList', allRankLists[newListName].rank_list);
        } else {
            updateFilter('rankingPlayersIdsList', []);
        }
    };

    const updateFilters = (filterName, filter) => {
        let newFilters = filters;
        newFilters[filterName] = filter;
        setFilters({ ...newFilters });
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

        if (
            !showTaken &&
            showMyPlayers &&
            (!playerInfo[rankingPlayers.match_results[0][0]].is_taken ||
                playerInfo[rankingPlayers.match_results[0][0]].rostered_by === 'ryangh')
        ) {
            return true;
        } else if (
            showTaken &&
            !showMyPlayers &&
            playerInfo[rankingPlayers.match_results[0][0]].rostered_by !== 'ryangh'
        ) {
            return true;
        } else if (!showMyPlayers && !showTaken && !playerInfo[rankingPlayers.match_results[0][0]].is_taken) {
            return true;
        } else if (showTaken && showMyPlayers) {
            return true;
        }

        return false;
    };

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
                let rankListNames = Object.keys(getSavedRankListsResult).map(
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
    }, [checkErrors, signedIn]);

    return (
        <div className="panel search-panel">
            {loadingMessage === 'Loading search panel...' ? (
                <div className="panel-loader"></div>
            ) : (
                <>
                    <div className="search">
                        <div className="position-filter" style={{ flexWrap: 'wrap' }}>
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
                        <div className="position-filter">
                            {[
                                { label: 'Taken', name: 'showTaken' },
                                { label: 'My players', name: 'showMyPlayers' },
                            ].map((filter, i) => (
                                <SearchFilterButton
                                    name={filter.label}
                                    handleChange={() => updateFilters(filter.name, !filters[filter.name])}
                                    labelName={filter.label}
                                    checked={filters[filter.name]}
                                    key={filter.name}
                                />
                            ))}
                        </div>
                        <div className="position-filter">
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
                        {signedIn && allListsVals.length > 1 && (
                            <div className="custom-horizontal-select">
                                <div
                                    className={`custom-horizontal-select-item ${
                                        rankListType === 'new' ? 'selected' : null
                                    }`}
                                    onClick={() => setRankListType('new')}
                                >
                                    <div className="meta">
                                        <div className="name">New</div>
                                        <div className="description">Rank list</div>
                                    </div>
                                </div>
                                <div
                                    className={`custom-horizontal-select-item ${
                                        rankListType === 'saved' ? 'selected' : null
                                    }`}
                                    onClick={() => setRankListType('saved')}
                                >
                                    <div className="meta">
                                        <div className="name">Saved</div>
                                        <div className="description">Rank lists</div>
                                    </div>
                                </div>
                            </div>
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
                                            className="input-small"
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
                                            className="input"
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
                    <div className="player-grid">
                        {rankingPlayersIdsList
                            .filter(filterPlayers)
                            .filter((results) =>
                                Object.entries(filters)
                                    .filter((filter) => filter[1] === true)
                                    .map((ar) => ar[0])
                                    .includes(playerInfo[results.match_results[0][0]].position),
                            )
                            .filter((results) =>
                                filters.showRookiesOnly ? playerInfo[results.match_results[0][0]].years_exp < 1 : true,
                            )
                            .map((results, i) => (
                                <PlayerInfoItem
                                    key={`${results.match_results[0]}${i}`}
                                    player={playerInfo[results.match_results[0][0]]}
                                    playerInfo={playerInfo}
                                    isNewRankList={isNewRankList}
                                    addToRoster={addToRoster}
                                    updatePlayerId={updatePlayerId}
                                    searchData={results}
                                />
                            ))}
                        {notFoundPlayers.map((item, index) => (
                            <p key={item + new Date().getTime() + index}>{item}</p>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
};

export default RanksPanel;
