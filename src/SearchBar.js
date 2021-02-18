import React from 'react';

const SearchBar = ({ children, allLeagueIDs, leagueID, updateLeagueID, getLeagueData }) => {
  return (
    <div className="search-box">
      <div>
        {children}
      </div>
      <div>
          <select value={leagueID} onChange={updateLeagueID}>
              {allLeagueIDs.map(league => (
                <option key={league.league_id} value={league.league_id}>{league.name}</option>
              ))}
          </select>
        <button onClick={getLeagueData}>
            Submit
        </button>
      </div>
    </div>
  );
}

export default SearchBar;
