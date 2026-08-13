import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import ValueChip, { formatChange, formatValue } from './ValueChip';

describe('formatValue', () => {
    it('abbreviates thousands, which is what keeps the row from truncating', () => {
        expect(formatValue(9997)).toBe('10.0k');
        expect(formatValue(6012)).toBe('6.0k');
    });

    it('leaves a sub-thousand value whole, since there is nothing to abbreviate', () => {
        expect(formatValue(940)).toBe('940');
        expect(formatValue(0)).toBe('0');
    });

    it('is null when there is no value, so the caller renders nothing', () => {
        expect(formatValue(null)).toBeNull();
        expect(formatValue(undefined)).toBeNull();
    });
});

describe('formatChange', () => {
    it('signs the percentage', () => {
        expect(formatChange(4.2)).toBe('+4%');
        expect(formatChange(-2.7)).toBe('-3%');
    });

    it('distinguishes flat from unknown', () => {
        // The API sends null rather than 0 precisely so these stay apart: a
        // player nobody has a reading on must not claim he held steady.
        expect(formatChange(0)).toBe('±0');
        expect(formatChange(0.2)).toBe('±0');
        expect(formatChange(null)).toBeNull();
    });
});

describe('ValueChip', () => {
    it('shows the value and its movement', () => {
        render(<ValueChip value={6012} changePct={4.2} />);
        expect(screen.getByText('6.0k')).toBeInTheDocument();
        expect(screen.getByText('+4%')).toBeInTheDocument();
    });

    it('renders nothing at all without a value', () => {
        // A row for a player the market has never priced is exactly the row
        // this app rendered before the feature existed.
        const { container } = render(<ValueChip value={null} changePct={5} />);
        expect(container).toBeEmptyDOMElement();
    });

    it('shows the value alone when there is no movement reading', () => {
        const { container } = render(<ValueChip value={6012} changePct={null} />);
        expect(screen.getByText('6.0k')).toBeInTheDocument();
        // No dash placeholder: in a line of percentages a dash reads as one.
        expect(container.textContent).toBe('6.0k');
    });

    it('colours only a move big enough to be a trend', () => {
        // KTC values wobble daily on crowd votes; colouring a 1% move would
        // be the figure being honest and the styling overclaiming.
        const { container: small } = render(<ValueChip value={6012} changePct={1.4} />);
        expect(small.querySelector('.text-ink-dim')).toBeInTheDocument();

        const { container: rise } = render(<ValueChip value={6012} changePct={9} />);
        expect(rise.querySelector('.text-live')).toBeInTheDocument();

        const { container: fall } = render(<ValueChip value={6012} changePct={-9} />);
        expect(fall.querySelector('.text-warn')).toBeInTheDocument();
    });
});
