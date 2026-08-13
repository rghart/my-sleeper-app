import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import PlayerAvatar from './PlayerAvatar';

// jsdom applies no stylesheet and never loads images, so these cover which
// elements exist and what they point at. Whether the crop looks right is a
// browser question and was checked there.
const imagesIn = (container) => [...container.querySelectorAll('img')];

describe('PlayerAvatar', () => {
    it('points at the player thumb and the team logo', () => {
        const { container } = render(<PlayerAvatar playerId="4984" name="Josh Allen" team="BUF" />);
        const [player, team] = imagesIn(container);

        expect(player).toHaveAttribute('src', 'https://sleepercdn.com/content/nfl/players/thumb/4984.jpg');
        expect(team).toHaveAttribute('src', 'https://sleepercdn.com/images/team_logos/nfl/buf.png');
    });

    it('lower-cases the team, since the CDN path is lower-case', () => {
        const { container } = render(<PlayerAvatar playerId="1" name="A B" team="LAR" />);
        expect(imagesIn(container)[1]).toHaveAttribute('src', expect.stringContaining('/lar.png'));
    });

    it('renders no team logo for a free agent, rather than a broken one', () => {
        const { container } = render(<PlayerAvatar playerId="4984" name="Josh Allen" team={null} />);
        expect(imagesIn(container)).toHaveLength(1);
    });

    it('falls back to initials when there is no player id', () => {
        const { container } = render(<PlayerAvatar playerId={null} name="Josh Allen" team="BUF" />);

        expect(imagesIn(container)).toHaveLength(1);
        expect(screen.getByText('JA')).toBeInTheDocument();
    });

    it('takes two letters from a single-word name', () => {
        render(<PlayerAvatar playerId={null} name="Ocho" />);
        expect(screen.getByText('OC')).toBeInTheDocument();
    });

    it('renders nothing rather than "undefined" when there is no name at all', () => {
        const { container } = render(<PlayerAvatar playerId={null} name={undefined} />);
        expect(container.textContent).toBe('');
    });

    it('is hidden from assistive tech, since the row already names the player', () => {
        // Announcing it would be the third time the name is read on one row.
        const { container } = render(<PlayerAvatar playerId="4984" name="Josh Allen" team="BUF" />);
        expect(container.firstChild).toHaveAttribute('aria-hidden', 'true');
    });

    it('lazy-loads, because a pasted list is 200+ rows', () => {
        const { container } = render(<PlayerAvatar playerId="4984" name="Josh Allen" team="BUF" />);
        imagesIn(container).forEach((img) => expect(img).toHaveAttribute('loading', 'lazy'));
    });
});
