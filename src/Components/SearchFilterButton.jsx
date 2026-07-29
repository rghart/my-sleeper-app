// Selection reads through contrast (a filled `bg-line` chip), not a new hue -
// same rule SegmentedControl follows, since saturation is reserved for
// position data and violet for "yours". `sr-only` replaces the old
// display:none `.radioPad`: display:none drops a control from the
// accessibility tree entirely, so a screen reader user would never have
// found this checkbox even though sighted users could operate the label.
const SearchFilterButton = ({ checked, handleChange, labelName, name }) => {
    return (
        <label
            className={`border-ink-muted relative m-[3px] inline-block cursor-pointer rounded-[22px] border p-1.5 text-center text-sm ${
                checked ? 'bg-line! text-ink! font-semibold' : 'text-ink-muted'
            }`}
        >
            {labelName}
            {/* index.css used to carry `input, select, textarea { width: 85%
                !important }` below 767px, which would have given this
                sr-only checkbox a real box to stretch against - the old
                control was display:none, so it never had one to stretch.
                That rule was deleted in step 1 of the redesign, so this is no
                longer a live concern; sr-only is enough on its own now. */}
            <input className="sr-only" type="checkbox" checked={checked} onChange={handleChange} name={name} />
        </label>
    );
};

export default SearchFilterButton;
