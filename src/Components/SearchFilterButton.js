import React from 'react';

const SearchFilterButton = ({ checked, handleChange, labelName, name }) => {
  return (
    <label className={`radio-label`}>
      <input
        className="radioPad"
        type="checkbox"
        checked={checked}
        onChange={handleChange}
        name={name}
      />
      {labelName}
    </label>
  );
}

export default SearchFilterButton;
