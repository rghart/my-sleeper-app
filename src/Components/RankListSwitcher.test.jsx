import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RankListSwitcher from './RankListSwitcher';

// The switcher's own popover used to be an `absolute top-full` panel: anchored
// under the trigger, inside the sheet header that holds it, with no idea how
// much screen was left below. A sheet with little in it - a slot with no
// candidates, "best available" before any list has been chosen - sits low, so
// the list of lists opened off the bottom of the screen and most of it could
// not be reached. It renders through the shared Popover now, which measures
// the space, flips above the trigger when there is more of it there, clamps to
// a scrollable max-height, and portals out of the sheet's clipping body.
//
// Placement itself is geometry and jsdom has no layout, so what is asserted
// here is the structural half that makes it possible: the panel is not inside
// the container that would clip it.

const savedRankLists = {
    default: { pretty_name: '-- Select saved ranks list', route_name: 'default' },
    my_rankings: { pretty_name: 'My Rankings', route_name: 'my_rankings', rank_list: [1, 2, 3] },
    superflex: { pretty_name: 'Superflex', route_name: 'superflex', rank_list: [1] },
};

const renderSwitcher = (overrides = {}) => {
    const props = {
        savedRankLists,
        savedRankListsLoading: false,
        signedIn: true,
        rankListId: null,
        onSelect: vi.fn(),
        onPasteNew: vi.fn(),
        sessionCount: 12,
        ...overrides,
    };
    // The clipping ancestor a sheet body is: an absolutely positioned panel
    // inside this is cut off at its edge.
    const { container } = render(
        <div style={{ overflowY: 'auto', height: '100px' }}>
            <RankListSwitcher {...props} />
        </div>,
    );
    return { ...props, container };
};

const open = async (user) => {
    await user.click(screen.getByRole('button', { name: /^Rank list/ }));
    return screen.getByRole('dialog', { name: 'Choose rank list' });
};

describe('RankListSwitcher', () => {
    it('escapes the scroller it is rendered inside rather than being clipped by it', async () => {
        const user = userEvent.setup();
        const { container } = renderSwitcher();

        const popover = await open(user);

        expect(container.contains(popover)).toBe(false);
        expect(popover.parentElement).toBe(document.body);
    });

    it('lists the session list and every saved one, and reports the choice', async () => {
        const user = userEvent.setup();
        const { onSelect } = renderSwitcher();

        const popover = await open(user);
        expect(within(popover).getByText('Current list')).toBeVisible();
        expect(within(popover).getByText('12 players')).toBeVisible();
        expect(within(popover).getByText('My Rankings')).toBeVisible();
        // The placeholder entry is RanksPanel's "nothing selected", not a list.
        expect(within(popover).queryByText(/Select saved ranks list/)).toBeNull();

        await user.click(within(popover).getByText('Superflex'));
        expect(onSelect).toHaveBeenCalledWith('superflex');
        expect(screen.queryByRole('dialog', { name: 'Choose rank list' })).toBeNull();
    });

    it('closes on Escape and on a click outside it', async () => {
        const user = userEvent.setup();
        renderSwitcher();

        await open(user);
        await user.keyboard('{Escape}');
        expect(screen.queryByRole('dialog', { name: 'Choose rank list' })).toBeNull();

        await open(user);
        await user.click(document.body);
        expect(screen.queryByRole('dialog', { name: 'Choose rank list' })).toBeNull();
    });
});
