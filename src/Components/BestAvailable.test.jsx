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

    // Leaguemate intel (docs/leaguemate-intel.md §3 Frontend, §3g).
    describe('with availability intel', () => {
        // Deliberately a *subset* of the rank list: FREE_AGENT has reads and
        // OTHER_FREE_AGENT does not, which is the normal case rather than an
        // edge one - the corpus only knows players your leaguemates have
        // actually drafted.
        const target = {
            id: FREE_AGENT.id,
            name: FREE_AGENT.name,
            position: 'TE',
            leagueAdp: 33.9,
            sd: 6.7,
            n: 60,
            marketPick: 34,
            adpGap: -0.1,
            perManager: [{ manager: 'baconstains', times: 5, of: 30, adp: 30.6, picks: ['3.1@25'] }],
            notable: null,
            // One hazard per pick. The manager, their drafts-seen and the take
            // count are joined from `board`/`perManager` - see stationsFor.
            hazards: [
                { pick: 35, prob: 0.18 },
                { pick: 36, prob: 0.22 },
                { pick: 37, prob: 0.15 },
            ],
            byPick: {
                35: { adjSurvival: 1, baseSurvival: 1 },
                37: { adjSurvival: 0.77, baseSurvival: 0.75 },
                39: { adjSurvival: 0.59, baseSurvival: 0.56 },
                40: { adjSurvival: 0.5, baseSurvival: 0.48 },
            },
        };

        const availability = (overrides = {}) => ({
            currentPick: 35,
            lastPick: 48,
            myPicks: [39],
            corpusDrafts: 70,
            signalThreshold: { minDrafts: 8, minTimes: 3 },
            board: [
                { pick: 35, manager: 'atekipp', mine: false, drafts: 3 },
                { pick: 36, manager: 'cja9689', mine: false, drafts: 1 },
                { pick: 37, manager: 'baconstains', mine: false, drafts: 30 },
                { pick: 39, manager: MY_DISPLAY_NAME, mine: true, drafts: 4 },
            ],
            targets: [target],
            ...overrides,
        });

        const renderWithIntel = (overrides = {}) =>
            renderBestAvailable({ ownership: SHOW_EVERYONE, availability: availability(), ...overrides });

        it('keeps the rank list order rather than re-sorting by survival', () => {
            // The ordering is the user's own judgment and the reason they
            // pasted a list; the percent chip carries the comparison instead.
            renderWithIntel();

            const names = screen.getAllByRole('listitem').map((item) => item.textContent);
            expect(names[0]).toContain(TAKEN_BY_ME.name);
            expect(names[1]).toContain(FREE_AGENT.name);
            expect(names[3]).toContain(OTHER_FREE_AGENT.name);
        });

        it('shows the survival chip against my next pick, and nothing for a player with no reads', () => {
            renderWithIntel();

            expect(screen.getByText('59%')).toBeInTheDocument();

            const noReads = screen.getByText(OTHER_FREE_AGENT.name).closest('li');
            expect(within(noReads).queryByText(/%$/)).toBeNull();
        });

        it('renders exactly as before when no availability is passed at all', () => {
            // Intel is additive: a failed fetch or the Lineup sheet must get
            // the list this component rendered before the feature existed.
            renderBestAvailable({ ownership: SHOW_EVERYONE });

            expect(screen.queryByText('59%')).toBeNull();
            expect(screen.queryByText('Still there at…')).toBeNull();
        });

        describe('the pick selector (§3g gap 1)', () => {
            it('defaults to my next pick and re-answers the list client-side when another is chosen', async () => {
                const user = userEvent.setup();
                renderWithIntel();

                expect(screen.getByText('59%')).toBeInTheDocument();

                await user.click(screen.getByRole('button', { name: 'Analyze pick 37, baconstains' }));

                // No refetch: the response carries the whole byPick matrix.
                expect(screen.getByText('77%')).toBeInTheDocument();
                expect(screen.queryByText('59%')).toBeNull();
            });

            it('marks my own pick as mine, using the trade-resolved owner', () => {
                renderWithIntel();

                const myChip = screen.getByRole('button', { name: 'Analyze pick 39, yours' });
                // Scoped to the chip: "YOU" is also the row flag on a player
                // I already roster, so an unscoped query matches both.
                expect(within(myChip).getByText('YOU')).toBeInTheDocument();
                expect(within(myChip).getByText('39')).toBeInTheDocument();
            });
        });

        // §3g gap 1b - a correctness bug, not an enhancement. "My next pick"
        // used to resolve to the pick being made right now, so `between` was
        // empty and every player read 100%: the feature went blank at exactly
        // the moment it was most wanted.
        describe('when I am on the clock (§3g gap 1b)', () => {
            it('analyzes my FOLLOWING pick, not the one I am making', () => {
                renderWithIntel({
                    availability: availability({ currentPick: 39, myPicks: [39, 51] }),
                });

                // 51 has no byPick entry in this fixture, so the honest answer
                // is a dash - emphatically not 100%.
                expect(screen.queryByText('100%')).toBeNull();
            });

            it('says there are no picks left rather than rendering a number, when nothing follows', () => {
                renderWithIntel({
                    availability: availability({ currentPick: 48, myPicks: [48], board: [] }),
                });

                expect(screen.getByText('No picks left in this draft.')).toBeInTheDocument();
                expect(screen.queryByText('100%')).toBeNull();
            });
        });

        describe('the drill-down', () => {
            it('pushes the detail in place and comes back, rather than opening a second sheet', async () => {
                const user = userEvent.setup();
                renderWithIntel();

                await user.click(screen.getByRole('button', { name: new RegExp(FREE_AGENT.name) }));

                expect(screen.getByText('probably there')).toBeInTheDocument();
                expect(screen.getByText(/Who picks before 39/)).toBeInTheDocument();
                // The list is gone, not layered under a second sheet.
                expect(screen.queryByText(OTHER_FREE_AGENT.name)).toBeNull();

                await user.click(screen.getByRole('button', { name: /Ranks/ }));
                expect(screen.getByText(OTHER_FREE_AGENT.name)).toBeInTheDocument();
            });

            it('carries the sample size on every manager claim (§3 copy rules)', async () => {
                const user = userEvent.setup();
                renderWithIntel();

                await user.click(screen.getByRole('button', { name: new RegExp(FREE_AGENT.name) }));

                // 3 drafts seen, never taken him - a rate would overclaim.
                expect(screen.getByText('never taken him · 3 drafts seen')).toBeInTheDocument();
                // 1 draft seen, never taken him - same shape, smaller sample.
                expect(screen.getByText('never taken him · 1 draft seen')).toBeInTheDocument();
                // 30 drafts and 5 takes clears the threshold, so the ADP shows.
                expect(screen.getByText('took him 5× of 30 drafts · their ADP 30.6')).toBeInTheDocument();
            });

            it('does not make a row tappable when there is nothing behind the tap', () => {
                renderWithIntel();

                const noReads = screen.getByText(OTHER_FREE_AGENT.name).closest('li');
                expect(within(noReads).queryByRole('button')).toBeNull();
            });
        });

        it('says so plainly when the corpus has no reads at all (§3e)', () => {
            // A 200 with a resolved board and targets: [] is the deliberate
            // "no reads yet" state, not a failure to render as one.
            renderWithIntel({ availability: availability({ targets: [], corpusDrafts: 0 }) });

            expect(screen.getByText(/No reads yet/)).toBeInTheDocument();
            expect(screen.getByText(FREE_AGENT.name)).toBeInTheDocument();
        });
    });
});
