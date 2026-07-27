import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import Spinner from './Spinner';

// Deliberately not role="status": ErrorBanner's warning variant already owns
// that role, and several App.test.jsx assertions query getByRole('status')
// expecting exactly that banner. A second status node would make those
// queries ambiguous.
describe('Spinner', () => {
    it('exposes an accessible progressbar with the label it was given', () => {
        render(<Spinner size="panel" />);

        expect(screen.getByRole('progressbar', { name: 'Loading' })).toBeTruthy();
        expect(screen.queryByRole('status')).toBeNull();
    });

    it('gives the page variant a distinct, more specific label', () => {
        render(<Spinner size="page" />);

        expect(screen.getByRole('progressbar', { name: 'Loading your leagues' })).toBeTruthy();
        expect(screen.queryByRole('progressbar', { name: 'Loading' })).toBeNull();
    });

    it('renders the page and panel variants as distinguishable elements', () => {
        render(
            <div>
                <Spinner size="page" />
                <Spinner size="panel" />
            </div>,
        );

        const pageSpinner = screen.getByRole('progressbar', { name: 'Loading your leagues' });
        const panelSpinner = screen.getByRole('progressbar', { name: 'Loading' });

        expect(pageSpinner).not.toBe(panelSpinner);
        expect(screen.getAllByRole('progressbar')).toHaveLength(2);
    });
});
