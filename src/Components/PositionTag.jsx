import { positionClass } from '../Panels/pickLabels.js';

// The shared position badge: a tint plus a light ink, never a solid fill.
// `positionClass` already resolves the tint/ink pair (and the K/DEF neutral
// fallback) - this component is only the markup six call sites used to
// duplicate.
const PositionTag = ({ position }) => (
    <span
        className={`rounded-tag shrink-0 px-[7px] py-1 font-mono text-[10px] font-semibold tracking-[.08em] ${positionClass(position)}`}
    >
        {position}
    </span>
);

export default PositionTag;
