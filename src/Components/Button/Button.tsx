import React from 'react';
import './Button.css';
import classNames from 'classnames';

interface Props {
    text: string;
    onClick: React.MouseEventHandler<HTMLButtonElement> | undefined;
    btnStyle: string;
    isDisabled: boolean;
}

export const Button = ({ text, onClick, btnStyle = 'primary', isDisabled = false }: Props): JSX.Element => {
    const btnClass = classNames(btnStyle, {
        disabled: isDisabled,
    });
    return (
        <button className={btnClass} onClick={onClick} disabled={isDisabled}>
            {text}
        </button>
    );
};
