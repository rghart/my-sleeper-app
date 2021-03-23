import React from 'react';

const SearchBar = ({ allLeagueIDs, leagueID, updateLeagueID, }) => {
  return (
    <div className="search-box">
        <select className="dropdown" value={leagueID} onChange={(e) => updateLeagueID("leagueID", e.target.value, "getLeagueData", "Loading league panel...")}>
            {allLeagueIDs.map(league => (
              <option key={league.league_id} value={league.league_id}>{league.name}</option>
            ))}
        </select>
    </div>
  );
}

export default SearchBar;
