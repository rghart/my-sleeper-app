import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LineupPanel from './LineupPanel';
import { buildRosterInfo, decorateRosters } from '../lib/rosterInfo.js';
import rosterFlagsFixture from '../lib/__fixtures__/roster-flags-2026.json';

const { rosterDataRaw, managerData, playerInfo: fixturePlayerInfo } = rosterFlagsFixture;
const rosterData = decorateRosters({ rosterData: rosterDataRaw, managerData });
const rosterInfo = buildRosterInfo({ rosterData, builtDraft: null });
const MY_DISPLAY_NAME = 'ryangh';

const STARTER = {
    player_id: '13274',
    full_name: 'Germie Bernard',
    first_name: 'Germie',
    last_name: 'Bernard',
    position: 'WR',
    // Needed for the eligibility filter, which reads `fantasy_positions`
    // rather than `position` - a slot's admitted positions are checked against
    // this list, so an occupant without one is eligible for nothing and never
    // appears as a candidate at all.
    fantasy_positions: ['WR'],
    team: 'LV',
};

const PLAYER_INFO = { ...fixturePlayerInfo, [STARTER.player_id]: STARTER };
const MISSING_ID = '999999';

// Both free agents in the shared roster-flags fixture, so no second fixture
// has to be maintained. FREE_AGENT_TE is eligible for neither QB nor WR (no
// FLX among ROSTER_SLOTS' open slots below), so it exercises "the handle
// shows regardless of eligibility" without being a candidate to add;
// FREE_AGENT_QB is eligible for the open QB slot and is what the Add test
// selects.
const FREE_AGENT_TE = { id: '13307', name: 'Marlin Klein' };
const FREE_AGENT_QB = { id: '289', name: 'Drew Brees' };

const rankEntry = (playerId, ranking) => ({
    match_results: [[playerId, '0.000']],
    ranking,
    search_string: 'a pasted rank line',
});

// The filled slot is deliberately a FLX holding a WR: the label and the
// occupant's position must differ, or rendering the position instead of the
// label looks identical and the assertion proves nothing. A WR in a WR slot
// hides exactly the bug this is here to catch.
const ROSTER_SLOTS = [
    { label: 'QB', playerId: null },
    { label: 'FLX', playerId: STARTER.player_id },
    { label: 'WR', playerId: null },
];

const SAVED_RANK_LISTS = { default: { pretty_name: '-- Select saved ranks list', route_name: 'default' } };

function renderLineup(overrides = {}) {
    const removeFromLineup = vi.fn();
    const addToRoster = vi.fn();
    const fillSlot = vi.fn();
    const { unmount } = render(
        <LineupPanel
            playerInfo={PLAYER_INFO}
            rosterInfo={rosterInfo}
            rosterSlots={ROSTER_SLOTS}
            removeFromLineup={removeFromLineup}
            rankingPlayersIdsList={[]}
            myDisplayName={MY_DISPLAY_NAME}
            addToRoster={addToRoster}
            fillSlot={fillSlot}
            savedRankLists={SAVED_RANK_LISTS}
            savedRankListsLoading={false}
            signedIn={false}
            {...overrides}
        />,
    );
    return { removeFromLineup, addToRoster, fillSlot, unmount };
}

describe('LineupPanel', () => {
    it('labels a filled slot by the slot, not the occupant - a WR in FLX reads FLX', () => {
        renderLineup();

        // The label and the position chip disagree on purpose: a WR sitting
        // in a FLX slot must read FLX, never WR.
        expect(screen.getByRole('button', { name: 'FLX, Germie Bernard, WR' })).toBeTruthy();
        expect(screen.queryByRole('button', { name: 'WR, Germie Bernard, WR' })).toBeNull();

        // The rendered label, not just the accessible name. Swapping the
        // visible label for the occupant's position left the name correct and
        // every test green - the two are built from different expressions, so
        // one of them passing says nothing about the other.
        expect(screen.getByText('FLX')).toBeVisible();
    });

    it('renders every slot, filled or empty, as a real button - both open the scoped sheet now', () => {
        renderLineup();

        // A single tap must not be destructive any more: removal moved into
        // the sheet's own Remove action (see the describe block below), so
        // every slot - including an empty one, which used to be a bare
        // non-interactive row - is a button that opens it.
        expect(screen.getByRole('button', { name: 'QB, empty' })).toBeTruthy();
        expect(screen.getByRole('button', { name: 'WR, empty' })).toBeTruthy();
        expect(screen.getByRole('button', { name: 'FLX, Germie Bernard, WR' })).toBeTruthy();
    });

    it('opens the slot-scoped sheet on a tap, titled for that slot, whether the slot is empty or filled', async () => {
        const user = userEvent.setup();
        renderLineup();

        await user.click(screen.getByRole('button', { name: 'QB, empty' }));
        expect(screen.getByRole('dialog', { name: 'Fill QB' })).toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: 'Close' }));
        expect(screen.queryByRole('dialog')).toBeNull();

        // Tapping a filled slot opens the same sheet, under the same title -
        // the design doc is explicit that the occupant appears inside it
        // rather than the slot getting a different sheet altogether.
        await user.click(screen.getByRole('button', { name: 'FLX, Germie Bernard, WR' }));
        expect(screen.getByRole('dialog', { name: 'Fill FLX' })).toBeInTheDocument();
    });

    it('shows a muted count of unfilled slots, omitted entirely when zero', () => {
        const { unmount } = renderLineup();
        expect(screen.getByText('2 empty')).toBeTruthy();
        unmount();

        const fullSlots = [{ label: 'QB', playerId: STARTER.player_id }];
        renderLineup({ rosterSlots: fullSlots });
        expect(screen.queryByText(/empty$/)).toBeNull();
    });

    it('renders a slot holding an id missing from the player database, and keeps it removable via the sheet', async () => {
        const user = userEvent.setup();
        const slots = [{ label: 'TE', playerId: MISSING_ID }];
        const { removeFromLineup } = renderLineup({ rosterSlots: slots });

        const row = screen.getByRole('button', { name: `TE, Unknown player ${MISSING_ID}` });
        expect(row).toBeTruthy();

        // Asserted on screen, not only in the accessible name: the two were
        // built by separate expressions and disagreed here - the row showed a
        // bare id while the name said "Unknown player <id>". Checking the name
        // alone is what let that through.
        expect(screen.getByText(`Unknown player ${MISSING_ID}`)).toBeVisible();

        await user.click(row);
        await user.click(screen.getByRole('button', { name: 'Remove' }));
        expect(removeFromLineup).toHaveBeenCalledWith(0);
        // Remove is the one action that closes the sheet - unlike a fill.
        expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('shows the occupant name and team on screen, and a placeholder for an unfilled slot', () => {
        renderLineup();

        expect(screen.getByText(STARTER.full_name)).toBeVisible();
        // The second line is the team alone - there is no schedule data in
        // this app, so an opponent here would have to be invented.
        expect(screen.getByText(STARTER.team)).toBeVisible();
        // An empty slot reads "Add player" / "Empty slot" rather than a
        // dashed box - the dashed border was exactly the blockiness this
        // redesign removes.
        expect(screen.getAllByText('Add player')).toHaveLength(2);
        expect(screen.getAllByText('Empty slot')).toHaveLength(2);
    });
});

describe('LineupPanel injury', () => {
    // A lineup slot is where an injury matters most and where the return date
    // is least available: this panel fetches no values, so it shows the status
    // and body part and says nothing about when he is back.
    const hurt = (attrs) => ({
        ...PLAYER_INFO,
        [STARTER.player_id]: { ...STARTER, ...attrs },
    });

    it('badges a hurt starter and puts the detail on the meta line', () => {
        renderLineup({ playerInfo: hurt({ injury_status: 'Questionable', injury_body_part: 'Hamstring' }) });

        expect(screen.getByTestId('injury-tag')).toHaveTextContent('Q');
        expect(screen.getByText(/LV · Q · Hamstring/)).toBeInTheDocument();
    });

    it('spells the status out in the slot name', () => {
        renderLineup({ playerInfo: hurt({ injury_status: 'IR' }) });

        expect(screen.getByRole('button', { name: /on injured reserve/i })).toBeInTheDocument();
    });

    it('leaves a healthy starter row unchanged', () => {
        renderLineup();

        expect(screen.queryByTestId('injury-tag')).not.toBeInTheDocument();
        expect(screen.getByText('LV')).toBeInTheDocument();
    });
});

describe('LineupPanel best-available sheet', () => {
    it('shows the handle, filtered to the open slots, when there are open slots and a rank list', () => {
        renderLineup({ rankingPlayersIdsList: [rankEntry(FREE_AGENT_TE.id, 1)] });

        // ROSTER_SLOTS has two open slots: QB and WR.
        expect(screen.getByRole('button', { name: /Best available/ })).toHaveTextContent('fills QB, WR');
    });

    it('hides the handle entirely once every slot is filled', () => {
        renderLineup({ rosterSlots: [{ label: 'QB', playerId: STARTER.player_id }] });

        expect(screen.queryByRole('button', { name: /Best available/ })).toBeNull();
    });

    // Same reasoning as DraftPanel's: the handle opens whether or not a list
    // is loaded, because the switcher that loads one lives inside the sheet.
    it('still opens, with a rank-list switcher inside, when no list is selected yet', async () => {
        const user = userEvent.setup();
        renderLineup({ rankingPlayersIdsList: [] });

        const handle = screen.getByRole('button', { name: /Best available/ });
        expect(handle).toHaveTextContent('Paste a rank list');

        await user.click(handle);
        const dialog = screen.getByRole('dialog', { name: 'Best available' });

        expect(within(dialog).getByRole('button', { name: /^Rank list/ })).toBeInTheDocument();
        expect(within(dialog).getByText(/No rank list selected/)).toBeInTheDocument();
    });

    it('fills the first eligible open slot on Add, and the sheet stays open', async () => {
        const user = userEvent.setup();
        const { addToRoster } = renderLineup({ rankingPlayersIdsList: [rankEntry(FREE_AGENT_QB.id, 1)] });

        await user.click(screen.getByRole('button', { name: /Best available/ }));
        const dialog = screen.getByRole('dialog', { name: 'Best available' });
        await user.click(screen.getByRole('button', { name: 'Add' }));

        expect(addToRoster).toHaveBeenCalledWith(fixturePlayerInfo[FREE_AGENT_QB.id]);
        // Unlike the Draft sheet, adding a player here does not close the
        // sheet - it stays open so several slots can be filled in a row.
        expect(dialog).toBeInTheDocument();
        expect(screen.getByRole('dialog', { name: 'Best available' })).toBeInTheDocument();
    });
});

describe('LineupPanel slot-scoped sheet', () => {
    // A free agent RB, absent from the shared fixture's actual free agents -
    // built by hand so a TE-scoped sheet has a real "hide this one" case to
    // assert against, rather than only a "show this one".
    const FREE_AGENT_RB = { id: '55501', name: 'Test Runningback' };
    const RB_PLAYER_INFO = {
        ...PLAYER_INFO,
        [FREE_AGENT_RB.id]: {
            player_id: FREE_AGENT_RB.id,
            full_name: FREE_AGENT_RB.name,
            position: 'RB',
            fantasy_positions: ['RB'],
            team: 'FA',
        },
    };
    const TE_AND_RB_SLOTS = [
        { label: 'TE', playerId: null },
        { label: 'RB', playerId: null },
    ];
    const TE_AND_RB_ENTRIES = [rankEntry(FREE_AGENT_TE.id, 1), rankEntry(FREE_AGENT_RB.id, 2)];

    it('scopes to the tapped slot, showing an eligible TE and hiding an RB', async () => {
        const user = userEvent.setup();
        renderLineup({
            rosterSlots: TE_AND_RB_SLOTS,
            rankingPlayersIdsList: TE_AND_RB_ENTRIES,
            playerInfo: RB_PLAYER_INFO,
        });

        await user.click(screen.getByRole('button', { name: 'TE, empty' }));

        expect(screen.getByRole('dialog', { name: 'Fill TE' })).toBeInTheDocument();
        expect(screen.getByText(FREE_AGENT_TE.name)).toBeInTheDocument();
        expect(screen.queryByText(FREE_AGENT_RB.name)).toBeNull();
    });

    it('widens to every open slot on ALL, without dropping the underlying list', async () => {
        const user = userEvent.setup();
        renderLineup({
            rosterSlots: TE_AND_RB_SLOTS,
            rankingPlayersIdsList: TE_AND_RB_ENTRIES,
            playerInfo: RB_PLAYER_INFO,
        });

        await user.click(screen.getByRole('button', { name: 'TE, empty' }));
        expect(screen.queryByText(FREE_AGENT_RB.name)).toBeNull();

        await user.click(screen.getByRole('button', { name: 'ALL' }));

        expect(screen.getByText(FREE_AGENT_TE.name)).toBeInTheDocument();
        expect(screen.getByText(FREE_AGENT_RB.name)).toBeInTheDocument();
    });

    it('fills the exact tapped slot on Add, not the first eligible open one', async () => {
        const user = userEvent.setup();
        const { fillSlot, addToRoster } = renderLineup({
            // RB (index 0) is also open and eligible for nothing here since
            // the rank list holds only a TE - so this also proves the fill
            // isn't accidentally landing on RB by search order.
            rosterSlots: [
                { label: 'RB', playerId: null },
                { label: 'TE', playerId: null },
            ],
            rankingPlayersIdsList: [rankEntry(FREE_AGENT_TE.id, 1)],
        });

        await user.click(screen.getByRole('button', { name: 'TE, empty' }));
        await user.click(screen.getByRole('button', { name: 'Add' }));

        expect(fillSlot).toHaveBeenCalledWith(1, fixturePlayerInfo[FREE_AGENT_TE.id]);
        expect(addToRoster).not.toHaveBeenCalled();
    });

    it("replaces a filled slot's occupant on Add, via fillSlot rather than addToRoster", async () => {
        const user = userEvent.setup();
        const { fillSlot, addToRoster } = renderLineup({
            rosterSlots: [{ label: 'FLX', playerId: STARTER.player_id }],
            rankingPlayersIdsList: [rankEntry(FREE_AGENT_TE.id, 1)],
        });

        await user.click(screen.getByRole('button', { name: 'FLX, Germie Bernard, WR' }));
        // The occupant renders first, with Remove rather than Add - scoped to
        // the dialog, since the same name still shows in the SlotRow behind
        // it, which stays mounted underneath the sheet.
        const dialog = screen.getByRole('dialog', { name: 'Fill FLX' });
        expect(within(dialog).getByText(STARTER.full_name)).toBeInTheDocument();
        expect(within(dialog).getByRole('button', { name: 'Remove' })).toBeInTheDocument();

        await user.click(within(dialog).getByRole('button', { name: 'Add' }));

        expect(fillSlot).toHaveBeenCalledWith(0, fixturePlayerInfo[FREE_AGENT_TE.id]);
        expect(addToRoster).not.toHaveBeenCalled();
    });
});

describe('LineupPanel rank-list switcher', () => {
    const SAVED_LIST_ID = 'my_rankings';
    // A different QB from the fixture than FREE_AGENT_QB, so the saved
    // list's row is distinguishable on screen from the session list's.
    const SAVED_LIST_QB = { id: '167', name: 'Tom Brady' };

    it('re-filters the rows in place on a list switch, without closing the sheet or losing the slot scope', async () => {
        const user = userEvent.setup();
        renderLineup({
            rosterSlots: [{ label: 'QB', playerId: null }],
            rankingPlayersIdsList: [rankEntry(FREE_AGENT_QB.id, 1)],
            signedIn: true,
            savedRankLists: {
                ...SAVED_RANK_LISTS,
                [SAVED_LIST_ID]: {
                    pretty_name: 'My Rankings',
                    route_name: SAVED_LIST_ID,
                    rank_list: [rankEntry(SAVED_LIST_QB.id, 1)],
                },
            },
        });

        await user.click(screen.getByRole('button', { name: 'QB, empty' }));
        expect(screen.getByText(FREE_AGENT_QB.name)).toBeInTheDocument();
        expect(screen.queryByText(SAVED_LIST_QB.name)).toBeNull();

        await user.click(screen.getByRole('button', { name: /^Rank list/ }));
        await user.click(screen.getByRole('button', { name: /^My Rankings/ }));

        // Still open, still scoped to QB, and now showing the saved list's
        // player instead of the session one - a re-filter, not a reset.
        expect(screen.getByRole('dialog', { name: 'Fill QB' })).toBeInTheDocument();
        expect(screen.queryByText(FREE_AGENT_QB.name)).toBeNull();
        expect(screen.getByText(SAVED_LIST_QB.name)).toBeInTheDocument();
    });

    it('shows only the session list and the paste action when signed out', async () => {
        const user = userEvent.setup();
        renderLineup({
            rosterSlots: [{ label: 'QB', playerId: null }],
            rankingPlayersIdsList: [rankEntry(FREE_AGENT_QB.id, 1)],
            signedIn: false,
            savedRankLists: {
                ...SAVED_RANK_LISTS,
                [SAVED_LIST_ID]: {
                    pretty_name: 'My Rankings',
                    route_name: SAVED_LIST_ID,
                    rank_list: [rankEntry(SAVED_LIST_QB.id, 1)],
                },
            },
        });

        await user.click(screen.getByRole('button', { name: 'QB, empty' }));
        await user.click(screen.getByRole('button', { name: /^Rank list/ }));

        expect(screen.queryByRole('button', { name: /^My Rankings/ })).toBeNull();
        expect(screen.getByRole('button', { name: 'Paste a new list' })).toBeInTheDocument();
    });
});

// The sheet's job is "who can I put here?", and by default that means your own
// players plus anything unowned. Before the FILTERS chip existed it listed
// every ranked player eligible for the slot, including ones locked on other
// managers' rosters, marked "Taken" - visible but unusable, and the majority of
// a real list mid-season.
describe('LineupPanel ownership filters', () => {
    const MINE_WR = { id: '13279', name: 'Carnell Tate' }; // roster 1 - ryangh, rookie
    const OTHERS_WR = { id: '13294', name: 'Makai Lemon' }; // roster 2
    const FREE_WR = { id: '536', name: 'Antonio Brown' }; // unowned, 12 years exp

    const openWrSheet = async (user, overrides = {}) => {
        renderLineup({
            rankingPlayersIdsList: [rankEntry(MINE_WR.id, 1), rankEntry(OTHERS_WR.id, 2), rankEntry(FREE_WR.id, 3)],
            ...overrides,
        });
        await user.click(screen.getByRole('button', { name: 'WR, empty' }));
        return screen.getByRole('dialog', { name: 'Fill WR' });
    };

    const openFilters = async (user) => user.click(screen.getByRole('button', { name: /^FILTERS/ }));

    it('hides players on other managers rosters by default, and counts the two live buckets', async () => {
        const user = userEvent.setup();
        const dialog = await openWrSheet(user);

        expect(within(dialog).getByText(MINE_WR.name)).toBeInTheDocument();
        expect(within(dialog).getByText(FREE_WR.name)).toBeInTheDocument();
        // The whole point: not shown at all, not shown-and-greyed.
        expect(within(dialog).queryByText(OTHERS_WR.name)).toBeNull();
        expect(within(dialog).queryByText('Taken')).toBeNull();

        expect(within(dialog).getByRole('button', { name: 'FILTERS · 2' })).toBeInTheDocument();
    });

    it('shows other rosters once asked, and says so in the chip count', async () => {
        const user = userEvent.setup();
        const dialog = await openWrSheet(user);

        await openFilters(user);
        await user.click(screen.getByRole('checkbox', { name: /Other rosters/ }));

        expect(within(dialog).getByText(OTHERS_WR.name)).toBeInTheDocument();
        expect(within(dialog).getByText('Taken')).toBeInTheDocument();
        expect(within(dialog).getByRole('button', { name: 'FILTERS · 3' })).toBeInTheDocument();
    });

    // Same shape as the bug reported on the Ranks section: a control that
    // dismissed its own container on mousedown, so the click that would have
    // toggled it never landed. Two toggles in a row is what proves the popover
    // survived the first.
    it('keeps the popover open across successive toggles rather than dismissing itself', async () => {
        const user = userEvent.setup();
        await openWrSheet(user);

        await openFilters(user);
        await user.click(screen.getByRole('checkbox', { name: /Other rosters/ }));

        expect(screen.getByRole('checkbox', { name: /Other rosters/ })).toHaveAttribute('aria-checked', 'true');

        await user.click(screen.getByRole('checkbox', { name: /My players/ }));

        expect(screen.getByRole('checkbox', { name: /My players/ })).toHaveAttribute('aria-checked', 'false');
        expect(screen.queryByText(MINE_WR.name)).toBeNull();
    });

    it('drops veterans when rookies only is on, and puts everything back on reset', async () => {
        const user = userEvent.setup();
        const dialog = await openWrSheet(user);

        await openFilters(user);
        await user.click(screen.getByRole('switch', { name: 'Rookies only' }));

        expect(within(dialog).queryByText(FREE_WR.name)).toBeNull();
        expect(within(dialog).getByText(MINE_WR.name)).toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: 'Reset to default' }));

        expect(within(dialog).getByText(FREE_WR.name)).toBeInTheDocument();
        expect(within(dialog).getByRole('button', { name: 'FILTERS · 2' })).toBeInTheDocument();
    });

    // Ownership is held by LineupPanel, not by the sheet, precisely because the
    // sheet is unmounted on close - a scope kept inside it would silently
    // reset itself every time.
    it('remembers the scope across closing and reopening the sheet', async () => {
        const user = userEvent.setup();
        await openWrSheet(user);

        await openFilters(user);
        await user.click(screen.getByRole('checkbox', { name: /Other rosters/ }));
        await user.keyboard('{Escape}'); // closes the popover
        await user.click(screen.getByRole('button', { name: 'Close' }));

        await user.click(screen.getByRole('button', { name: 'WR, empty' }));
        const reopened = screen.getByRole('dialog', { name: 'Fill WR' });

        expect(within(reopened).getByText(OTHERS_WR.name)).toBeInTheDocument();
        expect(within(reopened).getByRole('button', { name: 'FILTERS · 3' })).toBeInTheDocument();
    });
});

// The slot chips narrow the list to one slot's eligible positions. This is the
// other half of "who can I put here?" - FLX admits RB/WR/TE, SFLX adds QB, and
// a named position slot admits only itself.
describe('LineupPanel slot chip filtering', () => {
    const FREE_WR = { id: '536', name: 'Antonio Brown' };

    it('filters to the tapped slot position, and widens again on ALL', async () => {
        const user = userEvent.setup();
        renderLineup({
            rankingPlayersIdsList: [rankEntry(FREE_AGENT_QB.id, 1), rankEntry(FREE_WR.id, 2)],
        });

        await user.click(screen.getByRole('button', { name: 'WR, empty' }));
        const dialog = screen.getByRole('dialog', { name: 'Fill WR' });

        expect(within(dialog).getByText(FREE_WR.name)).toBeInTheDocument();
        expect(within(dialog).queryByText(FREE_AGENT_QB.name)).toBeNull();

        // ALL drops the position filter but keeps the list and the ownership
        // scope - the QB is only reachable through the other open slot.
        await user.click(within(dialog).getByRole('button', { name: 'ALL' }));
        expect(within(dialog).getByText(FREE_AGENT_QB.name)).toBeInTheDocument();

        await user.click(within(dialog).getByRole('button', { name: 'QB' }));
        expect(within(dialog).getByText(FREE_AGENT_QB.name)).toBeInTheDocument();
        expect(within(dialog).queryByText(FREE_WR.name)).toBeNull();
    });
});

// Adding a player who already fills another slot would silently move them:
// fillSlot writes the id into the tapped slot and never checks the rest of the
// lineup, so the same player would end up in two slots on screen and one of
// them would be a lie. The list says so instead.
describe('LineupPanel already-started players', () => {
    const buildLineupSet = (slots) => new Set(slots.filter((slot) => slot.playerId).map((slot) => slot.playerId));

    it('offers no Add for a player already in a slot, and says why in the name', async () => {
        const user = userEvent.setup();
        // STARTER is a WR sitting in the FLX slot of ROSTER_SLOTS, so opening
        // the open WR slot lists him as a candidate for it.
        renderLineup({
            rankingPlayersIdsList: [rankEntry(STARTER.player_id, 1)],
            lineupSet: buildLineupSet(ROSTER_SLOTS),
        });

        await user.click(screen.getByRole('button', { name: 'WR, empty' }));
        const dialog = screen.getByRole('dialog', { name: 'Fill WR' });

        const row = within(dialog).getByRole('button', { name: 'Started' });
        expect(row).toBeDisabled();
        expect(within(dialog).queryByRole('button', { name: 'Add' })).toBeNull();
        // Disabled controls announce inconsistently, so the state is in the
        // row's own name too.
        expect(
            within(dialog).getByText(STARTER.full_name).closest('[aria-label]').getAttribute('aria-label'),
        ).toContain('already started');
    });

    it('leaves a player who is on your roster but not in the lineup addable', async () => {
        const user = userEvent.setup();
        renderLineup({
            rankingPlayersIdsList: [rankEntry(STARTER.player_id, 1)],
            // Same roster, nobody in a slot.
            lineupSet: buildLineupSet([{ label: 'WR', playerId: null }]),
        });

        await user.click(screen.getByRole('button', { name: 'WR, empty' }));
        const dialog = screen.getByRole('dialog', { name: 'Fill WR' });

        expect(within(dialog).getByRole('button', { name: 'Add' })).toBeEnabled();
    });

    it('fills the slot when nothing is blocking it, proving the block above is not vacuous', async () => {
        const user = userEvent.setup();
        const { fillSlot } = renderLineup({
            rankingPlayersIdsList: [rankEntry(STARTER.player_id, 1)],
            lineupSet: new Set(),
        });

        await user.click(screen.getByRole('button', { name: 'WR, empty' }));
        await user.click(screen.getByRole('button', { name: 'Add' }));

        expect(fillSlot).toHaveBeenCalledWith(2, expect.objectContaining({ player_id: STARTER.player_id }));
    });
});

// The handle is pinned above the tab bar rather than sitting where the content
// happens to end - on a short lineup it was floating mid-screen. It shares its
// anchor with the sheet it opens, so the two line up.
describe('LineupPanel handle placement', () => {
    it('anchors the handle to the tab bar, and leaves its height clear at the end of the list', () => {
        renderLineup({ rankingPlayersIdsList: [rankEntry(FREE_AGENT_QB.id, 1)] });

        const handle = screen.getByRole('button', { name: /Best available/ });
        expect(handle.className).toMatch(/fixed/);
        expect(handle.className).toMatch(/bottom-\[var\(--tab-bar-h\)\]/);
        expect(screen.getByRole('list').className).toMatch(/pb-\[var\(--handle-h\)\]/);
    });
});
