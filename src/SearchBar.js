import React from 'react';

const SearchBar = ({ children, searchText, updateSearchText }) => {
  return (
    <div className="search-box">
      <div>
        {children}
      </div>
      <div>
        <input type="text" value={searchText} onChange={updateSearchText} placeholder="Search Players" />
      </div>
    </div>
  );
}

export default SearchBar;
