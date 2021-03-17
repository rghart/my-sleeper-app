import React from 'react';

const SearchFilterButton = ({ checked, handleChange, labelName, name }) => {
    return (
        <label className={`radio-label ${checked ? "checked" : null}`}>
            {labelName}
            <input
              className="radioPad"
              type="checkbox"
              checked={checked}
              onChange={handleChange}
              name={name}
            />
        </label>
    );
  }

export default SearchFilterButton;
