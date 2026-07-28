// Selection reads through contrast (a filled `bg-line` chip), not a new hue -
// same rule SegmentedControl follows, since saturation is reserved for
// position data and violet for "yours". `sr-only` replaces the old
// display:none `.radioPad`: display:none drops a control from the
// accessibility tree entirely, so a screen reader user would never have
// found this checkbox even though sighted users could operate the label.
const SearchFilterButton = ({ checked, handleChange, labelName, name }) => {
    return (
        <label
            className={`border-ink-muted relative m-[3px] inline-block cursor-pointer rounded-[22px] border border-solid p-1.5 text-center text-sm ${
                checked ? 'bg-line! text-ink! font-semibold' : 'text-ink-muted'
            }`}
        >
            {labelName}
            {/* The `relative` on the label above is what contains this input.
                index.css still carries `input, select, textarea { width: 85%
                !important }` below 767px; the old control was display:none so
                had no box for that to stretch, but sr-only gives it a real
                one - 319px wide, pushing the page 186px past a 375px
                viewport. A `w-px!` utility does NOT win that fight: for
                *important* declarations the cascade reverses layer order, so
                index.css's `@layer base` beats anything in `@layer utilities`
                no matter the specificity. Making the label the containing
                block means 85% is 85% of a chip, which fits. */}
            <input className="sr-only" type="checkbox" checked={checked} onChange={handleChange} name={name} />
        </label>
    );
};

export default SearchFilterButton;
