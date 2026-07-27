import React from 'react';
import classNames from 'classnames';

interface Props {
    text: string;
    onClick: React.MouseEventHandler<HTMLButtonElement> | undefined;
    btnStyle: string;
    isDisabled: boolean;
}

// Preflight is not loaded, so a bare <button> keeps the UA's own appearance,
// border and rounded corners unless it is told otherwise here. The disabled
// overrides carry `!` (Tailwind's important modifier) because the original
// CSS used `!important` for the same reason: :disabled has to beat the
// hover rules below it regardless of which one the cascade would otherwise
// prefer.
const BASE =
    'appearance-none bg-transparent text-ink border border-solid border-ink-muted rounded-[5px] min-w-max mb-[7px] hover:scale-[1.02] motion-reduce:hover:transform-none disabled:scale-100! disabled:border-line! disabled:text-line!';

// One entry per value `btnStyle` is called with at a call site today. Keyed
// by the exact string (or, for the "variant plus modifier" form, by each
// space-separated token individually - see btnClass below) so a lookup miss
// is a real bug rather than a silently-unstyled button.
//
// `alert` fills with the `qb` token, not a `danger` token: #ff2a6d is the QB
// position colour (see theme.css), reused here as a destructive-action
// signal. That collision predates this change and is left alone - flagged in
// the PR, not fixed here.
//
// A handful of these carry `!`. Tailwind utilities aren't ordered by where
// they appear in the class string - the generated stylesheet orders them by
// utility group - so `bg-transparent` from BASE compiles *after* `bg-line`
// and silently wins even though `bg-line` reads later in the className.
// Verified against the running app: without `!` here, "Sync draft"'s active
// state and the alert/invert buttons rendered with BASE's colours instead of
// their own. `!` is the same fix already used below for the disabled state.
const VARIANTS: Record<string, string> = {
    primary: 'hover:text-ink hover:border-ink-muted',
    'primary-large': 'w-4/5 text-center mt-2 mb-[15px] text-base h-[30px] hover:text-ink hover:border-ink-muted',
    alert: 'bg-qb! border-qb! hover:scale-[1.05]!',
    active: 'bg-line! border-ink-muted overflow-hidden hover:text-ink',
    'primary-invert': 'text-ground! border-ground! hover:text-line hover:border-line',
    'player-add-button':
        'text-ground! border-ground! hover:text-line hover:border-line self-center justify-self-end text-center w-[45px] mt-2 mb-0! ml-[3px]',
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
