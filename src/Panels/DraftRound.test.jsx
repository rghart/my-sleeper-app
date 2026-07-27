import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DraftRound from './DraftRound';
import { buildRosterInfo, decorateRosters } from '../lib/rosterInfo.js';
import rosterFlagsFixture from '../lib/__fixtures__/roster-flags-2026.json';

// Two things meet in DraftRound and neither had a direct test: the derived
// flags decide which ranked players the manual-pick modal is allowed to offer,
// and the DraftRound -> applyManualPick -> onPickChange contract is what PR
// #100's reducer-shaped updateDraftBoard composes against. App.test.jsx reaches
// the second only through the much heavier live-sync test, and the first not at
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

const rankEntry = (playerId) => ({
    match_results: [[playerId, '0.000']],
    ranking: '1',
    search_string: 'a pasted rank line',
});

const round = builtDraft[0];

function renderRound(overrides = {}) {
    const onPickChange = vi.fn();
    const props = {
        round,
        playerInfo,
        rosterInfo,
        rosterData,
        rankingPlayersIdsList: [rankEntry(FREE_AGENT.id), rankEntry(OTHERS_PLAYER.id), rankEntry(MY_PLAYER.id)],
        onPickChange,
        ...overrides,
    };
    render(<DraftRound {...props} />);
    return { onPickChange };
}

// The modal is rendered as a sibling of the round box, so scope queries to it
// rather than to the board - the board also renders player names.
const openPickModal = async (user, pickLabel) => {
    await user.click(screen.getByText(pickLabel).closest('.draft-pick'));
    return screen.getByText(/^Manually select pick/).closest('div').parentElement;
};

// The player database is a snapshot - it is fetched wholesale and its last
// update attempt reads Nov 2022 - so a drafted player can simply not be in it.
// DraftRound already allowed for that when choosing the position className and
// then read `.full_name` off the same lookup unconditionally on the next line,
// so one unknown id threw and took the entire board down, not just that cell.
describe('DraftRound with a player missing from the player database', () => {
    const UNKNOWN_ID = '99999999';

    const roundWithUnknownPick = () => ({
        ...round,
        picks: round.picks.map((pick, i) => (i === 0 ? { ...pick, player_id: UNKNOWN_ID, picked: true } : pick)),
    });

    it('renders the rest of the board instead of throwing', () => {
        expect(playerInfo[UNKNOWN_ID]).toBeUndefined();

        renderRound({ round: roundWithUnknownPick() });

        // Every pick slot still rendered - the failure mode was the whole
        // component throwing, so the count is the assertion that matters.
        expect(document.querySelectorAll('.draft-pick.clickable-item').length).toBe(round.picks.length);
        expect(screen.getByText(`Round ${round.round}`)).toBeInTheDocument();
    });

    it('shows the unresolved player id so the gap is diagnosable', () => {
        renderRound({ round: roundWithUnknownPick() });

        expect(screen.getByText(`Unknown player ${UNKNOWN_ID}`)).toBeInTheDocument();
    });

    it('renders the fallback outside the full-text/abbr-text pair', () => {
        // `full-text` is display:none below 640px, where `abbr-text` replaces
        // it. The first cut of this fix put the fallback in a `full-text` span,
        // which rendered a blank cell on a phone - caught in the browser, not
        // here, because jsdom applies no stylesheet and getByText found it
        // regardless.
        renderRound({ round: roundWithUnknownPick() });

        const fallback = screen.getByText(`Unknown player ${UNKNOWN_ID}`);
        expect(fallback.className).toBe('');
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

        renderRound({ round: mixed });

        expect(screen.getByText(`Unknown player ${UNKNOWN_ID}`)).toBeInTheDocument();
        expect(screen.getByText(playerInfo[knownId].full_name)).toBeInTheDocument();
    });
});

describe('DraftRound manual pick selection', () => {
    let user;

    beforeEach(() => {
        user = userEvent.setup();
    });

    it('offers only untaken ranked players in the pick modal', async () => {
        renderRound();

        const modal = await openPickModal(user, '1.1');

        expect(within(modal).getByText(new RegExp(FREE_AGENT.name))).toBeTruthy();
        expect(within(modal).queryByText(new RegExp(OTHERS_PLAYER.name))).toBeNull();
        expect(within(modal).queryByText(new RegExp(MY_PLAYER.name))).toBeNull();
    });

    it('reports the chosen player back through onPickChange as a whole round', async () => {
        const { onPickChange } = renderRound();

        const modal = await openPickModal(user, '1.1');
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

    it('lets a filled pick be cleared again', async () => {
        // The remove path only renders when the pick already holds a player,
        // and it is the half of the flow that clears rather than sets - the
        // asymmetric direction, where a flag that is written but never cleared
        // fails silently.
        const filledRound = {
            ...round,
            picks: round.picks.map((pick) => (pick.pick_number === 1 ? { ...pick, player_id: FREE_AGENT.id } : pick)),
        };
        const { onPickChange } = renderRound({ round: filledRound });

        const modal = await openPickModal(user, '1.1');
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
        renderRound({ round: tradedRound });

        expect(screen.getByText('ryangh via aphilliny21')).toBeTruthy();
    });
});
