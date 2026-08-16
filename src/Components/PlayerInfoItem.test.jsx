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

describe('PlayerInfoItem FAAB', () => {
    const price = (attrs) => ({ median: 12, low: 0, high: 40, claims: 8, leagues: 7, failed: 3, ...attrs });

    // The availability words are the trigger — the meta line has no room for
    // a chip, measured at 155px with 145 already spent.
    it('makes a gettable player price tappable, and opens the distribution', async () => {
        const user = userEvent.setup();
        renderItem(FREE_AGENT_ID, { faabPrice: price(), faabWindow: 'Dec 2025 – Aug 2026' });

        await user.click(screen.getByTestId('faab-tip'));

        expect(screen.getByText('Typically 12% of budget')).toBeInTheDocument();
        expect(screen.getByText('0% to 40%')).toBeInTheDocument();
        expect(screen.getByText('8 claims in 7 leagues')).toBeInTheDocument();
        expect(screen.getByText('3 more claims did not go through')).toBeInTheDocument();
        expect(screen.getByText(/Offseason claims, Dec 2025 – Aug 2026/)).toBeInTheDocument();
    });

    // A price on a player locked up on someone else's roster is trivia.
    it('offers nothing on a player who is already taken', () => {
        renderItem(OTHERS_PLAYER_ID, { faabPrice: price() });

        expect(screen.queryByTestId('faab-tip')).not.toBeInTheDocument();
    });

    it('leaves the row alone when nobody in the corpus has claimed him', () => {
        renderItem(FREE_AGENT_ID, { faabPrice: undefined });

        expect(screen.queryByTestId('faab-tip')).not.toBeInTheDocument();
        expect(screen.getByText('Free agent')).toBeInTheDocument();
    });

    // The trigger lived on the meta line first and was unreachable there: on
    // any row carrying a value *and* a change it ellipsised away. It belongs
    // beside the name, where the width is measured and available.
    it('keeps the trigger off the meta line, which cannot hold it', () => {
        renderItem(FREE_AGENT_ID, { faabPrice: price() });

        const availability = screen.getByText('Free agent');
        expect(availability.closest('[data-testid="faab-tip"]')).toBeNull();
    });

    it('sits alongside an injury badge rather than replacing it', () => {
        renderItem(FREE_AGENT_ID, {
            player: { ...playerInfo[FREE_AGENT_ID], injury_status: 'Questionable' },
            faabPrice: price(),
        });

        expect(screen.getByTestId('injury-tag')).toBeInTheDocument();
        expect(screen.getByTestId('faab-tip')).toBeInTheDocument();
    });

    it('weakens the claim when the sample is thin', async () => {
        const user = userEvent.setup();
        renderItem(FREE_AGENT_ID, { faabPrice: price({ claims: 1, leagues: 1 }) });

        await user.click(screen.getByTestId('faab-tip'));

        expect(screen.getByText('Went for 12% of budget, once')).toBeInTheDocument();
    });
});

describe('PlayerInfoItem injury', () => {
    // Injury status and body part come from Sleeper's player dump; the
    // expected return date rides on the value row, because only KeepTradeCut
    // publishes one. The two arrive by different routes and the row has to
    // read either without the other.
    const injured = (attrs) => ({ ...playerInfo[FREE_AGENT_ID], ...attrs });

    it('badges an injured player and spells the status out in the name', () => {
        renderItem(FREE_AGENT_ID, {
            player: injured({ injury_status: 'Questionable', injury_body_part: 'Hamstring' }),
        });

        expect(screen.getByTestId('injury-tag')).toHaveTextContent('Q');
        expect(screen.getByRole('group', { name: /questionable, hamstring/i })).toBeInTheDocument();
    });

    // The detail is a popover rather than meta-line text because that line is
    // measurably full — 145px of content in 155px of room at 375px.
    it('opens the detail, with the return date, when the badge is tapped', async () => {
        const user = userEvent.setup();
        renderItem(FREE_AGENT_ID, {
            player: injured({ injury_status: 'Questionable', injury_body_part: 'Hamstring' }),
            marketValue: { value: 4300, changePct: null, injuryReturn: '2026-08-22' },
        });

        await user.click(screen.getByTestId('injury-tag'));

        expect(screen.getByText('Hamstring')).toBeInTheDocument();
        expect(screen.getByText(/Expected (back|due back) Aug 22/)).toBeInTheDocument();
    });

    // Real behaviour, but structurally guaranteed rather than defended: the
    // badge is a sibling of the name button, so nothing propagates. Kept as a
    // regression guard on that structure, not as cover for the
    // `stopPropagation` call, which sabotage shows no test can currently reach.
    it('does not open the edit form when the badge is tapped', async () => {
        const user = userEvent.setup();
        renderItem(FREE_AGENT_ID, { player: injured({ injury_status: 'IR' }) });

        await user.click(screen.getByTestId('injury-tag'));

        expect(screen.queryByPlaceholderText('Manually update player')).not.toBeInTheDocument();
    });

    it('keeps the meta line free of injury text, which does not fit on it', () => {
        renderItem(FREE_AGENT_ID, {
            player: injured({ injury_status: 'Questionable', injury_body_part: 'Hamstring' }),
            marketValue: { value: 4300, changePct: null, injuryReturn: '2026-08-22' },
        });

        expect(screen.queryByText(/· Hamstring/)).not.toBeInTheDocument();
    });

    it('shows the injury even when the market has never seen the player', () => {
        // A rank list holds players with no value entry at all, and the
        // injury is the half that does not depend on one.
        renderItem(FREE_AGENT_ID, {
            player: injured({ injury_status: 'IR' }),
            marketValue: undefined,
        });

        expect(screen.getByTestId('injury-tag')).toHaveTextContent('IR');
    });

    it('leaves a healthy player exactly as he was', () => {
        renderItem(FREE_AGENT_ID);

        expect(screen.queryByTestId('injury-tag')).not.toBeInTheDocument();
        expect(screen.getByRole('group', { name: /free agent$/i })).toBeInTheDocument();
    });

    // The trap this whole mapping exists for: 61 players carry `NA`, which is
    // not an injury.
    it('does not badge a player whose status is NA', () => {
        renderItem(FREE_AGENT_ID, { player: injured({ injury_status: 'NA' }) });

        expect(screen.queryByTestId('injury-tag')).not.toBeInTheDocument();
    });
});

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
        // The "Taken" label is only for someone else's player now - your own
        // taken player still gets the Add/Added pill instead, not both.
        expect(screen.queryByText('Taken')).toBeNull();
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

    // The old two-line "ADP: 15" / "Ranked N picks before ADP" prose is gone
    // from the display state - it is a single signed delta now (see
    // ListRow's `trailing` in PlayerInfoItem): negative (ranked ahead of ADP)
    // in text-live, positive (ranked behind) in text-warn, zero in
    // text-ink-dim.
    it('renders the ADP delta signed, coloured by direction: ahead, matching, and behind', () => {
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
        expect(screen.getByText('-5')).toHaveClass('text-live');

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
        expect(screen.getByText('0')).toHaveClass('text-ink-dim');

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
        expect(screen.getByText('+5')).toHaveClass('text-warn');
    });

    it('omits the ADP delta column entirely when there is no ADP data', () => {
        renderItem(FREE_AGENT_ID, { adpData: null });

        expect(screen.queryByTestId('adp-delta')).toBeNull();
    });
});
