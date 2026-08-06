import { pickOptions } from '../lib/availability.js';

// Choosing which pick to analyze (docs/leaguemate-intel.md §3g gap 1).
//
// The header used to state the pick as fact ("% = lasts to your pick (39)").
// It is a control instead: everything downstream - the chip, the row
// ordering's meaning, the gauntlet - recomputes from whatever is selected.
// That is also what answers "which of these two lasts longer?" without a
// dedicated compare mode: scope the list to a pick and read two rows.
//
// A horizontal chip row rather than a dropdown or a stepper, validated at
// 375px: on a phone this has to be one tap, and the picks worth choosing are
// a short known list. Each chip shows the pick's CURRENT owner, trade-resolved
// by the API (§3d) - deriving ownership from the draft order got two of three
// picks wrong, and attributing danger to the wrong manager is the one thing
// this feature must not do.

const IntelPickSelector = ({ board, selected, onSelect, currentPick }) => {
    const options = pickOptions(board);

    // §3g gap 1b's honest ending. A finished draft (or a last-round pick with
    // nothing after it) has no pick to analyze, and the fix for 1b is only
    // half done if the UI answers that with a number anyway.
    if (options.length === 0) {
        return (
            <p className="text-ink-muted m-0 flex min-h-11 items-center px-1.5 text-sm">No picks left in this draft.</p>
        );
    }

    return (
        <div className="-mx-2 px-2">
            <div className="flex scrollbar-none gap-1.5 overflow-x-auto pb-1">
                {options.map((slot) => {
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
            <p className="text-ink-dim pt-1 font-mono text-[10px]">{caption({ selected, currentPick })}</p>
        </div>
    );
};

// The one line under the chips. Never phrased as advice - §3g: a high number
// means "you can wait" or "don't spend this pick on him" depending on the
// question, so this states what the number is and stops.
function caption({ selected, currentPick }) {
    if (selected == null) return 'Pick one to analyze against.';
    if (selected === currentPick) return `On the clock at ${selected}`;

    const away = selected - currentPick;
    return `Chance he lasts to pick ${selected} · ${away} pick${away === 1 ? '' : 's'} from now`;
}

export default IntelPickSelector;
