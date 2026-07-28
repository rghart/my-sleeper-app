import { describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PlayerInfoItem from './PlayerInfoItem';
import { buildLineupSet, buildRosterInfo, decorateRosters } from '../lib/rosterInfo.js';
import rosterFlagsFixture from '../lib/__fixtures__/roster-flags-2026.json';

// PlayerInfoItem is the leaf that consumes all three derived-flag helpers -
// isTaken, rosteredBy and isInLineup - and until now nothing tested that path.
// App.test.jsx renders App for real but with an empty rank list, so no
// PlayerInfoItem is ever constructed there and nothing flag-dependent is
// observable. These tests build rosterInfo through the real derivation
// (decorateRosters -> buildRosterInfo) rather than hand-rolling a Map, so a
// change to how the flags are derived shows up here too.
//
// Availability used to be asserted through `.single-player-item`'s class
// list - exactly the transparency encoding this component's redesign
// replaces. Every assertion below goes through the visible "Free agent" /
// manager-name text, the "Taken" chip, or the row's accessible name instead.

const { rosterDataRaw, managerData, playerInfo } = rosterFlagsFixture;

const rosterData = decorateRosters({ rosterData: rosterDataRaw, managerData });
const rosterInfo = buildRosterInfo({ rosterData, builtDraft: null });

const MY_DISPLAY_NAME = 'ryangh';

// Chosen against the fixture, not invented. 13307 is on nobody's roster - the
// free-agent requirement from the flag-staleness work, where a player who is
// taken for an unrelated reason silently masks the assertion. 13294 is on
// roster 2 (aphilliny21), and 13274 is on roster 1, which is mine.
const FREE_AGENT_ID = '13307';
const OTHERS_PLAYER_ID = '13294';
const MY_PLAYER_ID = '13274';

const searchDataFor = (playerId, matchScore = '0.000') => ({
    match_results: [[playerId, matchScore]],
    ranking: '12',
    search_string: 'a pasted rank line',
});

function renderItem(playerId, { lineupSet = new Set(), ...overrides } = {}) {
    const props = {
        player: playerInfo[playerId],
        playerInfo,
        rosterInfo,
        lineupSet,
        addToRoster: vi.fn(),
        searchData: searchDataFor(playerId),
        updatePlayerId: vi.fn(),
        isNewRankList: false,
        adpData: null,
        myDisplayName: MY_DISPLAY_NAME,
        ...overrides,
    };
    render(<PlayerInfoItem {...props} />);
    return props;
}

describe('PlayerInfoItem', () => {
    it('shows a free agent as available and offers the Add button', () => {
        renderItem(FREE_AGENT_ID);

        // rosteredBy returns null for an id the map doesn't hold, which is what
        // drives the 'Free agent' fallback rather than a blank team name.
        expect(screen.getByText('Free agent')).toBeTruthy();
        expect(
            screen.getByRole('group', {
                name: `${playerInfo[FREE_AGENT_ID].full_name}, ${playerInfo[FREE_AGENT_ID].position}, free agent`,
            }),
        ).toBeTruthy();
        expect(screen.queryByText('Taken')).toBeNull();
        expect(screen.getByRole('button', { name: 'Add' })).toBeEnabled();
    });

    it("shows another manager's player as taken and hides the Add button entirely", () => {
        renderItem(OTHERS_PLAYER_ID);

        // The display name has to survive the whole derivation: owner_id ->
        // managerData -> manager_display_name -> rosterInfo -> here.
        expect(screen.getByText('aphilliny21')).toBeTruthy();
        expect(screen.getByText('Taken')).toBeTruthy();
        expect(screen.queryByText('Free agent')).toBeNull();
        expect(
            screen.getByRole('group', {
                name: `${playerInfo[OTHERS_PLAYER_ID].full_name}, ${playerInfo[OTHERS_PLAYER_ID].position}, taken by aphilliny21`,
            }),
        ).toBeTruthy();
        expect(screen.queryByRole('button', { name: 'Add' })).toBeNull();
    });

    it('still offers Add for a player already on my own roster', () => {
        // This is the case that makes the `rosteredByName === myDisplayName`
        // clause test-distinguishable. The player is taken, so the `!taken`
        // clause is false and only the display-name comparison can keep the
        // button on screen - dropping that clause would hide Add for every
        // player I own, which is exactly the set I most want to add to a lineup.
        renderItem(MY_PLAYER_ID);

        expect(screen.getByText(MY_DISPLAY_NAME)).toBeTruthy();
        expect(screen.getByText('Taken')).toBeTruthy();
        expect(
            screen.getByRole('group', {
                name: `${playerInfo[MY_PLAYER_ID].full_name}, ${playerInfo[MY_PLAYER_ID].position}, taken by ${MY_DISPLAY_NAME} · you`,
            }),
        ).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Add' })).toBeEnabled();
    });

    // The row's "yours" and "low confidence" states are carried by a border
    // colour, and this repo's tests may not assert className - so without
    // these the whole encoding was unfalsifiable: dropping either border left
    // all 316 tests green. The accessible name is where the meaning lives now,
    // which makes it both assertable and audible to a screen reader.
    it('marks your own row in the accessible name, not by border colour alone', () => {
        renderItem(MY_PLAYER_ID);

        const name = screen
            .getByRole('group', { name: new RegExp(`^${playerInfo[MY_PLAYER_ID].full_name}, `) })
            .getAttribute('aria-label');
        expect(name).toContain('· you');

        // Another manager's row must not claim to be yours.
        cleanup();
        renderItem(OTHERS_PLAYER_ID);
        expect(
            screen
                .getByRole('group', { name: new RegExp(`^${playerInfo[OTHERS_PLAYER_ID].full_name}, `) })
                .getAttribute('aria-label'),
        ).not.toContain('· you');
    });

    it('marks a low-confidence match in the accessible name', () => {
        // A non-zero search score is the low-confidence signal - the row used
        // to fill red for it, and now takes the warn border.
        renderItem(FREE_AGENT_ID, { searchData: searchDataFor(FREE_AGENT_ID, '0.420') });

        expect(
            screen
                .getByRole('group', { name: new RegExp(`^${playerInfo[FREE_AGENT_ID].full_name}, `) })
                .getAttribute('aria-label'),
        ).toContain('low confidence match');
    });

    it('shows a confident match without the low-confidence marker', () => {
        renderItem(FREE_AGENT_ID);

        expect(
            screen
                .getByRole('group', { name: new RegExp(`^${playerInfo[FREE_AGENT_ID].full_name}, `) })
                .getAttribute('aria-label'),
        ).not.toContain('low confidence');
    });

    it('renders the position chip from the player, not a hardcoded position', () => {
        // Nothing asserted the chip's visible text, so rendering a constant
        // there passed the entire suite.
        renderItem(FREE_AGENT_ID);

        expect(screen.getByText(playerInfo[FREE_AGENT_ID].position)).toBeVisible();
    });

    it('disables the Add button for a player already in the lineup', () => {
        // The lineup set is built by the real helper rather than a literal Set
        // so the shape stays honest, but what this protects is the component
        // half: that lineupSet reaches the item and drives the button's label
        // and disabled state. buildLineupSet's own occupancy logic is covered
        // directly in lib/rosterInfo.test.js - sabotaging it does not fail this
        // test, and this comment used to claim it did.
        const lineupSet = buildLineupSet([
            { label: 'QB', playerId: null },
            { label: 'WR', playerId: MY_PLAYER_ID },
            { label: 'FLX', playerId: null },
        ]);
        renderItem(MY_PLAYER_ID, { lineupSet });

        const added = screen.getByRole('button', { name: 'Added' });
        expect(added).toBeDisabled();
        expect(screen.queryByRole('button', { name: 'Add' })).toBeNull();
    });

    it('flags a low-confidence match through the search score text, without hiding it behind a colour fill', async () => {
        // Score > 0 is the low-confidence signal (see updatePlayerInfo's
        // '0.000' for a fresh manual pick, which is the confident case). The
        // row border itself isn't asserted by a role/name query, so this
        // leans on the one thing that IS queryable: the search-score text,
        // which only renders once the row is opened for editing.
        const user = userEvent.setup();
        renderItem(FREE_AGENT_ID, { searchData: searchDataFor(FREE_AGENT_ID, '0.850') });

        await user.click(screen.getByRole('button', { name: playerInfo[FREE_AGENT_ID].full_name }));

        expect(
            screen.getByText((_content, element) => element?.tagName === 'P' && element.textContent.includes('0.850')),
        ).toBeTruthy();
    });

    it('opens the edit dropdown and switches to a different match', async () => {
        const user = userEvent.setup();
        const updatePlayerId = vi.fn();
        // Two candidates so a real switch is possible - a single-result
        // match_results (the default fixture) only ever offers the player
        // already showing, which can't distinguish "switched" from "did
        // nothing".
        const searchData = {
            match_results: [
                [FREE_AGENT_ID, '0.000'],
                [OTHERS_PLAYER_ID, '0.000'],
            ],
            ranking: '12',
            search_string: 'a pasted rank line',
        };
        renderItem(FREE_AGENT_ID, { updatePlayerId, searchData });

        await user.click(screen.getByRole('button', { name: playerInfo[FREE_AGENT_ID].full_name }));

        const select = screen.getByRole('combobox');
        expect(select).toBeTruthy();

        await user.selectOptions(select, OTHERS_PLAYER_ID);

        expect(updatePlayerId).toHaveBeenCalledTimes(1);
        const newSearchData = updatePlayerId.mock.calls[0][0];
        expect(newSearchData.match_results[0][0]).toBe(OTHERS_PLAYER_ID);
    });

    it('deletes the row via the edit dropdown', async () => {
        const user = userEvent.setup();
        const updatePlayerId = vi.fn();
        renderItem(FREE_AGENT_ID, { updatePlayerId });

        await user.click(screen.getByRole('button', { name: playerInfo[FREE_AGENT_ID].full_name }));
        await user.click(screen.getByRole('button', { name: 'Delete' }));

        expect(updatePlayerId).toHaveBeenCalledWith(expect.anything(), true);
    });

    it('reports ranked-before-ADP, matches-ADP, and ranked-after-ADP', () => {
        const { rerender } = render(
            <PlayerInfoItem
                player={playerInfo[FREE_AGENT_ID]}
                playerInfo={playerInfo}
                rosterInfo={rosterInfo}
                lineupSet={new Set()}
                addToRoster={vi.fn()}
                searchData={{ ...searchDataFor(FREE_AGENT_ID), ranking: '10' }}
                updatePlayerId={vi.fn()}
                isNewRankList={false}
                adpData={15}
                myDisplayName={MY_DISPLAY_NAME}
            />,
        );
        expect(screen.getByText('Ranked 5 picks before ADP')).toBeTruthy();

        rerender(
            <PlayerInfoItem
                player={playerInfo[FREE_AGENT_ID]}
                playerInfo={playerInfo}
                rosterInfo={rosterInfo}
                lineupSet={new Set()}
                addToRoster={vi.fn()}
                searchData={{ ...searchDataFor(FREE_AGENT_ID), ranking: '15' }}
                updatePlayerId={vi.fn()}
                isNewRankList={false}
                adpData={15}
                myDisplayName={MY_DISPLAY_NAME}
            />,
        );
        expect(screen.getByText('Rank matches ADP')).toBeTruthy();

        rerender(
            <PlayerInfoItem
                player={playerInfo[FREE_AGENT_ID]}
                playerInfo={playerInfo}
                rosterInfo={rosterInfo}
                lineupSet={new Set()}
                addToRoster={vi.fn()}
                searchData={{ ...searchDataFor(FREE_AGENT_ID), ranking: '20' }}
                updatePlayerId={vi.fn()}
                isNewRankList={false}
                adpData={15}
                myDisplayName={MY_DISPLAY_NAME}
            />,
        );
        expect(screen.getByText('Ranked 5 picks after ADP')).toBeTruthy();
    });
});
