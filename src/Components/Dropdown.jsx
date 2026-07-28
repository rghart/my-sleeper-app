const Dropdown = ({ currentValue, updateCurrentValue, children: dropdownSelections }) => {
    return (
        <select
            className="border-line text-ink caret-ink-muted mt-2 h-[25px] w-[85%] appearance-none rounded-[10px] border-2 bg-transparent"
            value={currentValue}
            onChange={(e) => updateCurrentValue(e.target.value)}
        >
            {dropdownSelections}
        </select>
    );
};

export default Dropdown;
