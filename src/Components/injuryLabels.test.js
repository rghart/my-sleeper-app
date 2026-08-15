import { describe, expect, it } from 'vitest';
import { injuryAccessibleText, injuryBadge, injuryDetail, returnText } from './injuryLabels.js';

const player = (attrs) => ({ full_name: 'Malik Nabers', position: 'WR', ...attrs });

describe('injuryBadge', () => {
    it('shortens the statuses Sleeper spells out', () => {
        expect(injuryBadge(player({ injury_status: 'Questionable' })).badge).toBe('Q');
        expect(injuryBadge(player({ injury_status: 'PUP' })).badge).toBe('PUP');
    });

    it('colours questionable as a warning and the rest as danger', () => {
        // "Questionable" usually plays; the others do not. Rendering them
        // alike would make the row's loudest signal mean two different things.
        expect(injuryBadge(player({ injury_status: 'Questionable' })).tone).toBe('warn');
        expect(injuryBadge(player({ injury_status: 'IR' })).tone).toBe('danger');
        expect(injuryBadge(player({ injury_status: 'Out' })).tone).toBe('danger');
    });

    // 61 players carry `NA` against 372 genuinely questionable ones, so
    // treating it as an injury would put a warning badge on five dozen healthy
    // players. It is Sleeper's spelling of "no status", not a status.
    it('refuses NA, which is how Sleeper spells no status at all', () => {
        expect(injuryBadge(player({ injury_status: 'NA' }))).toBeNull();
    });

    it('drops a status it has no short form for rather than rendering it raw', () => {
        expect(injuryBadge(player({ injury_status: 'Doubtful-ish' }))).toBeNull();
    });

    it('is silent for a healthy player and for a missing one', () => {
        expect(injuryBadge(player({}))).toBeNull();
        expect(injuryBadge(null)).toBeNull();
    });
});

describe('returnText', () => {
    const today = new Date(2026, 7, 15);

    it('reads a date still ahead as when he is back', () => {
        expect(returnText('2026-08-22', today)).toBe('back Aug 22');
    });

    // Different facts: a date already passed means he was expected back and
    // nothing has said otherwise, which is softer news than one still to come.
    it('marks a date already passed as overdue rather than as news', () => {
        expect(returnText('2026-08-01', today)).toBe('due back Aug 1');
    });

    it('treats today as still ahead', () => {
        expect(returnText('2026-08-15', today)).toBe('back Aug 15');
    });

    // `new Date('2026-08-22')` is UTC midnight, which renders as Aug 21 in any
    // negative offset — the app's own timezone included.
    it('does not slip a day in a negative UTC offset', () => {
        expect(returnText('2026-08-22', today)).toBe('back Aug 22');
        expect(returnText('2026-01-01', new Date(2025, 11, 1))).toBe('back Jan 1');
    });

    it('is silent when there is no date', () => {
        expect(returnText(null, today)).toBeNull();
        expect(returnText('not-a-date', today)).toBeNull();
    });
});

describe('injuryDetail', () => {
    it('joins only the parts that exist', () => {
        expect(injuryDetail(player({ injury_status: 'Questionable', injury_body_part: 'Hamstring' }), null)).toBe(
            'Q · Hamstring',
        );
        expect(injuryDetail(player({ injury_status: 'IR' }), null)).toBe('IR');
    });

    it('is silent for a player with no injury, whatever else he carries', () => {
        expect(injuryDetail(player({ injury_body_part: 'Hamstring' }), '2026-08-22')).toBeNull();
    });
});

describe('injuryAccessibleText', () => {
    // "Q" read aloud is not a word.
    it('spells the badge out', () => {
        expect(injuryAccessibleText(player({ injury_status: 'Questionable', injury_body_part: 'Knee' }), null)).toBe(
            'questionable, knee',
        );
        expect(injuryAccessibleText(player({ injury_status: 'PUP' }), null)).toBe('on PUP');
    });

    it('is silent for a healthy player, so the name is unchanged', () => {
        expect(injuryAccessibleText(player({}), null)).toBeNull();
    });
});
