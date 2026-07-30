import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import ClockCard from './ClockCard';

// The card replaced a stack of paragraphs, a bordered clock box and two
// buttons. Its three genuinely conditional pieces are what this covers: the
// "you in n" line, the progress bar (and its urgent colour), and the sync
// action's two states. The clock numeral itself is PickClock's, tested
// separately; the arithmetic under both is draftClock.js's.

const NOW = Date.UTC(2026, 6, 27, 12, 0, 0);

const liveDraft = (pickTimer = 100) => ({
    status: 'drafting',
    start_time: NOW,
    last_picked: null,
    settings: { pick_timer: pickTimer },
});

function renderCard(overrides = {}) {
    const onToggleSync = vi.fn();
    const onOpenSource = vi.fn();
    render(
        <ClockCard
            draft={liveDraft()}
            onTheClockName="crbiehl"
            pickLabel="Pick 2.05 · Round 2"
            picksUntilMine={2}
            sourceLabel="…3201"
            isSourceOpen={false}
            onOpenSource={onOpenSource}
            isSyncing={false}
            onToggleSync={onToggleSync}
            {...overrides}
        />,
    );
    return { onToggleSync, onOpenSource };
}

describe('ClockCard', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(NOW);
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('shows who is on the clock, which pick, and how far away yours is', () => {
        renderCard();

        expect(screen.getByText('crbiehl')).toBeVisible();
        expect(screen.getByText('Pick 2.05 · Round 2')).toBeVisible();
        expect(screen.getByText('YOU IN 2')).toBeVisible();
    });

    it('says YOUR PICK rather than "YOU IN 0" when you are the one on the clock', () => {
        renderCard({ picksUntilMine: 0 });

        expect(screen.getByText('YOUR PICK')).toBeVisible();
        expect(screen.queryByText(/YOU IN/)).toBeNull();
    });

    it('shows nothing at all when you have no pick left, rather than guessing at one', () => {
        renderCard({ picksUntilMine: null });

        expect(screen.queryByText(/YOU/)).toBeNull();
    });

    it('draws the progress bar for a timed draft and leaves it out entirely for an untimed one', () => {
        const { container } = render(
            <ClockCard
                draft={liveDraft()}
                onTheClockName="crbiehl"
                pickLabel="Pick 2.05 · Round 2"
                picksUntilMine={2}
                sourceLabel="…3201"
                onOpenSource={vi.fn()}
                onToggleSync={vi.fn()}
            />,
        );
        expect(container.querySelector('[class*="bg-line-mid"]')).not.toBeNull();

        const untimed = render(
            <ClockCard
                draft={{ status: 'drafting', start_time: NOW, last_picked: null, settings: { pick_timer: 0 } }}
                onTheClockName="crbiehl"
                pickLabel="Untimed"
                picksUntilMine={null}
                sourceLabel="…3201"
                onOpenSource={vi.fn()}
                onToggleSync={vi.fn()}
            />,
        );
        expect(untimed.container.querySelector('[class*="bg-line-mid"]')).toBeNull();
    });

    it('turns the bar and the numeral danger-red inside the last 30 seconds', () => {
        // 20s pick timer: the whole pick is inside the urgent window.
        const { container } = render(
            <ClockCard
                draft={liveDraft(20)}
                onTheClockName="crbiehl"
                pickLabel="Pick 2.05 · Round 2"
                picksUntilMine={0}
                sourceLabel="…3201"
                onOpenSource={vi.fn()}
                onToggleSync={vi.fn()}
            />,
        );

        expect(container.querySelector('[class*="bg-danger"]')).not.toBeNull();
        expect(screen.getByText('0:20').className).toMatch(/text-danger/);
    });

    it('is the only way to start and stop sync, and says which it will do', async () => {
        const { onToggleSync } = renderCard();

        screen.getByRole('button', { name: 'Sync draft' }).click();
        expect(onToggleSync).toHaveBeenCalledTimes(1);

        renderCard({ isSyncing: true });
        expect(screen.getByRole('button', { name: 'Stop sync' })).toBeInTheDocument();
    });

    it('labels the draft-source pill by the id it points at, not by the word "source" alone', async () => {
        const { onOpenSource } = renderCard();

        const pill = screen.getByRole('button', { name: 'Draft source: …3201' });
        expect(pill).toHaveAttribute('aria-expanded', 'false');

        pill.click();
        expect(onOpenSource).toHaveBeenCalledTimes(1);
    });
});

// A draft that isn't counting anything down gets a different card, not the
// countdown's card with its numeral swapped for a word. What Ryan
// screenshotted was the latter: `ON THE CLOCK` over `No pick on the clock`,
// which says the same non-fact twice, above a full-width violet Sync button on
// a board that had already finished.
describe('ClockCard at rest', () => {
    const completeDraft = {
        status: 'complete',
        season: '2026',
        player_pool: 'Rookie',
        start_time: NOW - 86400000,
        last_picked: NOW - 3600000,
        settings: { pick_timer: 43200 },
    };

    const renderResting = (overrides = {}) =>
        render(
            <ClockCard
                draft={completeDraft}
                onTheClockName="No pick on the clock"
                pickLabel="2026 Rookie"
                picksUntilMine={null}
                picksMade={48}
                syncedLabel="synced 2m ago"
                sourceLabel="…3201"
                onOpenSource={vi.fn()}
                onToggleSync={vi.fn()}
                {...overrides}
            />,
        );

    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(NOW);
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('leads with the state, and never repeats it as a headline under an On-the-clock eyebrow', () => {
        renderResting();

        expect(screen.getByText('Draft complete')).toBeVisible();
        expect(screen.queryByText('On the clock')).toBeNull();
        expect(screen.queryByText('No pick on the clock')).toBeNull();
    });

    it('takes its eyebrow from the draft itself', () => {
        renderResting();

        // Rendered uppercase by CSS; the text stays as written.
        expect(screen.getByText('2026 Rookie')).toBeVisible();
    });

    it('counts the picks and says when sync last landed', () => {
        renderResting();

        expect(screen.getByText('48 picks · synced 2m ago')).toBeVisible();
    });

    it('omits the sync half until a sync has actually landed', () => {
        renderResting({ syncedLabel: null });

        expect(screen.getByText('48 picks')).toBeVisible();
        expect(screen.queryByText(/synced/)).toBeNull();
    });

    it('drops sync to a secondary pill that still answers to the same name', () => {
        const onToggleSync = vi.fn();
        renderResting({ onToggleSync });

        // Reads SYNC, named "Sync draft" - the same action the counting-down
        // card spells out, so neither a screen reader nor a test sees two
        // different features.
        const sync = screen.getByRole('button', { name: 'Sync draft' });
        // Exactly "Sync", not "Sync draft": `toHaveTextContent` is a substring
        // match, so it passes on the counting-down card's full-width button too
        // and proves nothing about which shape rendered.
        expect(sync.textContent).toBe('Sync');
        sync.click();
        expect(onToggleSync).toHaveBeenCalledTimes(1);
    });

    it('renders no countdown and no progress bar', () => {
        const { container } = renderResting();

        expect(screen.queryByText(/Time expired/)).toBeNull();
        expect(container.querySelector('[class*="bg-line-mid"]')).toBeNull();
    });

    it('never claims a turn is coming on a draft with no clock', () => {
        renderResting({ picksUntilMine: 2 });

        expect(screen.queryByText(/YOU IN/)).toBeNull();
    });
});

// An untimed draft (`pick_timer: 0` - Sleeper's shape for a slow dynasty
// rookie draft with no per-pick limit) is underway like any other: somebody is
// up, and who that is is the most useful line on the screen. The card used to
// key both halves off the countdown, so it read `Untimed draft` and never
// named them.
describe('ClockCard on an untimed draft that has started', () => {
    const untimedDraft = {
        status: 'drafting',
        season: '2026',
        player_pool: 'Rookie',
        start_time: NOW - 86400000,
        last_picked: NOW - 3600000,
        settings: { pick_timer: 0 },
    };

    const renderUntimed = (overrides = {}) =>
        render(
            <ClockCard
                draft={untimedDraft}
                onTheClockName="crbiehl"
                pickLabel="Pick 2.05 · Round 2"
                picksUntilMine={2}
                picksMade={16}
                syncedLabel="synced 2m ago"
                sourceLabel="…3201"
                onOpenSource={vi.fn()}
                onToggleSync={vi.fn()}
                {...overrides}
            />,
        );

    it('names who is on the clock, and says so in the eyebrow', () => {
        renderUntimed();

        expect(screen.getByText('On the clock')).toBeVisible();
        expect(screen.getByText('crbiehl')).toBeVisible();
        expect(screen.getByText('Pick 2.05 · Round 2')).toBeVisible();
        expect(screen.queryByText('Untimed draft')).toBeNull();
    });

    it('still counts your own turn down in picks, which is the only unit it has', () => {
        renderUntimed();

        expect(screen.getByText('YOU IN 2')).toBeVisible();
    });

    it('borrows the resting card’s chrome, since there is nothing to count', () => {
        const { container } = renderUntimed();

        expect(container.querySelector('[class*="bg-line-mid"]')).toBeNull();
        expect(screen.getByRole('button', { name: 'Sync draft' }).textContent).toBe('Sync');
    });

    it('falls back to the state when the board has nobody left on it', () => {
        renderUntimed({ onTheClockName: null, pickLabel: null });

        expect(screen.getByText('Untimed draft')).toBeVisible();
        expect(screen.queryByText('On the clock')).toBeNull();
        expect(screen.getByText('16 picks · synced 2m ago')).toBeVisible();
    });
});
