import React, { useState } from 'react';
import SearchFilterButton from '../Components/SearchFilterButton';

const RanksPanel = ({ 
    loadingMessage, 
    handleChange, 
    checkedItems, 
    setParentStateAndFilter, 
    showMyPlayers, 
    showTaken, 
    showRookiesOnly,
    startLoad,
    children,
}) => {
    const [searchText, setSearchText] = useState("");
    const startSearch = () => {
        startLoad("Loading search panel...", searchText)
        setSearchText("");
    }

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
                            <SearchFilterButton name={"Rostered players"} handleChange={() => setParentStateAndFilter("showTaken", !showTaken)} labelName={"Rostered players"} checked={showTaken} />
                            <SearchFilterButton name={"My players"} handleChange={() => setParentStateAndFilter("showMyPlayers", !showMyPlayers)} labelName={"My players"} checked={showMyPlayers} />
                        </div>
                        <div className="position-filter">
                            <SearchFilterButton name={"Only rookies"} handleChange={() => setParentStateAndFilter("showRookiesOnly", !showRookiesOnly)} labelName={"Only rookies"} checked={showRookiesOnly} />
                        </div>
                        <textarea className="input" placeholder="Copy + Paste rankings here..." value={searchText} onChange={(e) => setSearchText(e.target.value)} />
                        <button className={`${searchText.length < 6 ? "disabled" : "search-button"} button`} disabled={searchText.length < 6 ? true : false} onClick={startSearch}>
                            Submit
                        </button>
                    </div>
                    <div className="player-grid">
                        { children }
                    </div>
                </>
            }
        </div> 
    );
}

export default RanksPanel;
