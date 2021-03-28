import React from 'react';

const Dropdown = ({ currentValue, updateCurrentValue, children: dropdownSelections }) => {
  return (
      <select className="dropdown" value={currentValue} onChange={(e) => updateCurrentValue(e.target.value)}>
          { dropdownSelections }
      </select>
  );
}

export default Dropdown;
