import React from 'react';

const SearchBar = ({ children, leagueID, updateLeagueID, getLeagueData }) => {
  return (
    <div className="search-box">
      <div>
        {children}
      </div>
      <div>
        <input type="text" value={leagueID} onChange={updateLeagueID} placeholder="Update league ID" />
        <button onClick={getLeagueData}>
            Submit
        </button>
      </div>
    </div>
  );
}

export default SearchBar;
