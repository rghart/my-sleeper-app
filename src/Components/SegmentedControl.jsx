// A two-state (or more) segmented control. Used both for the Feed/Grid
// toggle in DraftPanel and the Overview/Readable zoom switch in DraftGrid -
// pulled out here rather than written twice so the two don't drift apart.
//
// Labels are uppercased with the `uppercase` CSS class, never by changing the
// label strings themselves - one call site (DraftGrid's zoom switch) passes
// mixed-case React text, and tests/accessible names key off the text as
// written, not as rendered.
const SegmentedControl = ({ label, options, value, onChange }) => (
    <div
        role="group"
        aria-label={label}
        className="bg-raised border-line-mid inline-flex gap-0.5 rounded-full border p-0.5"
    >
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
                className={`min-h-11 rounded-full px-3 py-1.5 font-mono text-[11px] font-semibold tracking-[.06em] uppercase ${
                    value === option.value ? 'bg-selected text-ink' : 'text-ink-muted'
                }`}
            >
                {option.label}
            </button>
        ))}
    </div>
);

export default SegmentedControl;
