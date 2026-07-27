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
// 345 with ErrorBanner converted; 340 once the shell replaced .main-container.
const MAX_LINES = 340;

const CONVERTED = ['error-banner', 'warning-banner', 'main-container'];

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
