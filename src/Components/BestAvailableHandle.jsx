// The collapsed strip that opens the best-available sheet. A real button
// (not a div wearing an onClick) so it carries a natural aria-expanded and
// keyboard activation for free - the thing BestAvailableSheet's old toggle
// already got right and this keeps.
//
// Pinned above the tab bar rather than sitting wherever the section's content
// happens to end. In flow it drifted up the screen the moment a board was
// shorter than the viewport - on a four-round draft it landed halfway up,
// reading as a stray strip in the middle of the page rather than as the bottom
// edge of the screen. It shares its anchor (`--tab-bar-h`) with the sheet it
// opens, so the sheet now rises from exactly where the handle sat.
//
// Panels that render one have to leave `--handle-h` of clearance at the bottom
// of their scrolling content, or the last row sits underneath it.
const BestAvailableHandle = ({ isExpanded, onClick, subtitle, buttonRef }) => (
    <button
        ref={buttonRef}
        type="button"
        aria-expanded={isExpanded}
        onClick={onClick}
        className="border-line bg-raised fixed inset-x-0 bottom-[var(--tab-bar-h)] z-10 flex h-[var(--handle-h)] w-full items-center justify-between border-t px-4 md:hidden"
    >
        <span className="flex flex-col items-start">
            <span className="text-ink text-[14px] font-semibold">Best available</span>
            <span className="text-ink-quiet font-mono text-[11px]">{subtitle}</span>
        </span>
        <span className="text-ink-quiet shrink-0 text-[10px]">▲</span>
    </button>
);

export default BestAvailableHandle;
