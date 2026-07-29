import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PickFeed from './PickFeed';
import { buildRosterInfo, decorateRosters } from '../lib/rosterInfo.js';
import rosterFlagsFixture from '../lib/__fixtures__/roster-flags-2026.json';

// PickFeed is what DraftRound.test.jsx used to cover: the derived flags that
// decide which ranked players the manual-pick modal is allowed to offer, and
// the PickFeed -> applyManualPick -> onPickChange contract that PR #100's
// reducer-shaped updateDraftBoard composes against. App.test.jsx reaches the
// second only through the much heavier live-sync test, and the first not at
// all.

const { rosterDataRaw, managerData, playerInfo, builtDraft } = rosterFlagsFixture;

const rosterData = decorateRosters({ rosterData: rosterDataRaw, managerData });
const rosterInfo = buildRosterInfo({ rosterData, builtDraft: null });

// 13307 is on nobody's roster. That matters more here than anywhere else: the
// natural repro for this filter uses a player who is also taken for an
// unrelated reason, which makes "correctly excluded" and "wrongly excluded"
// indistinguishable. 13294 and 13274 are genuinely taken (roster 2 and my own
// roster 1), so their absence is the real assertion.
const FREE_AGENT = { id: '13307', name: 'Marlin Klein' };
const OTHERS_PLAYER = { id: '13294', name: 'Makai Lemon' };
const MY_PLAYER = { id: '13274', name: 'Germie Bernard' };

// Board spot 3 is roster 1 ("ryangh") in every round of this fixture (the
// draft is linear, not snake) - see App.test.jsx for the same fact used
// against the whole app.
const MY_DISPLAY_NAME = 'ryangh';

const rankEntry = (playerId) => ({
    match_results: [[playerId, '0.000']],
    ranking: '1',
    search_string: 'a pasted rank line',
});

const round = builtDraft[0];

function renderFeed(overrides = {}) {
    const onPickChange = vi.fn();
    const props = {
        builtDraft: [round],
        playerInfo,
        rosterInfo,
        rosterData,
        rankingPlayersIdsList: [rankEntry(FREE_AGENT.id), rankEntry(OTHERS_PLAYER.id), rankEntry(MY_PLAYER.id)],
        myDisplayName: MY_DISPLAY_NAME,
        onPickChange,
        ...overrides,
    };
    render(<PickFeed {...props} />);
    return { onPickChange };
}

const roundList = () => screen.getByRole('list', { name: `Round ${round.round}` });

// The modal is rendered as a sibling of the round list, so scope queries to it
// rather than to the board - the board also renders player names. Queried by
// its dialog role now rather than `closest('div').parentElement`: that
// structural climb only ever worked because of how many wrapper divs
// happened to exist, and ManualPickModal's conversion to Tailwind gives it a
// real `role="dialog"` and accessible name to query instead.
const openPickModal = async (user, pickNumber) => {
    await user.click(screen.getByRole('button', { name: new RegExp(`pick ${pickNumber},`) }));
    return screen.getByRole('dialog', { name: /^Manually select pick/ });
};

// The player database is a snapshot - it is fetched wholesale and its last
// update attempt reads Nov 2022 - so a drafted player can simply not be in it.
// PickRow already allowed for that when choosing the position badge and then
// read `.full_name` off the same lookup unconditionally on the next line, so
// one unknown id threw and took the entire board down, not just that cell.
describe('PickFeed with a player missing from the player database', () => {
    const UNKNOWN_ID = '99999999';

    const roundWithUnknownPick = () => ({
        ...round,
        picks: round.picks.map((pick, i) => (i === 0 ? { ...pick, player_id: UNKNOWN_ID, picked: true } : pick)),
    });

    it('renders the rest of the board instead of throwing', () => {
        expect(playerInfo[UNKNOWN_ID]).toBeUndefined();

        renderFeed({ builtDraft: [roundWithUnknownPick()] });

        // Every pick slot still rendered - the failure mode was the whole
        // component throwing, so the count is the assertion that matters.
        expect(within(roundList()).getAllByRole('listitem')).toHaveLength(round.picks.length);
        expect(screen.getByText(`Round ${round.round}`)).toBeInTheDocument();
    });

    it('shows the unresolved player id so the gap is diagnosable', () => {
        renderFeed({ builtDraft: [roundWithUnknownPick()] });

        expect(screen.getByText(`Unknown player ${UNKNOWN_ID}`)).toBeInTheDocument();
    });

    it('renders the fallback inside a plain, always-visible span', () => {
        // The old board hid this fallback once by putting it inside a class
        // that was display:none at narrow widths. This rebuild has no such
        // class at all - the fallback is a bare span in the row - so the
        // regression this guards against is "someone reintroduces a hidden
        // variant", not a specific className.
        renderFeed({ builtDraft: [roundWithUnknownPick()] });

        const fallback = screen.getByText(`Unknown player ${UNKNOWN_ID}`);
        expect(fallback).toBeVisible();
    });

    it('still renders known players on the same round normally', () => {
        const knownId = Object.keys(playerInfo)[0];
        const mixed = {
            ...round,
            picks: round.picks.map((pick, i) => {
                if (i === 0) return { ...pick, player_id: UNKNOWN_ID, picked: true };
                if (i === 1) return { ...pick, player_id: knownId, picked: true };
                return pick;
            }),
        };

        renderFeed({ builtDraft: [mixed] });

        expect(screen.getByText(`Unknown player ${UNKNOWN_ID}`)).toBeInTheDocument();
        expect(screen.getByText(playerInfo[knownId].full_name)).toBeInTheDocument();
    });
});

describe('PickFeed manual pick selection', () => {
    let user;

    beforeEach(() => {
        user = userEvent.setup();
    });

    it('offers only untaken ranked players in the pick modal', async () => {
        renderFeed();

        const modal = await openPickModal(user, 1);

        expect(within(modal).getByText(new RegExp(FREE_AGENT.name))).toBeTruthy();
        expect(within(modal).queryByText(new RegExp(OTHERS_PLAYER.name))).toBeNull();
        expect(within(modal).queryByText(new RegExp(MY_PLAYER.name))).toBeNull();
    });

    it('exposes the pick modal as a dialog named after the pick it edits', async () => {
        // openPickModal itself queries getByRole('dialog', ...) already, so a
        // failure to expose the role or name shows up there - this pins the
        // exact accessible name down as its own assertion rather than leaving
        // it implicit in a helper.
        renderFeed();

        const modal = await openPickModal(user, 1);

        expect(modal).toHaveAccessibleName(`Manually select pick ${round.round}.1`);
    });

    it('reports the chosen player back through onPickChange as a whole round', async () => {
        const { onPickChange } = renderFeed();

        const modal = await openPickModal(user, 1);
        await user.click(within(modal).getByText(new RegExp(FREE_AGENT.name)));

        expect(onPickChange).toHaveBeenCalledTimes(1);
        const updatedRound = onPickChange.mock.calls[0][0];

        // DraftPanel swaps the whole round object into the board by matching
        // `round.round`, so an update that loses the round number - or that
        // hands back a bare pick - silently drops the pick on the floor.
        expect(updatedRound.round).toBe(round.round);
        expect(updatedRound.picks.find((pick) => pick.pick_number === 1).player_id).toBe(FREE_AGENT.id);

        // Every other pick has to survive untouched, and the input round must
        // not have been mutated in place: DraftPanel's reducer compares against
        // prevState, which an in-place edit would defeat.
        expect(updatedRound.picks).toHaveLength(round.picks.length);
        expect(round.picks[0].player_id).toBeNull();
    });

    it('passes the changed pick key as a second argument, so DraftPanel can mark it seen', async () => {
        // A manual pick must not flash a "NEW" chip at the person who just
        // made it - DraftPanel only knows to call markSeen because this
        // second argument is present.
        const { onPickChange } = renderFeed();

        const modal = await openPickModal(user, 1);
        await user.click(within(modal).getByText(new RegExp(FREE_AGENT.name)));

        expect(onPickChange.mock.calls[0][1]).toBe(`${round.round}.1`);
    });

    it('lets a filled pick be cleared again', async () => {
        // The remove path only renders when the pick already holds a player,
        // and it is the half of the flow that clears rather than sets - the
        // asymmetric direction, where a flag that is written but never cleared
        // fails silently.
        const filledRound = {
            ...round,
            picks: round.picks.map((pick) => (pick.pick_number === 1 ? { ...pick, player_id: FREE_AGENT.id } : pick)),
        };
        const { onPickChange } = renderFeed({ builtDraft: [filledRound] });

        const modal = await openPickModal(user, 1);
        await user.click(within(modal).getByText('Remove pick?'));

        expect(onPickChange.mock.calls[0][0].picks.find((pick) => pick.pick_number === 1).player_id).toBeNull();
    });

    it('attributes a traded pick to its current owner via the original holder', async () => {
        // pick.owner_id and pick.roster_id resolve against two different
        // rosters; the "via" text is the only place both lookups are visible.
        const tradedRound = {
            ...round,
            picks: round.picks.map((pick) =>
                pick.pick_number === 1 ? { ...pick, is_traded: true, owner_id: 1, roster_id: 2 } : pick,
            ),
        };
        renderFeed({ builtDraft: [tradedRound] });

        // Owner 1 is "ryangh" - which is also myDisplayName in this suite, so
        // the "you" suffix and the "via" attribution both land on the same row.
        // "you" marks the whole attribution and so comes last: the pick is
        // yours, acquired via aphilliny21.
        //
        // That suffix now lives in the accessible name only. On screen the row
        // says "yours" twice already - the violet tint and the YOU flag - so
        // the visible attribution is the plain one.
        expect(screen.getByRole('button', { name: 'Round 1, pick 1, ryangh via aphilliny21 · you' })).toBeTruthy();
        expect(screen.getByText('ryangh via aphilliny21')).toBeTruthy();
    });
});

describe('PickFeed pick numbering', () => {
    it('zero-pads the pick number so 1.10 does not sort next to 1.1 to the eye', () => {
        renderFeed();

        expect(screen.getByText('1.01')).toBeInTheDocument();
        expect(screen.queryByText('1.1')).toBeNull();
    });
});

describe('PickFeed your-pick styling', () => {
    it('marks the pick belonging to myDisplayName with the row tint, and no one else', () => {
        renderFeed();

        // Board spot 3 in round 1 is roster 1, "ryangh", in this fixture.
        // Board spot 1 is roster 5, "HEFFinAround305" - not me. The design
        // marks "yours" with a row background tint, not a border - see
        // ListRow's `tone="mine"`.
        const myRow = screen.getByRole('button', { name: /pick 3, ryangh/ });
        expect(myRow.className).toMatch(/bg-mine-row/);

        const someoneElsesRow = screen.getByRole('button', { name: /pick 1, HEFFinAround305/ });
        expect(someoneElsesRow.className).not.toMatch(/bg-mine-row/);
    });

    it('keeps "· you" in my pick\'s accessible name but not in its visible text', () => {
        renderFeed();

        // The suffix is what a screen reader has instead of the row tint and
        // the YOU flag, so it stays in the name. Visually it would be the
        // third time the same row said "yours", so it is not rendered.
        const myRow = screen.getByRole('button', { name: 'Round 1, pick 3, ryangh · you' });
        expect(within(myRow).queryByText(/· you/)).toBeNull();
        expect(within(myRow).getByText('YOU')).toBeInTheDocument();

        // Pick 1 belongs to roster 5, not me - no suffix and no flag.
        const otherRow = screen.getByRole('button', { name: /pick 1,/ });
        expect(within(otherRow).queryByText(/· you/)).toBeNull();
        expect(within(otherRow).queryByText('YOU')).toBeNull();
    });
});

describe('PickFeed accessible names', () => {
    it('names an unmade pick with round, pick number and manager only', () => {
        renderFeed();

        expect(screen.getByRole('button', { name: 'Round 1, pick 1, HEFFinAround305' })).toBeInTheDocument();
    });

    it('names a made pick with round, pick number, manager, player and position', () => {
        const filledRound = {
            ...round,
            picks: round.picks.map((pick) => (pick.pick_number === 1 ? { ...pick, player_id: FREE_AGENT.id } : pick)),
        };
        renderFeed({ builtDraft: [filledRound] });

        expect(
            screen.getByRole('button', { name: `Round 1, pick 1, HEFFinAround305, ${FREE_AGENT.name}, TE` }),
        ).toBeInTheDocument();
    });

    it('appends ", new" to a pick whose key is in newPickKeys', () => {
        const filledRound = {
            ...round,
            picks: round.picks.map((pick) => (pick.pick_number === 1 ? { ...pick, player_id: FREE_AGENT.id } : pick)),
        };
        renderFeed({ builtDraft: [filledRound], newPickKeys: new Set([`${round.round}.1`]) });

        expect(
            screen.getByRole('button', { name: `Round 1, pick 1, HEFFinAround305, ${FREE_AGENT.name}, TE, new` }),
        ).toBeInTheDocument();
    });

    it('does not append ", new" to an already-seen made pick', () => {
        const filledRound = {
            ...round,
            picks: round.picks.map((pick) => (pick.pick_number === 1 ? { ...pick, player_id: FREE_AGENT.id } : pick)),
        };
        renderFeed({ builtDraft: [filledRound], newPickKeys: new Set() });

        expect(
            screen.getByRole('button', { name: `Round 1, pick 1, HEFFinAround305, ${FREE_AGENT.name}, TE` }),
        ).toBeInTheDocument();
        expect(
            screen.queryByRole('button', { name: `Round 1, pick 1, HEFFinAround305, ${FREE_AGENT.name}, TE, new` }),
        ).toBeNull();
    });
});

// The accessible name carries "new" for assistive tech, but the visible chips
// are what a sighted user actually gets, and nothing above asserts they render
// at all - stripping them left the whole suite green. These are text
// assertions, not className ones: the palette is browser-verified, but whether
// the marker exists in the DOM is not a styling question.
describe('PickFeed new-pick markers', () => {
    const filledRound = (pickNumbers) => ({
        ...round,
        picks: round.picks.map((pick) =>
            pickNumbers.includes(pick.pick_number) ? { ...pick, player_id: FREE_AGENT.id } : pick,
        ),
    });

    it('renders a NEW chip on each new row and none on the seen ones', () => {
        renderFeed({
            builtDraft: [filledRound([1, 2, 3])],
            newPickKeys: new Set([`${round.round}.1`, `${round.round}.2`]),
        });

        const chips = screen.getAllByText('NEW');
        expect(chips).toHaveLength(2);
        expect(chips[0]).toBeVisible();

        // Pick 3 is made but already seen, so its row carries no chip.
        const seenRow = screen.getByRole('button', { name: /pick 3, ryangh/ });
        expect(within(seenRow).queryByText('NEW')).toBeNull();
    });

    it('counts the new picks in the round header', () => {
        renderFeed({
            builtDraft: [filledRound([1, 2, 3])],
            newPickKeys: new Set([`${round.round}.1`, `${round.round}.2`]),
        });

        expect(screen.getByText('2 new')).toBeVisible();
    });

    it('shows no chip and no count when nothing is new', () => {
        renderFeed({ builtDraft: [filledRound([1, 2, 3])], newPickKeys: new Set() });

        expect(screen.queryByText('NEW')).toBeNull();
        expect(screen.queryByText(/\d+ new/)).toBeNull();
    });

    it('keeps the round header clickable with a count beside it', async () => {
        // The count chip lives inside the collapse button. Adding a second
        // child there is exactly how "Round 1" stops being its own text node
        // and the collapse test below starts matching nothing.
        const user = userEvent.setup();
        renderFeed({ builtDraft: [filledRound([1])], newPickKeys: new Set([`${round.round}.1`]) });

        await user.click(screen.getByText('Round 1'));
        expect(screen.queryByRole('list', { name: 'Round 1' })).toBeNull();
    });
});

describe('PickFeed round collapsing', () => {
    it('hides the round list when its header is clicked, and shows it again on a second click', async () => {
        const user = userEvent.setup();
        renderFeed();

        expect(roundList()).toBeInTheDocument();

        await user.click(screen.getByText('Round 1'));
        expect(screen.queryByRole('list', { name: 'Round 1' })).toBeNull();

        await user.click(screen.getByText('Round 1'));
        expect(screen.getByRole('list', { name: 'Round 1' })).toBeInTheDocument();
    });
});
