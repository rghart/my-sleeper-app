import Button from './Button';

// Purely presentational: the whole top bar, plus the player-database
// timestamp that sits under it. Nothing here reaches for auth or state - the
// sign-in and sign-out handlers arrive as props so this stays renderable in
// isolation.
const Header = ({ signedIn, signedInEmail, lastUpdate, onSignIn, onSignOut }) => {
    return (
        <>
            <div
                style={{
                    display: 'flex',
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    padding: `${0}px ${3}px`,
                }}
            >
                <h1 className="title">Sleeper Team Assistant</h1>
                {signedIn ? (
                    <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'baseline' }}>
                        <p className="latest-update">
                            <i>{signedInEmail}</i>
                        </p>
                        <Button text="Sign out" onClick={onSignOut} btnStyle="primary" />
                    </div>
                ) : (
                    <Button text="Sign in" onClick={onSignIn} btnStyle="primary" />
                )}
            </div>
            {/*
                Rendered only once there is a timestamp. `lastUpdate` starts as
                null and the request for it is deliberately not awaited, so
                this used to spend the first moments of every load showing
                `new Date(null).toString()` - "Wed Dec 31 1969". It also stays
                hidden if that request fails, which is honest: an absent line
                beats a confidently wrong date.
            */}
            {lastUpdate ? (
                <p className="latest-update">
                    <i>Latest player DB update attempt: {new Date(lastUpdate).toString()}</i>
                </p>
            ) : null}
        </>
    );
};

export default Header;
