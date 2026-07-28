import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DraftGrid from './DraftGrid';
import { pickAccessibleName, managerLabel } from './pickLabels.js';
import { buildRosterInfo, decorateRosters } from '../lib/rosterInfo.js';
import rosterFlagsFixture from '../lib/__fixtures__/roster-flags-2026.json';
import goldenDraft from '../lib/__fixtures__/golden-draft-output.json';

// DraftGrid is the second view of the same board PickFeed already covers, so
// this file only asserts what's specific to the grid: every pick shows up as
// a cell at both zoom stops, the accessible name matches the feed's builder
// exactly (both read off pickLabels.js, so they cannot drift), "mine" marking,
// unmade-vs-made, and that a cell opens the same modal.

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

const setZoom = async (user, label) => {
    await user.click(screen.getByRole('button', { name: label }));
};

describe('DraftGrid cell coverage', () => {
    it('renders every pick in the round as a cell in overview mode', () => {
        renderGrid();

        round.picks.forEach((pick) => {
            expect(screen.getByRole('button', { name: expectedNameFor(pick) })).toBeInTheDocument();
        });
    });

    it('renders every pick in the round as a cell in readable mode too', async () => {
        const user = userEvent.setup();
        renderGrid();

        await setZoom(user, 'Readable');

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
});

describe('DraftGrid your-pick marking', () => {
    it('outlines my own pick and leaves everyone else unmarked', () => {
        renderGrid();

        const myPick = round.picks.find((pick) => pick.pick_number === 3);
        const othersPick = round.picks.find((pick) => pick.pick_number === 1);

        const myCell = screen.getByRole('button', { name: expectedNameFor(myPick) });
        const othersCell = screen.getByRole('button', { name: expectedNameFor(othersPick) });

        expect(myCell.className).toMatch(/outline-mine/);
        expect(othersCell.className).not.toMatch(/outline-mine/);
    });
});

describe('DraftGrid unmade vs made picks', () => {
    it('renders an unmade pick as empty in readable mode rather than as a made pick', async () => {
        const user = userEvent.setup();
        renderGrid();
        await setZoom(user, 'Readable');

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

    it('renders a made pick with the player visible in readable mode', async () => {
        const user = userEvent.setup();
        const filledRound = {
            ...round,
            picks: round.picks.map((pick) => (pick.pick_number === 1 ? { ...pick, player_id: FREE_AGENT.id } : pick)),
        };
        renderGrid({ builtDraft: [filledRound] });
        await setZoom(user, 'Readable');

        const filledPick = filledRound.picks.find((pick) => pick.pick_number === 1);
        const cell = screen.getByRole('button', { name: expectedNameFor(filledPick) });

        expect(within(cell).getByText('M.Klein')).toBeInTheDocument();
    });
});

describe('DraftGrid column identity on a snake board', () => {
    // On a linear board pick_number and board_spot are the same number in
    // every round, so keying the columns off the wrong one looks perfectly
    // correct - the right and wrong answers coincide. Round 2 of the snake
    // fixture reverses: pick_number 1 sits in board_spot 12.
    const snakeBoard = goldenDraft.snake.built_draft;
    const snakeRound2 = snakeBoard[1];

    it('puts a pick in its board_spot column, not its pick_number column', async () => {
        const user = userEvent.setup();
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
        await setZoom(user, 'Readable');

        const reversed = snakeRound2.picks.find((pick) => pick.pick_number === 1);
        expect(reversed.board_spot).not.toBe(reversed.pick_number);

        const row = screen.getByRole('rowheader', { name: 'Round 2' }).closest('tr');
        const cells = within(row).getAllByRole('button');
        const columnIndex = snakeBoard[0].picks
            .map((pick) => pick.board_spot)
            .sort((a, b) => a - b)
            .indexOf(reversed.board_spot);

        expect(cells[columnIndex].getAttribute('aria-label')).toContain('pick 1,');
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

describe('DraftGrid zoom control', () => {
    it('starts in overview, where cells carry no visible player text', () => {
        renderGrid();

        expect(screen.getByRole('button', { name: 'Overview' })).toHaveAttribute('aria-pressed', 'true');
        expect(screen.getByRole('button', { name: 'Readable' })).toHaveAttribute('aria-pressed', 'false');
    });

    it('switches to readable mode on click', async () => {
        const user = userEvent.setup();
        renderGrid();

        await setZoom(user, 'Readable');

        expect(screen.getByRole('button', { name: 'Readable' })).toHaveAttribute('aria-pressed', 'true');
        expect(screen.getByRole('button', { name: 'Overview' })).toHaveAttribute('aria-pressed', 'false');
    });
});
