import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
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

const searchDataFor = (playerId) => ({
    match_results: [[playerId, '0.000']],
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
    const { container } = render(<PlayerInfoItem {...props} />);
    return { ...props, item: container.querySelector('.single-player-item') };
}

describe('PlayerInfoItem', () => {
    it('shows a free agent as available and offers the Add button', () => {
        const { item } = renderItem(FREE_AGENT_ID);

        // rosteredBy returns null for an id the map doesn't hold, which is what
        // drives the 'Free Agent' fallback rather than a blank team name.
        expect(screen.getByText('Free Agent')).toBeTruthy();
        // The `-available` half of the class list is the only visual signal that
        // a player is still draftable; it is driven purely by isTaken.
        expect(item.className).toContain(`${playerInfo[FREE_AGENT_ID].position}-available`);
        expect(screen.getByRole('button', { name: 'Add' })).toBeEnabled();
    });

    it("shows another manager's player as taken and hides the Add button entirely", () => {
        const { item } = renderItem(OTHERS_PLAYER_ID);

        // The display name has to survive the whole derivation: owner_id ->
        // managerData -> manager_display_name -> rosterInfo -> here.
        expect(screen.getByText('aphilliny21')).toBeTruthy();
        expect(screen.queryByText('Free Agent')).toBeNull();
        expect(item.className).not.toContain('-available');
        expect(screen.queryByRole('button', { name: 'Add' })).toBeNull();
    });

    it('still offers Add for a player already on my own roster', () => {
        // This is the case that makes the `rosteredByName === myDisplayName`
        // clause test-distinguishable. The player is taken, so the `!taken`
        // clause is false and only the display-name comparison can keep the
        // button on screen - dropping that clause would hide Add for every
        // player I own, which is exactly the set I most want to add to a lineup.
        const { item } = renderItem(MY_PLAYER_ID);

        expect(screen.getByText(MY_DISPLAY_NAME)).toBeTruthy();
        expect(item.className).not.toContain('-available');
        expect(screen.getByRole('button', { name: 'Add' })).toBeEnabled();
    });

    it('disables the Add button for a player already in the lineup', () => {
        // The lineup set is built by the real helper rather than a literal Set
        // so the shape stays honest, but what this protects is the component
        // half: that lineupSet reaches the item and drives the button's label
        // and disabled state. buildLineupSet's own numeric filtering is
        // covered directly in lib/rosterInfo.test.js - sabotaging that filter
        // does not fail this test, and this comment used to claim it did.
        const lineupSet = buildLineupSet(['QB', MY_PLAYER_ID, 'FLX', 'BN']);
        renderItem(MY_PLAYER_ID, { lineupSet });

        const added = screen.getByRole('button', { name: 'Added' });
        expect(added).toBeDisabled();
        expect(screen.queryByRole('button', { name: 'Add' })).toBeNull();
    });
});
