import React, { useState } from 'react';
import Button from './Button';

const OnFocusButton = ({ event, ...rest }) => {
    const [isFocused, setIsFocused] = useState(false);

    return (
        <>
            {!isFocused && <Button text="Edit" onClick={() => setIsFocused(true)} btnStyle="primary" />}
            {isFocused && (
                <div>
                    <Button text="Delete" onClick={event} btnStyle="alert" />
                    <Button
                        text="Save"
                        onClick={() => {
                            rest.saveRankList();
                            setIsFocused(false);
                        }}
                        btnStyle="active"
                    />
                    <Button text="Cancel" onClick={() => setIsFocused(false)} btnStyle="primary" />
                </div>
            )}
        </>
    );
};

export default OnFocusButton;
