import React from 'react';

const Dropdown = ({ leagueID, updateLeagueID, children: leagueSelections }) => {
  return (
    <div className="search-box">
        <select className="dropdown" value={leagueID} onChange={(e) => updateLeagueID(e.target.value)}>
            { leagueSelections }
        </select>
    </div>
  );
}

export default Dropdown;
