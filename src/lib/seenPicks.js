/**
 * Pure helpers for "what did I miss": which picks have been made, and which
 * of those are new since the visitor's last visit.
 *
 * Identity is `${round.round}.${pick.pick_number}`, not a "highest pick
 * reached" cursor. `applyManualPick` lets a pick in any future round be
 * projected in ahead of picks still open in earlier rounds, so a cursor built
 * from "furthest pick made" would advance past real, still-unseen picks and
 * silently hide them. A set of made-pick keys has no such ordering
 * assumption - each pick is judged on its own.
 */

export const pickKey = (round, pick) => `${round.round}.${pick.pick_number}`;

export const madePickKeys = (builtDraft) => {
    if (!builtDraft) {
        return [];
    }
    return builtDraft.flatMap((round) =>
        round.picks.filter((pick) => pick.player_id).map((pick) => pickKey(round, pick)),
    );
};

export const newPickKeySet = (builtDraft, seenKeys) => {
    if (!builtDraft || !seenKeys) {
        return new Set();
    }
    return new Set(madePickKeys(builtDraft).filter((key) => !seenKeys.has(key)));
};

export const countNewInRound = (round, newPickKeys) =>
    round.picks.filter((pick) => newPickKeys.has(pickKey(round, pick))).length;
