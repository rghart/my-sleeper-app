const PLAYER_TYPE_POOL = {
    1: 'Rookie',
    2: 'Veteran',
};

const getPlayerPool = (playerType) => PLAYER_TYPE_POOL[playerType] ?? 'All players';

const createPickOrder = ({ currentDraft, rosterOwnerByRosterId, round }) => {
    const pickOrder = Object.entries(currentDraft.slot_to_roster_id).map(([key, value]) => {
        const userID = rosterOwnerByRosterId.has(value) ? rosterOwnerByRosterId.get(value) : null;
        return {
            user_id: userID,
            roster_id: value,
            is_traded: false,
            owner_id: value,
            pick_round: round,
            pick_number: Number(key),
            board_spot: Number(key),
            player_id: null,
        };
    });
    pickOrder.sort((a, b) => a.pick_number - b.pick_number);

    if (currentDraft.type === 'snake' && round % 2 === 0) {
        pickOrder.reverse();
        return pickOrder.map((pick, i) => ({ ...pick, pick_number: i + 1 }));
    }

    return pickOrder;
};

/**
 * Pure builder for a fantasy draft board.
 *
 * Given the raw draft settings, roster data, and traded-pick records, returns
 * a brand new `{ built_draft, player_pool }` object. Never mutates any of its
 * inputs.
 */
export function buildDraftRounds({ currentDraft, rosterData, tradedDraftPicks }) {
    const { settings } = currentDraft;
    const player_pool = getPlayerPool(settings.player_type);

    const rosterOwnerByRosterId = new Map(rosterData.map((roster) => [roster.roster_id, roster.owner_id]));

    const draftRounds = [];
    for (let i = 0; i < settings.rounds; i++) {
        const round = settings.rounds - i;
        draftRounds.unshift({
            round,
            picks: createPickOrder({ currentDraft, rosterOwnerByRosterId, round }),
        });
    }

    const builtDraftWithTrades = draftRounds.map((round) => ({ ...round, picks: [...round.picks] }));

    tradedDraftPicks.forEach((tradedPick) => {
        const roundEntry = builtDraftWithTrades[tradedPick.round - 1];
        // The previous implementation threw a TypeError on either of these cases,
        // taking the whole draft board down. Skipping the unmatched record is
        // kinder, but warn rather than swallowing it -- it means the traded-pick
        // data disagrees with the draft's own slot_to_roster_id.
        if (!roundEntry) {
            console.warn(`Ignoring traded pick for round ${tradedPick.round}: draft has no such round`);
            return;
        }
        const pickIndex = roundEntry.picks.findIndex((pick) => pick.roster_id === tradedPick.roster_id);
        if (pickIndex === -1) {
            console.warn(
                `Ignoring traded pick in round ${tradedPick.round}: roster ${tradedPick.roster_id} has no pick in this draft`,
            );
            return;
        }
        roundEntry.picks[pickIndex] = {
            ...roundEntry.picks[pickIndex],
            owner_id: tradedPick.owner_id,
            is_traded: true,
        };
    });

    return {
        built_draft: builtDraftWithTrades,
        player_pool,
    };
}

export default buildDraftRounds;
