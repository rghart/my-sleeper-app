import { useRef } from 'react';
import Popover from './Popover';
import { isTaken, rosteredBy } from '../lib/rosterInfo.js';

/**
 * The ownership scope a candidate list is read through. The sheet answers
 * "who can I put here?", and by default that means *your* players plus
 * anything unowned - so an upgrade sitting on waivers is visible - while
 * players locked on somebody else's roster are hidden until asked for.
 *
 * Free agency and waivers are one bucket on purpose: "unowned in the league's
 * rosters" is all `rosterInfo` knows. Telling them apart would need Sleeper's
 * transactions endpoint, which is out of scope.
 */
export const DEFAULT_OWNERSHIP = {
    mine: true,
    available: true,
    others: false,
    rookiesOnly: false,
};

const OWNERSHIP_OPTIONS = [
    { name: 'mine', label: 'My players', explainer: 'on your roster' },
    { name: 'available', label: 'Free agents & waivers', explainer: 'available to add' },
    { name: 'others', label: 'Other rosters', explainer: 'not gettable now' },
];

/**
 * The number the `FILTERS · n` chip shows: how many ownership buckets are
 * being shown. It is a count of what is on, not of what differs from the
 * default, so the default state reads `FILTERS · 2` (as in the design) rather
 * than a bare `FILTERS`.
 */
export const ownershipCount = (ownership) => OWNERSHIP_OPTIONS.filter((option) => ownership[option.name]).length;

/** True when the scope is untouched - what makes the chip read as "at rest". */
export const isDefaultOwnership = (ownership) =>
    Object.keys(DEFAULT_OWNERSHIP).every((key) => ownership[key] === DEFAULT_OWNERSHIP[key]);

/**
 * Whether one player survives the ownership scope. Split three ways by who
 * holds them, which is the same `!taken || isMine` distinction PlayerInfoItem
 * and BestAvailable already draw - "taken" has always meant taken by somebody
 * *else* in this app, and this filter keeps that meaning rather than
 * introducing a fourth reading of it.
 */
export function matchesOwnership({ ownership, player, playerId, rosterInfo, myDisplayName }) {
    if (ownership.rookiesOnly && !(player?.years_exp < 1)) {
        return false;
    }
    if (!isTaken(rosterInfo, playerId)) {
        return ownership.available;
    }
    return rosteredBy(rosterInfo, playerId) === myDisplayName ? ownership.mine : ownership.others;
}

const Checkbox = ({ checked }) => (
    <span
        aria-hidden="true"
        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-[5px] text-[10px] ${
            checked ? 'bg-mine text-ground' : 'border-mark border'
        }`}
    >
        {checked ? '✓' : ''}
    </span>
);

/**
 * The `SHOW PLAYERS` body: three ownership checkboxes, a rookies-only toggle,
 * and a reset. Exported separately from the chip so the same body can sit in
 * whatever container a caller has (the anchored popover below, or a panel).
 */
export const OwnershipFiltersBody = ({ ownership, onChange }) => {
    const toggle = (name) => onChange({ ...ownership, [name]: !ownership[name] });

    return (
        <div className="flex flex-col">
            <p className="text-ink-quiet m-0 px-2.5 pt-2 pb-1 font-mono text-[10px] font-semibold tracking-[.12em]">
                SHOW PLAYERS
            </p>
            {OWNERSHIP_OPTIONS.map((option) => (
                <button
                    key={option.name}
                    type="button"
                    role="checkbox"
                    aria-checked={ownership[option.name]}
                    onClick={() => toggle(option.name)}
                    className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-[9px] text-left"
                >
                    <Checkbox checked={ownership[option.name]} />
                    <span className="flex min-w-0 flex-col">
                        <span
                            className={`truncate text-[13px] ${
                                ownership[option.name] ? 'text-ink font-semibold' : 'text-ink-muted font-medium'
                            }`}
                        >
                            {option.label}
                        </span>
                        <span className="text-ink-quiet font-mono text-[10px]">{option.explainer}</span>
                    </span>
                </button>
            ))}
            <div className="bg-line mx-1.5 my-1 h-px" />
            <button
                type="button"
                role="switch"
                aria-checked={ownership.rookiesOnly}
                onClick={() => toggle('rookiesOnly')}
                className="flex w-full items-center justify-between gap-2.5 rounded-lg px-2.5 py-[9px] text-left"
            >
                <span className={`text-[13px] ${ownership.rookiesOnly ? 'text-ink font-semibold' : 'text-ink-muted'}`}>
                    Rookies only
                </span>
                <span
                    aria-hidden="true"
                    className={`flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 ${
                        ownership.rookiesOnly ? 'bg-mine justify-end' : 'bg-line-mid justify-start'
                    }`}
                >
                    <span
                        className={`block h-4 w-4 rounded-full ${ownership.rookiesOnly ? 'bg-ground' : 'bg-ink-dim'}`}
                    />
                </span>
            </button>
            <button
                type="button"
                onClick={() => onChange(DEFAULT_OWNERSHIP)}
                className="text-mine w-full rounded-lg px-2.5 py-[9px] text-left text-[13px] font-semibold"
            >
                Reset to default
            </button>
        </div>
    );
};

/**
 * The `FILTERS · n` chip and its popover. Violet-filled while open or while
 * the scope is non-default, outlined at rest - the chip has to say that
 * something is being hidden without the popover being open to explain it.
 */
const OwnershipFilters = ({ ownership, onChange, isOpen, onToggle }) => {
    const chipRef = useRef(null);
    const active = isOpen || !isDefaultOwnership(ownership);

    return (
        <div className="relative inline-block shrink-0">
            <button
                type="button"
                ref={chipRef}
                aria-expanded={isOpen}
                onClick={onToggle}
                className={`rounded-full border px-[11px] py-[7px] font-mono text-[11px] font-semibold tracking-[.08em] ${
                    active ? 'bg-mine-chip border-mine text-mine' : 'border-line text-ink-muted'
                }`}
            >
                FILTERS · {ownershipCount(ownership)}
            </button>
            {isOpen && (
                <Popover triggerRef={chipRef} onClose={onToggle} label="Filters">
                    <OwnershipFiltersBody ownership={ownership} onChange={onChange} />
                </Popover>
            )}
        </div>
    );
};

export default OwnershipFilters;
