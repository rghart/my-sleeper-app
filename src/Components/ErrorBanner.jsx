import Button from './Button';

// Two modes, chosen by `variant`:
// - 'error' (default): shown in place of the panels when there is no league
//   data to render them from. Deliberately blocking rather than a dismissible
//   toast - both panels read league data unconditionally, so there is nothing
//   useful behind it. Uses role="alert" so it interrupts a screen reader.
// - 'warning': a non-blocking notice rendered alongside the panels, for a
//   partial failure the app can still render around. Uses role="status" so
//   it does not interrupt.
// Both modes require an `onRetry`. An optional one was written first and then
// removed: both call sites pass a handler, so the "no button" branch was
// unreachable, and a sabotage that made the button unconditional passed the
// whole suite. Untested speculative generality is worse than the one-line
// change it would save if a retryless notice ever turns up.
// First component converted onto Tailwind. The 10px radius, 15px padding and 3px
// margins are legacy geometry carried over verbatim to keep this change
// invisible; they become scale values when the shell is rebuilt.
//
// The border style is set on the left edge specifically, not with `border-solid`.
// Preflight is not loaded, so there is no global `border-style: none` for the
// other three edges to fall back to: `border-solid` gave them the browser's
// default medium width and made the banner 3px taller.
const BANNER =
    'mx-[3px] mt-2 mb-[3px] flex flex-row flex-wrap items-center justify-between gap-3 rounded-[10px] border-l-4 [border-left-style:solid] bg-raised px-[15px] py-3';

const ErrorBanner = ({ message, onRetry, variant = 'error' }) => {
    const className = `${BANNER} ${variant === 'warning' ? 'border-l-warn' : 'border-l-danger'}`;
    const role = variant === 'warning' ? 'status' : 'alert';
    return (
        <div className={className} role={role}>
            <p className="m-0">{message}</p>
            <Button text="Retry" btnStyle="primary" onClick={onRetry} />
        </div>
    );
};

export default ErrorBanner;
