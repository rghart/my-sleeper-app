import { useState } from 'react';

// The player's face, with their team's mark on it — both from Sleeper's CDN,
// which is the same source the app already pulls player data from.
//
// This existed before the redesign (PR #133 dropped it along with the old
// PlayerInfoItem markup) and is deliberately coming back: a list of 200 names
// in one typeface is genuinely hard to scan, and a face is the fastest thing
// a human recognises. It is decoration in the sense that no decision depends
// on it, which is exactly why it must never cost a row its layout.
//
// Sizes are fixed rather than fluid: the row geometry in `ListRow` is pinned
// to the pixel (see its comment about 46px/56px), so an avatar that could
// change size would be the one thing able to break it.

const PLAYER_THUMB = (playerId) => `https://sleepercdn.com/content/nfl/players/thumb/${playerId}.jpg`;
const TEAM_LOGO = (team) => `https://sleepercdn.com/images/team_logos/nfl/${team.toLowerCase()}.png`;

/**
 * The two-letter fallback, same idea as `avatarInitials` for managers but on a
 * full name that is always "First Last" here rather than a display handle.
 */
const initials = (name) => {
    if (!name) return '';
    const words = String(name).trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) return '';
    if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
    return (words[0][0] + words[1][0]).toUpperCase();
};

const PlayerAvatar = ({ playerId, name, team, size = 32 }) => {
    // Tracked per-image rather than as one flag: a player with no headshot
    // very often still has a team, and vice versa for a free agent. Collapsing
    // them would drop a mark we do have.
    const [playerFailed, setPlayerFailed] = useState(false);
    const [teamFailed, setTeamFailed] = useState(false);

    // Sleeper answers 200 with a placeholder silhouette for most missing
    // headshots rather than 404ing, so `onError` is a backstop for the cases
    // it does 404 (and for the CDN being unreachable), not the main path.
    const showPlayer = playerId && !playerFailed;
    const showTeam = team && !teamFailed;
    const badge = Math.round(size * 0.45);

    return (
        // `aria-hidden`: every row already carries the player's name, team and
        // position in its accessible label, so announcing this would be the
        // third time. Purely visual, and marked as such.
        <span
            aria-hidden="true"
            className="bg-raised-2 relative shrink-0 overflow-visible rounded-full"
            style={{ width: size, height: size }}
        >
            {showPlayer ? (
                <img
                    src={PLAYER_THUMB(playerId)}
                    alt=""
                    // `loading="lazy"` matters more here than anywhere else in
                    // the app: a pasted rank list is 200+ rows, and eagerly
                    // fetching 200 headshots on mount would be a worse trade
                    // than not having them at all.
                    loading="lazy"
                    decoding="async"
                    onError={() => setPlayerFailed(true)}
                    className="h-full w-full rounded-full object-cover object-top"
                    style={{ width: size, height: size }}
                />
            ) : (
                <span
                    className="text-ink-dim flex h-full w-full items-center justify-center rounded-full font-mono font-semibold"
                    style={{ fontSize: Math.round(size * 0.34) }}
                >
                    {initials(name)}
                </span>
            )}

            {showTeam && (
                // Overlapping the bottom-right corner rather than sitting in
                // the meta line: the team is a property *of the player*, and
                // pairing the two costs no horizontal room on a 375px row —
                // which is the width the meta line was already truncating at.
                <img
                    src={TEAM_LOGO(team)}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    onError={() => setTeamFailed(true)}
                    className="bg-ground absolute -right-0.5 -bottom-0.5 rounded-full object-contain p-[1px]"
                    style={{ width: badge, height: badge }}
                />
            )}
        </span>
    );
};

export default PlayerAvatar;
