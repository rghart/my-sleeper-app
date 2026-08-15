// Injury comes from Sleeper's own player dump (`injury_status` /
// `injury_body_part`), not from a value source — see the backend migration
// that extracted them. `injury_return` arrives separately, on the dynasty
// value row, because only KeepTradeCut publishes an expected return date.
//
// The badge text is deliberately not the raw status. Sleeper spells them
// "Questionable"/"PUP"/"Sus", which is nine characters of a row that measured
// tests have already shown has none to spare, so each maps to the short form
// the rest of fantasy uses.
const STATUS = {
    Questionable: { badge: 'Q', label: 'questionable', tone: 'warn' },
    Out: { badge: 'OUT', label: 'out', tone: 'danger' },
    IR: { badge: 'IR', label: 'on injured reserve', tone: 'danger' },
    PUP: { badge: 'PUP', label: 'on PUP', tone: 'danger' },
    DNR: { badge: 'DNR', label: 'did not report', tone: 'danger' },
    Sus: { badge: 'SUS', label: 'suspended', tone: 'danger' },
};

// `NA` is not an injury and must never render as one. It is how Sleeper
// spells "no applicable status" and it is on 61 players — mostly inactive and
// practice-squad — against 372 genuinely questionable ones (measured
// 2026-08-15 against the live payload). Rendering it would put a warning
// badge on five dozen healthy players, which is the same `NA`-is-not-a-value
// trap the id crosswalk hit.
//
// Anything else unrecognised is dropped for the same reason: a status this
// module has no short form for would render as raw text of unknown length,
// and a badge nobody can read is worse than no badge.
export const injuryBadge = (player) => STATUS[player?.injury_status] ?? null;

// The popover's contents: a headline naming the status, then whatever else is
// known. Split into lines rather than one joined string because this is the
// one place with room to be readable — the row itself has 10px of slack (see
// InjuryTag) and had to give the detail up.
export const injuryDetailLines = (player, injuryReturn) => {
    const badge = injuryBadge(player);
    if (!badge) return { headline: null, body: [] };

    const body = [];
    if (player.injury_body_part) body.push(player.injury_body_part);

    const back = returnText(injuryReturn);
    // Named as an expectation, not a fact. It is KeepTradeCut's read of when
    // he returns, and a date rendered bare invites being taken for official.
    if (back) body.push(`Expected ${back}`);

    return { headline: badge.label, body };
};

// "Q · Hamstring · back Aug 22" — the detail line, built only from the parts
// that exist. The body part is absent for about one injured player in eight
// and the return date for most of them, so every separator is conditional
// rather than the line being assembled and then tidied.
export const injuryDetail = (player, injuryReturn) => {
    const badge = injuryBadge(player);
    if (!badge) return null;

    const parts = [badge.badge];
    if (player.injury_body_part) parts.push(player.injury_body_part);

    const back = returnText(injuryReturn);
    if (back) parts.push(back);

    return parts.join(' · ');
};

// "back Aug 22" for a date still ahead, "due back Aug 15" for one already
// passed. The two are different facts: a return date in the past means the
// player was expected back and the market has not been told otherwise, which
// is a softer signal than a date still to come, and collapsing them would let
// a stale date read as fresh news.
export const returnText = (injuryReturn, today = new Date()) => {
    if (!injuryReturn) return null;

    // The API sends a plain `YYYY-MM-DD`. Parsing it with `new Date()` would
    // read it as UTC midnight and render the day before in any negative
    // offset, so the parts are split out and fed to the local-time
    // constructor instead.
    const [year, month, day] = injuryReturn.split('-').map(Number);
    if (!year || !month || !day) return null;

    const date = new Date(year, month - 1, day);
    if (Number.isNaN(date.getTime())) return null;

    const label = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    return date < startOfToday ? `due back ${label}` : `back ${label}`;
};

// Screen readers get the long form: the badge is two or three letters chosen
// to fit, and "Q" read aloud is not a word. Appended to the accessible name
// the same way "yours" and "low confidence match" already are.
export const injuryAccessibleText = (player, injuryReturn) => {
    const badge = injuryBadge(player);
    if (!badge) return null;

    const parts = [badge.label];
    if (player.injury_body_part) parts.push(player.injury_body_part.toLowerCase());

    const back = returnText(injuryReturn);
    if (back) parts.push(back);

    return parts.join(', ');
};
