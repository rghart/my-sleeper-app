import React from 'react';

const SearchBar = ({ allLeagueIDs, leagueID, updateLeagueID, }) => {
  return (
    <div className="search-box">
        <select className="dropdown" value={leagueID} onChange={updateLeagueID}>
            {allLeagueIDs.map(league => (
              <option key={league.league_id} value={league.league_id}>{league.name}</option>
            ))}
        </select>
    </div>
  );
}

export default SearchBar;
