import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SyncStatusProvider, useSyncStatus, usePublishSyncStatus } from './SyncStatus';

const Publisher = ({ isSyncing }) => {
    usePublishSyncStatus(isSyncing);
    return null;
};

const Consumer = () => {
    const isSyncing = useSyncStatus();
    return <div data-testid="status">{String(isSyncing)}</div>;
};

// `showPublisher` unmounts Publisher without unmounting Consumer, which is
// the shape that matters: DraftPanel (Publisher here) unmounts on its own
// whenever the user switches sections, while the top bar (Consumer) stays on
// screen and has to notice.
const Harness = ({ showPublisher, isSyncing }) => (
    <SyncStatusProvider>
        {showPublisher ? <Publisher isSyncing={isSyncing} /> : null}
        <Consumer />
    </SyncStatusProvider>
);

describe('SyncStatus', () => {
    it('reports false with no publisher mounted', () => {
        render(<Harness showPublisher={false} />);

        expect(screen.getByTestId('status')).toHaveTextContent('false');
    });

    it('reports whatever the publisher publishes', () => {
        render(<Harness showPublisher={true} isSyncing={true} />);

        expect(screen.getByTestId('status')).toHaveTextContent('true');
    });

    it('clears back to false when the publisher unmounts, even if it published true', () => {
        const { rerender } = render(<Harness showPublisher={true} isSyncing={true} />);
        expect(screen.getByTestId('status')).toHaveTextContent('true');

        rerender(<Harness showPublisher={false} isSyncing={true} />);

        expect(screen.getByTestId('status')).toHaveTextContent('false');
    });

    it('reads false when used with no provider at all', () => {
        render(<Consumer />);

        expect(screen.getByTestId('status')).toHaveTextContent('false');
    });
});
