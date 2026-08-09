import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import IntelDetail from './IntelDetail';

// The manager list is the only part of this component that makes a claim in
// words rather than a number, and the standing failure in this feature has
// been the sentence rather than the maths - so that is what is covered here.
//
// The shapes are the ones production actually returns, taken from
// `/availability` on 2026-08-09: `skeefe` holds a player in 1 of his 30
// leagues with no crawled drafts at all, and `N8TEDAGR38T` has 25 drafts,
// never took him, and owns him somewhere anyway.
const threshold = { minDrafts: 8, minTimes: 3 };

const target = {
    id: '13353',
    name: 'Chris Brazzell',
    position: 'WR',
    leagueAdp: 27,
    sd: 6,
    n: 12,
    marketPick: 36,
    adpGap: -9,
    byPick: { 35: { adjSurvival: 0.5, baseSurvival: 0.5 } },
    hazards: [],
    notable: false,
    perManager: [],
};

const board = [{ pick: 35, manager: 'atekipp', mine: false, drafts: 12 }];

const renderWith = (perManager) =>
    render(<IntelDetail target={{ ...target, perManager }} board={board} atPick={35} threshold={threshold} />);

// The manager's own row, not the whole panel. Scoping matters here: the
// component also renders a survival percentage and an ADP-gap sentence that
// says "has him #36", both of which match the obvious loose queries and make
// a passing assertion mean nothing.
//
// Found from the section heading rather than by climbing up from the name,
// so it keeps returning the whole row: the row became two lines to stop the
// holdings phrase truncating at 375px, and `closest('div')` from the name
// then returned only the first of them.
const rowFor = (manager) => {
    const heading = screen.getByText(/Who has drafted or holds him/i);

    return [...heading.parentElement.querySelectorAll(':scope > div')].find((row) =>
        row.textContent.trim().startsWith(manager),
    );
};

describe('IntelDetail manager rows', () => {
    it('shows holdings for a manager with no crawled drafts, without printing "0 of 0"', () => {
        renderWith([{ manager: 'skeefe', times: 0, of: 0, adp: null, picks: [], owns: 1, ofLeagues: 30 }]);

        expect(screen.getByText(/has him in 1 of 30/)).toBeInTheDocument();
        expect(screen.queryByText(/0 of 0/)).not.toBeInTheDocument();
    });

    it('shows the draft read and the holdings read together when both exist', () => {
        renderWith([
            { manager: 'baconstains', times: 1, of: 30, adp: 27.5, picks: ['2.4@16'], owns: 1, ofLeagues: 39 },
        ]);

        expect(screen.getByText(/1 of 30/)).toBeInTheDocument();
        expect(screen.getByText(/has him in 1 of 39/)).toBeInTheDocument();
    });

    // The distinction the API sends `ofLeagues: null` to preserve. A manager
    // whose leagues we cannot see must not read as one who owns him nowhere.
    it('says nothing about holdings when there is no roster data', () => {
        renderWith([{ manager: 'cja9689', times: 2, of: 12, adp: 30, picks: [], owns: 0, ofLeagues: null }]);

        const row = rowFor('cja9689');
        expect(row).toHaveTextContent('2 of 12');
        expect(row).not.toHaveTextContent(/has him in/);
        expect(row).not.toHaveTextContent(/none of their/);
    });

    it('states outright when a manager who drafted him holds him nowhere now', () => {
        renderWith([{ manager: 'GetForked', times: 2, of: 10, adp: 24, picks: [], owns: 0, ofLeagues: 10 }]);

        expect(screen.getByText(/has him in none of their 10/)).toBeInTheDocument();
    });

    // "50%" of two leagues is a coin flip with a decimal point.
    it('withholds the percentage on a thin denominator but still shows the count', () => {
        renderWith([{ manager: 'cunglomerate', times: 0, of: 0, adp: null, picks: [], owns: 1, ofLeagues: 2 }]);

        const row = rowFor('cunglomerate');
        expect(row).toHaveTextContent('has him in 1 of 2');
        expect(row).not.toHaveTextContent('%');
    });

    it('shows it once the denominator is large enough to carry one', () => {
        renderWith([{ manager: 'N8TEDAGR38T', times: 0, of: 25, adp: null, picks: [], owns: 5, ofLeagues: 58 }]);

        expect(screen.getByText(/has him in 5 of 58 · 9%/)).toBeInTheDocument();
    });

    // The heading is a claim too: this list stopped being only drafters.
    it('does not claim everyone listed has drafted him', () => {
        renderWith([{ manager: 'skeefe', times: 0, of: 0, adp: null, picks: [], owns: 1, ofLeagues: 30 }]);

        expect(screen.queryByText(/Everyone who has drafted him/i)).not.toBeInTheDocument();
        expect(screen.getByText(/Who has drafted or holds him/i)).toBeInTheDocument();
    });
});
