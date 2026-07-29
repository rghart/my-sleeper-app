import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RankListProvider, useRankList, usePublishRankList } from './RankList';

const OPTIONS = [
    { value: 'default', label: '-- Select saved ranks list' },
    { value: 'rookies_v3', label: '2026 Rookie Ranks v3' },
];

const Publisher = ({ currentValue }) => {
    usePublishRankList({ options: OPTIONS, currentValue, onChange: () => {} });
    return null;
};

const Consumer = () => {
    const rankList = useRankList();
    return <div data-testid="status">{rankList ? rankList.currentValue : 'none'}</div>;
};

// `showPublisher` unmounts Publisher without unmounting Consumer, which is
// the shape that matters: RanksPanel (Publisher here) unmounts on its own
// whenever the user switches sections, while the top bar (Consumer) stays on
// screen and has to notice - the same reasoning SyncStatus.test.jsx exercises
// for isSyncing.
const Harness = ({ showPublisher, currentValue }) => (
    <RankListProvider>
        {showPublisher ? <Publisher currentValue={currentValue} /> : null}
        <Consumer />
    </RankListProvider>
);

describe('RankList', () => {
    it('reports no rank list with no publisher mounted', () => {
        render(<Harness showPublisher={false} />);

        expect(screen.getByTestId('status')).toHaveTextContent('none');
    });

    it('reports whatever the publisher publishes', () => {
        render(<Harness showPublisher={true} currentValue="rookies_v3" />);

        expect(screen.getByTestId('status')).toHaveTextContent('rookies_v3');
    });

    it('clears back to null when the publisher unmounts, even if it had published a list', () => {
        const { rerender } = render(<Harness showPublisher={true} currentValue="rookies_v3" />);
        expect(screen.getByTestId('status')).toHaveTextContent('rookies_v3');

        rerender(<Harness showPublisher={false} currentValue="rookies_v3" />);

        expect(screen.getByTestId('status')).toHaveTextContent('none');
    });

    it('reads no rank list when used with no provider at all', () => {
        render(<Consumer />);

        expect(screen.getByTestId('status')).toHaveTextContent('none');
    });

    // The regression this file was written by: publishing re-renders every
    // consumer, the publisher included, so an effect keyed off the identity of
    // `options` or `onChange` refires forever for any caller that builds
    // either inline. The first version of the hook did exactly that and hung
    // the test worker until it ran out of memory rather than failing an
    // assertion - so this publisher deliberately passes a brand new array and
    // a brand new function on every single render.
    it('does not loop when the publisher rebuilds its options and handler every render', () => {
        let renders = 0;
        const UnstablePublisher = () => {
            renders += 1;
            usePublishRankList({
                options: [{ value: 'rookies_v3', label: '2026 Rookie Ranks v3' }],
                currentValue: 'rookies_v3',
                onChange: () => {},
            });
            return null;
        };

        render(
            <RankListProvider>
                <UnstablePublisher />
                <Consumer />
            </RankListProvider>,
        );

        expect(screen.getByTestId('status')).toHaveTextContent('rookies_v3');
        // One render to publish, one for the provider's resulting state
        // change, and StrictMode-free rendering adds nothing else. A loop
        // would be in the thousands before the worker died.
        expect(renders).toBeLessThan(5);
    });

    it('reaches the latest onChange rather than the one published first', async () => {
        const calls = [];
        const LatestHandlerPublisher = ({ tag }) => {
            usePublishRankList({
                options: OPTIONS,
                currentValue: 'rookies_v3',
                onChange: () => calls.push(tag),
            });
            return null;
        };
        const Invoker = () => {
            const rankList = useRankList();
            return (
                <button type="button" onClick={() => rankList?.onChange('x')}>
                    change
                </button>
            );
        };

        const { rerender } = render(
            <RankListProvider>
                <LatestHandlerPublisher tag="first" />
                <Invoker />
            </RankListProvider>,
        );
        rerender(
            <RankListProvider>
                <LatestHandlerPublisher tag="second" />
                <Invoker />
            </RankListProvider>,
        );

        await userEvent.click(screen.getByRole('button', { name: 'change' }));

        expect(calls).toEqual(['second']);
    });
});
