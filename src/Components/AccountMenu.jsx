import Button from './Button';

// The signed-in/signed-out identity controls. Sign-in and sign-out are
// reported to the caller through props rather than performed here, matching
// Header before it: this stays renderable in isolation, with no reach into
// auth or state.
const AccountMenu = ({ signedIn, signedInEmail, onSignIn, onSignOut }) => {
    return (
        <div className="flex flex-row items-baseline gap-2">
            {/*
                Placeholder for a future "switch Sleeper user" control. The app
                is hardcoded to one Sleeper user id (SLEEPER_USER_ID) today;
                when that becomes configurable, its picker goes here, beside
                the Google account identity below.
            */}
            {signedIn ? (
                <>
                    <p className="text-ink-muted m-0 text-xs">
                        <i>{signedInEmail}</i>
                    </p>
                    <Button text="Sign out" onClick={onSignOut} btnStyle="primary" />
                </>
            ) : (
                <Button text="Sign in" onClick={onSignIn} btnStyle="primary" />
            )}
        </div>
    );
};

export default AccountMenu;
