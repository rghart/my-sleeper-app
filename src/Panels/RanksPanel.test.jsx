import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RanksPanel from './RanksPanel';
import { buildRosterInfo, decorateRosters } from '../lib/rosterInfo.js';
import rosterFlagsFixture from '../lib/__fixtures__/roster-flags-2026.json';

// RanksPanel.filterPlayers is the only place the derived flags decide what
// renders at all, and it is a four-branch table over isTaken/rosteredBy rather
// than a single condition. App.test.jsx cannot reach it: the rank list is empty
// there, so every branch is vacuous. Each test below pins one branch, because a
// table that agrees with the real one only in the default state is the likely
// shape of a regression here.

vi.mock('../firebase.js', () => ({
    auth: {
        currentUser: {
            uid: 'test-uid',
            getIdToken: vi.fn().mockResolvedValue('test-id-token'),
        },
    },
    googleProvider: {},
}));

const { rosterDataRaw, managerData, playerInfo } = rosterFlagsFixture;

const rosterData = decorateRosters({ rosterData: rosterDataRaw, managerData });
const rosterInfo = buildRosterInfo({ rosterData, builtDraft: null });

const MY_DISPLAY_NAME = 'ryangh';

// One player per flag state, all WR/TE so the position filters (which default
// to QB/RB/WR/TE on) never confound the taken/mine assertions.
const FREE_AGENT = { id: '13307', name: 'Marlin Klein' }; // on nobody's roster
const OTHERS_PLAYER = { id: '13294', name: 'Makai Lemon' }; // roster 2, aphilliny21
const MY_PLAYER = { id: '13274', name: 'Germie Bernard' }; // roster 1, mine

const rankEntry = (playerId, ranking) => ({
    match_results: [[playerId, '0.000']],
    ranking: String(ranking),
    search_string: 'a pasted rank line',
});

const rankingPlayersIdsList = [rankEntry(FREE_AGENT.id, 1), rankEntry(OTHERS_PLAYER.id, 2), rankEntry(MY_PLAYER.id, 3)];

function renderPanel(overrides = {}) {
    // signedIn stays false so the saved-rank-lists effect takes its else
    // branch and never fetches. The ADP request still fires on mount and now
    // goes through the real fetchRequest, so it needs a stubbed global fetch
    // rather than an injected mock - which is closer to production than the
    // hand-written stand-in it replaces.
    global.fetch = vi.fn(() => Promise.resolve({ ok: true, statusText: 'OK', json: () => Promise.resolve({}) }));
    const props = {
        isLoading: false,
        signedIn: false,
        playerInfo,
        rosterInfo,
        lineupSet: new Set(),
        updateRankingPlayersIdsList: vi.fn(),
        startLoad: vi.fn(),
        rankingPlayersIdsList,
        addToRoster: vi.fn(),
        updatePlayerId: vi.fn(),
        notFoundPlayers: [],
        resolveMissingPlayer: vi.fn(),
        myDisplayName: MY_DISPLAY_NAME,
        // savedRankLists/updateSavedRankLists are lifted to App (see
        // App.jsx's loadSavedRankLists/updateSavedRankLists) - RanksPanel now
        // just receives them. signedIn stays false in every test here, so
        // the map never grows past the placeholder entry.
        savedRankLists: { default: { pretty_name: '-- Select saved ranks list', route_name: 'default' } },
        updateSavedRankLists: vi.fn(),
        ...overrides,
    };
    const { container } = render(<RanksPanel {...props} />);
    return { ...props, container };
}

// The paste box moved from the page into a sheet opened by the "Paste list"
// pill (step 6d) - every test that needs the textarea has to open it first.
const openPasteSheet = async (user) => {
    await user.click(screen.getByRole('button', { name: 'Paste list' }));
};

// The four flag toggles (Taken/My players/Only rookies/All players) and the
// ADP type control both live in the FILTERS popover (step 6e). That used to
// render as two trees at once - an anchored desktop popover plus a phone Sheet
// - which is why the queries below take the first match; it is one popover at
// every width now (see Popover.jsx and the regression test at the bottom of
// this file), and the `getAllBy...[0]` form is kept only so this stays robust
// to that shape rather than asserting on how many copies exist. `openFilters`
// is idempotent (checks before clicking) so tests can call it before more
// than one toggle in the same case without accidentally closing it again.
const openFilters = async (user) => {
    if (screen.queryAllByRole('checkbox', { name: 'Taken' }).length === 0) {
        await user.click(screen.getByRole('button', { name: /^FILTERS/ }));
    }
};

// The filter controls are <label> elements wrapping a checkbox, so the
// accessible name is what to click rather than the label text node. Takes
// the first of the two (popover + sheet) matches - see openFilters above.
const toggleFlag = async (user, name) => {
    await openFilters(user);
    await user.click(screen.getAllByRole('checkbox', { name })[0]);
};

// Position chips are plain toggle buttons now (aria-pressed), not checkboxes,
// and they live in the always-visible chip row rather than behind FILTERS -
// see RanksPanel.jsx's positionChipClass/POSITIONS.
const togglePosition = async (user, position) => {
    await user.click(screen.getByRole('button', { name: position }));
};

const visiblePlayers = () =>
    [FREE_AGENT, OTHERS_PLAYER, MY_PLAYER].filter((p) => screen.queryByText(p.name) !== null).map((p) => p.name);

describe('RanksPanel loading', () => {
    it('shows only the loader while the ranks panel is loading', () => {
        renderPanel({ isLoading: true });

        expect(screen.queryByRole('progressbar', { name: 'Loading' })).toBeTruthy();
        expect(screen.queryByText(FREE_AGENT.name)).toBeNull();
    });

    it('asks for a search by text alone, without naming a loading state', async () => {
        // startLoad used to take the loading message as its first argument, and
        // RanksPanel passed the literal 'Loading search panel...' - which came
        // straight back down as the prop it then compared against. The panel no
        // longer knows that vocabulary exists.
        const user = userEvent.setup();
        const { startLoad } = renderPanel();

        await openPasteSheet(user);
        await user.type(screen.getByPlaceholderText('Copy + Paste rankings here...'), 'Ja  rr Chase');
        await user.click(screen.getByRole('button', { name: 'Submit' }));

        // The second argument is the column map, null here because a plain
        // one-per-line list is not a table. Still no loading vocabulary.
        expect(startLoad).toHaveBeenCalledWith('Ja  rr Chase', null);
    });
});

describe('RanksPanel player filters', () => {
    let user;

    beforeEach(() => {
        user = userEvent.setup();
    });

    it('shows free agents and my own players by default, and hides everyone elses', async () => {
        // Default filters: showTaken false, showMyPlayers true - the branch a
        // manager actually drafts against.
        renderPanel();

        expect(visiblePlayers()).toEqual([FREE_AGENT.name, MY_PLAYER.name]);
    });

    it('shows every player once Taken is on alongside My players', async () => {
        renderPanel();

        await toggleFlag(user, 'Taken');

        expect(visiblePlayers()).toEqual([FREE_AGENT.name, OTHERS_PLAYER.name, MY_PLAYER.name]);
    });

    it('shows only free agents when both Taken and My players are off', async () => {
        renderPanel();

        await toggleFlag(user, 'My players');

        expect(visiblePlayers()).toEqual([FREE_AGENT.name]);
    });

    it('hides my own players when Taken is on but My players is off', async () => {
        // The one branch that reads rosteredBy rather than isTaken: it keeps
        // anything not rostered by me, which is how a manager scouts the rest
        // of the league without their own roster in the way.
        renderPanel();

        await toggleFlag(user, 'Taken');
        await toggleFlag(user, 'My players');

        expect(visiblePlayers()).toEqual([FREE_AGENT.name, OTHERS_PLAYER.name]);
    });

    it('applies the position filters on top of the flag filters', async () => {
        // The position filter runs as a second pass over whatever filterPlayers
        // returned, so turning WR off must not disturb the taken/mine decision
        // for the TE that remains.
        renderPanel();

        await togglePosition(user, 'WR');

        expect(visiblePlayers()).toEqual([FREE_AGENT.name]);
    });

    it('marks a filter chip checked once toggled on, and only that one', async () => {
        // The chips are real checkboxes styled as pills (SearchFilterButton),
        // not a from-scratch control - this is the assertion that the
        // Tailwind conversion didn't quietly disconnect `checked` from the
        // underlying input.
        renderPanel();

        await openFilters(user);
        expect(screen.getAllByRole('checkbox', { name: 'Taken' })[0].checked).toBe(false);

        await toggleFlag(user, 'Taken');

        expect(screen.getAllByRole('checkbox', { name: 'Taken' })[0].checked).toBe(true);
        // WR defaults on (see the top-of-file position filter defaults) and is
        // untouched by toggling Taken. It's a button now (aria-pressed), not a
        // checkbox - see togglePosition above.
        expect(screen.getByRole('button', { name: 'WR' })).toHaveAttribute('aria-pressed', 'true');
    });

    it('marks a position chip pressed once toggled on, with its own position colours', async () => {
        renderPanel();

        expect(screen.getByRole('button', { name: 'K' })).toHaveAttribute('aria-pressed', 'false');

        await togglePosition(user, 'K');

        expect(screen.getByRole('button', { name: 'K' })).toHaveAttribute('aria-pressed', 'true');
        // Off by default and untouched by turning K on.
        expect(screen.getByRole('button', { name: 'WR' })).toHaveAttribute('aria-pressed', 'true');
        expect(screen.getByRole('button', { name: 'DEF' })).toHaveAttribute('aria-pressed', 'false');
    });

    it('counts non-default filters on the FILTERS chip, and shows no count when everything is default', async () => {
        renderPanel();

        // Nothing has been touched yet: showTaken/showMyPlayers/
        // showRookiesOnly/showAllPlayers and adpType are all still their
        // initial values, so the chip carries no count.
        expect(screen.getByRole('button', { name: 'FILTERS' })).toBeTruthy();

        await toggleFlag(user, 'Taken');

        expect(screen.getByRole('button', { name: 'FILTERS · 1' })).toBeTruthy();

        await toggleFlag(user, 'Only rookies');

        expect(screen.getByRole('button', { name: 'FILTERS · 2' })).toBeTruthy();

        // My players defaults to true, so turning it off is a third
        // non-default filter, not a fourth toggle back toward zero.
        await toggleFlag(user, 'My players');

        expect(screen.getByRole('button', { name: 'FILTERS · 3' })).toBeTruthy();
    });
});

describe('RanksPanel ADP type picker', () => {
    it('has no ADP type selected by default, then reflects the pressed option, and counts toward FILTERS', async () => {
        // adpType starts as undefined - no `.radio-label.checked` div in the old
        // markup, no `aria-pressed` segment here - and a click should move
        // exactly one segment into the pressed state. The control now lives in
        // the FILTERS popover, which renders twice (desktop popover + phone
        // sheet) - see openFilters/toggleFlag above - so every query takes the
        // first of the two matches.
        const user = userEvent.setup();
        renderPanel();

        await openFilters(user);

        expect(screen.getAllByRole('button', { name: 'Startup' })[0]).toHaveAttribute('aria-pressed', 'false');
        expect(screen.getAllByRole('button', { name: 'Rookie' })[0]).toHaveAttribute('aria-pressed', 'false');
        expect(screen.getByRole('button', { name: 'FILTERS' })).toBeTruthy();

        await user.click(screen.getAllByRole('button', { name: 'Rookie' })[0]);

        expect(screen.getAllByRole('button', { name: 'Rookie' })[0]).toHaveAttribute('aria-pressed', 'true');
        expect(screen.getAllByRole('button', { name: 'Startup' })[0]).toHaveAttribute('aria-pressed', 'false');
        expect(screen.getByRole('button', { name: 'FILTERS · 1' })).toBeTruthy();
    });
});

// The reported bug: with the FILTERS popover open, tapping any control inside
// it closed the whole thing and the toggle never applied. Cause was the
// desktop-only popover staying mounted (behind `hidden md:block`) underneath
// the phone Sheet, where its document-level outside-click listener counted
// every tap inside the Sheet as "outside" and closed on mousedown - before the
// click that would have toggled the filter could land.
//
// jsdom has no stylesheet, so `hidden md:block` never hid anything here and
// both copies were always "visible" to a test - which is exactly why the whole
// suite stayed green while the phone was broken. What this asserts instead is
// the behaviour: the control still responds, and the popover is still there
// afterwards.
describe('RanksPanel FILTERS popover stays open while it is used', () => {
    it('applies a toggle instead of dismissing itself, twice in a row', async () => {
        const user = userEvent.setup();
        renderPanel();

        await user.click(screen.getByRole('button', { name: /^FILTERS/ }));
        expect(screen.getAllByRole('checkbox', { name: 'Taken' })[0]).toBeInTheDocument();

        await user.click(screen.getAllByRole('checkbox', { name: 'Taken' })[0]);

        // Still open, and the toggle took.
        expect(screen.getAllByRole('checkbox', { name: 'Taken' })[0].checked).toBe(true);

        await user.click(screen.getAllByRole('checkbox', { name: 'Only rookies' })[0]);

        expect(screen.getAllByRole('checkbox', { name: 'Only rookies' })[0].checked).toBe(true);
        expect(screen.getAllByRole('checkbox', { name: 'Taken' })[0].checked).toBe(true);
        expect(screen.getByRole('button', { name: 'FILTERS · 2' })).toBeInTheDocument();
    });

    it('closes on the chip, on Escape, and on a click outside it', async () => {
        const user = userEvent.setup();
        renderPanel();

        const chip = () => screen.getByRole('button', { name: /^FILTERS/ });
        const isOpen = () => screen.queryAllByRole('checkbox', { name: 'Taken' }).length > 0;

        await user.click(chip());
        expect(isOpen()).toBe(true);
        await user.click(chip());
        expect(isOpen()).toBe(false);

        await user.click(chip());
        await user.keyboard('{Escape}');
        expect(isOpen()).toBe(false);

        await user.click(chip());
        await user.click(screen.getByRole('heading', { name: 'Ranks' }));
        expect(isOpen()).toBe(false);
    });
});

// Naming and saving a pasted list is the pre-redesign feature the rebuilt
// panel lost. The name field survived, but only inside the paste sheet - and
// startSearch closes that sheet the moment a list lands in it, so the only way
// back to the field was to reopen the button that had just dismissed itself.
// It has its own sheet now, behind a Save pill that appears as soon as there
// is a list to save.
describe('RanksPanel saving a pasted list', () => {
    const SAVED = {
        pretty_name: 'My Rankings',
        route_name: 'my_rankings',
        rank_list: [rankEntry(FREE_AGENT.id, 1)],
    };

    const savedRankLists = {
        default: { pretty_name: '-- Select saved ranks list', route_name: 'default' },
        my_rankings: SAVED,
    };

    const openSaveSheet = async (user) => {
        await user.click(screen.getByRole('button', { name: 'Save' }));
        return screen.getByRole('dialog', { name: 'Save list' });
    };

    // The PUT/DELETE go through fetchRequest, which resolves to undefined on
    // any failure - so `ok: false` here is the whole of the failure path.
    const writes = (ok = true) => {
        const calls = [];
        global.fetch = vi.fn((url, init) => {
            // The ADP request goes through fetchRequest too, so a write is a
            // method other than GET rather than any method at all.
            if (init?.method && init.method !== 'GET') {
                calls.push({ url, ...init });
                return Promise.resolve({ ok, status: ok ? 200 : 500, statusText: ok ? 'OK' : 'Server Error' });
            }
            return Promise.resolve({ ok: true, statusText: 'OK', json: () => Promise.resolve({}) });
        });
        return calls;
    };

    it('offers no Save pill until there is something to save, or to anyone signed out', () => {
        renderPanel({ signedIn: true, rankingPlayersIdsList: [] });
        expect(screen.queryByRole('button', { name: 'Save' })).toBeNull();

        renderPanel({ signedIn: false });
        expect(screen.queryByRole('button', { name: 'Save' })).toBeNull();
    });

    it('names a freshly pasted list and PUTs it under a slug of that name', async () => {
        const user = userEvent.setup();
        const { updateSavedRankLists } = renderPanel({ signedIn: true });
        // renderPanel installs its own global.fetch for the ADP request, so
        // the write mock has to replace it rather than precede it.
        const calls = writes();

        const sheet = await openSaveSheet(user);
        const save = () => screen.getByRole('button', { name: 'Save list' });

        // Too short a name makes a bad key, so the button says so by staying
        // disabled rather than the save failing into a console.log.
        await user.type(screen.getByLabelText('LIST NAME'), 'abc');
        expect(save()).toBeDisabled();

        await user.type(screen.getByLabelText('LIST NAME'), ' Rookie Ranks');
        expect(save()).toBeEnabled();
        await user.click(save());

        expect(calls).toHaveLength(1);
        expect(calls[0].method).toBe('PUT');
        expect(calls[0].url).toContain('test-uid/abc_rookie_ranks');
        expect(JSON.parse(calls[0].body)).toMatchObject({
            pretty_name: 'abc Rookie Ranks',
            route_name: 'abc_rookie_ranks',
        });
        expect(updateSavedRankLists).toHaveBeenCalledTimes(1);
        // The sheet is done once the list has a name.
        expect(sheet).not.toBeInTheDocument();
    });

    it('says so and stays open when the save does not land', async () => {
        const user = userEvent.setup();
        renderPanel({ signedIn: true });
        writes(false);

        await openSaveSheet(user);
        await user.type(screen.getByLabelText('LIST NAME'), 'Rookie Ranks');
        await user.click(screen.getByRole('button', { name: 'Save list' }));

        expect(screen.getByRole('alert')).toHaveTextContent(/try again/i);
        expect(screen.getByRole('dialog', { name: 'Save list' })).toBeInTheDocument();
    });

    // The "a saved list is selected" branch of the sheet (Update / Save as
    // new / Delete) is SaveListSheet's own, and is covered in
    // SaveListSheet.test.jsx: currentListVal only ever changes through the
    // selector this panel publishes to the top bar, which needs the provider
    // and is App's wiring rather than the panel's.
    it('asks only for a name while the session list is unsaved', async () => {
        const user = userEvent.setup();
        renderPanel({ signedIn: true, savedRankLists });
        const calls = writes();

        const sheet = await openSaveSheet(user);
        expect(within(sheet).getByLabelText('LIST NAME')).toBeInTheDocument();
        expect(within(sheet).queryByRole('button', { name: 'Update' })).toBeNull();
        expect(within(sheet).queryByRole('button', { name: 'Delete list' })).toBeNull();
        expect(calls).toHaveLength(0);
    });

    it('leaves the paste sheet to pasting alone', async () => {
        const user = userEvent.setup();
        renderPanel({ signedIn: true });
        writes();

        await openPasteSheet(user);
        const sheet = screen.getByRole('dialog', { name: 'Paste list' });

        expect(within(sheet).getByPlaceholderText('Copy + Paste rankings here...')).toBeInTheDocument();
        expect(within(sheet).queryByLabelText('LIST NAME')).toBeNull();
        expect(within(sheet).queryByRole('button', { name: /Delete/ })).toBeNull();
    });
});

// A ranking list that arrives as a table (a CSV file, or a paste out of a
// spreadsheet, which is tab-separated) carries its columns, and the flat-line
// parser's whole job is guessing at fields a table already labels. These cover
// the panel's half: noticing the shape, showing the guess, and sending the
// confirmed map on. lib/rankColumns.test.js covers the reading itself.
describe('RanksPanel column mapping', () => {
    const CSV = "Rank,Player,Team,Pos\n1,Ja'Marr Chase,CIN,WR\n2,Bijan Robinson,ATL,RB";

    const pasteIntoSheet = async (user, text) => {
        await openPasteSheet(user);
        const box = screen.getByPlaceholderText('Copy + Paste rankings here...');
        await user.click(box);
        await user.paste(text);
        return box;
    };

    it('offers no column mapping for a plain one-per-line list', async () => {
        const user = userEvent.setup();
        renderPanel();
        await pasteIntoSheet(user, "Ja'Marr Chase\nBijan Robinson\nPuka Nacua");

        expect(screen.queryByRole('combobox', { name: /name/i })).toBeNull();
    });

    it('shows the guessed mapping when the paste is a table', async () => {
        const user = userEvent.setup();
        renderPanel();
        await pasteIntoSheet(user, CSV);

        expect(screen.getByRole('combobox', { name: 'NAME' })).toHaveValue('1');
        expect(screen.getByRole('combobox', { name: 'TEAM' })).toHaveValue('2');
        expect(screen.getByRole('combobox', { name: 'POSITION' })).toHaveValue('3');
    });

    // The guess is a default, not a decision - a wrong one mislabels the whole
    // list, so the data it applies to has to be visible beside it.
    it('previews real rows under the mapping', async () => {
        const user = userEvent.setup();
        renderPanel();
        await pasteIntoSheet(user, CSV);

        expect(screen.getByRole('cell', { name: "Ja'Marr Chase" })).toBeTruthy();
        expect(screen.getByRole('cell', { name: 'Bijan Robinson' })).toBeTruthy();
    });

    it('drops the heading row from the preview', async () => {
        const user = userEvent.setup();
        renderPanel();
        await pasteIntoSheet(user, CSV);

        expect(screen.queryByRole('cell', { name: 'Player' })).toBeNull();
    });

    it('sends the confirmed mapping on with the text', async () => {
        const user = userEvent.setup();
        const { startLoad } = renderPanel();
        await pasteIntoSheet(user, CSV);
        await user.click(screen.getByRole('button', { name: 'Submit' }));

        expect(startLoad).toHaveBeenCalledWith(
            CSV,
            expect.objectContaining({ delimiter: ',', hasHeader: true, name: 1, team: 2, position: 3 }),
        );
    });

    it('sends the correction when the guess is overridden', async () => {
        const user = userEvent.setup();
        const { startLoad } = renderPanel();
        await pasteIntoSheet(user, CSV);
        await user.selectOptions(screen.getByRole('combobox', { name: 'TEAM' }), '3');
        await user.click(screen.getByRole('button', { name: 'Submit' }));

        expect(startLoad).toHaveBeenCalledWith(CSV, expect.objectContaining({ team: 3 }));
    });

    it('lets a column be marked as absent', async () => {
        const user = userEvent.setup();
        const { startLoad } = renderPanel();
        await pasteIntoSheet(user, CSV);
        await user.selectOptions(screen.getByRole('combobox', { name: 'TEAM' }), '');
        await user.click(screen.getByRole('button', { name: 'Submit' }));

        expect(startLoad).toHaveBeenCalledWith(CSV, expect.objectContaining({ team: null }));
    });

    // Editing the text after the guess must re-guess, or the map describes a
    // table that is no longer there.
    it('drops the mapping when the table is edited back into plain text', async () => {
        const user = userEvent.setup();
        const { startLoad } = renderPanel();
        await pasteIntoSheet(user, CSV);
        await user.clear(screen.getByPlaceholderText('Copy + Paste rankings here...'));
        await user.click(screen.getByPlaceholderText('Copy + Paste rankings here...'));
        await user.paste("Ja'Marr Chase\nBijan Robinson\nPuka Nacua");

        expect(screen.queryByRole('combobox', { name: 'NAME' })).toBeNull();
        await user.click(screen.getByRole('button', { name: 'Submit' }));
        expect(startLoad).toHaveBeenCalledWith("Ja'Marr Chase\nBijan Robinson\nPuka Nacua", null);
    });

    it('offers a file picker beside the paste box', async () => {
        const user = userEvent.setup();
        renderPanel();
        await openPasteSheet(user);

        expect(screen.getByRole('button', { name: 'Choose a file' })).toBeTruthy();
    });

    it('reads a chosen CSV file into the paste box and maps it', async () => {
        const user = userEvent.setup();
        const { container } = renderPanel();
        await openPasteSheet(user);

        const file = new File([CSV], 'ranks.csv', { type: 'text/csv' });
        await user.upload(container.querySelector('input[type="file"]'), file);

        expect(await screen.findByRole('combobox', { name: 'NAME' })).toHaveValue('1');
        expect(screen.getByPlaceholderText('Copy + Paste rankings here...')).toHaveValue(CSV);
    });
});

// A pasted line the matcher could not place used to be a sentence and nothing
// else - the only way to act on one was to re-paste the whole list. Each miss
// now carries the rank it was going to occupy and offers a search against it.
describe('RanksPanel unmatched lines', () => {
    const miss = { ranking: 2, search_string: 'Nobdy Whatsoever' };

    // Marlin Klein is the free agent from the fixture at the top of this file.
    const searchFor = async (user, text) => {
        const box = screen.getByRole('textbox', { name: /Find a player for/ });
        await user.click(box);
        await user.paste(text);
        return box;
    };

    it('says how many lines matched nothing', () => {
        renderPanel({ notFoundPlayers: [miss] });

        expect(screen.getByText('1 pasted line matched nothing')).toBeTruthy();
    });

    it('shows what the line said and the rank it was going to take', () => {
        renderPanel({ notFoundPlayers: [miss] });

        expect(screen.getByText('Nobdy Whatsoever')).toBeTruthy();
        expect(screen.getByText('RANK 2')).toBeTruthy();
    });

    it('offers a search against the line, not just a report of it', () => {
        renderPanel({ notFoundPlayers: [miss] });

        expect(screen.getByRole('textbox', { name: 'Find a player for “Nobdy Whatsoever”' })).toBeTruthy();
    });

    it('resolves the miss with the player picked', async () => {
        const user = userEvent.setup();
        // Empty list: the fixture's own rows render player names too, and the
        // point here is the name offered by the search.
        const { resolveMissingPlayer } = renderPanel({ notFoundPlayers: [miss], rankingPlayersIdsList: [] });

        await searchFor(user, 'Marlin');
        await user.click(screen.getByRole('button', { name: /Marlin Klein/ }));

        expect(resolveMissingPlayer).toHaveBeenCalledWith(miss, FREE_AGENT.id);
    });

    it('waits for a real query before listing anyone', async () => {
        const user = userEvent.setup();
        renderPanel({ notFoundPlayers: [miss], rankingPlayersIdsList: [] });

        await searchFor(user, 'Ma');

        expect(screen.queryByRole('button', { name: /Marlin Klein/ })).toBeNull();
    });

    it('gives each miss its own search', () => {
        renderPanel({
            notFoundPlayers: [miss, { ranking: 5, search_string: 'Someone Else' }],
        });

        expect(screen.getAllByRole('textbox', { name: /Find a player for/ })).toHaveLength(2);
    });

    it('says nothing at all when every line matched', () => {
        renderPanel({ notFoundPlayers: [] });

        expect(screen.queryByText(/matched nothing/)).toBeNull();
    });
});

// Tiers render as groups of the same rows, not different rows. The property
// that matters most is the negative one: a list with no tier structure has to
// look exactly as it did before any of this existed.
describe('RanksPanel tiers', () => {
    const tiered = (playerId, ranking, tier, tier_label) => ({
        match_results: [[playerId, '0.000']],
        ranking: String(ranking),
        search_string: 'a pasted rank line',
        tier,
        tier_label,
    });

    // FREE_AGENT and MY_PLAYER both survive the default filters;
    // OTHERS_PLAYER does not, which is what the emptied-tier case leans on.
    const twoTiers = [
        tiered(FREE_AGENT.id, 1, 1, 'Tier 1 \u00b7 Elite'),
        tiered(MY_PLAYER.id, 2, 2, 'Tier 2 \u00b7 Solid'),
    ];

    it('heads each tier with its label', () => {
        renderPanel({ rankingPlayersIdsList: twoTiers });

        expect(screen.getByRole('heading', { name: /Tier 1 \u00b7 Elite/ })).toBeTruthy();
        expect(screen.getByRole('heading', { name: /Tier 2 \u00b7 Solid/ })).toBeTruthy();
    });

    it('counts the players in each tier', () => {
        renderPanel({
            rankingPlayersIdsList: [
                tiered(FREE_AGENT.id, 1, 1, 'Tier 1'),
                tiered(MY_PLAYER.id, 2, 1, 'Tier 1'),
                tiered(OTHERS_PLAYER.id, 3, 2, 'Tier 2'),
            ],
        });

        const tierOne = screen.getByRole('region', { name: 'Tier 1' });
        expect(within(tierOne).getByRole('heading').textContent).toContain('2');
    });

    it('puts each player under their own tier', () => {
        renderPanel({ rankingPlayersIdsList: twoTiers });

        expect(within(screen.getByRole('region', { name: /Tier 1/ })).getByText(FREE_AGENT.name)).toBeTruthy();
        expect(within(screen.getByRole('region', { name: /Tier 2/ })).getByText(MY_PLAYER.name)).toBeTruthy();
    });

    // The reason grouping happens after filtering rather than before.
    it('drops a tier the filters have emptied, rather than heading nothing', () => {
        renderPanel({
            rankingPlayersIdsList: [tiered(FREE_AGENT.id, 1, 1, 'Tier 1'), tiered(OTHERS_PLAYER.id, 2, 2, 'Tier 2')],
        });

        // Tier 2 holds only someone else's player, hidden by default.
        expect(screen.getByRole('region', { name: 'Tier 1' })).toBeTruthy();
        expect(screen.queryByRole('region', { name: 'Tier 2' })).toBeNull();
    });

    it('keeps the surviving tiers apart when the ones between are filtered out', () => {
        renderPanel({
            rankingPlayersIdsList: [
                tiered(FREE_AGENT.id, 1, 1, 'Tier 1'),
                tiered(OTHERS_PLAYER.id, 2, 2, 'Tier 2'),
                tiered(MY_PLAYER.id, 3, 3, 'Tier 3'),
            ],
        });

        expect(screen.getByRole('region', { name: 'Tier 1' })).toBeTruthy();
        expect(screen.getByRole('region', { name: 'Tier 3' })).toBeTruthy();
    });

    // An untiered list renders as it always has - no heading, not even one.
    it('draws no tier heading for a list without tiers', () => {
        renderPanel();

        expect(screen.queryByRole('heading', { name: /Tier/ })).toBeNull();
        expect(screen.getByText(FREE_AGENT.name)).toBeTruthy();
    });
});
