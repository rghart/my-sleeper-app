import { useState } from 'react';

const fieldClass = 'border-line bg-raised-2 text-ink caret-ink-muted rounded-row w-full border p-3 text-[14px]';
const primaryPill = 'bg-mine text-ground min-h-11 rounded-full px-3.5 text-[13px] font-semibold disabled:opacity-50';

// What the app shows before it is pointed at a Sleeper account - the state it
// could never be in while the account was a hardcoded constant.
//
// It asks for a username rather than an id because that is the only thing
// anyone knows about their own Sleeper account; the id it resolves to is an
// implementation detail the user never sees. No password and no OAuth is not
// an omission: Sleeper has no auth API at all, so this is a public lookup of
// public league data, and the copy says so rather than implying a login.
//
// Once signed in, the footer below has to keep saying something and say the
// right thing. Signing in here looks like it should produce an account and
// does not - there is nothing saved for a first-time user to load - and an
// unexplained "still asking me for my username" reads as broken rather than as
// first use. The third case is the one worth catching: if the saved copy could
// not be read at all, this screen is not evidence of anything, and connecting
// will not roam either.
//
// The three outcomes of that lookup are deliberately distinct. A name nobody
// owns is the expected result of a typo and gets a "check the spelling"
// message with no retry button, because retrying fails identically. A failed
// request is the one worth retrying. A hit connects immediately.
const ConnectSleeper = ({ onConnect, resolveUsername, signedIn, signedInEmail, syncFailed, onSignIn }) => {
    const [username, setUsername] = useState('');
    const [status, setStatus] = useState(null);
    const [busy, setBusy] = useState(false);

    const trimmed = username.trim();

    const submit = async (event) => {
        event.preventDefault();
        if (!trimmed || busy) {
            return;
        }
        setBusy(true);
        setStatus(null);
        const account = await resolveUsername(trimmed);
        setBusy(false);

        if (account === undefined) {
            setStatus({ kind: 'error', message: "Couldn't reach Sleeper. Check your connection and try again." });
            return;
        }
        if (account === null) {
            setStatus({ kind: 'notFound', message: `No Sleeper account named “${trimmed}”. Check the spelling.` });
            return;
        }
        onConnect(account);
    };

    return (
        <div className="mx-auto flex w-full max-w-[420px] flex-col gap-5 p-3.5 md:p-4">
            <div className="bg-raised border-line rounded-card flex flex-col gap-4 border p-[18px]">
                <div className="flex flex-col gap-1.5">
                    <h1 className="text-ink m-0 text-[19px] font-bold tracking-[-0.02em]">Connect your Sleeper</h1>
                    <p className="text-ink-muted m-0 text-[13px]">
                        Enter your Sleeper username to load your leagues, rosters and drafts.
                    </p>
                </div>

                <form onSubmit={submit} className="flex flex-col gap-2">
                    <label
                        htmlFor="sleeper-username"
                        className="text-ink-dim m-0 font-mono text-[11px] tracking-[.08em]"
                    >
                        SLEEPER USERNAME
                    </label>
                    <input
                        id="sleeper-username"
                        type="text"
                        autoComplete="username"
                        autoCapitalize="none"
                        autoCorrect="off"
                        spellCheck="false"
                        placeholder="yourname"
                        className={fieldClass}
                        value={username}
                        onChange={(event) => setUsername(event.target.value)}
                        aria-describedby={status ? 'sleeper-username-status' : undefined}
                        aria-invalid={status ? true : undefined}
                    />
                    <button type="submit" disabled={!trimmed || busy} className={primaryPill}>
                        {busy ? 'Looking up…' : 'Connect'}
                    </button>
                </form>

                {status ? (
                    <p
                        id="sleeper-username-status"
                        role="alert"
                        className={`m-0 text-[12px] ${status.kind === 'error' ? 'text-danger' : 'text-ink-muted'}`}
                    >
                        {status.message}
                    </p>
                ) : null}

                <p className="text-ink-quiet m-0 font-mono text-[10px]">
                    This is a public lookup of your Sleeper leagues. No password, and nothing is posted to Sleeper.
                </p>
            </div>

            {/* Sign-in is genuinely optional, so it is offered here rather than
                gating the form above. The only thing it buys is named on the
                line: saved rank lists, and the account following you between
                devices. */}
            {!signedIn ? (
                <p className="text-ink-quiet m-0 px-1 text-[12px]">
                    <button type="button" onClick={onSignIn} className="text-ink font-medium underline">
                        Sign in with Google
                    </button>{' '}
                    to save rank lists and keep this account across devices.
                </p>
            ) : syncFailed ? (
                <p role="status" className="text-danger m-0 px-1 text-[12px]">
                    Signed in{signedInEmail ? ` as ${signedInEmail}` : ''}, but your saved Sleeper account couldn’t be
                    read. Connecting still works on this device — it just won’t follow you to others.
                </p>
            ) : (
                <p className="text-ink-quiet m-0 px-1 text-[12px]">
                    Signed in{signedInEmail ? ` as ${signedInEmail}` : ''}. No Sleeper account saved yet — connect one
                    and it’ll follow you to your other devices.
                </p>
            )}
        </div>
    );
};

export default ConnectSleeper;
