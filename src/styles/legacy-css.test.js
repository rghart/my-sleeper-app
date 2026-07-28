import { readFileSync } from 'fs';
import { resolve } from 'path';

// App.css is draining to zero as components move onto Tailwind, and this is the
// ratchet that keeps it draining. Two things are guarded:
//
// 1. The file only ever gets smaller. The ceiling drops in the change that
//    deletes the rules, so a later change cannot quietly grow it back.
// 2. A converted component's rules never come back. That matters more than it
//    looks: App.css is unlayered and utilities live in a cascade layer, so an
//    unlayered rule beats a utility no matter how specific the utility is. A
//    reintroduced `.error-banner` would silently win over the classes on the
//    component and the component would look untouched while being wrong.
//
// This file is deleted along with App.css at the end of the migration.
// Resolved from the vitest root rather than from import.meta.url: the jsdom
// environment does not hand this file a file: URL, so fileURLToPath throws.
const APP_CSS = resolve(process.cwd(), 'src/App.css');

// 427 lines before the redesign started; 381 after the dead CRA rules went;
// 345 with ErrorBanner converted; 340 once the shell replaced .main-container;
// 326 once Header's .title and .latest-update went with it.
//
// 328 after the palette flip, and this is the one time the ceiling has gone
// UP. Selection used to be a teal fill that was byte-identical to the RB
// position colour; replacing it with contrast and elevation costs two extra
// declarations. Raising the ceiling for a deliberate, explained reason is the
// ratchet doing its job - the thing it exists to stop is growth nobody
// noticed.
//
// 341 now that Button.css is deleted: two of its rules were never about
// buttons (`.clickable-item:hover` and the `.player-add-div` media query)
// and moved in here rather than being converted or dropped. This is rules
// relocating out of a deleted stylesheet, not new styling - the ratchet
// still only trends toward zero across the two files combined.
//
// 324 once the weekly lineup moved onto Tailwind as LineupPanel: both
// `.roster-positions` rules (the base one and the one inside the phone
// media query) and `.lineup-position` are gone. `.abbr-text`, `.full-text`,
// and `.avatar-player` stay - PlayerInfoItem still uses them and is not
// part of this migration.
//
// 240 once PlayerInfoItem moved onto Tailwind: `.single-player-item`,
// `.player-name`, `.player-info`, `.player-info-item`, the four
// `-available` rules, `.available`, `.search-alert`, `.avatar-player` (both
// the base rule and its phone media-query override), `.abbr-text` and
// `.full-text` (both the base rules and the width-breakpoint media query)
// and `.player-add-div`'s phone media query are all gone. `.QB`/`.RB`/
// `.WR`/`.TE`, `.draft-pick-rows` (both the base rule and its `:hover`),
// `.clickable-item:hover` and `.dropdown` stay - ManualPickModal and
// Dropdown still use them and neither is part of this migration.
const MAX_LINES = 240;

const CONVERTED = [
    'error-banner',
    'warning-banner',
    'main-container',
    'latest-update',
    '.title {',
    '.single-player-item',
    '.player-name',
    '.player-info {',
    '.player-info-item',
    '.RB-available',
    '.WR-available',
    '.TE-available',
    '.QB-available',
    '.available {',
    '.search-alert',
    '.avatar-player',
    '.abbr-text',
    '.full-text',
    '.player-add-div',
];

describe('App.css drain', () => {
    const css = readFileSync(APP_CSS, 'utf8');

    it(`is no more than ${MAX_LINES} lines`, () => {
        // trimEnd so this counts the way `wc -l` does - the file ends in a
        // newline, and an off-by-one here reads as a ratchet that is one line
        // looser than the number in the comment above says.
        expect(css.trimEnd().split('\n').length).toBeLessThanOrEqual(MAX_LINES);
    });

    it.each(CONVERTED)('has no rules left for the converted %s', (selector) => {
        expect(css).not.toContain(selector);
    });
});

// The rule the palette derives from: saturation is reserved for data. The old
// UI chrome broke it in the worst possible way - selected filters and the
// selected panel tab were filled with #00ceb8, which is byte-identical to the
// RB position colour, and rows hovered to #00d8a7 next door to it. Both are
// gone; this is what stops them coming back as "just a highlight".
describe('position colours are not reused as chrome', () => {
    // Button.css is gone - Button is Tailwind now, and its `alert` variant
    // deliberately fills with the `qb` token (see Button.tsx), so a raw hex
    // guard on that component would either fight the migration or need an
    // exception carved out for it. Button.tsx takes over the guard here.
    const CHROME_SHEETS = ['src/App.css', 'src/Components/Button/Button.tsx', 'src/index.css'];

    it.each(CHROME_SHEETS)('%s does not fill anything with the RB colour', (sheet) => {
        const contents = readFileSync(resolve(process.cwd(), sheet), 'utf8').toLowerCase();

        // The position palette itself is written in rgb() in App.css, so the
        // hex spelling appearing anywhere means something borrowed the hue.
        expect(contents).not.toContain('#00ceb8');
        expect(contents).not.toContain('#00d8a7');
    });
});
