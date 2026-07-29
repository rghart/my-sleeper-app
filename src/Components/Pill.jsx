// The shared "select styled as a pill" geometry: 1px border-line, rounded-full,
// 13px/600 truncating text, with a 9px `▾` drawn ourselves in place of the
// native arrow (`appearance-none` drops that). LeaguePill and the top bar's
// rank-list pill (see RankList.jsx/AppBar.jsx) both wrap a plain `<select>`
// in exactly this shape, so it lives here once rather than twice.
const SelectPill = ({ ariaLabel, value, onChange, options }) => (
    <span className="relative inline-flex items-center">
        <select
            aria-label={ariaLabel}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="border-line text-ink max-w-[150px] appearance-none truncate rounded-full border bg-transparent py-1 pr-5 pl-2.5 text-[13px] font-semibold tracking-[-0.01em] md:max-w-none"
        >
            {options.map((option) => (
                <option key={option.value} value={option.value}>
                    {option.label}
                </option>
            ))}
        </select>
        <span aria-hidden="true" className="text-ink-dim pointer-events-none absolute right-2.5 text-[9px]">
            ▾
        </span>
    </span>
);

export default SelectPill;
