import AccountMenu from './AccountMenu';

// The top bar, plus the player-database timestamp that sits under it.
// Rendered by App above AppShell, not inside it: AppShell only renders once
// league data exists, and this has to stay on screen during loading and when
// the error banner has replaced everything else.
const AppBar = ({ signedIn, signedInEmail, lastUpdate, onSignIn, onSignOut }) => {
    return (
        <>
            <div className="flex flex-row items-center justify-between px-[3px] py-0">
                <h1 className="text-ink m-0 mb-1.5 ml-[3px] text-lg">Sleeper Team Assistant</h1>
                <AccountMenu
                    signedIn={signedIn}
                    signedInEmail={signedInEmail}
                    onSignIn={onSignIn}
                    onSignOut={onSignOut}
                />
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
                <p className="text-ink-muted m-0 mr-2 ml-[3px] text-xs">
                    <i>Latest player DB update attempt: {new Date(lastUpdate).toString()}</i>
                </p>
            ) : null}
        </>
    );
};

export default AppBar;
