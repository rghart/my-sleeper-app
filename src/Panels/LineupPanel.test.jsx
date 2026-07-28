import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LineupPanel from './LineupPanel';

const STARTER = {
    player_id: '13274',
    full_name: 'Germie Bernard',
    first_name: 'Germie',
    last_name: 'Bernard',
    position: 'WR',
    team: 'LV',
};

const PLAYER_INFO = { [STARTER.player_id]: STARTER };
const MISSING_ID = '999999';

// The filled slot is deliberately a FLX holding a WR: the label and the
// occupant's position must differ, or rendering the position instead of the
// label looks identical and the assertion proves nothing. A WR in a WR slot
// hides exactly the bug this is here to catch.
const ROSTER_SLOTS = [
    { label: 'QB', playerId: null },
    { label: 'FLX', playerId: STARTER.player_id },
    { label: 'WR', playerId: null },
];

function renderLineup(overrides = {}) {
    const removeFromLineup = vi.fn();
    const { unmount } = render(
        <LineupPanel
            playerInfo={PLAYER_INFO}
            rosterSlots={ROSTER_SLOTS}
            removeFromLineup={removeFromLineup}
            {...overrides}
        />,
    );
    return { removeFromLineup, unmount };
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

    it('renders empty slots as bare, non-interactive rows', () => {
        renderLineup();

        // Empty slots have no fill-from-slot action in this app, so they are
        // not buttons at all - only filled slots get a role of button.
        expect(screen.queryByRole('button', { name: 'QB, empty' })).toBeNull();
        expect(screen.queryByRole('button', { name: 'WR, empty' })).toBeNull();
        expect(screen.getByLabelText('QB, empty')).toBeTruthy();
        expect(screen.getByLabelText('WR, empty')).toBeTruthy();
    });

    it('calls removeFromLineup with the slot index, and ignores clicks on empty slots', async () => {
        const user = userEvent.setup();
        const { removeFromLineup } = renderLineup();

        // Empty slots are not buttons, so there is nothing to click - this
        // just confirms no stray handler exists on them.
        await user.click(screen.getByLabelText('QB, empty'));
        expect(removeFromLineup).not.toHaveBeenCalled();

        await user.click(screen.getByRole('button', { name: 'FLX, Germie Bernard, WR' }));
        // The index is which slot gets emptied, so passing the wrong one
        // clears someone else's.
        expect(removeFromLineup).toHaveBeenCalledTimes(1);
        expect(removeFromLineup).toHaveBeenCalledWith(1);
    });

    it('shows a muted count of unfilled slots, omitted entirely when zero', () => {
        const { unmount } = renderLineup();
        expect(screen.getByText('2 empty')).toBeTruthy();
        unmount();

        const fullSlots = [{ label: 'QB', playerId: STARTER.player_id }];
        renderLineup({ rosterSlots: fullSlots });
        expect(screen.queryByText(/empty$/)).toBeNull();
    });

    it('renders a slot holding an id missing from the player database, and keeps it removable', async () => {
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
        expect(removeFromLineup).toHaveBeenCalledWith(0);
    });

    it('shows the occupant name and team on screen, and Empty for an unfilled slot', () => {
        renderLineup();

        expect(screen.getByText(STARTER.full_name)).toBeVisible();
        // The second line is the team alone - there is no schedule data in
        // this app, so an opponent here would have to be invented.
        expect(screen.getByText(STARTER.team)).toBeVisible();
        expect(screen.getAllByText('Empty')).toHaveLength(2);
    });
});
