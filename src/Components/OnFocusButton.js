import React, { useState } from 'react';

const OnFocusButton = ({ copy, event }) => {
    const [isFocused, setIsFocused] = useState(false);

    return (
        <>
            { !isFocused &&
                <button 
                    className={`sign-in-button button`}
                    onClick={() => setIsFocused(true)}
                >
                    Edit
                </button>
            }
            { isFocused &&
                <div>
                    <button 
                        className={`delete-button button`}
                        onClick={event}
                    >
                        Delete?
                    </button>
                    <button 
                        className={`sign-in-button button`}
                        onClick={() => setIsFocused(false)}
                    >
                        Cancel
                    </button>
                </div>
            }
        </>  
    );
}

export default OnFocusButton;
