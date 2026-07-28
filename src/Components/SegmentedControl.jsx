// A two-state (or more) segmented control. Used both for the Feed/Grid
// toggle in DraftPanel and the Overview/Readable zoom switch in DraftGrid -
// pulled out here rather than written twice so the two don't drift apart.
const SegmentedControl = ({ label, options, value, onChange }) => (
    <div role="group" aria-label={label} className="border-line m-0 inline-flex gap-0.5 rounded-[6px] border p-0.5">
        {options.map((option) => (
            <button
                key={option.value}
                type="button"
                aria-pressed={value === option.value}
                onClick={() => onChange(option.value)}
                // Selection reads through contrast and elevation, not hue. Violet
                // is reserved for "yours" - your picks, your slots, your turn - so
                // a filled violet segment would say this view belongs to you.
                // Same rule that took the old teal fill off the filter chips.
                className={`min-h-11 rounded-[4px] px-3 py-1 text-sm ${
                    value === option.value
                        ? 'border-ink-muted! bg-line! text-ink! border font-semibold'
                        : 'text-ink-muted'
                }`}
            >
                {option.label}
            </button>
        ))}
    </div>
);

export default SegmentedControl;
