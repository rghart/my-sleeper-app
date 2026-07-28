import { existsSync, readFileSync, readdirSync } from 'fs';
import { resolve, join, extname } from 'path';

// The App.css drain finished: RanksPanel and ManualPickModal were the last two
// components on it (plus LeaguePanel, DraftPanel and Dropdown, which shared a
// handful of its rules - `.panel`, `.player-grid`, `.input-small`, `.dropdown`
// - without being named on the original migration list). The ratchet's job
// here is done, so instead of shrinking a line-count ceiling it now guards the
// two things that would make the file's absence a lie: that it is actually
// gone, and that nothing still tries to import it. An import of a deleted
// file doesn't fail loudly in every bundler configuration - some resolve it
// to `undefined` at build time - so this is a real regression class, not a
// theoretical one.
const APP_CSS = resolve(process.cwd(), 'src/App.css');
const SRC_DIR = resolve(process.cwd(), 'src');
// Resolved the same way as APP_CSS above rather than via import.meta.url: the
// jsdom test environment doesn't hand this file a file: URL, so
// fileURLToPath throws here just as it would for App.css itself.
const THIS_FILE = resolve(process.cwd(), 'src/styles/legacy-css.test.js');

// Walked by hand rather than via a glob dependency: this repo has no existing
// file-walking utility to reach for, and pulling one in for a single test is
// more machinery than the test is worth.
const walk = (dir) =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) {
            return walk(full);
        }
        return ['.js', '.jsx', '.ts', '.tsx'].includes(extname(entry.name)) ? [full] : [];
    });

describe('App.css is gone', () => {
    it('no longer exists on disk', () => {
        expect(existsSync(APP_CSS)).toBe(false);
    });

    it('is not imported from anywhere in src', () => {
        // Excludes this file itself: it necessarily mentions "App.css" by
        // name (in this very string, and in the comments above), which isn't
        // an import of it.
        const importers = walk(SRC_DIR).filter(
            (file) => file !== THIS_FILE && readFileSync(file, 'utf8').includes('App.css'),
        );
        expect(importers).toEqual([]);
    });
});

// The rule the palette derives from: saturation is reserved for data. The old
// UI chrome broke it in the worst possible way - selected filters and the
// selected panel tab were filled with #00ceb8, which is byte-identical to the
// RB position colour, and rows hovered to #00d8a7 next door to it. Both are
// gone; this is what stops them coming back as "just a highlight". Still
// useful post-migration: nothing about App.css's deletion makes this
// regression class less possible in whatever replaces it.
describe('position colours are not reused as chrome', () => {
    // Button.css is gone - Button is Tailwind now, and its `alert` variant
    // deliberately fills with the `qb` token (see Button.tsx), so a raw hex
    // guard on that component would either fight the migration or need an
    // exception carved out for it. Button.tsx takes over the guard here.
    // App.css dropped out of this list along with the rest of the migration -
    // there is nothing left at that path to read.
    const CHROME_SHEETS = ['src/Components/Button/Button.tsx', 'src/index.css'];

    it.each(CHROME_SHEETS)('%s does not fill anything with the RB colour', (sheet) => {
        const contents = readFileSync(resolve(process.cwd(), sheet), 'utf8').toLowerCase();

        // The position palette itself used to be written in rgb() in App.css,
        // so the hex spelling appearing anywhere meant something borrowed the
        // hue. That source is gone, but the hex guard still catches the same
        // mistake anywhere else it could reappear.
        expect(contents).not.toContain('#00ceb8');
        expect(contents).not.toContain('#00d8a7');
    });
});
