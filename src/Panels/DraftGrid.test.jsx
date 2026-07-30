import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DraftGrid from './DraftGrid';
import { pickAccessibleName, managerLabel } from './pickLabels.js';
import { buildRosterInfo, decorateRosters } from '../lib/rosterInfo.js';
import rosterFlagsFixture from '../lib/__fixtures__/roster-flags-2026.json';
import goldenDraft from '../lib/__fixtures__/golden-draft-output.json';

// DraftGrid is the second view of the same board PickFeed already covers, so
// this file only asserts what's specific to the grid: every pick shows up as a
// cell, the accessible name matches the feed's builder exactly (both read off
// pickLabels.js, so they cannot drift), "mine" marking, unmade-vs-made, column
// identity on a snake board, and that a cell opens the same modal.
//
// There is one density. The overview zoom stop - 23px colour blocks with no
// text - is deleted rather than restyled, so the tests that used to switch
// between the two are gone with it; what replaced them is the key row, which is
// what makes a 5px dot legible now that the dot is the grid's whole tag.

const { rosterDataRaw, managerData, playerInfo, builtDraft } = rosterFlagsFixture;

const rosterData = decorateRosters({ rosterData: rosterDataRaw, managerData });
const rosterInfo = buildRosterInfo({ rosterData, builtDraft: null });

const FREE_AGENT = { id: '13307', name: 'Marlin Klein' };

// Board spot 3 is roster 1 ("ryangh") in every round of this fixture (the
// draft is linear, not snake) - same fact PickFeed.test.jsx and
// App.test.jsx key off.
const MY_DISPLAY_NAME = 'ryangh';

const rankEntry = (playerId) => ({
    match_results: [[playerId, '0.000']],
    ranking: '1',
    search_string: 'a pasted rank line',
});

const round = builtDraft[0];

function renderGrid(overrides = {}) {
    const onPickChange = vi.fn();
    const props = {
        builtDraft: [round],
        playerInfo,
        rosterInfo,
        rosterData,
        rankingPlayersIdsList: [rankEntry(FREE_AGENT.id)],
        myDisplayName: MY_DISPLAY_NAME,
        onPickChange,
        ...overrides,
    };
    render(<DraftGrid {...props} />);
    return { onPickChange };
}

// Every cell's accessible name follows "Round R, pick N, <manager>[, <player>, <position>]" -
// build the expected name off the same fixture data pickLabels.js itself reads,
// rather than hardcoding one example, so this asserts the whole round at once.
const expectedNameFor = (pick) => {
    const manager = managerLabel({ pick, rosterData, myDisplayName: MY_DISPLAY_NAME });
    const player = pick.player_id ? playerInfo[pick.player_id] : null;
    return pickAccessibleName({ round, pick, player, manager });
};

describe('DraftGrid cell coverage', () => {
    it('renders every pick in the round as a cell', () => {
        renderGrid();

        round.picks.forEach((pick) => {
            expect(screen.getByRole('button', { name: expectedNameFor(pick) })).toBeInTheDocument();
        });
    });

    it('gives a cell the same accessible name PickRow builds for the identical pick', () => {
        renderGrid();

        // Pick 1 of this round is unmade in the raw fixture: manager only, no
        // player/position segment - matches PickFeed's own "unmade" test.
        const unmadePick = round.picks.find((pick) => pick.pick_number === 1);
        expect(unmadePick.player_id).toBeNull();
        expect(screen.getByRole('button', { name: 'Round 1, pick 1, HEFFinAround305' })).toBeInTheDocument();
    });

    it('names every manager column, and the round rail in full rather than as R1', () => {
        renderGrid();

        // A manager's name can now appear inside a cell too - that is how a
        // traded pick names its new owner - so the column header is the one
        // occurrence outside a cell button.
        const headers = screen.getAllByText('HEFFinAround305').filter((element) => !element.closest('button'));
        expect(headers).toHaveLength(1);
        expect(headers[0]).toBeVisible();
        // Visibly "R1" - the rail is 30px wide - but named "Round 1", so a
        // screen reader reaching it says something useful.
        expect(screen.getByLabelText('Round 1')).toHaveTextContent('R1');
    });
});

// A column is its *original* owner - the board keys columns off board_spot,
// which a trade never moves - so a traded pick sitting in someone else's
// column belonged to nobody visible until this. The feed spells out "ryangh
// via crbiehl"; a 108px cell says only the half its column cannot.
describe('DraftGrid traded picks', () => {
    const tradedPick = round.picks.find((pick) => pick.is_traded && pick.roster_id !== pick.owner_id);
    const newOwner = rosterData.find((roster) => roster.roster_id === tradedPick.owner_id).manager_display_name;
    const originalOwner = rosterData.find((roster) => roster.roster_id === tradedPick.roster_id).manager_display_name;

    it('names the pick’s new owner inside the cell', () => {
        renderGrid();

        const cell = screen.getByRole('button', { name: expectedNameFor(tradedPick) });
        expect(within(cell).getByText(newOwner)).toBeVisible();
        // The long form stays in the accessible name, which is the same string
        // the feed's row carries for this pick.
        expect(cell).toHaveAccessibleName(new RegExp(`${newOwner} via ${originalOwner}`));
    });

    it('leaves a pick still held by its original owner unmarked', () => {
        renderGrid();

        const untraded = round.picks.find((pick) => !pick.is_traded);
        const cell = screen.getByRole('button', { name: expectedNameFor(untraded) });
        const owner = rosterData.find((roster) => roster.roster_id === untraded.owner_id).manager_display_name;
        expect(within(cell).queryByText(owner)).toBeNull();
    });
});

describe('DraftGrid position key', () => {
    // The grid is the only place a position hue appears outside a tag or a
    // filter chip, so it is the only place that needs a key. Without it a 5px
    // coloured dot is undecodable.
    it('explains all four hued positions, and marks which column is yours', () => {
        renderGrid();

        ['QB', 'RB', 'WR', 'TE'].forEach((position) => {
            expect(screen.getByText(position)).toBeVisible();
        });
        expect(screen.getByText('YOU')).toBeVisible();
    });
});

describe('DraftGrid your-pick marking', () => {
    it('marks my own cell and leaves everyone else unmarked', () => {
        renderGrid();

        const myPick = round.picks.find((pick) => pick.pick_number === 3);
        const othersPick = round.picks.find((pick) => pick.pick_number === 1);

        const myCell = screen.getByRole('button', { name: expectedNameFor(myPick) });
        const othersCell = screen.getByRole('button', { name: expectedNameFor(othersPick) });

        // Yours is a violet fill plus a violet edge now, not an inset outline
        // over a saturated position fill - there is no position fill left to
        // show through.
        expect(myCell.className).toMatch(/border-mine-edge/);
        expect(othersCell.className).not.toMatch(/border-mine-edge/);

        // The visual encoding is colour-only, so the meaning also has to be in
        // the name - which it is, via managerLabel's "· you".
        expect(myCell.getAttribute('aria-label')).toContain('· you');
        expect(othersCell.getAttribute('aria-label')).not.toContain('· you');
    });
});

describe('DraftGrid unmade vs made picks', () => {
    it('renders an unmade pick as its pick number alone rather than as a made pick', () => {
        renderGrid();

        const unmadePick = round.picks.find((pick) => pick.pick_number === 1);
        const cell = screen.getByRole('button', { name: expectedNameFor(unmadePick) });

        // A made pick's cell shows the player's short name over "TEAM · pick";
        // an unmade one shows the pick number and nothing else. Asserting the
        // whole text, rather than just the absence of a short name, is what
        // makes this fail if the cell ever renders in its made state with no
        // player - which reads as an em dash where the team should be.
        expect(cell.textContent.trim()).toBe('1.01');
        expect(cell.textContent).not.toContain('—');
    });

    it('renders a made pick as a short name over its team and pick', () => {
        const filledRound = {
            ...round,
            picks: round.picks.map((pick) => (pick.pick_number === 1 ? { ...pick, player_id: FREE_AGENT.id } : pick)),
        };
        renderGrid({ builtDraft: [filledRound] });

        const filledPick = filledRound.picks.find((pick) => pick.pick_number === 1);
        const cell = screen.getByRole('button', { name: expectedNameFor(filledPick) });

        expect(within(cell).getByText('M.Klein')).toBeInTheDocument();
        expect(within(cell).getByText(`${playerInfo[FREE_AGENT.id].team} · 1.01`)).toBeInTheDocument();
    });
});

describe('DraftGrid column identity on a snake board', () => {
    // On a linear board pick_number and board_spot are the same number in
    // every round, so keying the columns off the wrong one looks perfectly
    // correct - the right and wrong answers coincide. Round 2 of the snake
    // fixture reverses: pick_number 1 sits in board_spot 12.
    const snakeBoard = goldenDraft.snake.built_draft;
    const snakeRound2 = snakeBoard[1];

    // Note what this does and does not pin down. Round 1 of a snake is not
    // reversed, so `buildTeamColumns` (which reads round 1) produces the same
    // column order whether it sorts by board_spot or pick_number - that half is
    // not observable here. What is observable is the lookup: finding each
    // round's pick by pick_number instead of board_spot puts round 2's picks in
    // the wrong columns, which is what this asserts.
    it('puts a pick in its board_spot column, not its pick_number column', () => {
        render(
            <DraftGrid
                builtDraft={snakeBoard}
                playerInfo={playerInfo}
                rosterInfo={rosterInfo}
                rosterData={rosterData}
                rankingPlayersIdsList={[]}
                myDisplayName={MY_DISPLAY_NAME}
                onPickChange={vi.fn()}
            />,
        );

        const reversed = snakeRound2.picks.find((pick) => pick.pick_number === 1);
        expect(reversed.board_spot).not.toBe(reversed.pick_number);

        // The board is a CSS grid rather than a table now, so the row's cells
        // are read off their own names in DOM order - which is column order,
        // since the columns are built sorted by board_spot.
        const rowCells = screen.getAllByRole('button', { name: /^Round 2,/ });
        const columnIndex = snakeBoard[0].picks
            .map((pick) => pick.board_spot)
            .sort((a, b) => a - b)
            .indexOf(reversed.board_spot);

        expect(rowCells[columnIndex].getAttribute('aria-label')).toContain('pick 1,');
    });
});

describe('DraftGrid modal', () => {
    it('opens the manual-pick modal for the clicked cell', async () => {
        const user = userEvent.setup();
        renderGrid();

        const unmadePick = round.picks.find((pick) => pick.pick_number === 1);
        await user.click(screen.getByRole('button', { name: expectedNameFor(unmadePick) }));

        expect(screen.getByText(`Manually select pick ${round.round}.${unmadePick.pick_number}`)).toBeInTheDocument();
    });
});

describe('DraftGrid zoom stops are gone', () => {
    it('offers no density control at all', () => {
        renderGrid();

        expect(screen.queryByRole('button', { name: 'Overview' })).toBeNull();
        expect(screen.queryByRole('button', { name: 'Readable' })).toBeNull();
        expect(screen.queryByRole('group', { name: 'Zoom level' })).toBeNull();
    });
});
