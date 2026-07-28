import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BestAvailableSheet from './BestAvailableSheet';
import { buildRosterInfo, decorateRosters } from '../lib/rosterInfo.js';
import rosterFlagsFixture from '../lib/__fixtures__/roster-flags-2026.json';

// 13307 is a genuine free agent - on nobody's roster. 13294 and 13274 are
// really taken (roster 2 and roster 1 respectively). Using those three is
// what makes "correctly excluded" and "wrongly excluded" distinguishable -
// see PickFeed.test.jsx for the same trap against the manual-pick filter.
const { rosterDataRaw, managerData, playerInfo } = rosterFlagsFixture;

const rosterData = decorateRosters({ rosterData: rosterDataRaw, managerData });
const rosterInfo = buildRosterInfo({ rosterData, builtDraft: null });

const FREE_AGENT = { id: '13307', name: 'Marlin Klein' };
// Also unrostered in this fixture - used alongside FREE_AGENT to prove
// ordering survives the taken-player filter rather than just checking a
// single-item list.
const OTHER_FREE_AGENT = { id: '289', name: 'Drew Brees' };
const TAKEN_BY_OTHERS = { id: '13294', name: 'Makai Lemon' };
const TAKEN_BY_ME = { id: '13274', name: 'Germie Bernard' };

const rankEntry = (playerId, ranking) => ({
    match_results: [[playerId, '0.000']],
    ranking,
    search_string: 'a pasted rank line',
});

const rankingPlayersIdsList = [
    rankEntry(TAKEN_BY_ME.id, 1),
    rankEntry(FREE_AGENT.id, 2),
    rankEntry(TAKEN_BY_OTHERS.id, 3),
    rankEntry(OTHER_FREE_AGENT.id, 4),
];

const renderSheet = (overrides = {}) =>
    render(
        <BestAvailableSheet
            rankingPlayersIdsList={rankingPlayersIdsList}
            playerInfo={playerInfo}
            rosterInfo={rosterInfo}
            {...overrides}
        />,
    );

const toggle = () => screen.getByRole('button', { name: /Best available/ });

describe('BestAvailableSheet', () => {
    it('is collapsed by default', () => {
        renderSheet();

        expect(toggle()).toHaveAttribute('aria-expanded', 'false');
        expect(screen.queryByText(FREE_AGENT.name)).toBeNull();
    });

    it('expands and collapses on click, tracked by aria-expanded', async () => {
        const user = userEvent.setup();
        renderSheet();

        await user.click(toggle());
        expect(toggle()).toHaveAttribute('aria-expanded', 'true');
        expect(screen.getByText(FREE_AGENT.name)).toBeInTheDocument();

        await user.click(toggle());
        expect(toggle()).toHaveAttribute('aria-expanded', 'false');
        expect(screen.queryByText(FREE_AGENT.name)).toBeNull();
    });

    it('lists players in ranking order', async () => {
        const user = userEvent.setup();
        renderSheet();
        await user.click(toggle());

        const names = screen.getAllByRole('listitem').map((item) => item.textContent);
        expect(names[0]).toContain(FREE_AGENT.name);
        expect(names[1]).toContain(OTHER_FREE_AGENT.name);
    });

    it('excludes a taken player while keeping an untaken one', async () => {
        const user = userEvent.setup();
        renderSheet();
        await user.click(toggle());

        expect(screen.getByText(FREE_AGENT.name)).toBeInTheDocument();
        expect(screen.queryByText(TAKEN_BY_OTHERS.name)).toBeNull();
        expect(screen.queryByText(TAKEN_BY_ME.name)).toBeNull();
    });

    it('reflects the filtered count, not the raw list, in the collapsed bar', () => {
        renderSheet();

        // Only the two free agents survive filtering out of the four pasted ranks.
        expect(toggle()).toHaveTextContent('2 left');
    });

    it('renders an empty state when there is no rank list at all', () => {
        renderSheet({ rankingPlayersIdsList: [] });

        expect(screen.getByText(/No rank list yet/)).toBeInTheDocument();
        expect(screen.getByText(/Ranks section/)).toBeInTheDocument();
    });
});
