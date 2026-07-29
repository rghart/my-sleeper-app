// The shared list row: transparent on ground, no border, no card - the
// blockiness the redesign removes. Three call sites (PickRow, SlotRow,
// PlayerInfoItem's display state) all render this same shape with different
// content, so the geometry lives here once.
//
// `as="div"` rows carry role="group" so the aria-label is actually exposed -
// on a bare div (role `generic`) most screen readers drop it, which would
// leave the name working in tests and nowhere else.
const NAME_TONE = {
    default: 'text-ink',
    muted: 'text-ink-muted',
    dim: 'text-ink-dim',
};

const FLAG_TONE = {
    mine: 'text-mine',
    live: 'text-live',
};

const ROW_TONE = {
    mine: 'bg-mine-row',
    empty: 'bg-empty',
};

const DOT_TONE = {
    warn: 'bg-warn',
};

const ListRow = ({
    as = 'button',
    label,
    onClick,
    disabled = false,
    ordinal,
    ordinalWidth,
    // The base treatment matches PickRow's pick number (mono 12px,
    // text-ink-dim). SlotRow's slot label and PlayerInfoItem's rank numeral
    // each use a distinct size/weight/tracking/colour and a right-aligned
    // column, so they pass their own override here rather than ListRow
    // hardcoding one typography for every caller.
    ordinalClassName = 'text-[12px] text-ink-dim',
    name,
    nameTone = 'default',
    flag,
    leadingDot,
    meta,
    tone,
    trailing,
}) => {
    // The design's row heights are 46px single-line and 56px two-line, and
    // both fall out of this once the line-heights are pinned: preflight puts
    // `line-height: 1.5` on the root, which made a 15px name 22.5px and an
    // 11px meta 16.5px and the two-line row 61px. `leading-5` + `leading-[14px]`
    // give 11 + 20 + 14 + 11 = 56. A single-line row is then 42, which is both
    // under the design's 46 and under the 44px touch minimum, so the floor
    // brings it back up - it is doing real work, not tidiness.
    const geometry = `flex min-h-[46px] w-full items-center gap-3 rounded-row px-2.5 py-[11px] text-left ${tone ? ROW_TONE[tone] : ''}`;

    const content = (
        <>
            {ordinal !== undefined && (
                <span
                    className={`shrink-0 font-mono tabular-nums ${ordinalClassName}`}
                    style={ordinalWidth ? { width: ordinalWidth } : undefined}
                >
                    {ordinal}
                </span>
            )}
            <span className="flex min-w-0 flex-1 flex-col">
                <span className="flex min-w-0 items-center gap-2">
                    {leadingDot && <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${DOT_TONE[leadingDot]}`} />}
                    <span
                        className={`min-w-0 truncate font-sans text-[15px] leading-5 font-semibold tracking-[-0.01em] ${NAME_TONE[nameTone]}`}
                    >
                        {name}
                    </span>
                    {flag && (
                        <span
                            className={`shrink-0 font-mono text-[9px] font-semibold tracking-[.1em] ${FLAG_TONE[flag.tone]}`}
                        >
                            {flag.text}
                        </span>
                    )}
                </span>
                {meta && <span className="text-ink-dim truncate font-mono text-[11px] leading-[14px]">{meta}</span>}
            </span>
            {trailing && <span className="flex shrink-0 items-center gap-2">{trailing}</span>}
        </>
    );

    if (as === 'div') {
        return (
            <div role="group" aria-label={label} className={geometry}>
                {content}
            </div>
        );
    }

    return (
        <button type="button" aria-label={label} onClick={onClick} disabled={disabled} className={geometry}>
            {content}
        </button>
    );
};

export default ListRow;
