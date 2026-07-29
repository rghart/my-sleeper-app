// The collapsed strip that opens the best-available sheet. A real button
// (not a div wearing an onClick) so it carries a natural aria-expanded and
// keyboard activation for free - the thing BestAvailableSheet's old toggle
// already got right and this keeps.
const BestAvailableHandle = ({ isExpanded, onClick, subtitle, buttonRef }) => (
    <button
        ref={buttonRef}
        type="button"
        aria-expanded={isExpanded}
        onClick={onClick}
        className="border-line bg-raised flex min-h-11 w-full items-center justify-between border-t px-4 py-3 md:hidden"
    >
        <span className="flex flex-col items-start">
            <span className="text-ink text-[14px] font-semibold">Best available</span>
            <span className="text-ink-quiet font-mono text-[11px]">{subtitle}</span>
        </span>
        <span className="text-ink-quiet shrink-0 text-[10px]">▲</span>
    </button>
);

export default BestAvailableHandle;
