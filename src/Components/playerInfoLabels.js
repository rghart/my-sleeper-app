// The row's visible availability text: the manager's name when taken (the
// "Taken" chip beside it already says the word "taken"), or "Free agent"
// when not. Kept separate from the accessible name below - screen-reader
// users don't have the chip's text to lean on, so the name spells the
// relationship out ("taken by X") rather than assuming the chip's context.
export const playerAvailabilityText = ({ taken, rosteredByName }) => (taken ? rosteredByName : 'Free agent');

// "Bijan Robinson, RB, taken by kpresley" / "Marlin Klein, TE, free agent",
// plus ", yours" and ", low confidence match" where they apply.
//
// Those last two are here because the row encodes them *only* as a border
// colour - violet for yours, warn for a weak match. A colour-only encoding
// says nothing to a screen reader, and it is also the one thing a test cannot
// assert under this repo's no-className rule, so both problems have the same
// fix: put the meaning in the name. Ownership reads "taken by ryangh · you",
// keeping the manager's name and marking the whole attribution - the same
// convention pickLabels.js uses for your own picks. Replacing the name with a
// bare "you" would have dropped the identity that the league-switch
// attribution test in App.test.jsx exists to prove.
export const playerAccessibleName = ({ player, taken, rosteredByName, isMine = false, lowConfidenceMatch = false }) => {
    let availability = 'free agent';
    if (taken) {
        availability = isMine ? `taken by ${rosteredByName} · you` : `taken by ${rosteredByName}`;
    }
    const nameParts = [player.full_name, player.position, availability];
    if (lowConfidenceMatch) {
        nameParts.push('low confidence match');
    }
    return nameParts.join(', ');
};
