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
