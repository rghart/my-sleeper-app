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
