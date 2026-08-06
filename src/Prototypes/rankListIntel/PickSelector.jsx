// THROWAWAY PROTOTYPE — choose which pick to analyze.
//
// Replaces the hardcoded "your next pick" that every earlier round assumed.
// Everything downstream (survival %, the gauntlet, threats) recomputes from
// whatever is selected here.
//
// A horizontal chip row rather than a dropdown or a stepper: on a phone this
// has to be one tap, and the picks worth choosing are a short, known list
// (14 remain here). Your own picks are marked so the common case - "my next
// one" - is findable without reading numbers.
//
// Note the row shows the pick's CURRENT owner, trade-resolved (see fixture
// `board`), so "mine" is accurate even for picks acquired by trade.

const PickSelector = ({ board, selected, onSelect, currentPick }) => (
    <div className="-mx-2 px-2">
        <div className="flex scrollbar-none gap-1.5 overflow-x-auto pb-1">
            {board.map((slot) => {
                const isSelected = slot.pick === selected;
                return (
                    <button
                        key={slot.pick}
                        type="button"
                        onClick={() => onSelect(slot.pick)}
                        aria-pressed={isSelected}
                        aria-label={`Analyze pick ${slot.pick}${slot.mine ? ', yours' : `, ${slot.manager}`}`}
                        className={`flex shrink-0 flex-col items-center rounded-lg border px-2.5 py-1 transition-colors ${
                            isSelected
                                ? 'border-mine bg-mine-chip'
                                : slot.mine
                                  ? 'border-mine/40 bg-mine-row'
                                  : 'border-line'
                        }`}
                    >
                        <span
                            className={`font-mono text-[13px] font-semibold tabular-nums ${
                                isSelected ? 'text-ink' : slot.mine ? 'text-mine' : 'text-ink-quiet'
                            }`}
                        >
                            {slot.pick}
                        </span>
                        <span
                            className={`max-w-[52px] truncate font-mono text-[9px] ${
                                slot.mine ? 'text-mine' : 'text-ink-dim'
                            }`}
                        >
                            {slot.mine ? 'YOU' : slot.manager}
                        </span>
                    </button>
                );
            })}
        </div>
        <p className="text-ink-dim pt-1 font-mono text-[10px]">
            {selected === currentPick
                ? `On the clock at ${selected}`
                : `Chance he lasts to pick ${selected} · ${selected - currentPick} pick${
                      selected - currentPick === 1 ? '' : 's'
                  } from now`}
        </p>
    </div>
);

export default PickSelector;
