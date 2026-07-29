import React from 'react';
import classNames from 'classnames';

interface Props {
    text: string;
    onClick: React.MouseEventHandler<HTMLButtonElement> | undefined;
    btnStyle: string;
    isDisabled: boolean;
}

// Shape and type are shared by every variant: rounded-full, 13px/600,
// px-3.5 py-2. No margins here at all - call sites space buttons with the
// flex/gap they already have, same as every other converted component.
// No `scale()` hover anywhere in this file (a hard rule) - a fill button
// shifts its own background on hover, an outlined one shifts border/text.
const BASE = 'min-w-max rounded-full px-3.5 py-2 text-[13px] font-semibold transition-colors disabled:opacity-50';

// One entry per value `btnStyle` is called with at a call site today. Keyed
// by the exact string (or, for the "variant plus modifier" form, by each
// space-separated token individually - see btnClass below) so a lookup miss
// is a real bug rather than a silently-unstyled button.
//
// `alert` now fills with `bg-danger`, not the `qb` token: the old version
// reused #ff2a6d, the QB position colour (see theme.css), as a destructive-
// action signal - the design system calls that collision out by name and
// asks for `--raw-danger` instead. `text-ground` on the danger fill measures
// 6.47:1 (danger #ff5f56 against ground #0a0e14's near-black ink token) -
// comfortably past AA, same reasoning the old QB fill used.
//
// `active` is the outlined/"engaged" shape (border-line, text-ink-muted,
// transparent) - used standalone (OnFocusButton's Save) and stacked onto
// `primary-large` for the live-sync toggle's "on" state, where the filled
// primary button ("Sync draft") becomes outlined ("Stop sync") once syncing
// starts. Its three overrides carry `!`: Tailwind orders utilities by group
// rather than by class-string order, so `primary-large`'s `bg-mine`/
// `text-ground` would otherwise silently win over `active`'s
// `bg-transparent`/`text-ink-muted` regardless of which token reads later in
// the merged className. Verified against the running app: without `!` here,
// "Stop sync" rendered filled violet instead of outlined. Same fix already
// established for the disabled state below.
//
// `player-add-button` and `primary-invert` are gone - PlayerInfoItem, their
// only caller, was converted off Button entirely in an earlier step, so
// nothing in the app calls either any more.
const VARIANTS: Record<string, string> = {
    primary: 'bg-mine text-ground hover:bg-mine/90',
    'primary-large': 'bg-mine text-ground hover:bg-mine/90 w-full text-center',
    alert: 'bg-danger text-ground hover:bg-danger/90',
    active: 'border border-line! text-ink-muted! bg-transparent! hover:text-ink! hover:border-ink-muted!',
};

export const Button = ({ text, onClick, btnStyle = 'primary', isDisabled = false }: Props): React.JSX.Element => {
    const variantClasses = btnStyle.split(' ').map((token) => VARIANTS[token]);
    const btnClass = classNames(BASE, ...variantClasses);
    return (
        <button className={btnClass} onClick={onClick} disabled={isDisabled}>
            {text}
        </button>
    );
};
