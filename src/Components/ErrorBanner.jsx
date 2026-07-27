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
const ErrorBanner = ({ message, onRetry, variant = 'error' }) => {
    const className = variant === 'warning' ? 'warning-banner' : 'error-banner';
    const role = variant === 'warning' ? 'status' : 'alert';
    return (
        <div className={className} role={role}>
            <p>{message}</p>
            <Button text="Retry" btnStyle="primary" onClick={onRetry} />
        </div>
    );
};

export default ErrorBanner;
