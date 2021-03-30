import React, { useState, useEffect } from 'react';
import SearchFilterButton from '../Components/SearchFilterButton';
import OnFocusButton from '../Components/OnFocusButton';
import Dropdown from '../Components/Dropdown';
import { auth } from '../firebase.js';
import URLS from '../urls.js';
const { USERS, TYPE_PARAMS } = URLS;

const RanksPanel = ({ 
    loadingMessage,
    signedIn,
    handleChange, 
    checkedItems, 
    updateFilter, 
    showMyPlayers, 
    showTaken, 
    showRookiesOnly,
    startLoad,
    fetchRequest,
    checkErrors,
    rankingPlayersIdsList,
    children: playerItem,
}) => {
    const defaultSelector = 'default';
    const defaultSelectorObj = {
        'pretty_name': '-- Select saved ranks list',
        'route_name': defaultSelector
    }
    const [isNewRankList, setIsNewRankList] = useState(false);
    const [searchText, setSearchText] = useState('');
    const [newRankListName, setNewRankListName] = useState('');
    const [currentListVal, setCurrentListVal] = useState(defaultSelector);
    const [allRankLists, setAllRankLists] = useState({[defaultSelector]: defaultSelectorObj});
    const [allListsVals, setAllListsVals] = useState([defaultSelector]);
    const [rankListType, setRankListType] = useState('new');
    
    const startSearch = () => {
        updateFilter("filteredPlayersIdsList", []);
        updateFilter("rankingPlayersIdsList", []);
        setCurrentListVal(defaultSelector);
        setIsNewRankList(true);
        startLoad("Loading search panel...", searchText);
        setSearchText("");
    }
    const saveRankList = async () => {
        // Neee to escape backslashes 
        if (newRankListName.length > 3) {
            const newRankListNameEscaped = newRankListName.replace(/([^A-Za-z0-9])/g, "_").toLowerCase();
            const rankListData = {
                'pretty_name': newRankListName,
                'route_name': newRankListNameEscaped,
                'rank_list': rankingPlayersIdsList
            }

            const updateResponse = await fetchRequest(USERS + auth.currentUser.uid + '/' + newRankListNameEscaped + TYPE_PARAMS + await auth.currentUser.getIdToken(true), 'PUT', rankListData);
            if (updateResponse && updateResponse.ok) {
                setIsNewRankList(false);
                allListsVals.push(newRankListNameEscaped);
                setAllListsVals(allListsVals);
                setCurrentListVal(newRankListNameEscaped);
                allRankLists[newRankListNameEscaped] = {};
                Object.assign(allRankLists[newRankListNameEscaped], {
                    rank_list: rankingPlayersIdsList,
                    pretty_name: newRankListName,
                    route_name: newRankListNameEscaped,
                });
                setAllRankLists(allRankLists);
                setNewRankListName('');
                console.log(updateResponse.status);
            } else {
                console.log(updateResponse)
            }
        } else {
            console.log("List not saved: name for a new rank list should be longer than 3 characters")
        }
    }

    const deleteRankList = async () => {
        // Neee to escape backslashes 
        const updateResponse = await fetchRequest(USERS + auth.currentUser.uid + '/' + currentListVal + TYPE_PARAMS + await auth.currentUser.getIdToken(true), 'DELETE');
        if (updateResponse && updateResponse.ok) {
            setIsNewRankList(false);
            const deleteIndex = allListsVals.indexOf(currentListVal);
            allListsVals.splice(deleteIndex, 1);
            if (allListsVals.length > 0) {
                setAllListsVals(allListsVals);
                updateRankList(defaultSelectorObj.route_name);
                if (allListsVals.length < 2) {
                    setRankListType("new");
                }
            }
            console.log(updateResponse.status);
        } else {
            console.log(updateResponse)
        }
    }

    const updateRankList = (newListName) => {
        setIsNewRankList(false);
        updateFilter("filteredPlayersIdsList", []);
        setCurrentListVal(newListName);
        if (newListName !== defaultSelector) {
            updateFilter("rankingPlayersIdsList", allRankLists[newListName].rank_list, "filterPlayers");
        } else {
            updateFilter("rankingPlayersIdsList", []);
        }
    }

    useEffect(() => {
        const defaultSelectorObj = {[defaultSelector]: {'pretty_name': '-- Select saved ranks list', 'route_name': defaultSelector}}
        const getSavedRankLists = async () => {
            const getSavedRankListsResult = await fetch(USERS + auth.currentUser.uid + TYPE_PARAMS + await auth.currentUser.getIdToken(true))
              .then(checkErrors)
              .then(response => response.json())
              .then(data => {
                return data;
              })
              .catch((error) => {
                console.error('Error:', error);
              });

            if (getSavedRankListsResult) {
                let rankListNames = Object.keys(getSavedRankListsResult).map(key => getSavedRankListsResult[key].route_name);
                rankListNames.unshift(defaultSelector);
                const updatingRankList = {
                    ...defaultSelectorObj,
                    ...getSavedRankListsResult
                }
                setAllRankLists(updatingRankList);
                setAllListsVals(rankListNames);
                if (rankListNames.length > 1) {
                    setRankListType('saved');
                }
            }
        }
        if (signedIn) {
            getSavedRankLists();
        } else if (!signedIn) {
            setIsNewRankList(false);
            setCurrentListVal(defaultSelector);
            setAllRankLists(defaultSelectorObj);
            setAllListsVals([defaultSelector]);
            setRankListType('new');
        }
    }, [checkErrors, signedIn])

    return (
        <div className="panel search-panel">
            { 
                loadingMessage === "Loading search panel..." ? 
                <div className="panel-loader"></div> : 
                <>
                    <div className="search">
                        <div className="position-filter" style={{flexWrap: "wrap"}}>
                            <SearchFilterButton name={"QB"} handleChange={handleChange} labelName={"QB"} checked={checkedItems.includes("QB")} />
                            <SearchFilterButton name={"RB"} handleChange={handleChange} labelName={"RB"} checked={checkedItems.includes("RB")} />
                            <SearchFilterButton name={"WR"} handleChange={handleChange} labelName={"WR"} checked={checkedItems.includes("WR")} />
                            <SearchFilterButton name={"TE"} handleChange={handleChange} labelName={"TE"} checked={checkedItems.includes("TE")} />
                            <SearchFilterButton name={"K"} handleChange={handleChange} labelName={"K"} checked={checkedItems.includes("K")} />
                            <SearchFilterButton name={"DEF"} handleChange={handleChange} labelName={"DEF"} checked={checkedItems.includes("DEF")} />
                        </div>
                        <div className="position-filter">
                            <SearchFilterButton name={"Rostered players"} handleChange={() => updateFilter("showTaken", !showTaken, "filterPlayers")} labelName={"Rostered players"} checked={showTaken} />
                            <SearchFilterButton name={"My players"} handleChange={() => updateFilter("showMyPlayers", !showMyPlayers, "filterPlayers")} labelName={"My players"} checked={showMyPlayers} />
                        </div>
                        <div className="position-filter">
                            <SearchFilterButton name={"Only rookies"} handleChange={() => updateFilter("showRookiesOnly", !showRookiesOnly, "filterPlayers")} labelName={"Only rookies"} checked={showRookiesOnly} />
                        </div>
                        { signedIn && allListsVals.length > 1 && (
                            <div className="custom-horizontal-select">
                                <div className={`custom-horizontal-select-item ${rankListType === "new" ? "selected" : null}`} onClick={() => setRankListType("new")}>
                                    <div className="meta">
                                        <div className="name">New</div>
                                        <div className="description">Rank list</div>
                                    </div>
                                </div>
                                <div className={`custom-horizontal-select-item ${rankListType === "saved" ? "selected" : null}`}  onClick={() => setRankListType("saved")}>
                                    <div className="meta">
                                        <div className="name">Saved</div>
                                        <div className="description">Rank lists</div>
                                    </div>
                                </div>
                            </div>
                        )}
                        { rankListType === "saved" &&
                            <div>
                                <Dropdown currentValue={currentListVal} updateCurrentValue={updateRankList}>
                                    {allListsVals.map(list => (
                                        <option key={list} value={list}>{allRankLists[list] ? allRankLists[list].pretty_name : "dunno"}</option>
                                    ))}
                                </Dropdown>
                                { currentListVal !== defaultSelector &&
                                    <OnFocusButton event={deleteRankList} />
                                }
                            </div>
                        }
                        { rankListType === "new" && (
                            <>
                                { signedIn && isNewRankList &&
                                    <div>
                                        <input type="text" placeholder="Enter new list name..." className="input-small" value={newRankListName} onChange={(e) => setNewRankListName(e.target.value)} />
                                        <button 
                                            className={`${newRankListName.length < 3 ? "disabled-sign-in" : "sign-in-button"} button`} 
                                            disabled={newRankListName.length < 3 ? true : false} 
                                            onClick={saveRankList}
                                        >
                                            Save
                                        </button>
                                    </div>
                                }
                                { !isNewRankList &&
                                    <>
                                        <textarea className="input" placeholder="Copy + Paste rankings here..." value={searchText} onChange={(e) => setSearchText(e.target.value)} />
                                        <button 
                                            className={`${searchText.length < 6 ? "disabled-search-button" : "search-button" } button`} 
                                            disabled={searchText.length < 6 ? true : false} 
                                            onClick={startSearch}
                                        >
                                            Submit
                                        </button>
                                    </>
                                }
                            </>
                        )}
                    </div>
                    <div className="player-grid">
                        { playerItem }
                    </div>
                </>
            }
        </div> 
    );
}

export default RanksPanel;
