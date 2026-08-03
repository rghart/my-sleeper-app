import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BestAvailable from './BestAvailable';
import { draftDefaultOwnership } from './OwnershipFilters';
import { buildRosterInfo, decorateRosters } from '../lib/rosterInfo.js';
import rosterFlagsFixture from '../lib/__fixtures__/roster-flags-2026.json';

// Coverage moved here from the old BestAvailableSheet.test.jsx (deleted with
// that component): the taken/untaken and ranking-order assertions still
// apply to this component, which is now the thing that actually renders the
// rows - Sheet and BestAvailableHandle only supply chrome around it. The
// "excludes a taken player" case became "shows it, marked" - the redesign
// stopped hiding taken players outright (see BestAvailable.jsx's own
// comment) in favour of a plain "Taken" label, so that test's assertion
// direction flipped along with the behaviour.
//
// 13307 is a genuine free agent - on nobody's roster. 13294 and 13274 are
// really taken (roster 2 and roster 1 respectively). Using those three is
// what makes "correctly excluded" and "wrongly excluded" distinguishable -
// see PickFeed.test.jsx for the same trap against the manual-pick filter.
const { rosterDataRaw, managerData, playerInfo } = rosterFlagsFixture;

const rosterData = decorateRosters({ rosterData: rosterDataRaw, managerData });
const rosterInfo = buildRosterInfo({ rosterData, builtDraft: null });

const FREE_AGENT = { id: '13307', name: 'Marlin Klein' };
// Also unrostered in this fixture - used alongside FREE_AGENT to prove
// ordering survives rendering rather than just checking a single-item list.
const OTHER_FREE_AGENT = { id: '289', name: 'Drew Brees' };
const TAKEN_BY_OTHERS = { id: '13294', name: 'Makai Lemon' };
const TAKEN_BY_ME = { id: '13274', name: 'Germie Bernard' };
const MY_DISPLAY_NAME = 'ryangh';

const rankEntry = (playerId, ranking) => ({
    match_results: [[playerId, '0.000']],
    ranking,
    search_string: 'a pasted rank line',
});

const entries = [
    rankEntry(TAKEN_BY_ME.id, 1),
    rankEntry(FREE_AGENT.id, 2),
    rankEntry(TAKEN_BY_OTHERS.id, 3),
    rankEntry(OTHER_FREE_AGENT.id, 4),
];

// The rows every scope has always shown, plus other managers' - the default
// scope hides those (see OwnershipFilters.DEFAULT_OWNERSHIP), so the cases
// below that are about rendering a row rather than about the scope itself ask
// for all three buckets explicitly.
const SHOW_EVERYONE = { mine: true, available: true, others: true, rookiesOnly: false };

const renderBestAvailable = (overrides = {}) =>
    render(
        <BestAvailable
            entries={entries}
            playerInfo={playerInfo}
            rosterInfo={rosterInfo}
            myDisplayName={MY_DISPLAY_NAME}
            eligibleSlots={null}
            onSelect={null}
            {...overrides}
        />,
    );

describe('BestAvailable', () => {
    it('lists players in ranking order', () => {
        renderBestAvailable({ ownership: SHOW_EVERYONE });

        const names = screen.getAllByRole('listitem').map((item) => item.textContent);
        expect(names[0]).toContain(TAKEN_BY_ME.name);
        expect(names[1]).toContain(FREE_AGENT.name);
        expect(names[2]).toContain(TAKEN_BY_OTHERS.name);
        expect(names[3]).toContain(OTHER_FREE_AGENT.name);
    });

    // Two behaviours in one case, because they are two halves of the same
    // rule: the default scope is yours-plus-unowned, and a player on somebody
    // else's roster is not hidden as a mistake - ask for them and they come
    // back, marked. "Taken" means taken *from you*, so your own never carry it.
    it("hides other managers' players by default and marks them Taken once asked for", () => {
        const { unmount } = renderBestAvailable();

        expect(screen.getByText(FREE_AGENT.name)).toBeInTheDocument();
        expect(screen.getByText(TAKEN_BY_ME.name)).toBeInTheDocument();
        expect(screen.queryByText(TAKEN_BY_OTHERS.name)).toBeNull();
        expect(screen.queryAllByText('Taken')).toHaveLength(0);

        unmount();
        renderBestAvailable({ ownership: SHOW_EVERYONE });

        expect(screen.getByText(TAKEN_BY_OTHERS.name)).toBeInTheDocument();
        expect(screen.getAllByText('Taken')).toHaveLength(1);
    });

    // The lineup sheet exists to fill your starting slots, and the only
    // players you can start are the ones you already roster - so greying those
    // out alongside every other manager's would make the sheet useless for its
    // main job. Same rule PlayerInfoItem has always used.
    it("keeps the action on your own rostered player and withholds it from someone else's", () => {
        renderBestAvailable({ onSelect: vi.fn(), ownership: SHOW_EVERYONE });

        const mine = screen.getByText(TAKEN_BY_ME.name).closest('li');
        const theirs = screen.getByText(TAKEN_BY_OTHERS.name).closest('li');

        expect(within(mine).getByRole('button', { name: 'Add' })).toBeInTheDocument();
        expect(within(theirs).queryByRole('button', { name: 'Add' })).toBeNull();
        expect(within(theirs).getByText('Taken')).toBeInTheDocument();
    });

    // The copy points at the sheet's own switcher, not at another section: the
    // handle opens this sheet with no list loaded now, and choosing or starting
    // a list both happen from its header. Telling the reader to go to Ranks was
    // written when this state was unreachable.
    it('renders an empty state that points at the switcher above it', () => {
        renderBestAvailable({ entries: [] });

        expect(screen.getByText(/No rank list selected/)).toBeInTheDocument();
        expect(screen.getByText(/switcher above/)).toBeInTheDocument();
        expect(screen.queryByText(/Ranks section/)).toBeNull();
    });

    it('skips an entry whose id is absent from playerInfo rather than rendering a hole', () => {
        renderBestAvailable({ entries: [...entries, rankEntry('999999', 5)], ownership: SHOW_EVERYONE });

        expect(screen.getAllByRole('listitem')).toHaveLength(entries.length);
    });

    describe('with eligibleSlots', () => {
        // fantasy_positions/position come straight off the fixture's real
        // player records - getEligiblePositions is not reimplemented here.
        const TE_ONLY_SLOT = ['TE'];

        it('filters to players eligible for at least one given slot, hiding the rest', () => {
            renderBestAvailable({ eligibleSlots: TE_ONLY_SLOT });

            // FREE_AGENT (13307) is a TE in the fixture; the others are not.
            expect(screen.getByText(FREE_AGENT.name)).toBeInTheDocument();
            expect(screen.queryByText(OTHER_FREE_AGENT.name)).toBeNull();
        });

        it('renders a chip row with ALL plus one chip per distinct slot label', () => {
            renderBestAvailable({ eligibleSlots: ['TE', 'FLX'] });

            expect(screen.getByRole('button', { name: 'ALL' })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'TE' })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'FLX' })).toBeInTheDocument();
        });

        it('omits the slot chips when eligibleSlots is null, but keeps FILTERS', () => {
            renderBestAvailable({ eligibleSlots: null });

            expect(screen.queryByRole('button', { name: 'ALL' })).toBeNull();
            // The draft list has no slot to be eligible for, but the same
            // question - who can I still have? - and so the same chip.
            expect(screen.getByRole('button', { name: /^FILTERS/ })).toBeInTheDocument();
        });

        it('narrows to a single slot on chip click, and ALL clears the narrowing', async () => {
            const user = userEvent.setup();
            renderBestAvailable({ eligibleSlots: ['TE', 'WR'] });

            // Under ALL, both a TE (FREE_AGENT) and a WR (TAKEN_BY_ME) show.
            expect(screen.getByText(FREE_AGENT.name)).toBeInTheDocument();
            expect(screen.getByText(TAKEN_BY_ME.name)).toBeInTheDocument();

            await user.click(screen.getByRole('button', { name: 'TE' }));
            expect(screen.getByText(FREE_AGENT.name)).toBeInTheDocument();
            expect(screen.queryByText(TAKEN_BY_ME.name)).toBeNull();

            await user.click(screen.getByRole('button', { name: 'ALL' }));
            expect(screen.getByText(TAKEN_BY_ME.name)).toBeInTheDocument();
        });
    });

    describe('with defaultOwnership', () => {
        // In the fixture, FREE_AGENT/TAKEN_BY_OTHERS/TAKEN_BY_ME (13307,
        // 13294, 13274) are all years_exp 0 - rookies. OTHER_FREE_AGENT (289,
        // Drew Brees) is years_exp 20 - the lone veteran. Uncontrolled here
        // (no `ownership` override) so the component's own seeding from
        // `defaultOwnership` is what's under test, same as an unopened draft
        // sheet or the desktop rail.
        it('starts scoped to rookies when seeded from a Rookie draft, hiding the one veteran', () => {
            renderBestAvailable({ defaultOwnership: draftDefaultOwnership('Rookie') });

            expect(screen.getByText(FREE_AGENT.name)).toBeInTheDocument();
            expect(screen.getByText(TAKEN_BY_ME.name)).toBeInTheDocument();
            expect(screen.queryByText(TAKEN_BY_OTHERS.name)).toBeNull();
            expect(screen.queryByText(OTHER_FREE_AGENT.name)).toBeNull();
        });

        // The point of seeding rather than hard-filtering: the starting
        // position is a default, not a floor, so it has to give back.
        it('still lets Rookies only be switched back off from that starting point', async () => {
            const user = userEvent.setup();
            renderBestAvailable({ defaultOwnership: draftDefaultOwnership('Rookie') });

            expect(screen.queryByText(OTHER_FREE_AGENT.name)).toBeNull();

            await user.click(screen.getByRole('button', { name: /^FILTERS/ }));
            await user.click(screen.getByRole('switch', { name: 'Rookies only' }));

            expect(screen.getByText(OTHER_FREE_AGENT.name)).toBeInTheDocument();
        });

        it('leaves rookiesOnly off for a Veteran draft or when omitted, same as the ordinary default', () => {
            renderBestAvailable({ defaultOwnership: draftDefaultOwnership('Veteran') });

            expect(screen.getByText(OTHER_FREE_AGENT.name)).toBeInTheDocument();
            expect(screen.getByText(FREE_AGENT.name)).toBeInTheDocument();
        });
    });

    describe('the Add action', () => {
        it('renders an Add pill for an untaken player when onSelect is given, and calls it with the player', async () => {
            const user = userEvent.setup();
            const onSelect = vi.fn();
            renderBestAvailable({ onSelect });

            const row = screen.getByText(FREE_AGENT.name).closest('[role="group"]');
            await user.click(within(row).getByRole('button', { name: 'Add' }));

            expect(onSelect).toHaveBeenCalledWith(playerInfo[FREE_AGENT.id]);
        });

        it('renders no action at all for an untaken player when onSelect is null', () => {
            renderBestAvailable({ onSelect: null });

            const row = screen.getByText(FREE_AGENT.name).closest('[role="group"]');
            expect(within(row).queryByRole('button', { name: 'Add' })).toBeNull();
        });

        it('never offers Add for a taken player, regardless of onSelect', () => {
            renderBestAvailable({ onSelect: () => {}, ownership: SHOW_EVERYONE });

            const row = screen.getByText(TAKEN_BY_OTHERS.name).closest('[role="group"]');
            expect(within(row).queryByRole('button', { name: 'Add' })).toBeNull();
            expect(within(row).getByText('Taken')).toBeInTheDocument();
        });
    });
});
