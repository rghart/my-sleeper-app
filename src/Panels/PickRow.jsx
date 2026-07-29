import { managerLabel, pickAccessibleName, pickNumberLabel } from './pickLabels.js';
import { pickKey } from '../lib/seenPicks.js';
import ListRow from '../Components/ListRow';
import PositionTag from '../Components/PositionTag';

const PickRow = ({ round, pick, playerInfo, rosterData, myDisplayName, onSelect, newPickKeys = new Set() }) => {
    // The player database is a snapshot and a drafted player can be absent
    // from it. Render the id itself rather than a blank cell - that is what
    // makes the gap diagnosable, and it matches warnAboutMissingRosterPlayers,
    // which logs the same situation on the roster side. Unlike the old
    // DraftRound, there is no width-hidden class in this rebuild for the
    // fallback to accidentally land inside.
    const player = pick.player_id ? playerInfo[pick.player_id] : null;
    const owner = pick.owner_id ? rosterData.find((roster) => roster.roster_id === pick.owner_id) : null;
    const isMine = Boolean(owner?.manager_display_name) && owner.manager_display_name === myDisplayName;
    const manager = managerLabel({ pick, rosterData, myDisplayName });
    const pickNumber = pickNumberLabel(round, pick);
    const isNew = newPickKeys.has(pickKey(round, pick));
    const accessibleName = pickAccessibleName({ round, pick, player, manager, isNew });

    // The visible attribution drops the "· you" the accessible name keeps: on
    // screen the row already says it twice, with the violet tint and the YOU
    // flag, and "WR · ATL · ryangh · you" would be a third.
    const visibleManager = managerLabel({ pick, rosterData, myDisplayName, markYours: false });

    // Manager used to sit above the player name to stop a long attribution
    // ("CHood20 via kpresley") from truncating the name. It moves into the
    // mono meta line instead - the meta line already truncates independently
    // of the name, which is the actual fix for the same problem.
    const meta = player ? [player.position, player.team, visibleManager].filter(Boolean).join(' · ') : visibleManager;

    // One flag slot, and a pick can be both yours and unseen. NEW wins:
    // ownership is already carried by the row's violet tint, so spending the
    // flag on YOU would say that twice and leave "new" - which nothing else on
    // the row encodes, and which stops being true on the next visit - unsaid.
    let flag;
    if (isNew) {
        flag = { text: 'NEW', tone: 'live' };
    } else if (isMine) {
        flag = { text: 'YOU', tone: 'mine' };
    }

    return (
        <li>
            <ListRow
                label={accessibleName}
                onClick={() => onSelect(pick)}
                ordinal={pickNumber}
                ordinalWidth="34px"
                name={
                    pick.player_id ? (player ? player.full_name : `Unknown player ${pick.player_id}`) : visibleManager
                }
                flag={flag}
                meta={pick.player_id ? meta : undefined}
                tone={isMine ? 'mine' : undefined}
                trailing={player && <PositionTag position={player.position} />}
            />
        </li>
    );
};

export default PickRow;
