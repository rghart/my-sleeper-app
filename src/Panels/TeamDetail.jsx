import { TierChip, tierLabel } from '../Components/TierIcon';
import { avatarInitials } from '../Components/avatarInitials.js';
import { futureFacts, groupStrength, pickLabel, tierAgreement } from '../lib/teamComparison.js';

// One team, and how it compares with yours: the drill-down behind a row in
// Power rankings. Pushed in place with a back control, the same idiom
// Leaguemates uses for a profile, rather than a sheet - it is a page of
// reading, not a quick choice.
//
// Every number here is one the list already implies (ranks, tiers, the same
// lineups and Future detail), laid out so a tier can be argued with.

const ordinal = (n) => {
    const tail = n % 100 >= 11 && n % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] ?? 'th');
    return `${n}${tail}`;
};

const signed = (z) => {
    const rounded = Math.round(z * 10) / 10;
    if (rounded === 0) return '0.0';
    return `${rounded > 0 ? '+' : '−'}${Math.abs(rounded).toFixed(1)}`;
};

// A bar for a z-score: -2 is a sliver, +2 is full width, average is half.
const barWidth = (z) => `${Math.max(4, Math.min(100, ((Math.max(-2, Math.min(2, z)) + 2) / 4) * 100))}%`;

const StatCard = ({ label, value, sub }) => (
    <div className="bg-raised rounded-row flex flex-col gap-0.5 p-3">
        <p className="text-ink-dim m-0 font-mono text-[10px] font-semibold tracking-[.1em]">{label}</p>
        <p className="text-ink m-0 text-xl font-bold">{value}</p>
        {sub && <p className="text-ink-quiet m-0 text-xs">{sub}</p>}
    </div>
);

const TeamDetail = ({ team, you, teams, source, rosters, playerInfo, nowRanks, futureRanks, onBack, onOpenTrades }) => {
    const isYou = you && you.rosterId === team.rosterId;
    const other = isYou ? null : you;

    const strength = groupStrength(teams, source);
    const theirGroups = strength.get(team.rosterId) ?? {};
    const yourGroups = other ? (strength.get(other.rosterId) ?? {}) : null;

    const rosterOf = (t) => rosters.find((roster) => roster.roster_id === t.rosterId);
    const theirFacts = futureFacts({ team, roster: rosterOf(team), playerInfo });
    const yourFacts = other ? futureFacts({ team: other, roster: rosterOf(other), playerInfo }) : null;

    const tier = team.tiers[source];
    const agreement = tierAgreement(team);
    const nowRank = nowRanks.get(team.rosterId);
    const futureRank = futureRanks.get(team.rosterId);

    const facts = [
        { label: 'Draft picks', them: theirFacts.picks, you: yourFacts?.picks },
        {
            label: 'Pick value (KTC)',
            them: Math.round(theirFacts.pickValue).toLocaleString(),
            you: yourFacts && Math.round(yourFacts.pickValue).toLocaleString(),
        },
        { label: 'Players 24 and under', them: theirFacts.young, you: yourFacts?.young },
        {
            label: 'Avg starter age',
            them: theirFacts.starterAge?.toFixed(1) ?? '—',
            you: yourFacts && (yourFacts.starterAge?.toFixed(1) ?? '—'),
        },
    ];

    // By season and round; within one, the team's own pick first, then the
    // ones it bought in the order of the team they came from.
    const own = (pick) => (pick.originalRosterId === team.rosterId ? 0 : 1);
    const picks = [...team.futureDetail.picks].sort(
        (a, b) =>
            a.season - b.season || a.round - b.round || own(a) - own(b) || a.originalRosterId - b.originalRosterId,
    );

    return (
        <div className="flex flex-col gap-5 px-4 pt-2 pb-6">
            <button
                type="button"
                onClick={onBack}
                className="text-ink-muted -ml-1 flex min-h-11 items-center gap-1 self-start text-sm font-semibold"
            >
                <span aria-hidden="true">‹</span> Power rankings
            </button>

            <div className="flex flex-col gap-2">
                <div className="flex items-center gap-3">
                    <span className="bg-raised-2 border-line text-ink-muted flex h-11 w-11 shrink-0 items-center justify-center rounded-full border font-mono text-[13px] font-semibold">
                        {avatarInitials(team.name)}
                    </span>
                    <div className="flex min-w-0 flex-col items-start gap-1">
                        <h2 className="text-ink m-0 truncate text-[22px] font-bold tracking-[-.02em]">
                            {team.name}
                            {isYou && <span className="text-mine"> · you</span>}
                        </h2>
                        <TierChip tier={tier} />
                    </div>
                </div>
                <p className="text-ink-muted m-0 text-sm leading-relaxed">
                    {ordinal(nowRank)} for Now and {ordinal(futureRank)} for Future
                    {other &&
                        ` — you're ${ordinal(nowRanks.get(other.rosterId))} and ${ordinal(futureRanks.get(other.rosterId))}`}
                    . Holds {theirFacts.picks} picks worth {Math.round(theirFacts.pickValue).toLocaleString()} on KTC.
                </p>
            </div>

            <div className="grid grid-cols-3 gap-2">
                <StatCard
                    label="NOW"
                    value={ordinal(nowRank)}
                    sub={other ? `You ${ordinal(nowRanks.get(other.rosterId))}` : null}
                />
                <StatCard
                    label="FUTURE"
                    value={ordinal(futureRank)}
                    sub={other ? `You ${ordinal(futureRanks.get(other.rosterId))}` : null}
                />
                <StatCard
                    label="SOURCES"
                    value={`${agreement.agree} of ${agreement.of}`}
                    sub={`agree on ${tierLabel(team.tiers.blend)}`}
                />
            </div>

            <section className="flex flex-col gap-2.5" aria-labelledby="starters-heading">
                <div className="flex items-center gap-3">
                    <h3 id="starters-heading" className="text-ink m-0 flex-1 text-[15px] font-bold">
                        {other ? 'Starters vs you' : 'Starters'}
                    </h3>
                    {other && (
                        <>
                            <span className="text-ink-quiet flex items-center gap-1.5 text-xs">
                                <span className="bg-ink-muted h-2.5 w-2.5 rounded-sm" />
                                {team.name}
                            </span>
                            <span className="text-ink-quiet flex items-center gap-1.5 text-xs">
                                <span className="bg-mine h-2.5 w-2.5 rounded-sm" />
                                You
                            </span>
                        </>
                    )}
                </div>
                {Object.keys(theirGroups).map((group) => (
                    <div
                        key={group}
                        role="group"
                        aria-label={`${group}: ${team.name} ${signed(theirGroups[group])}${
                            yourGroups ? `, you ${signed(yourGroups[group])}` : ''
                        }`}
                        className="grid grid-cols-[44px_1fr_44px] items-center gap-x-2.5 gap-y-1"
                    >
                        <span className="text-ink-quiet row-span-2 font-mono text-[11px] font-semibold">{group}</span>
                        <span
                            className="bg-ink-muted h-2.5 rounded-r"
                            style={{ width: barWidth(theirGroups[group]) }}
                        />
                        <span className="text-ink-muted text-right font-mono text-[11px] tabular-nums">
                            {signed(theirGroups[group])}
                        </span>
                        {yourGroups && (
                            <>
                                <span
                                    className="bg-mine h-2.5 rounded-r"
                                    style={{ width: barWidth(yourGroups[group]) }}
                                />
                                <span className="text-ink-muted text-right font-mono text-[11px] tabular-nums">
                                    {signed(yourGroups[group])}
                                </span>
                            </>
                        )}
                    </div>
                ))}
                <p className="text-ink-quiet m-0 text-xs">Starter strength by position, league average = 0.</p>
            </section>

            <section className="flex flex-col" aria-labelledby="future-heading">
                <h3 id="future-heading" className="text-ink m-0 pb-1.5 text-[15px] font-bold">
                    {other ? 'Future vs you' : 'Future'}
                </h3>
                <table className="w-full border-collapse text-sm">
                    <thead>
                        <tr className="text-ink-dim font-mono text-[10px] font-semibold tracking-[.1em]">
                            <th className="py-1 text-left font-semibold">
                                <span className="sr-only">Measure</span>
                            </th>
                            <th className="w-20 py-1 text-right font-semibold">{other ? 'THEM' : ''}</th>
                            {other && <th className="w-20 py-1 text-right font-semibold">YOU</th>}
                        </tr>
                    </thead>
                    <tbody>
                        {facts.map((fact) => (
                            <tr key={fact.label} className="border-line-quiet border-b last:border-0">
                                <td className="text-ink-muted py-2.5">{fact.label}</td>
                                <td className="text-ink py-2.5 text-right font-mono font-semibold tabular-nums">
                                    {fact.them}
                                </td>
                                {other && (
                                    <td className="text-mine py-2.5 text-right font-mono font-semibold tabular-nums">
                                        {fact.you}
                                    </td>
                                )}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </section>

            {picks.length > 0 && (
                <section className="flex flex-col" aria-labelledby="picks-heading">
                    <h3 id="picks-heading" className="text-ink m-0 pb-1.5 text-[15px] font-bold">
                        {isYou ? 'Your picks' : 'Their picks'}
                    </h3>
                    <ul className="m-0 flex list-none flex-col p-0">
                        {picks.map((pick) => (
                            <li
                                key={`${pick.season}-${pick.round}-${pick.originalRosterId}`}
                                className="border-line-quiet flex min-h-10 items-center gap-3 border-b text-sm last:border-0"
                            >
                                <span className="text-ink flex-1">
                                    {pickLabel(pick)}
                                    {pick.originalRosterId !== team.rosterId && (
                                        <span className="text-ink-quiet">
                                            {' '}
                                            · via{' '}
                                            {teams.find((t) => t.rosterId === pick.originalRosterId)?.name ??
                                                'another team'}
                                        </span>
                                    )}
                                </span>
                                <span className="text-ink-muted font-mono text-xs tabular-nums">
                                    {Math.round(pick.value).toLocaleString()}
                                </span>
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            {!isYou && (
                <button
                    type="button"
                    onClick={onOpenTrades}
                    className="border-line text-ink min-h-11 rounded-full border text-sm font-semibold"
                >
                    Look for trades
                </button>
            )}
        </div>
    );
};

export default TeamDetail;
