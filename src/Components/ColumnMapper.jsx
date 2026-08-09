// Confirming which column is which, for a list that arrived as a table.
//
// The guess from `detectColumns` is a default and never more than that: it is
// read off a header row when there is one and off the shape of the data when
// there is not, and being wrong here mislabels the entire list rather than one
// line. So the mapping is shown, with real cells under it, before anything is
// matched.
//
// Only the fields the matcher uses appear. A `rank` column is detected so it
// can be left out of the name guess, but it is not offered: rank is the row's
// position in the list on screen, and a file that numbers itself oddly must
// not renumber what the user sees.

const FIELDS = [
    { key: 'name', label: 'Name' },
    { key: 'team', label: 'Team' },
    { key: 'position', label: 'Position' },
];

const SPLIT_FIELDS = [
    { key: 'first', label: 'First name' },
    { key: 'last', label: 'Last name' },
    { key: 'team', label: 'Team' },
    { key: 'position', label: 'Position' },
];

const selectClass =
    'border-line bg-raised-2 text-ink rounded-row min-h-11 w-full border px-2 text-[13px] disabled:opacity-50';

/** A column's index shown as something a person can point at in the preview. */
const columnLabel = (index, header) => {
    const name = header?.[index]?.trim();
    return name ? `${index + 1} · ${name}` : `Column ${index + 1}`;
};

const ColumnMapper = ({ rows, mapping, onChange }) => {
    const width = rows.reduce((max, row) => Math.max(max, row.length), 0);
    const header = mapping.hasHeader ? rows[0] : null;
    const body = (mapping.hasHeader ? rows.slice(1) : rows).slice(0, 3);

    // A list written as separate first/last columns needs two name selects
    // rather than one, and the shape it arrived in decides which.
    const split = mapping.name === null && (mapping.first !== null || mapping.last !== null);
    const fields = split ? SPLIT_FIELDS : FIELDS;

    const set = (key, value) => onChange({ ...mapping, [key]: value });

    return (
        <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-2">
                {fields.map(({ key, label }) => (
                    <label key={key} className="flex items-center gap-2">
                        <span className="text-ink-dim w-24 shrink-0 font-mono text-[11px] tracking-[.08em]">
                            {label.toUpperCase()}
                        </span>
                        <select
                            className={selectClass}
                            value={mapping[key] === null || mapping[key] === undefined ? '' : String(mapping[key])}
                            onChange={(event) =>
                                set(key, event.target.value === '' ? null : Number(event.target.value))
                            }
                        >
                            {/* Team and position are genuinely optional - a
                                list of names alone is a normal thing to paste.
                                A name is not, so it has no empty option. */}
                            {key !== 'name' && key !== 'first' && <option value="">Not in this list</option>}
                            {Array.from({ length: width }, (_, index) => (
                                <option key={index} value={String(index)}>
                                    {columnLabel(index, header)}
                                </option>
                            ))}
                        </select>
                    </label>
                ))}
            </div>

            {/* Three rows, because the mapping is only checkable against the
                data it applies to - a column of team codes and a column of
                three-letter nicknames look identical in a dropdown. */}
            <div className="border-line rounded-row overflow-x-auto border">
                <table className="w-full border-collapse text-[12px]">
                    <thead>
                        <tr>
                            {Array.from({ length: width }, (_, index) => {
                                const role = fields.find(({ key }) => mapping[key] === index);
                                return (
                                    <th
                                        key={index}
                                        scope="col"
                                        className={`border-line truncate border-b px-2 py-1.5 text-left font-mono text-[10px] tracking-[.08em] whitespace-nowrap ${
                                            role ? 'text-mine' : 'text-ink-quiet'
                                        }`}
                                    >
                                        {role ? role.label.toUpperCase() : columnLabel(index, header).toUpperCase()}
                                    </th>
                                );
                            })}
                        </tr>
                    </thead>
                    <tbody>
                        {body.map((row, rowIndex) => (
                            <tr key={rowIndex}>
                                {Array.from({ length: width }, (_, index) => (
                                    <td
                                        key={index}
                                        className={`truncate px-2 py-1 whitespace-nowrap ${
                                            fields.some(({ key }) => mapping[key] === index)
                                                ? 'text-ink'
                                                : 'text-ink-quiet'
                                        }`}
                                    >
                                        {row[index] ?? ''}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <label className="text-ink-muted flex items-center gap-2 text-[13px]">
                <input
                    type="checkbox"
                    checked={mapping.hasHeader}
                    onChange={(event) => onChange({ ...mapping, hasHeader: event.target.checked })}
                />
                First row is column headings
            </label>
        </div>
    );
};

export default ColumnMapper;
